import assert from 'node:assert/strict';
import { createSingleFlight } from '../src/lib/singleFlight.ts';

let count = 0;
function test(name: string, condition: unknown) {
  assert.ok(condition, name); count++; console.log(`PASS ${name}`);
}
const guard = createSingleFlight();
let release!: () => void;
let calls = 0;
const gate = new Promise<void>(resolve => { release = resolve; });
const first = guard.run(async () => { calls++; await gate; return 'saved'; });
const duplicates = await Promise.all(Array.from({ length: 100 }, () => guard.run(async () => { calls++; return 'duplicate'; })));
test('100 repeated confirmations while pending do not run another operation', calls === 1);
test('suppressed calls have no success result', duplicates.every(x => x === undefined));
release();
test('first operation retains its result', await first === 'saved');
test('a later sale can run after completion', await guard.run(async () => 'next') === 'next');
const failure = new Error('storage failed');
await assert.rejects(guard.run(async () => { throw failure; }), e => e === failure); count++;
test('guard releases after rejected save', await guard.run(async () => 'retry') === 'retry');
await assert.rejects(guard.run(() => { throw failure; }), e => e === failure); count++;
test('guard releases after synchronous exception', await guard.run(async () => 'retry-sync') === 'retry-sync');
let releaseOther!: () => void;
const pending = guard.run(() => new Promise<void>(r => { releaseOther = r; }));
const other = createSingleFlight();
test('separate component instances do not block each other', await other.run(async () => 7) === 7);
releaseOther(); await pending;
// Wiring check: the actual POS handler must acquire the guard before any submit code.
const { readFileSync } = await import('node:fs');
const pos = readFileSync(new URL('../src/components/POS/PosView.tsx', import.meta.url), 'utf8');
test('POS finalization is wrapped by the per-instance guard', pos.includes('const handleFinalizeSale = () => saleSubmission.current.run(async () => {'));
console.log(`\n${count} checks passed. Unit + source wiring checks only; not a browser end-to-end test.`);
