/**
 * Notification service — one entry point used by every route.
 *
 * A notification always lands in the in-app feed (the bell) and, when the
 * receiving device has a push subscription, is also delivered as a real
 * phone notification through the service worker.
 */
import webpush from 'web-push';
import { db } from './db.ts';
import type { AppNotification, NotificationApp, NotificationKind } from '../types/index.ts';

const CONTACT = process.env.VAPID_CONTACT || 'mailto:admin@sanad.sd';

let configured = false;

/**
 * VAPID keys are read from the environment when available; otherwise a pair
 * is generated once and stored in the database so every serverless instance
 * (and every future deploy) signs with the same key.
 */
export function initPush(): { publicKey: string; privateKey: string } | null {
  const envPublic = process.env.VAPID_PUBLIC_KEY;
  const envPrivate = process.env.VAPID_PRIVATE_KEY;

  if (envPublic && envPrivate) {
    webpush.setVapidDetails(CONTACT, envPublic, envPrivate);
    configured = true;
    return { publicKey: envPublic, privateKey: envPrivate };
  }

  const stored = db.getPushKeys();
  if (stored) {
    webpush.setVapidDetails(CONTACT, stored.publicKey, stored.privateKey);
    configured = true;
    return stored;
  }

  try {
    const generated = webpush.generateVAPIDKeys();
    db.savePushKeys(generated);
    webpush.setVapidDetails(CONTACT, generated.publicKey, generated.privateKey);
    configured = true;
    return generated;
  } catch (err) {
    console.warn('[push] VAPID initialisation failed:', err);
    return null;
  }
}

export function getPublicKey(): string | null {
  const keys = initPush();
  return keys ? keys.publicKey : null;
}

interface NotifyInput {
  app: NotificationApp;
  kind: NotificationKind;
  title: string;
  body: string;
  linkTab?: string;
  recipientToken?: string;
  tenantId?: string;
  /** Extra payload merged into the push message (e.g. a deep link). */
  pushData?: Record<string, any>;
}

/** Create the in-app notification and fire the push to matching devices. */
export async function notify(input: NotifyInput): Promise<AppNotification> {
  const notification = db.createNotification({
    app: input.app,
    kind: input.kind,
    title: input.title,
    body: input.body,
    linkTab: input.linkTab,
    recipientToken: input.recipientToken,
    tenantId: input.tenantId,
  });

  await sendPush(input, notification).catch((err) => {
    console.warn('[push] send failed:', err?.message || err);
  });

  return notification;
}

async function sendPush(input: NotifyInput, notification: AppNotification): Promise<void> {
  if (!configured && !initPush()) return;

  const subscriptions = db.getPushSubscriptions({ app: input.app }).filter((s) => {
    if (notification.recipientToken) return s.ownerToken === notification.recipientToken;
    return true;
  });

  if (subscriptions.length === 0) return;

  const payload = JSON.stringify({
    title: input.title,
    body: input.body,
    icon: '/icons/sanad-icon-192.png',
    badge: '/icons/sanad-favicon-96.png',
    url: buildUrl(input.app, input.linkTab, input.pushData),
    tag: notification.id,
    kind: input.kind,
    ...(input.pushData || {}),
  });

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          payload
        );
      } catch (err: any) {
        // 404/410 = the device dropped the subscription
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          db.deletePushSubscription(sub.endpoint);
        } else {
          console.warn('[push] delivery error:', err?.statusCode, err?.message);
        }
      }
    })
  );
}

/** Deep link back into the right app + tab. */
function buildUrl(app: NotificationApp, linkTab?: string, extra?: Record<string, any>): string {
  if (extra?.url) return String(extra.url);
  const base = `/?app=${app}`;
  return linkTab ? `${base}&tab=${encodeURIComponent(linkTab)}` : base;
}
