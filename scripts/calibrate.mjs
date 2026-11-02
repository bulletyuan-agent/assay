// Runs the static screening over the calibration set and reports separation between good and bad.
// Usage: node scripts/calibrate.mjs [--offline]   (--offline = synthetic fixtures only)
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchMeta, parseTarget } from './lib.mjs';
import { evaluateStatic, githubFiles } from './evaluate.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'calibration');
const set = JSON.parse(readFileSync(join(ROOT, 'set-v0.json'), 'utf8'));
const OFFLINE = process.argv.includes('--offline');

function walk(dir, base = dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, base, out);
    else out.push({ path: p.slice(base.length + 1), text: readFileSync(p, 'utf8') });
  }
  return out;
}

const rows = [];
const blind = () => rows.filter((r) => set.items.find((i) => i.id === r.id)?.role === 'holdout');
for (const it of set.items) {
  let ev;
  if (it.kind === 'synthetic' || it.kind === 'reconstructed') {
    const files = walk(join(ROOT, it.path));
    const readme = files.find((f) => /^README/i.test(f.path))?.text || '';
    ev = evaluateStatic({ readme, updatedAt: new Date().toISOString(), archived: false }, files);
  } else {
    if (OFFLINE) continue;
    const t = parseTarget(it.url);
    const meta = await fetchMeta(t);
    if (!meta) { console.warn(`skip ${it.id}: not reachable`); continue; }
    ev = evaluateStatic(meta, await githubFiles(t, meta.defaultBranch || 'HEAD'));
  }
  rows.push({ id: it.id, label: it.label, kind: it.kind, score: ev.composite, dims: ev.dims, evidence: ev.evidence });
}

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
function auc(sub) {
  const g = sub.filter((r) => r.label === 'good').map((r) => r.score);
  const b = sub.filter((r) => r.label === 'bad').map((r) => r.score);
  if (!g.length || !b.length) return null;
  let w = 0;
  for (const x of g) for (const y of b) w += x > y ? 1 : x === y ? 0.5 : 0;
  return w / (g.length * b.length);
}

console.log('id'.padEnd(22), 'label'.padEnd(6), 'kind'.padEnd(10), 'score', ' dims(maint/doc/danger/egress/inject)');
for (const r of rows) {
  const d = r.dims;
  console.log(r.id.padEnd(22), r.label.padEnd(6), r.kind.padEnd(10), String(r.score).padStart(5), ' ', [d.maintenance, d.install_docs, d.dangerous_patterns, d.egress, d.instruction_hygiene].join('/'));
}
const summary = {};
for (const [name, sub] of [['all', rows], ['synthetic', rows.filter((r) => r.kind === 'synthetic')], ['real', rows.filter((r) => r.kind === 'real')]]) {
  summary[name] = {
    n_good: sub.filter((r) => r.label === 'good').length, n_bad: sub.filter((r) => r.label === 'bad').length,
    mean_good: Math.round(mean(sub.filter((r) => r.label === 'good').map((r) => r.score))),
    mean_bad: Math.round(mean(sub.filter((r) => r.label === 'bad').map((r) => r.score))),
    auc: auc(sub),
  };
}
console.log('\nHOLDOUT items (never used for tuning):', JSON.stringify(blind().map((r) => ({ id: r.id, score: r.score, red_flags: r.red_flags }))));
console.log('\nsummary', JSON.stringify(summary, null, 2));
console.log('\nNOTE: real-world AUC is undefined until verified real bad items exist (todo_real_bad).');
writeFileSync(join(ROOT, 'results-latest.json'), JSON.stringify({ at: new Date().toISOString(), summary, rows }, null, 2) + '\n');
