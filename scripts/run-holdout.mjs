// Scores a frozen holdout directory once and reports recall with a Wilson 95% interval.
// Usage: node scripts/run-holdout.mjs <holdout-dir> <method-version>
// Hit = screening score below 70 or any red flag. Output goes to <holdout-dir>-results-<method>.json and is never edited.
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { evaluateStatic } from './evaluate.mjs';
import { wilson } from './summarize-run.mjs';

const dir = process.argv[2];
const method = process.argv[3];
const out = `${dir}-results-${method}.json`;
if (existsSync(out)) { console.error(`${out} already exists: a holdout is used once per method version`); process.exit(3); }
const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));

function walk(d, base = d, o = []) {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) walk(p, base, o); else o.push({ path: p.slice(base.length + 1), text: readFileSync(p, 'utf8') });
  }
  return o;
}
const rows = [];
for (const it of manifest.items) {
  const files = walk(join(dir, it.id));
  const readme = files.find((f) => /^README/i.test(f.path))?.text || '';
  const ev = evaluateStatic({ readme, updatedAt: new Date().toISOString(), archived: false }, files);
  const hit = ev.composite < 70 || ev.red_flags.length > 0;
  rows.push({ id: it.id, type: it.type, difficulty: it.difficulty, score: ev.composite, red_flags: ev.red_flags, rules: [...new Set(ev.findings.map((f) => f.rule))], hit });
}
const k = rows.filter((r) => r.hit).length;
const [lo, hi] = wilson(k, rows.length);
const by = (key) => Object.fromEntries([...new Set(rows.map((r) => r[key]))].map((v) => [v, `${rows.filter((r) => r[key] === v && r.hit).length}/${rows.filter((r) => r[key] === v).length}`]));
const result = { holdout: dir, method_version: method, run_at: new Date().toISOString(), hit_rule: 'score<70 or any red flag', recall: k / rows.length, wilson95: [lo, hi], k, n: rows.length, by_difficulty: by('difficulty'), by_type: by('type'), rows };
writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
for (const r of rows) console.log(r.id.padEnd(34), r.difficulty.padEnd(17), String(r.score).padStart(3), r.hit ? 'HIT ' : 'MISS', r.rules.join(',') || '-');
console.log(`\nrecall ${k}/${rows.length} = ${(100 * k / rows.length).toFixed(1)}%  Wilson95 [${(100 * lo).toFixed(1)}%, ${(100 * hi).toFixed(1)}%]`, JSON.stringify(result.by_difficulty));
