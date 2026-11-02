// Audits result files. Offline checks always run; --refetch re-reads evidence from GitHub; --rerun re-evaluates and compares.
// Usage: node scripts/verify-run.mjs <result.json> [...] [--refetch] [--rerun]
import { readFileSync } from 'node:fs';
import { parseTarget, fetchMeta, http } from './lib.mjs';
import { evaluateStatic, githubFiles, WEIGHTS } from './evaluate.mjs';

const args = process.argv.slice(2);
const files = args.filter((a) => a.endsWith('.json'));
const REFETCH = args.includes('--refetch');
const RERUN = args.includes('--rerun');
const clamp = (v) => Math.max(0, Math.min(100, Math.round(v)));
let failures = 0;
let warnings = 0;
const warn = (cond, msg) => { if (cond) { warnings++; console.log(`  WARN ${msg}`); } };
const check = (ok, name, detail = '') => { if (!ok) failures++; console.log(`  ${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' · ' + detail : ''}`); };

for (const file of files) {
  const r = JSON.parse(readFileSync(file, 'utf8'));
  console.log(`\n${r.target.id}  (${file})`);
  const sum = (dim) => r.findings.filter((f) => f.dim === dim).reduce((a, f) => a + f.deduction, 0);
  const hasScan = r.result.dims.dangerous_patterns !== null;
  // 1. Every dimension score must be explained by listed findings.
  for (const [dim, key] of [['dangerous_patterns', 'dangerous_patterns'], ['egress', 'egress'], ['instruction_hygiene', 'instruction_hygiene']]) {
    if (!hasScan) continue;
    const expect = clamp(100 - sum(dim));
    check(r.result.dims[key] === expect, `deductions explain ${key}`, `score ${r.result.dims[key]} = 100 - ${sum(dim)}`);
  }
  // 2. Composite must follow the published formula and cap.
  let num = 0, den = 0;
  for (const [k, v] of Object.entries(r.result.dims)) if (v !== null) { num += WEIGHTS[k] * v; den += WEIGHTS[k]; }
  let comp = Math.round(num / den);
  if (r.result.red_flags.length) comp = Math.min(comp, 49);
  check(comp === r.result.screening_score, 'composite follows published weights and cap', `recomputed ${comp}, stored ${r.result.screening_score}`);
  // 3. Every finding is locatable.
  check(r.findings.every((f) => f.file && f.line && f.snippet !== undefined), 'every finding has file, line, snippet', `${r.findings.length} findings`);
  // 4. Scope honesty.
  check(/not a trust rating/.test(r.scope) && !('grade' in r.result), 'result is labelled static screening, no grade');
  check(r.input_fingerprint.truncated === false || r.input_fingerprint.truncated === true, 'truncation disclosed', `scanned ${r.input_fingerprint.files_scanned}/${r.input_fingerprint.candidates}${r.input_fingerprint.truncated ? ' (TRUNCATED)' : ''}`);
  const fp = r.input_fingerprint;
  check(Array.isArray(fp.scanned_paths) && fp.scanned_paths.length === fp.files_scanned, 'scanned path list is stored and complete', `${fp.scanned_paths?.length ?? 0} paths`);
  check(r.findings.every((f) => (fp.scanned_paths || []).some((p) => p.path === f.file)), 'every finding points to a scanned file');
  warn(fp.coverage !== null && fp.coverage < 0.5, `low coverage ${fp.coverage}: ${fp.files_scanned} of ${fp.candidates} shipped files scanned; a high score is weak evidence`);
  check(r.tool.dirty === false, 'tool code was committed (not dirty)', `commit ${String(r.tool.assay_commit).slice(0, 7)}`);

  const t = parseTarget(r.target.url);
  if (REFETCH && t) {
    let ok = 0, bad = 0;
    for (const f of r.findings.filter((x) => x.file).slice(0, 8)) {
      const raw = await http(`https://raw.githubusercontent.com/${t.id}/${r.input_fingerprint.tree_sha ? 'HEAD' : 'HEAD'}/${f.file}`, { json: false });
      if (raw.ok && raw.data.split('\n')[f.line - 1]?.includes(f.snippet.slice(0, 40))) ok++; else bad++;
    }
    check(bad === 0, 'evidence lines re-read from source match snippets', `${ok} matched, ${bad} not (HEAD may have moved)`);
  }
  if (RERUN && t) {
    const meta = await fetchMeta(t);
    const again = await githubFiles(t, meta.defaultBranch || 'HEAD');
    if (again.treeSha !== r.input_fingerprint.tree_sha) { console.log('  SKIP rerun: target tree changed since the run (cannot compare)'); continue; }
    const ev = evaluateStatic(meta, again);
    check(ev.composite === r.result.screening_score && JSON.stringify(ev.dims) === JSON.stringify(r.result.dims), 'rerun reproduces score and dimensions', `${ev.composite} vs ${r.result.screening_score}`);
  }
}
console.log(`${warnings} warning(s)`);
console.log(failures ? `\n${failures} check(s) FAILED` : '\nall checks passed');
process.exit(failures ? 1 : 0);
