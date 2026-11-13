'use client';

import React, { useEffect, useState, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, limit, onSnapshot, doc } from 'firebase/firestore';
import { useAppState } from '@/lib/context';
import { 
  NotificationPreferences, 
  DEFAULT_PREFERENCES, 
  playNotificationRingtone, 
  showSystemNotification,
  requestNotificationPermission,
  registerPushSubscription,
  isMobileOrPhoneDevice,
  updateAppBadge,
  clearAppBadge,
  AppNotificationEvent
} from '@/lib/notificationService';
import { Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';

export default function NotificationWatcher({ isDarkMode = false }: { isDarkMode?: boolean }) {
  const { user } = useAppState();
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const [permissionState, setPermissionState] = useState<NotificationPermission>('default');
  const [hasPromptedPermission, setHasPromptedPermission] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const initialLoadTimeRef = useRef<number>(Date.now());

  // Check device type and notification permission on mount (mobile only)
  useEffect(() => {
    const mobile = isMobileOrPhoneDevice();
    setIsMobile(mobile);
    if (!mobile) return; // Completely skip push checks on desktop
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermissionState(Notification.permission);
      if (Notification.permission === 'granted') {
        registerPushSubscription(user?.uid, preferences).catch(() => {});
      }
    }
  }, [user, preferences]);

  // Clear Home Screen red icon badge when app is opened or focused (mobile only)
  useEffect(() => {
    if (typeof window === 'undefined' || !isMobileOrPhoneDevice()) return;
    const resetBadge = () => {
      try {
        localStorage.setItem('momo_unread_notifications', '0');
        clearAppBadge();
      } catch {}
    };
    window.addEventListener('focus', resetBadge);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        resetBadge();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('focus', resetBadge);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // Sync user's preferences from `admins/{userId}` (mobile only)
  useEffect(() => {
    if (!user || !isMobileOrPhoneDevice()) return;

    const userRef = doc(db, 'admins', user.uid);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.notificationPreferences) {
          const newPrefs = {
            ...DEFAULT_PREFERENCES,
            ...data.notificationPreferences
          };
          setPreferences(newPrefs);
          if (isMobileOrPhoneDevice() && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            registerPushSubscription(user.uid, newPrefs).catch(() => {});
          }
        }
      }
    }, (err) => {
      console.warn('Error fetching user notification preferences:', err);
    });

    return () => unsubscribe();
  }, [user]);

  // Listen to Firestore `notifications` collection (mobile only)
  useEffect(() => {
    if (!user || !isMobileOrPhoneDevice()) return;

    const q = query(
      collection(db, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data() as AppNotificationEvent;
          const createdAt = data.createdAt || 0;

          // Only alert for events created AFTER the app initialized to prevent firing on historical notifications
          if (createdAt > initialLoadTimeRef.current) {
            handleIncomingNotification(data);
          }
        }
      });
    }, (err) => {
      console.warn('Notification watcher subscription issue:', err);
    });

    return () => unsubscribe();
  }, [user, preferences]);

  const handleIncomingNotification = (event: AppNotificationEvent) => {
    // Strictly restrict notifications, ringtones, and banners to phone/mobile devices only.
    // Desktop browsers remain 100% silent and clean.
    if (!isMobileOrPhoneDevice()) {
      return;
    }

    let isSubscribed = false;

    // Check user's specific notification matrix permissions
    switch (event.type) {
      case 'CANCELLED_RESERVATION':
        isSubscribed = !!preferences.cancelledReservations;
        break;
      case 'CASHFLOW_INCOME':
        isSubscribed = !!preferences.newCashflowIncome;
        break;
      case 'CASHFLOW_EXPENSE':
        isSubscribed = !!preferences.newCashflowExpense;
        break;
      case 'NEW_DAMAGE':
        isSubscribed = !!preferences.newDamage;
        break;
      case 'NEW_VIOLATION':
        isSubscribed = !!preferences.newViolation;
        break;
      case 'DOCUMENT_EXPIRY':
        isSubscribed = !!preferences.documentExpiry;
        break;
      default:
        isSubscribed = false;
    }

    // Only ring/buzz and update badge if this user is explicitly enabled in the matrix!
    if (isSubscribed) {
      // 1. Play ringtone with distinctive chime and vibrate phone
      playNotificationRingtone(event.type);

      // 2. Update Home Screen red icon badge counter (iOS 16.4+ / Android)
      try {
        const currentUnread = (Number(localStorage.getItem('momo_unread_notifications')) || 0) + 1;
        localStorage.setItem('momo_unread_notifications', String(currentUnread));
        updateAppBadge(currentUnread);
      } catch {}
    }
  };

  const handleEnablePermissions = async () => {
    const res = await requestNotificationPermission();
    setPermissionState(res);
    setHasPromptedPermission(true);
  };

  if (!isMobile) return null;

  return (
    <>
      {/* Mobile One-Time Notification Activation Banner (strictly on phone/mobile PWA, never on PC) */}
      <AnimatePresence>
        {user && isMobile && permissionState === 'default' && !hasPromptedPermission && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[999998] w-[92vw] max-w-sm pointer-events-auto"
          >
            <div className={cn(
              "p-4 rounded-3xl border-2 shadow-2xl flex items-center justify-between gap-3",
              isDarkMode 
                ? "bg-[#1E1B1A] border-[#FF5C35]/40 text-white shadow-black/80" 
                : "bg-white border-orange-200 text-gray-900 shadow-xl shadow-orange-500/10"
            )}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#FF5C35] to-[#FF7D5E] flex items-center justify-center text-white shrink-0 shadow-lg shadow-[#FF5C35]/30">
                  <Bell className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-black uppercase tracking-tight">
                    Lock Screen Alerts
                  </h4>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold line-clamp-1">
                    Tap once to enable sound & icon badge
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleEnablePermissions}
                className="px-4 py-2.5 rounded-xl bg-[#FF5C35] hover:bg-[#FF7D5E] text-white text-xs font-black uppercase tracking-wider shrink-0 transition-transform active:scale-95 shadow-md shadow-[#FF5C35]/30 cursor-pointer"
              >
                Enable
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
