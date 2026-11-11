/** Follow-up failures must not turn an acknowledged sale into a failed sale. */
export async function runSaleFollowUps(tasks: Array<() => unknown | Promise<unknown>>): Promise<boolean> {
  const results = await Promise.allSettled(tasks.map(task => Promise.resolve().then(task)));
  return results.every(result => result.status === 'fulfilled');
}
