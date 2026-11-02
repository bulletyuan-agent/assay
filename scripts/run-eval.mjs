// Runs the static screening on targets and writes observable artefacts:
//   data/results/runs/<run_id>.jsonl                       event log of the whole run (steps, timings, network calls)
//   data/results/<source>/<owner__name>/<date>.json        one result per target, never overwritten
// Usage: node scripts/run-eval.mjs <url> [<url> ...]   |   node scripts/run-eval.mjs --set data/calibration/set-v0.json
import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { parseTarget, fetchMeta, guessType, NET } from './lib.mjs';
import { evaluateStatic, githubFiles, checkGates } from './evaluate.mjs';

export const METHOD_VERSION = '0.2.0';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
let urls = [];
const si = args.indexOf('--set');
if (si >= 0) urls = JSON.parse(readFileSync(join(ROOT, args[si + 1]), 'utf8')).items.filter((i) => i.kind === 'real').map((i) => i.url);
else urls = args.filter((a) => a.startsWith('http'));
if (!urls.length) { console.error('no targets'); process.exit(2); }

const git = (a) => { try { return execFileSync('git', ['-C', ROOT, ...a], { encoding: 'utf8' }).trim(); } catch { return null; } };
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const RUN_ID = `run-${stamp}`;
const LOG = join(ROOT, 'data', 'results', 'runs', `${RUN_ID}.jsonl`);
mkdirSync(dirname(LOG), { recursive: true });
const t00 = Date.now();
const log = (ev, data = {}) => appendFileSync(LOG, JSON.stringify({ ts: new Date().toISOString(), t_ms: Date.now() - t00, ev, ...data }) + '\n');

const tool = { assay_commit: git(['rev-parse', 'HEAD']), dirty: (git(['status', '--porcelain']) || '') !== '', node: process.version, method_version: METHOD_VERSION };
log('run_start', { run_id: RUN_ID, targets: urls, tool });

const written = [];
for (const url of urls) {
  const t0 = Date.now();
  const netStart = NET.length;
  const t = parseTarget(url);
  log('target_start', { url });
  if (!t) { log('target_skip', { url, reason: 'unsupported url' }); continue; }
  const meta = await fetchMeta(t);
  log('meta', { url, ok: !!meta, license: meta?.license, pushed_at: meta?.updatedAt, archived: meta?.archived });
  if (!meta) { log('target_skip', { url, reason: 'not reachable' }); continue; }
  const files = t.source === 'github' ? await githubFiles(t, meta.defaultBranch || 'HEAD') : null;
  log('files', { url, scanned: files?.length ?? 0, candidates: files?.candidates, truncated: files?.truncated, tree_sha: files?.treeSha });
  const ev = evaluateStatic(meta, files);
  for (const f of ev.findings) log('finding', { url, ...f });
  const gates = checkGates(meta, { 'Confirmations / 确认事项': '- [x] a\n- [x] b\n- [x] c' });
  const net = NET.slice(netStart);
  const result = {
    schema: 1, run_id: RUN_ID, target: { ...t, name: meta.name },
    type: guessType(meta.name, meta.description) || 'unknown',
    evaluated_at: new Date().toISOString(), method_version: METHOD_VERSION, tool,
    scope: 'static screening only; nothing was executed; not a trust rating; no grade',
    input_fingerprint: { tree_sha: files?.treeSha ?? null, files_scanned: files?.length ?? 0, candidates: files?.candidates ?? 0, excluded_non_shipped: files?.excludedNonShipped ?? 0, coverage: files?.candidates ? Number((files.length / files.candidates).toFixed(2)) : null, truncated: !!files?.truncated, scanned_paths: ev.evidence.scanned_paths, repo_pushed_at: meta.updatedAt, license: meta.license },
    gates_without_consent: gates,
    result: { screening_score: ev.composite, dims: ev.dims, red_flags: ev.red_flags, weight_coverage: ev.coverage },
    findings: ev.findings, evidence: { ...ev.evidence, scanned_paths: undefined },
    network: { calls: net.length, failed: net.filter((n) => !n.ok).length, ms: net.reduce((a, n) => a + n.ms, 0) },
    duration_ms: Date.now() - t0,
  };
  const dir = join(ROOT, 'data', 'results', t.source, t.id.replace('/', '__'));
  mkdirSync(dir, { recursive: true });
  const day = result.evaluated_at.slice(0, 10);
  let file = join(dir, `${day}.json`);
  for (let n = 2; existsSync(file); n++) file = join(dir, `${day}-${n}.json`);
  writeFileSync(file, JSON.stringify(result, null, 2) + '\n');
  written.push(file);
  log('target_done', { url, score: ev.composite, red_flags: ev.red_flags, findings: ev.findings.length, net_calls: net.length, ms: result.duration_ms, file: file.slice(ROOT.length + 1) });
  console.log(`${t.id.padEnd(40)} cov ${result.input_fingerprint.coverage ?? 'n/a'} score ${String(ev.composite).padStart(3)} findings ${ev.findings.length} files ${files?.length ?? 0}/${files?.candidates ?? 0}${files?.truncated ? ' TRUNCATED' : ''} ${result.duration_ms}ms`);
}
log('run_end', { written: written.length, total_ms: Date.now() - t00, net_calls: NET.length, net_failed: NET.filter((n) => !n.ok).length });
console.log(`run ${RUN_ID}: ${written.length} results, log ${LOG.slice(ROOT.length + 1)}`);
