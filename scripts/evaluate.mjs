// Static evaluation and nomination gates. Implements docs in knowledge base: standards/01-evaluation-standard.md
import { fileURLToPath } from 'node:url';
import { http, ghHeaders, fetchMeta, parseTarget, daysSince, INSTALL_RE, WINDOW_DAYS, F } from './lib.mjs';

export const WEIGHTS = { maintenance: 0.15, install_docs: 0.15, dangerous_patterns: 0.30, egress: 0.25, instruction_hygiene: 0.15 };

const DANGER = [
  /rm\s+-rf\s+[/~]/,
  /curl[^\n|]*\|\s*(ba)?sh/,
  /wget[^\n|]*\|\s*(ba)?sh/,
  /\beval\s*\(/,
  /new Function\s*\(/,
  /child_process[\s\S]{0,200}shell:\s*true/,
  /os\.system\s*\(/,
  /subprocess\.\w+\([^)]*shell\s*=\s*True/,
  /base64[^\n]{0,40}\|\s*(ba)?sh/,
  /process\.env[\s\S]{0,300}(fetch|axios|http\.request)\s*\(/,
];
const INJECTION = [
  /ignore (all |any |the )?(previous|prior|above) instructions/i,
  /do not (tell|inform|mention (it )?to) the user/i,
  /忽略(之前|以上|所有|前面)的?指令/,
  /不要(告诉|告知)用户/,
];
const CODE_RE = /\.(m?[jt]sx?|py|sh|rb|go)$/i;
const TEXT_RE = /(\.(md|json|ya?ml|txt)|SKILL\.md)$/i;
const ALLOW_HOSTS = ['localhost', '127.0.0.1', 'github.com', 'api.github.com', 'raw.githubusercontent.com',
  'npmjs.org', 'npmjs.com', 'pypi.org', 'gitlab.com', 'w3.org', 'json-schema.org', 'schemastore.org',
  'example.com', 'modelcontextprotocol.io', 'anthropic.com', 'shields.io'];

const clamp = (v) => Math.max(0, Math.min(100, Math.round(v)));

export async function githubFiles(t, branch = 'HEAD') {
  const tree = await http(`https://api.github.com/repos/${t.id}/git/trees/${branch}?recursive=1`, { headers: ghHeaders() });
  if (!tree.ok) return null;
  const picked = tree.data.tree
    .filter((x) => x.type === 'blob' && x.size < 150000 && (CODE_RE.test(x.path) || TEXT_RE.test(x.path)))
    .slice(0, 80);
  const out = [];
  for (const f of picked) {
    const r = await http(`https://raw.githubusercontent.com/${t.id}/${branch}/${f.path}`, { json: false });
    if (r.ok) out.push({ path: f.path, text: r.data });
  }
  return out;
}

export function evaluateStatic(meta, files, { ownHost } = {}) {
  const readme = meta.readme || '';
  const age = daysSince(meta.updatedAt);
  const maintenance = meta.archived ? 0 : age <= 30 ? 100 : age <= 90 ? 85 : age <= 180 ? 60 : 0;
  const installDetected = INSTALL_RE.test(readme);
  const install_docs = clamp((installDetected ? 60 : 0) + (readme.length >= 500 ? 40 : 0));

  const hasFiles = Array.isArray(files);
  const code = hasFiles ? files.filter((f) => CODE_RE.test(f.path)) : [];
  let danger = 0;
  for (const f of code) for (const re of DANGER) if (re.test(f.text)) danger++;
  const dangerous_patterns = hasFiles ? clamp(100 - 25 * danger) : null;

  const hosts = new Set();
  for (const f of code) {
    for (const m of f.text.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)) {
      const h = m[1].toLowerCase();
      if (h !== ownHost && !ALLOW_HOSTS.some((a) => h === a || h.endsWith(`.${a}`))) hosts.add(h);
    }
  }
  const egress = hasFiles ? clamp(100 - 15 * Math.min(hosts.size, 6)) : null;

  let inj = 0;
  for (const f of hasFiles ? files : []) for (const re of INJECTION) if (re.test(f.text)) inj++;
  const instruction_hygiene = hasFiles ? clamp(100 - 30 * inj) : null;

  const dims = { maintenance, install_docs, dangerous_patterns, egress, instruction_hygiene };
  let num = 0;
  let den = 0;
  for (const [k, v] of Object.entries(dims)) {
    if (v === null) continue;
    num += WEIGHTS[k] * v;
    den += WEIGHTS[k];
  }
  const composite = den ? Math.round(num / den) : null;
  const grade = composite === null ? null : composite >= 85 ? 'A' : composite >= 70 ? 'B' : composite >= 50 ? 'C' : 'D';
  return {
    dims, composite, grade, coverage: Number(den.toFixed(2)), static_scan: hasFiles,
    evidence: {
      files_scanned: hasFiles ? files.length : 0, danger_hits: danger, injection_hits: inj,
      external_hosts: [...hosts].slice(0, 10), install_detected: installDetected, age_days: Math.round(age),
    },
  };
}

// Gates from the standard (G1-G5 plus consent). Crawler discoveries cannot tick the third box.
export function checkGates(meta, form = {}, { crawler = false } = {}) {
  const boxes = form[F.confirm] || '';
  const checked = (boxes.match(/- \[x\]/gi) || []).length;
  const installField = (form[F.install] || '').trim();
  const g = {
    public: !!meta && !meta.isPrivate,
    license: !!meta?.license,
    fresh: !!meta && !meta.archived && daysSince(meta.updatedAt) <= WINDOW_DAYS,
    install: installField.length > 0 || INSTALL_RE.test(meta?.readme || ''),
    consent: crawler ? checked >= 2 : checked >= 3,
  };
  g.passed = Object.values(g).every(Boolean);
  return g;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const t = parseTarget(process.argv[2] || '');
  if (!t) { console.error('usage: node scripts/evaluate.mjs <github|npm|gitlab URL>'); process.exit(2); }
  const meta = await fetchMeta(t);
  if (!meta) { console.error('target not reachable as a public project'); process.exit(1); }
  const files = t.source === 'github' ? await githubFiles(t, meta.defaultBranch || 'HEAD') : null;
  const ev = evaluateStatic(meta, files);
  console.log(JSON.stringify({ target: t, gates: checkGates(meta), ...ev }, null, 2));
}
