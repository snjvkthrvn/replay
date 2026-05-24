import { GoogleAuth } from 'google-auth-library';
import prisma from './prisma';

const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

// FCM v1 error codes that indicate the token will never work again.
// https://firebase.google.com/docs/cloud-messaging/manage-tokens
const UNREGISTERED_ERROR_CODES = new Set([
  'UNREGISTERED',
  'NOT_FOUND',
  'INVALID_ARGUMENT', // wrong/malformed token specifically
]);

let auth: GoogleAuth | null = null;
let projectId: string | null = null;

try {
  const fs = require('fs');
  const path = require('path');
  const serviceAccountPath = path.join(__dirname, '../../firebase-service-account.json');

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (serviceAccountJson) {
    const serviceAccount = JSON.parse(serviceAccountJson);
    projectId = serviceAccount.project_id;
    auth = new GoogleAuth({ credentials: serviceAccount, scopes: [FCM_SCOPE] });
    console.log('Firebase Cloud Messaging initialized');
  } else if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = require(serviceAccountPath);
    projectId = serviceAccount.project_id;
    auth = new GoogleAuth({ credentials: serviceAccount, scopes: [FCM_SCOPE] });
    console.log('Firebase Cloud Messaging initialized');
  } else {
    console.log('Firebase service account not found - push notifications disabled');
  }
} catch {
  console.log('Firebase not available - push notifications disabled');
}

async function sendOne(
  accessToken: string,
  fcmToken: string,
  payload: { title: string; body: string; data?: Record<string, string> },
): Promise<{ ok: true } | { ok: false; deadToken: boolean }> {
  try {
    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            token: fcmToken,
            notification: { title: payload.title, body: payload.body },
            data: payload.data,
            apns: { payload: { aps: { sound: 'default' } } },
          },
        }),
      },
    );

    if (response.ok) return { ok: true };

    // Parse FCM error to decide if the token is dead.
    let errorCode: string | undefined;
    try {
      const body = await response.json() as any;
      errorCode = body?.error?.details?.find((d: any) => d?.errorCode)?.errorCode
        || body?.error?.status;
    } catch {}

    const deadToken = response.status === 404
      || response.status === 410
      || (response.status === 400 && !!errorCode && UNREGISTERED_ERROR_CODES.has(errorCode));

    if (!deadToken) {
      console.error(`FCM send failed (${response.status}):`, errorCode || 'unknown');
    }
    return { ok: false, deadToken };
  } catch (err) {
    console.error('FCM request errored:', err);
    return { ok: false, deadToken: false };
  }
}

export async function sendPushNotification(
  userId: string,
  payload: { title: string; body: string; data?: Record<string, string> },
) {
  if (!auth || !projectId) {
    console.log(`[Push disabled] notification skipped for user ${userId}`);
    return;
  }

  const tokens = await prisma.deviceToken.findMany({ where: { userId } });
  if (tokens.length === 0) return;

  let accessToken: string;
  try {
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    const raw = typeof tokenResponse === 'string' ? tokenResponse : tokenResponse?.token;
    if (!raw) throw new Error('Missing FCM access token');
    accessToken = raw;
  } catch (err) {
    console.error('FCM auth failed:', err);
    return;
  }

  const results = await Promise.all(
    tokens.map((token) => sendOne(accessToken, token.fcmToken, payload).then((r) => ({ token, r }))),
  );

  const deadTokenIds = results
    .filter(({ r }) => !r.ok && (r as any).deadToken)
    .map(({ token }) => token.id);

  if (deadTokenIds.length > 0) {
    await prisma.deviceToken.deleteMany({ where: { id: { in: deadTokenIds } } }).catch((err) => {
      console.error('Failed to prune dead FCM tokens:', err);
    });
    console.log(`Pruned ${deadTokenIds.length} unregistered FCM token(s)`);
  }
}
