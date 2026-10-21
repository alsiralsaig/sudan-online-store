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
  /** Skip creating a duplicate when this key was already used. */
  dedupeKey?: string;
}

/** Create the in-app notification and fire the push to matching devices. */
export async function notify(input: NotifyInput): Promise<AppNotification> {
  const notification = db.createNotification({
    dedupeKey: input.dedupeKey,
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

/* ------------------------------------------------------------------ */
/*  Automatic alerts — low stock + subscription expiry                 */
/* ------------------------------------------------------------------ */

/**
 * Low-stock alerts.
 *
 * Runs after every sale / inventory change. For each product that dropped to
 * or below its reorder point we create a merchant notification, but only once
 * per product per day (tracked with a `low_stock:<product>:<day>` key so a
 * busy shop does not get flooded).
 */
export async function notifyLowStock(tenantId: string, opts: { branchId?: string } = {}): Promise<number> {
  const alerts = db.syncInventoryAlerts(tenantId);
  const relevant = opts.branchId ? alerts.filter((a) => a.branchId === opts.branchId) : alerts;
  const day = new Date().toISOString().slice(0, 10);
  let sent = 0;

  for (const alert of relevant) {
    const key = `low_stock:${alert.productId}:${alert.branchId}:${day}`;
    if (db.hasNotificationKey(key)) continue;

    await notify({
      app: 'merchant',
      kind: 'low_stock',
      title: alert.currentQuantity === 0 ? 'نفاد صنف من المخزون' : 'نقص في المخزون',
      body: `${alert.productName} — المتبقي ${alert.currentQuantity} فقط في ${alert.branchName} (حد إعادة الطلب ${alert.reorderPoint}).`,
      linkTab: 'inventory',
      tenantId,
      dedupeKey: key,
    });
    sent++;
  }

  return sent;
}

/**
 * Subscription expiry warnings.
 *
 * Warns the merchant 7, 3 and 1 day before expiry (and on the expiry day),
 * once per stage. Also tells the super admin when a tenant has actually
 * expired so they can follow up.
 */
export async function notifySubscriptionExpiry(): Promise<number> {
  const tenants = db.getSchema().tenants;
  const now = Date.now();
  let sent = 0;

  for (const tenant of tenants) {
    const expires = new Date(tenant.subscriptionExpiresAt).getTime();
    if (!Number.isFinite(expires)) continue;

    const daysLeft = Math.ceil((expires - now) / (24 * 60 * 60 * 1000));

    let stage: string | null = null;
    if (daysLeft <= 0) stage = 'expired';
    else if (daysLeft === 1) stage = 'd1';
    else if (daysLeft === 3) stage = 'd3';
    else if (daysLeft === 7) stage = 'd7';

    if (!stage) continue;

    const key = `subscription:${tenant.id}:${stage}:${new Date().toISOString().slice(0, 10)}`;
    if (db.hasNotificationKey(key)) continue;

    await notify({
      app: 'merchant',
      kind: 'subscription',
      title:
        stage === 'expired'
          ? 'انتهى اشتراكك في منصة سند'
          : `اشتراكك ينتهي بعد ${daysLeft} ${daysLeft === 1 ? 'يوم' : 'أيام'}`,
      body:
        stage === 'expired'
          ? `اشتراك «${tenant.tradeName || tenant.name}» منتهٍ. جدّد الاشتراك لتجنب إيقاف نقاط البيع والمتجر.`
          : `«${tenant.tradeName || tenant.name}» — تاريخ الانتهاء ${new Date(tenant.subscriptionExpiresAt).toLocaleDateString('ar-EG')}. جدّد الآن وتجنب التوقف.`,
      linkTab: 'subscription',
      tenantId: tenant.id,
      dedupeKey: key,
    });

    if (stage === 'expired') {
      const adminKey = `subscription-admin:${tenant.id}:${new Date().toISOString().slice(0, 10)}`;
      if (!db.hasNotificationKey(adminKey)) {
        await notify({
          app: 'admin',
          kind: 'subscription',
          title: 'اشتراك تاجر منتهٍ',
          body: `«${tenant.tradeName || tenant.name}» — ${tenant.city} • يحتاج متابعة تجديد.`,
          linkTab: 'payments_queue',
          tenantId: tenant.id,
          dedupeKey: adminKey,
        });
      }
    }

    sent++;
  }

  return sent;
}

/** Runs every automatic scan; safe to call often (everything is de-duplicated). */
export async function runNotificationScan(): Promise<{ lowStock: number; subscriptions: number }> {
  let lowStock = 0;
  const seen = new Set<string>();

  for (const tenant of db.getSchema().tenants) {
    if (seen.has(tenant.id)) continue;
    seen.add(tenant.id);
    try {
      lowStock += await notifyLowStock(tenant.id);
    } catch (err) {
      console.warn('[notify] low stock scan failed:', err);
    }
  }

  let subscriptions = 0;
  try {
    subscriptions = await notifySubscriptionExpiry();
  } catch (err) {
    console.warn('[notify] subscription scan failed:', err);
  }

  return { lowStock, subscriptions };
}
