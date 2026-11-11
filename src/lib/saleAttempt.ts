import type { Sale } from '../types/index.ts';

// Write-ahead recovery journal, separate from the IndexedDB offline queue.
// One unresolved attempt per tenant. API mutations run inside a Web Lock.
function key(tenantId: string) { return `sanad_sale_attempt_v1:${tenantId}`; }
export function readSaleAttempt(tenantId: string): Sale | null {
  const raw = localStorage.getItem(key(tenantId));
  if (!raw) return null;
  const sale = JSON.parse(raw) as Sale;
  if (!sale.id || sale.tenantId !== tenantId || !Array.isArray(sale.items)) {
    throw new Error('تعذر قراءة محاولة البيع السابقة. لا تُعد البيع؛ راجع سجل المبيعات والدعم.');
  }
  return sale;
}
export function writeSaleAttempt(sale: Sale): void {
  localStorage.setItem(key(sale.tenantId), JSON.stringify(sale));
}
export function clearSaleAttempt(tenantId: string, id: string): void {
  const pending = readSaleAttempt(tenantId);
  if (pending?.id === id) localStorage.removeItem(key(tenantId));
}
