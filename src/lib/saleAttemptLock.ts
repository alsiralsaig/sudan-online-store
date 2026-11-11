/** Same-origin browser coordination only; server idempotency remains essential. */
export async function withSaleAttemptLock<T>(tenantId: string, operation: () => Promise<T>): Promise<T> {
  if (typeof navigator === 'undefined' || !navigator.locks?.request) {
    throw new Error('هذا المتصفح لا يدعم قفل البيع الآمن بين التبويبات. استخدم متصفحاً حديثاً عبر اتصال HTTPS. لم يُرسل البيع.');
  }
  return navigator.locks.request(`sanad:pos-sale:${tenantId}`, { mode: 'exclusive', ifAvailable: true }, async lock => {
    if (!lock) throw new Error('توجد عملية بيع أو استعادة قيد التنفيذ في تبويب آخر لهذا المتجر. انتظر نتيجتها ولا تُعد البيع.');
    return operation();
  });
}
