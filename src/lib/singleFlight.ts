/** Synchronous, per-instance guard. Not durable idempotency or a cross-tab lock. */
export function createSingleFlight() {
  let pending = false;
  return {
    async run<T>(operation: () => Promise<T>): Promise<T | undefined> {
      if (pending) return undefined;
      pending = true;
      try {
        return await operation();
      } finally {
        pending = false;
      }
    },
  };
}
