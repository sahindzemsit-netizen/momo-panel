import { NextRequest, NextResponse } from 'next/server';
import * as webpush from 'web-push';
import { initializeApp, getApps, getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } from '@/lib/vapidConfig';

// 1. Initialize Firebase Admin App cleanly
const adminApp = getApps().length === 0 
  ? initializeApp({ projectId: "momo-portal" })
  : getApp();

// 2. Connect directly to your specific database instance
const db = getFirestore(adminApp, "ai-studio-85d0332d-770c-4c04-ad43-68a8c3688e8c");

// 3. Configure VAPID Details for Web Push
webpush.setVapidDetails(
  VAPID_SUBJECT,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const { type, title, body, color } = payload;

    // 1. Fetch push subscriptions targeting your exact database
    const subsSnap = await db.collection('push_subscriptions').get();
    if (subsSnap.empty) {
      return NextResponse.json({ sent: 0, message: 'No registered push devices' });
    }

    // 2. Fetch admin preferences
    const adminsSnap = await db.collection('admins').get();
    const adminPrefsMap: Record<string, any> = {};
    adminsSnap.forEach((docSnap) => {
      adminPrefsMap[docSnap.id] = docSnap.data().notificationPreferences || {};
    });

    // 3. Dispatch notifications
    let sentCount = 0;
    const sendPromises = subsSnap.docs.map(async (docSnap) => {
      const subData = docSnap.data();
      const userId = subData.userId;

      if (userId && adminPrefsMap[userId]) {
        const prefs = adminPrefsMap[userId];
        let isSubscribed = false;
        switch (type) {
          case 'CANCELLED_RESERVATION':
            isSubscribed = !!prefs.cancelledReservations;
            break;
          case 'CASHFLOW_INCOME':
            isSubscribed = !!prefs.newCashflowIncome;
            break;
          case 'CASHFLOW_EXPENSE':
            isSubscribed = !!prefs.newCashflowExpense;
            break;
          case 'NEW_DAMAGE':
            isSubscribed = !!prefs.newDamage;
            break;
          case 'NEW_VIOLATION':
            isSubscribed = !!prefs.newViolation;
            break;
          case 'DOCUMENT_EXPIRY':
            isSubscribed = !!prefs.documentExpiry;
            break;
          default:
            isSubscribed = false;
        }

        if (!isSubscribed) return;
      }

      if (!subData.endpoint || !subData.keys) return;

      const pushSubscription = {
        endpoint: subData.endpoint,
        keys: subData.keys,
      };

      const notificationPayload = JSON.stringify({
        title: title || 'MOMO Fleet Alert',
        body: body || 'New update in your fleet',
        notification: {
          title: title || 'MOMO Fleet Alert',
          body: body || 'New update in your fleet',
          icon: color === 'green' ? '/paidoutlay.png' : color === 'red' ? '/violation.png' : '/favicon-32x32.png',
          badge: '/favicon-16x16.png',
        },
        data: {
          title: title || 'MOMO Fleet Alert',
          body: body || 'New update in your fleet',
          url: '/',
          type: type || 'ALERT',
          color: color || 'orange',
          badgeCount: 1,
        },
      });

      try {
        await webpush.sendNotification(pushSubscription, notificationPayload, {
          TTL: 60 * 60 * 24,
          urgency: 'high',
        });
        sentCount++;
      } catch (err: any) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await db.collection('push_subscriptions').doc(docSnap.id).delete().catch(() => {});
        } else {
          console.warn('Web Push send warning:', err.message || err);
        }
      }
    });

    await Promise.allSettled(sendPromises);

    return NextResponse.json({ success: true, sent: sentCount, total: subsSnap.size });
  } catch (err: any) {
    console.error('Push API dispatch error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}