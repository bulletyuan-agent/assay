// Summarises one run for the release gates: false-positive rate (G2) and coverage (G3) with Wilson 95% intervals.
// Usage: node scripts/summarize-run.mjs <run_id> [--label good|bad]
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { wilson } from './stats.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'results');
const runId = process.argv[2];
if (!runId) { console.error('usage: summarize-run.mjs <run_id>'); process.exit(2); }

function walk(d, o = []) {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) { if (n !== 'runs') walk(p, o); } else if (p.endsWith('.json')) o.push(p);
  }
  return o;
}
const rows = walk(ROOT).map((f) => JSON.parse(readFileSync(f, 'utf8'))).filter((r) => r.run_id === runId);
const flagged = rows.filter((r) => r.result.screening_score < 70 || r.result.red_flags.length > 0);
const full = rows.filter((r) => (r.input_fingerprint.coverage ?? 0) >= 0.8);
const pct = (x) => (100 * x).toFixed(1) + '%';
const [fl, fh] = wilson(flagged.length, rows.length);
const [cl, ch] = wilson(full.length, rows.length);
console.log(`run ${runId}: ${rows.length} results, method ${rows[0]?.method_version}`);
console.log(`flagged (score<70 or red flag): ${flagged.length}/${rows.length} = ${pct(flagged.length / rows.length)}  Wilson95 [${pct(fl)}, ${pct(fh)}]`);
for (const r of flagged) console.log(`   - ${r.target.id} score ${r.result.screening_score} flags ${r.result.red_flags.join(',') || '-'}`);
console.log(`coverage >= 0.8: ${full.length}/${rows.length} = ${pct(full.length / rows.length)}  Wilson95 [${pct(cl)}, ${pct(ch)}]`);
const scores = rows.map((r) => r.result.screening_score).sort((a, b) => a - b);
console.log(`score min ${scores[0]} median ${scores[Math.floor(scores.length / 2)]} max ${scores[scores.length - 1]}`);
