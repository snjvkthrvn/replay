import prisma from './prisma';

// Firebase Admin is optional in development.
// Initialize only if service account is available.
let messaging: any = null;

try {
  const admin = require('firebase-admin');
  const fs = require('fs');
  const path = require('path');
  const serviceAccountPath = path.join(__dirname, '../../firebase-service-account.json');

  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    messaging = admin.messaging();
    console.log('Firebase initialized');
  } else {
    console.log('Firebase service account not found — push notifications disabled');
  }
} catch (err) {
  console.log('Firebase not available — push notifications disabled');
}

export async function sendPushNotification(
  userId: string,
  payload: { title: string; body: string; data?: Record<string, string> }
) {
  if (!messaging) {
    console.log(`[Push] ${payload.title}: ${payload.body} (to user ${userId})`);
    return;
  }

  const tokens = await prisma.deviceToken.findMany({ where: { userId } });
  if (tokens.length === 0) return;

  try {
    await messaging.sendEachForMulticast({
      tokens: tokens.map((t: any) => t.fcmToken),
      notification: { title: payload.title, body: payload.body },
      data: payload.data,
      apns: { payload: { aps: { sound: 'default' } } },
    });
  } catch (err) {
    console.error('Push notification failed:', err);
  }
}
