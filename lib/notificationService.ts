'use client';

import { db, auth } from './firebase';
import { VAPID_PUBLIC_KEY } from './vapidConfig';
import { 
  collection, 
  addDoc, 
  doc, 
  updateDoc, 
  setDoc,
  serverTimestamp, 
  query, 
  orderBy, 
  limit, 
  onSnapshot,
  getDocs 
} from 'firebase/firestore';

export interface NotificationPreferences {
  cancelledReservations: boolean;
  newCashflowIncome: boolean;
  newCashflowExpense: boolean;
  newDamage: boolean;
  newViolation: boolean;
  documentExpiry: boolean;
}

export const DEFAULT_PREFERENCES: NotificationPreferences = {
  cancelledReservations: false,
  newCashflowIncome: false,
  newCashflowExpense: false,
  newDamage: false,
  newViolation: false,
  documentExpiry: false,
};

export type NotificationType = 
  | 'CANCELLED_RESERVATION'
  | 'CASHFLOW_INCOME'
  | 'CASHFLOW_EXPENSE'
  | 'NEW_DAMAGE'
  | 'NEW_VIOLATION'
  | 'DOCUMENT_EXPIRY';

export interface AppNotificationEvent {
  id?: string;
  type: NotificationType;
  title: string;
  body: string;
  color?: string; // 'green' | 'red' | 'orange' | 'blue'
  amount?: number;
  carPlate?: string;
  carName?: string;
  clientName?: string;
  createdAt?: any;
  createdBy?: string;
}

// Device check: strictly limit sounds and mobile notifications to phones and mobile PWAs
export function isMobileOrPhoneDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.innerWidth < 768 ||
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    Boolean((window.navigator as any).standalone) ||
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches && window.innerWidth < 1024)
  );
}

// Synthesize a mobile phone ringtone and attention chime using Web Audio API (Phone apps only)
export function playNotificationRingtone(type?: NotificationType) {
  if (typeof window === 'undefined') return;
  // Strictly prevent desktop browsers from ringing or chiming
  if (!isMobileOrPhoneDevice()) return;

  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    // Trigger phone vibration if supported
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate([250, 100, 250, 100, 400]);
      } catch (e) {
        console.warn('Vibration not allowed:', e);
      }
    }

    const now = ctx.currentTime;

    // Distinct melody depending on notification type
    // Green (Income): Bright rising cheerful triad
    // Red (Expense / Cancelled): Clear distinctive double chime
    let frequencies = [587.33, 739.99, 880.0, 1174.66]; // D5, F#5, A5, D6
    if (type === 'CASHFLOW_INCOME') {
      frequencies = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 (Bright rich chord)
    } else if (type === 'CANCELLED_RESERVATION' || type === 'CASHFLOW_EXPENSE') {
      frequencies = [880.0, 783.99, 659.25, 587.33]; // Descending attention chime
    } else if (type === 'NEW_DAMAGE' || type === 'NEW_VIOLATION') {
      frequencies = [659.25, 880.0, 659.25, 880.0]; // Alternating alert chime
    }

    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.12);

      gain.gain.setValueAtTime(0, now + i * 0.12);
      gain.gain.linearRampToValueAtTime(0.4, now + i * 0.12 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.36);
    });

    // Close audio context after playback completes
    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 1500);
  } catch (err) {
    console.warn('Audio ringtone playback failed:', err);
  }
}

// Helper to convert VAPID public key string to Uint8Array for PushManager
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Register phone device for background Web Push via PushManager (iOS 16.4+ / Android)
export async function registerPushSubscription(userId?: string, preferences?: NotificationPreferences) {
  if (
    typeof window === 'undefined' || 
    !('serviceWorker' in navigator) || 
    !('PushManager' in window)
  ) {
    return null;
  }

  try {
    if (isMobileOrPhoneDevice()) {
      await navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
    }
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();

    if (!sub) {
      const convertedVapidKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey,
      });
    }

    if (sub) {
      const subJSON = sub.toJSON();
      // Generate unique document ID based on endpoint
      const endpointId = btoa(sub.endpoint).replace(/[^a-zA-Z0-9]/g, '_').slice(-40);
      const subRef = doc(db, 'push_subscriptions', endpointId);
      await setDoc(subRef, {
        endpoint: sub.endpoint,
        keys: subJSON.keys,
        userId: userId || auth.currentUser?.uid || 'anonymous',
        userEmail: auth.currentUser?.email || '',
        ...(preferences ? { notificationPreferences: preferences } : {}),
        updatedAt: Date.now(),
        device: /iPhone|iPad|iPod/.test(navigator.userAgent) ? 'iOS' : 'Android/Web',
      }, { merge: true });
      return sub;
    }
  } catch (err) {
    console.warn('PushManager subscription warning:', err);
  }
  return null;
}

// Request Native Web Push / Notification Permission
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    registerPushSubscription().catch(() => {});
    return 'granted';
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      playNotificationRingtone('CASHFLOW_INCOME');
      registerPushSubscription().catch(() => {});
    }
    return permission;
  } catch (err) {
    console.error('Error requesting notification permission:', err);
    return 'denied';
  }
}

// Display native system push notification (strictly on phones/mobile PWAs)
export function showSystemNotification(event: AppNotificationEvent) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (!isMobileOrPhoneDevice()) return;
  if (Notification.permission !== 'granted') return;

  const options: NotificationOptions = {
    body: event.body,
    icon: event.color === 'green' ? '/paidoutlay.png' : event.color === 'red' ? '/violation.png' : '/android-chrome-192x192.png',
    badge: '/favicon-32x32.png',
    tag: `momo-${event.type}-${Date.now()}`,
    vibrate: [250, 100, 250, 100, 400],
    requireInteraction: true,
  } as any;

  try {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.showNotification(event.title, options).catch((e) => console.warn('reg.showNotification failed:', e));
      }).catch((e) => {
        console.warn('Service worker not ready:', e);
      });
    } else if (typeof Notification === 'function') {
      try {
        new Notification(event.title, options);
      } catch {}
    }
  } catch (err) {
    console.warn('Failed to show notification:', err);
  }
}

// Dispatch an event to Firestore `notifications` collection AND trigger server-side background push
export async function dispatchAppNotification(event: Omit<AppNotificationEvent, 'id' | 'createdAt'>) {
  try {
    const notifsRef = collection(db, 'notifications');
    await addDoc(notifsRef, {
      ...event,
      timestamp: serverTimestamp(),
      createdAt: Date.now(),
    });

    // Trigger Server-Side Web Push to wake locked phones via Apple APNs & Google Web Push
    fetch('/api/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: event.type,
        title: event.title,
        body: event.body,
        color: event.color,
      }),
    }).catch((err) => {
      console.warn('Background push API dispatch warning:', err);
    });
  } catch (err) {
    console.error('Failed to dispatch notification to Firestore:', err);
  }
}

// Update specific user preferences in Firestore `admins/{userId}` and sync to registered push subscriptions
export async function updateTeammateNotificationPreferences(
  userId: string, 
  preferences: NotificationPreferences,
  userEmail?: string,
  displayName?: string
) {
  try {
    const userRef = doc(db, 'admins', userId);
    await setDoc(userRef, {
      notificationPreferences: preferences,
      ...(userEmail ? { email: userEmail } : {}),
      ...(displayName ? { displayName } : {}),
      updatedAt: Date.now()
    }, { merge: true });

    // Also sync the updated matrix preferences to this user's active push subscriptions
    try {
      const pushSnap = await getDocs(collection(db, 'push_subscriptions'));
      pushSnap.forEach((pDoc) => {
        const pData = pDoc.data();
        if (pData.userId === userId || (userEmail && pData.userEmail === userEmail)) {
          updateDoc(pDoc.ref, {
            notificationPreferences: preferences,
            updatedAt: Date.now()
          }).catch(() => {});
        }
      });
    } catch {}

    return true;
  } catch (err) {
    console.error('Failed to update notification preferences:', err);
    return false;
  }
}

// App Badging API for Home Screen Icon Badges (iOS 16.4+ / Android)
export function updateAppBadge(count: number) {
  if (typeof window === 'undefined') return;
  try {
    if ('setAppBadge' in navigator) {
      if (count > 0) {
        (navigator as any).setAppBadge(count).catch(() => {});
      } else {
        (navigator as any).clearAppBadge().catch(() => {});
      }
    }
  } catch (err) {
    console.warn('Failed to update app badge:', err);
  }
}

export function clearAppBadge() {
  if (typeof window === 'undefined') return;
  try {
    if ('clearAppBadge' in navigator) {
      (navigator as any).clearAppBadge().catch(() => {});
    }
  } catch (err) {
    console.warn('Failed to clear app badge:', err);
  }
}
