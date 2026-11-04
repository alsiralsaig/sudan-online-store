import type { Product, Sale } from '../types/index.ts';

const DB_NAME = 'sanad_pos_offline_db';
const DB_VERSION = 2;

let dbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB غير مدعوم في هذه البيئة'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains('products')) {
        db.createObjectStore('products', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('offline_sales')) {
        db.createObjectStore('offline_sales', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('offline_shifts')) {
        db.createObjectStore('offline_shifts', { keyPath: 'id' });
      }

      /* عدّاد أرقام الفواتير وهوية الجهاز: الرقم المطبوع للعميل دون اتصال
         يجب أن يكون فريداً وثابتاً، فلا يُعاد ترقيمه عند المزامنة. */
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

export async function cacheProductsLocally(products: Product[]): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('products', 'readwrite');
    const store = tx.objectStore('products');
    store.clear();
    for (const prod of products) {
      store.put(prod);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getLocallyCachedProducts(): Promise<Product[]> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('products', 'readonly');
    const store = tx.objectStore('products');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function saveOfflineSale(sale: Sale): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('offline_sales', 'readwrite');
    const store = tx.objectStore('offline_sales');
    store.put(sale);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPendingOfflineSales(): Promise<Sale[]> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('offline_sales', 'readonly');
    const store = tx.objectStore('offline_sales');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function removeOfflineSale(id: string): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('offline_sales', 'readwrite');
    const store = tx.objectStore('offline_sales');
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearSyncedSales(ids: string[]): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('offline_sales', 'readwrite');
    const store = tx.objectStore('offline_sales');
    for (const id of ids) {
      store.delete(id);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function readMeta<T>(key: string): Promise<T | undefined> {
  return getDb().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const req = db.transaction('meta', 'readonly').objectStore('meta').get(key);
        req.onsuccess = () => resolve(req.result?.value as T | undefined);
        req.onerror = () => reject(req.error);
      }),
  );
}

function writeMeta(key: string, value: unknown): Promise<void> {
  return getDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction('meta', 'readwrite');
        tx.objectStore('meta').put({ key, value });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      }),
  );
}

/** هوية ثابتة لهذا الجهاز/المتصفح، تُنشأ مرة واحدة وتُحفظ. */
export async function getDeviceTag(): Promise<string> {
  const existing = await readMeta<string>('deviceTag');
  if (existing) return existing;
  const tag = Math.random().toString(36).slice(2, 6).toUpperCase() + Date.now().toString(36).slice(-3).toUpperCase();
  await writeMeta('deviceTag', tag);
  return tag;
}

/**
 * رقم فاتورة دون اتصال: تسلسل يزيد ولا يعود + هوية الجهاز + التاريخ.
 * لا يعتمد على `Date.now()` وحده (كان يتكرر كل ~16.7 دقيقة وبين الأجهزة).
 * إن تعذّر التخزين المحلي نرمي خطأً واضحاً بدل إصدار رقم قد يتكرر بصمت.
 */
export async function nextOfflineInvoiceNumber(): Promise<string> {
  const db = await getDb();
  const seq: number = await new Promise((resolve, reject) => {
    const tx = db.transaction('meta', 'readwrite');
    const store = tx.objectStore('meta');
    const req = store.get('invoiceSeq');
    req.onsuccess = () => {
      const next = Number(req.result?.value || 0) + 1;
      store.put({ key: 'invoiceSeq', value: next });
      resolve(next);
    };
    req.onerror = () => reject(req.error);
    tx.onerror = () => reject(tx.error);
  });
  const tag = await getDeviceTag();
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `INV-OFF-${tag}-${stamp}-${String(seq).padStart(4, '0')}`;
}
