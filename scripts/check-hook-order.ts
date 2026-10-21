/** Static guard: a `return` before the last hook silently breaks React (#310). */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const HOOK = /\b(useState|useEffect|useRef|useMemo|useCallback|useReducer|useContext|useLayoutEffect)\s*\(/;
const files: string[] = [];
const walk = (dir: string) => {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else if (/\.(tsx|ts)$/.test(entry)) files.push(p);
  }
};
walk('src');

let bad = 0;
for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n');
  let firstReturn = -1;
  let lastHook = -1;
  lines.forEach((line, i) => {
    if (firstReturn === -1 && /^\s{2}if \(.*\) return null;/.test(line)) firstReturn = i;
    if (HOOK.test(line) && /^\s{2}(const|let|var) \[/.test(line)) lastHook = i;
  });
  if (firstReturn > -1 && lastHook > firstReturn) {
    bad++;
    console.log(`❌ ${file} — hook at line ${lastHook + 1} comes after the early return at ${firstReturn + 1}`);
  }
}
console.log(bad === 0 ? `\n✅ hook order clean across ${files.length} files` : `\n${bad} file(s) need fixing`);
process.exit(bad ? 1 : 0);
