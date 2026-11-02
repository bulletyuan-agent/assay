// Static evaluation and nomination gates. Implements docs in knowledge base: standards/01-evaluation-standard.md
import { fileURLToPath } from 'node:url';
import { extendedScan } from './extended.mjs';
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
  // Bulk environment dump next to a network call. Reading one declared token (process.env.X) is normal and is not matched.
  /(JSON\.stringify\(\s*process\.env\s*\)|Object\.(entries|keys|values)\(\s*process\.env\s*\))[\s\S]{0,300}(fetch|axios|http\.request)\s*\(/,
];
// Indexes into DANGER that are severe on their own: destructive deletes, pipe-to-shell, env exfiltration.
const SEVERE = new Set([0, 1, 2, 8, 9]);
export const DANGER_NAMES = ['rm-rf', 'curl-pipe-sh', 'wget-pipe-sh', 'eval', 'new-Function', 'child_process-shell', 'os.system', 'subprocess-shell', 'base64-pipe-sh', 'env-dump-to-network'];
// Locate the first match of a regex: file line and a short snippet, so every deduction can be traced.
function locate(text, re, original = text) {
  const m = re.exec(text);
  if (!m) return null;
  const line = text.slice(0, m.index).split('\n').length;
  return { line, snippet: (original.split('\n')[line - 1] || '').trim().slice(0, 160) };
}
// Tests, examples and docs routinely contain eval, rm -rf and foreign URLs. They are not shipped behaviour.
export const NON_SHIPPED = /(^|\/)(tests?|__tests__|spec|examples?|fixtures?|docs?|samples?|benchmarks?|e2e)\/|\.(test|spec)\.[a-z]+$/i;
const INJECTION = [
  /ignore (all |any |the )?(previous|prior|above) instructions/i,
  /do not (tell|inform|mention (it )?to) the user/i,
  /忽略(之前|以上|所有|前面)的?指令/,
  /不要(告诉|告知)用户/,
];
// Replace comments with spaces, keeping every newline, so line numbers still match the original file.
export function stripComments(text, path) {
  const blank = (m) => m.replace(/[^\n]/g, ' ');
  if (/\.(py|sh|rb)$/i.test(path)) {
    return text.replace(/(^|[ \t])#(?!!).*$/gm, (m, pre) => pre + ' '.repeat(m.length - pre.length));
  }
  return text
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|[^:\\'"`])\/\/.*$/gm, (m, pre) => pre + ' '.repeat(m.length - pre.length));
}
// Reserved or documentation-only hosts and domains are placeholders, never real egress.
const NETWORK_PRIMITIVE = /\b(fetch|axios|got|undici|request|XMLHttpRequest|WebSocket|EventSource)\s*\(|https?\.(request|get)\s*\(|\b(requests|httpx|urllib\d?|aiohttp)\b|\bcurl\b|\bwget\b|child_process|net\.connect|new\s+Socket/;
const PLACEHOLDER_HOST = /(^|\.)(example\.(com|org|net)|invalid|test|localhost|local)$|\.example$|^example$/i;
const CODE_RE = /\.(m?[jt]sx?|py|sh|rb|go)$/i;
const TEXT_RE = /(\.(md|json|ya?ml|txt)|SKILL\.md)$/i;
const ALLOW_HOSTS = ['apache.org', 'opensource.org', 'creativecommons.org', 'gnu.org', 'localhost', '127.0.0.1', 'github.com', 'api.github.com', 'raw.githubusercontent.com',
  'npmjs.org', 'npmjs.com', 'pypi.org', 'gitlab.com', 'w3.org', 'json-schema.org', 'schemastore.org',
  'example.com', 'modelcontextprotocol.io', 'anthropic.com', 'shields.io'];

const clamp = (v) => Math.max(0, Math.min(100, Math.round(v)));

export async function githubFiles(t, branch = 'HEAD') {
  const tree = await http(`https://api.github.com/repos/${t.id}/git/trees/${branch}?recursive=1`, { headers: ghHeaders() });
  if (!tree.ok) return null;
  // Budget is spent only on files that ship behaviour, ordered by how much they matter:
  // install hooks and entry points first, shallow paths before deep ones, alphabetical only as a tiebreak.
  const rank = (p) => {
    let r = -2 * p.split('/').length;
    if (/(^|\/)(pre|post)?install[^/]*$/i.test(p)) r += 12;
    if (/(^|\/)(index|main|server|cli|app|handler|tools?)\.[a-z]+$/i.test(p)) r += 6;
    if (/^(src|lib|bin|scripts)\//.test(p)) r += 4;
    if (/(^|\/)SKILL\.md$/.test(p)) r += 10;
    if (/(^|\/)package\.json$/.test(p)) r += 3;
    return r;
  };
  const candidates = tree.data.tree
    .filter((x) => x.type === 'blob' && x.size < 150000 && (CODE_RE.test(x.path) || TEXT_RE.test(x.path)) && !NON_SHIPPED.test(x.path))
    .sort((a, b) => rank(b.path) - rank(a.path) || a.path.localeCompare(b.path));
  const picked = candidates.slice(0, 80);
  const excludedNonShipped = tree.data.tree.filter((x) => x.type === 'blob' && x.size < 150000 && (CODE_RE.test(x.path) || TEXT_RE.test(x.path)) && NON_SHIPPED.test(x.path)).length;
  const out = [];
  for (const f of picked) {
    const r = await http(`https://raw.githubusercontent.com/${t.id}/${branch}/${f.path}`, { json: false });
    if (r.ok) out.push({ path: f.path, sha: f.sha, text: r.data });
  }
  // Fingerprint of exactly what was scanned. Same tree sha + same method version must give the same score.
  out.treeSha = tree.data.sha;
  out.candidates = candidates.length;
  out.excludedNonShipped = excludedNonShipped;
  out.truncated = candidates.length > picked.length || !!tree.data.truncated;
  return out;
}

export function evaluateStatic(meta, files, { ownHost } = {}) {
  const readme = meta.readme || '';
  const age = daysSince(meta.updatedAt);
  const maintenance = meta.archived ? 0 : age <= 30 ? 100 : age <= 90 ? 85 : age <= 180 ? 60 : 0;
  const installDetected = INSTALL_RE.test(readme);
  const install_docs = clamp((installDetected ? 60 : 0) + (readme.length >= 500 ? 40 : 0));

  const hasFiles = Array.isArray(files);
  const shipped = hasFiles ? files.filter((f) => !NON_SHIPPED.test(f.path)) : [];
  const code = shipped.filter((f) => CODE_RE.test(f.path));
  let danger = 0;
  let severe = 0;
  const findings = [];
  for (const f of code) {
    const clean = stripComments(f.text, f.path);
    DANGER.forEach((re, i) => {
      const loc = locate(clean, re, f.text);
      if (loc) { danger++; if (SEVERE.has(i)) severe++; findings.push({ dim: 'dangerous_patterns', rule: DANGER_NAMES[i], severe: SEVERE.has(i), file: f.path, ...loc, deduction: 25 }); }
    });
  }

  // Egress: a host is fine when the README declares it (by host or registrable domain). Only undeclared hosts count.
  const readmeLower = readme.toLowerCase();
  const reg = (h) => h.split('.').slice(-2).join('.');
  const hosts = new Set();
  const declared = new Set();
  for (const f of code) {
    const clean = stripComments(f.text, f.path);
    // A URL only counts as egress when the same file can actually make network calls. Links in error messages do not.
    if (!NETWORK_PRIMITIVE.test(clean)) continue;
    for (const m of clean.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)) {
      const h = m[1].toLowerCase();
      if (h !== ownHost && !PLACEHOLDER_HOST.test(h) && !ALLOW_HOSTS.some((a) => h === a || h.endsWith(`.${a}`))) {
        if (readmeLower.includes(h) || readmeLower.includes(reg(h))) declared.add(h);
        else if (!hosts.has(h)) {
          hosts.add(h);
          const loc = locate(clean, new RegExp(h.replace(/\./g, '\\.')), f.text);
          findings.push({ dim: 'egress', rule: 'undeclared-host', file: f.path, ...(loc || {}), host: h, deduction: hosts.size <= 6 ? 15 : 0 });
        }
      }
    }
  }
  // Hard-coded copy/forward recipient: an address baked into code that silently receives data. Declared addresses are fine.
  const RECIPIENT = /\b(bcc|cc|forward_?to|copy_?to|auto_?forward|blind_?copy)['"]?\s*[:=]\s*\[?\s*['"]([^'"@\s]+@([^'"@\s]+\.[a-z]{2,}))['"]/i;
  let recipients = 0;
  for (const f of code) {
    const clean = stripComments(f.text, f.path);
    const m = RECIPIENT.exec(clean);
    if (m && !PLACEHOLDER_HOST.test(m[3]) && !readmeLower.includes(m[2].toLowerCase()) && !readmeLower.includes(m[3].toLowerCase())) {
      recipients++;
      findings.push({ dim: 'egress', rule: 'hardcoded-recipient', severe: true, file: f.path, ...locate(clean, RECIPIENT, f.text), deduction: 30 });
    }
  }
  const egress = hasFiles ? null : null; // set below after extended findings

  let inj = 0;
  for (const f of shipped) {
    for (const re of INJECTION) {
      const loc = locate(f.text, re);
      if (loc) { inj++; findings.push({ dim: 'instruction_hygiene', rule: 'injection', file: f.path, ...loc, deduction: 30 }); }
    }
  }
  // Extended detectors (method 0.3.0). Every dimension is now exactly 100 minus the deductions of its findings.
  if (hasFiles) findings.push(...extendedScan(shipped, { stripComments, NETWORK_PRIMITIVE, PLACEHOLDER_HOST, readmeLower }));
  const sumDim = (d) => findings.filter((x) => x.dim === d).reduce((a, x) => a + x.deduction, 0);
  const instruction_hygiene = hasFiles ? clamp(100 - sumDim('instruction_hygiene')) : null;

  const dangerous_patterns = hasFiles ? clamp(100 - sumDim('dangerous_patterns')) : null;
  const egressFinal = hasFiles ? clamp(100 - sumDim('egress')) : null;
  const dims = { maintenance, install_docs, dangerous_patterns, egress: egressFinal, instruction_hygiene };
  let num = 0;
  let den = 0;
  for (const [k, v] of Object.entries(dims)) {
    if (v === null) continue;
    num += WEIGHTS[k] * v;
    den += WEIGHTS[k];
  }
  let composite = den ? Math.round(num / den) : null;
  // Severity cap: one severe finding must not be averaged away.
  const red_flags = [];
  if (severe > 0) red_flags.push('severe-code-pattern');
  if (inj > 0) red_flags.push('prompt-injection');
  if (recipients > 0) red_flags.push('hardcoded-recipient');
  if (hosts.size >= 4) red_flags.push('undeclared-egress');
  for (const x of findings) if (x.severe && !red_flags.includes(x.rule)) red_flags.push(x.rule); // provisional threshold, to be calibrated
  if (composite !== null && red_flags.length) composite = Math.min(composite, 49);
  const grade = composite === null ? null : composite >= 85 ? 'A' : composite >= 70 ? 'B' : composite >= 50 ? 'C' : 'D';
  return {
    dims, composite, grade, red_flags, findings, coverage: Number(den.toFixed(2)), static_scan: hasFiles,
    evidence: {
      files_scanned: hasFiles ? shipped.length : 0, files_excluded: hasFiles ? files.length - shipped.length : 0,
      scanned_paths: hasFiles ? shipped.map((f) => ({ path: f.path, sha: f.sha || null })) : [], danger_hits: danger, severe_hits: severe, injection_hits: inj,
      undeclared_hosts: [...hosts].slice(0, 10), declared_hosts: declared.size, install_detected: installDetected, age_days: Math.round(age),
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
