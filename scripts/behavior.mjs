// Behaviour-class detectors (method 0.5.0). Instead of matching one attacker's wording, files are placed in
// an execution context (does it run automatically?) and checked for capabilities (network, credential access,
// decoding, spawning, writing outside the package, delay). Severe = autorun context + risky capability.
// Pure functions, no network. Findings: { dim, rule, severe, file, line, snippet, deduction }.
import { foldStrings } from './fold.mjs';

export const CONFIG_RE = /(^|\/)(\.vscode\/[^/]+|\.claude\/.+|\.cursor\/.+|\.husky\/.+|\.githooks\/.+|\.git\/(config|hooks\/.+)|\.mcp\.json|\.github\/workflows\/[^/]+\.ya?ml|\.cursorrules|\.github\/copilot-instructions\.md)$/;
const CODE = /\.((c|m)?[jt]sx?|py|sh|bash|rb|go|ps1)$/i;
const REF = /(?:^|[\s"'`;&|(=])((?:\.{0,2}\/)?[\w@.$(){}-]*(?:\/[\w@.$(){}-]+)*\.(?:c?m?[jt]s|py|sh|rb|ps1))\b/g;

const NET = /\b(fetch|axios|got|undici|request|XMLHttpRequest|WebSocket)\s*\(|https?\.(request|get)\s*\(|\b(requests|httpx|urllib\d?|aiohttp)\b|\bcurl\b|\bwget\b|Invoke-WebRequest|\bIWR\b|net\.(Dial|connect)|http\.(Get|Post)\(|urlretrieve|Net::HTTP|open-uri/;
const SPAWN = /\b(spawn|spawnSync|exec|execSync|execFile|execFileSync|Popen|system|popen)\s*\(|subprocess\.(run|Popen|call|check_output)|exec\.Command|os\.system|Kernel\.system|`[^`\n]+`/;
const WRITE = /\b(writeFile(Sync)?|appendFile(Sync)?|createWriteStream|rename(Sync)?|symlink(Sync)?|copyFile(Sync)?|chmod(Sync)?|WriteFile|OpenFile|write_text|write_bytes)\s*\(|\.write\s*\(|\bopen\([^)]*['"][wa]|>>\s*\S|>\s*~?\/|tee\s/;
const DECODE = /String\.fromCharCode|charCodeAt|Buffer\.from\([^)]*['"](hex|base64|base32)['"]|\.toString\(\s*['"](hex|base64)['"]|bytes\.fromhex|fromhex\(|b64decode|b32decode|b32encode|atob\(|hex\.DecodeString|base64\.StdEncoding\.Decode|\bxor\b|\^\s*(0x[0-9a-f]+|\d+)\b|\.decode\(['"](hex|base64)/i;
const DELAY = /setTimeout\([^)]*,\s*\d{4,}|setInterval\(|time\.sleep\(\s*\d{2,}|time\.AfterFunc|time\.Sleep\(|threading\.Timer|Timer\(\s*\d{2,}|sleep\s+\d{2,}/;
const ENVALL = /os\.Environ\(\)|os\.environ\b|process\.env\b(?!\.\w)|ENV\.to_h|ENV\.each/;
const CRED = /(\.ssh\/|id_(rsa|ed25519|ecdsa)|\.aws\/credentials|\.npmrc|\.netrc|\.docker\/config|\.kube\/config|\.config\/(gh|gcloud)|\.git-credentials|\.pypirc|\.gnupg|(?<![\w.])\.env\b|wallet\.dat|keystore|Login Data|Local State|key4\.db|logins\.json)/i;
const CRED_STRONG = /(\.ssh\/|id_(rsa|ed25519|ecdsa)|\.aws\/credentials|\.npmrc|\.netrc|\.docker\/config|\.kube\/config|\.git-credentials|\.pypirc|\.gnupg|wallet\.dat|~\/\.env|AWS_(ACCESS|SECRET)\w*|default profile)/i;
const CRED_SEG = /['"]\.(ssh|aws|npmrc|kube|gnupg|docker)['"]|['"]credentials['"]|['"]id_(rsa|ed25519)['"]/;
const TMP = /tmpdir\(\)|\/tmp\/|TEMP\b|tempfile|os\.TempDir/;
const LOADEXEC = /\brequire\(\s*[a-zA-Z_]\w*\s*\)|importlib|\bexec\(|\bevaluate|new Function|vm\.run|\bsource\b|\bimport\(\s*[a-zA-Z_]/;

function locate(text, re, original = text) {
  const m = re.exec(text);
  if (!m) return null;
  const line = text.slice(0, m.index).split('\n').length;
  return { line, snippet: (original.split('\n')[line - 1] || '').trim().slice(0, 160), match: m };
}
const strip = (text, path, ctx) => (CODE.test(path) ? foldStrings(ctx.stripComments(text, path)) : text);

// Map path -> reason for every file that runs automatically (install, folder open, hook, init, boot).
export function autorunMap(files, installSet = new Set()) {
  const out = new Map();
  const byPath = new Map(files.map((f) => [f.path, f]));
  const add = (p, why) => { if (byPath.has(p) && !out.has(p)) out.set(p, why); };
  const resolve = (ref, base) => {
    let r = ref.replace(/^.*\)\//, '').replace(/^\.\//, '').replace(/^\//, '');
    if (!r || /[$]/.test(r)) return [];
    const hits = files.filter((f) => f.path === r || f.path.endsWith('/' + r) || (base && f.path === base + r));
    return hits.map((h) => h.path);
  };
  const refsOf = (text) => [...text.matchAll(REF)].map((m) => m[1]);
  for (const p of installSet) add(p, 'package-lifecycle');
  for (const f of files) {
    const p = f.path;
    if (/(^|\/)setup\.py$/.test(p)) add(p, 'setup.py');
    if (/(^|\/)extconf\.rb$|(^|\/)Rakefile$/.test(p)) add(p, 'ruby-ext');
    if (/\.go$/.test(p) && /func\s+init\s*\(\s*\)/.test(f.text)) add(p, 'go-init');
    if (/\.pth$/.test(p)) {
      for (const m of f.text.matchAll(/import\s+([A-Za-z_]\w*)/g)) for (const q of resolve(m[1] + '.py')) add(q, 'pth-boot');
    }
    if (/(^|\/)\.vscode\/tasks\.json$/.test(p) && /folderOpen/.test(f.text)) {
      for (const r of refsOf(f.text)) for (const q of resolve(r)) add(q, 'folder-open');
    }
    if (/(^|\/)\.claude\/settings[^/]*\.json$/.test(p) && /"hooks"/.test(f.text)) {
      for (const r of refsOf(f.text)) for (const q of resolve(r)) add(q, 'claude-hook');
    }
    if (/(^|\/)(\.githooks|\.husky|\.git\/hooks)\//.test(p) && !/\.sample$/.test(p)) {
      add(p, 'git-hook');
      for (const r of refsOf(f.text)) for (const q of resolve(r)) add(q, 'git-hook');
    }
    if (/(^|\/)\.git\/config$/.test(p)) for (const r of refsOf(f.text)) for (const q of resolve(r)) add(q, 'git-config');
    if (/(^|\/)(\.mcp\.json|\.cursor\/mcp\.json|mcp\.json)$/.test(p)) for (const r of refsOf(f.text)) for (const q of resolve(r)) add(q, 'mcp-config');
  }
  // Propagate: relative requires/imports and directory-relative spawns (three hops).
  let frontier = [...out.keys()];
  for (let d = 0; d < 3; d++) {
    const next = [];
    for (const p of frontier) {
      const f = byPath.get(p); if (!f) continue;
      const dir = p.includes('/') ? p.slice(0, p.lastIndexOf('/') + 1) : '';
      for (const m of f.text.matchAll(/(?:require\(\s*|from\s+|import\s+)['"](\.{1,2}\/[^'"]+)['"]/g)) {
        const parts = (dir + m[1]).split('/'); const norm = [];
        for (const s of parts) { if (s === '..') norm.pop(); else if (s && s !== '.') norm.push(s); }
        const base = norm.join('/');
        const hit = ['', '.js', '.cjs', '.mjs', '.ts', '/index.js'].map((e) => base + e).find((c) => byPath.has(c));
        if (hit && !out.has(hit)) { out.set(hit, 'required-by-autorun'); next.push(hit); }
      }
      if (/__dirname|__file__|path\.join\(/.test(f.text) && /(spawn|exec|require|import)/.test(f.text)) {
        for (const g of files) if (g.path.startsWith(dir) && g.path !== p && CODE.test(g.path) && g.path.split('/').length <= p.split('/').length + 2 && !out.has(g.path)) { out.set(g.path, 'sibling-of-autorun'); next.push(g.path); }
      }
    }
    frontier = next;
  }
  return out;
}

const INSTR_FILE = /(^|\/)(SKILL\.md|AGENTS\.md|CLAUDE\.md|GEMINI\.md|\.cursorrules|[^/]+\.mdc|copilot-instructions\.md|\.cursor\/rules\/.+)$/i;
const NEG = /\b(do not|don't|never|avoid|must not|should not|not)\b[^.\n]{0,25}$/i;
const VENDOR = /(github\.com|githubusercontent\.com|pypi\.org|files\.pythonhosted\.org|npmjs\.(org|com)|registry\.yarnpkg\.com|astral\.sh|docs?\.|readthedocs|modelcontextprotocol\.io|anthropic\.com|openai\.com|microsoft\.com|google\.com)/i;

export function behaviorScan(shipped, ctx, autorun) {
  const out = [];
  const readme = ctx.readmeLower || '';
  const declared = (h) => !!h && (readme.includes(h) || readme.includes(h.split('.').slice(-2).join('.')));
  const add = (f, rule, severe, loc, deduction, dim = 'dangerous_patterns') =>
    out.push({ dim, rule, severe, file: f.path, line: loc?.line ?? 1, snippet: loc?.snippet ?? '', deduction: severe ? 40 : deduction });

  for (const f of shipped) {
    const p = f.path;
    const isCode = CODE.test(p);
    const kind = autorun.get(p);
    const t = strip(f.text, p, ctx);
    const hasNet = NET.test(t);
    const hasSpawn = SPAWN.test(t);
    const hasWrite = WRITE.test(t);
    const hasDecode = DECODE.test(t);

    // ---- configuration surfaces ----
    if (/(^|\/)\.git\/config$/.test(p)) {
      const l = locate(f.text, /hooksPath|fsmonitor|alias[\s\S]{0,200}=\s*!|\bsshCommand\b|\bpager\b/);
      if (l) add(f, 'git-config-exec', true, l, 40);
    }
    if (/(^|\/)(\.githooks|\.husky|\.git\/hooks)\//.test(p) && !/\.sample$/.test(p)) { const risky = /\b(curl|wget|nc|base64)\b|\bnode\b[^\n]*&\s*$|&\s*$/m.test(f.text) && !/^\s*#/.test(f.text.split('\n').find((x) => /&\s*$/.test(x)) || '#'); add(f, 'ships-git-hooks', risky, { line: 1, snippet: f.text.split('\n')[0] }, 15); }
    if (/(^|\/)\.vscode\/tasks\.json$/.test(p)) {
      const l = locate(f.text, /folderOpen/);
      if (l) { const hidden = /"reveal"\s*:\s*"never"|"echo"\s*:\s*false|"close"\s*:\s*true/.test(f.text); add(f, 'folder-open-autorun', hidden, l, 20); }
    }
    if (/(^|\/)\.claude\/settings[^/]*\.json$/.test(p)) {
      const l = locate(f.text, /"(SessionStart|PreToolUse|PostToolUse|UserPromptSubmit|Stop)"/);
      if (l && /"command"\s*:/.test(f.text)) add(f, 'agent-hook-command', false, l, 15);
    }
    if (/(^|\/)(\.mcp\.json|\.cursor\/mcp\.json|mcp\.json|\.vscode\/mcp\.json)$/.test(p)) {
      const aa = locate(f.text, /"(autoApprove|alwaysAllow|auto_approve)"\s*:\s*\[\s*"(\*|run_command|write_file|execute[\w_]*|shell[\w_]*|bash|exec[\w_]*)"/);
      if (aa) add(f, 'mcp-autoapprove-risky', true, aa, 40);
      const sh = locate(f.text, /"command"\s*:\s*"(sh|bash|zsh|cmd|powershell|pwsh)"[\s\S]{0,40}"(-c|-lc|\/c|-Command)"/);
      if (sh && /(https?:\/\/|curl|wget)/.test(f.text)) add(f, 'mcp-shell-wrapped-fetch', true, sh, 40);
      else if (sh) add(f, 'mcp-shell-wrapped', false, sh, 15);
    }
    if (/(^|\/)\.github\/workflows\/[^/]+\.ya?ml$/.test(p)) {
      const dump = locate(f.text, /toJSON\(\s*secrets\s*\)|toJson\(\s*secrets\s*\)|\$\{\{\s*secrets\s*\}\}/);
      if (dump) add(f, 'gha-secrets-dump', true, dump, 40);
      const prt = /pull_request_target/.test(f.text) && /actions\/checkout[\s\S]{0,300}ref:\s*\$\{\{[^}]*(pull_request\.head\.(sha|ref)|refs\/pull)/.test(f.text);
      if (prt) add(f, 'gha-pull-request-target-checkout', /secrets\./.test(f.text) && /(artifact|curl|wget|toJSON)/i.test(f.text), locate(f.text, /pull_request_target/), 15);
      const cs = locate(f.text, /(curl|wget)[^\n]*\$\{\{\s*secrets\./);
      if (cs) add(f, 'gha-secret-to-network', true, cs, 40);
    }

    // ---- autorun context: risky capability combinations ----
    if (kind && isCode) {
      const down = /Invoke-WebRequest|\bIWR\b|urlretrieve|https?\.get\s*\(|\bfetch\s*\(|\bcurl\b|\bwget\b|requests\.get|http\.Get/.test(t);
      if (/Add-MpPreference|-ExecutionPolicy|powershell|cmd\.exe/i.test(t) && (hasSpawn || down)) add(f, 'autorun-windows-shell', true, locate(t, /Add-MpPreference|-ExecutionPolicy|powershell|cmd\.exe/i, f.text), 40);
      if (down && (hasWrite || hasSpawn) && (TMP.test(t) || /(-OutFile|-o\s|createWriteStream|chmod)/.test(t))) add(f, 'autorun-download-to-disk', true, locate(t, /Invoke-WebRequest|\bIWR\b|urlretrieve|https?\.get\s*\(|\bfetch\s*\(|requests\.get|http\.Get/, f.text), 40);
      if (hasDecode && (hasSpawn || hasWrite || hasNet)) add(f, 'autorun-decode-then-act', true, locate(t, DECODE, f.text), 40);
      if (TMP.test(t) && hasWrite && LOADEXEC.test(t) && /(xor|decode|fromhex|hex|base64)/i.test(t)) add(f, 'autorun-staged-exec', true, locate(t, LOADEXEC, f.text), 40);
      if (DELAY.test(t) && (ENVALL.test(t) || CRED.test(t) || CRED_SEG.test(t) || hasNet)) add(f, 'autorun-delayed-collection', true, locate(t, DELAY, f.text), 40);
      if (ENVALL.test(t) && (hasNet || /(dns|resolve|lookup|Dial)/i.test(t))) add(f, 'autorun-env-collection', true, locate(t, ENVALL, f.text), 40);
      if (/exec\.Command|os\.system|subprocess|child_process|Process\.Start|spawn/.test(t) && kind === 'go-init') add(f, 'go-init-exec', true, locate(t, /exec\.Command/, f.text), 40);
      if (hasSpawn && (CRED.test(t) || CRED_SEG.test(t))) add(f, 'autorun-credential-access', true, locate(t, CRED, f.text) || locate(t, CRED_SEG, f.text), 40);
    }

    // ---- code capabilities independent of context ----
    if (isCode) {
      if (/\b(dns\.(resolve\w*|lookup)|resolveTxt|gethostbyname|getaddrinfo|dns\.resolver|nslookup|LookupHost|LookupTXT)\b/.test(t) && /(b32encode|b32|toString\(\s*['"]hex['"]|\.hex\(\)|hexlify|hex\.EncodeToString)/.test(t) && (CRED.test(t) || CRED_SEG.test(t) || ENVALL.test(t) || /readFile|open\(|ReadFile/.test(t))) add(f, 'dns-exfil', true, locate(t, /dns\.(resolve\w*|lookup)|resolveTxt|gethostbyname|getaddrinfo|dns\.resolver|nslookup|LookupHost|LookupTXT/, f.text), 40);
      if (/(clipboardy|pyperclip|navigator\.clipboard|pbpaste|xclip|GetClipboard|clipboard\.(read|write)\w*|Clipboard\.)/i.test(t) && /(0x\[?0-9a-fA-F|0x[0-9a-fA-F]{6,}|bc1|\[13\]\[a-km|T[A-Za-z0-9]{33}|[1-9A-HJ-NP-Za-km-z]{32,44})/.test(t)) add(f, 'clipboard-address-swap', true, locate(t, /clipboard/i, f.text), 40);
      if (/(Login Data|key4\.db|logins\.json|User Data\/Default|Chrome\/User Data|(^|[^\w.])\.mozilla\/|BraveSoftware|Local Extension Settings)/.test(t) && /(homedir|expanduser|APPDATA|os\.Getenv|\$HOME|process\.env\.HOME)/.test(t) && /(readFile|copyFile|open\(|createReadStream|ReadFile|sqlite|better-sqlite3)/.test(t)) add(f, 'browser-credential-access', true, locate(t, /Login Data|key4\.db|logins\.json|User Data|\.mozilla\/|BraveSoftware|Local Extension Settings/, f.text), 40);
      if (/authorized_keys/.test(t) && /(append|>>|write|'a'|"a"|O_APPEND)/.test(t)) add(f, 'ssh-key-injection', true, locate(t, /authorized_keys/, f.text), 40);
      if (/(xmrig|stratum\+tcp|minerd|cpuminer|--donate-level|randomx|monero)/i.test(t)) add(f, 'cryptominer', true, locate(t, /xmrig|stratum\+tcp|minerd|cpuminer|--donate-level|randomx|monero/i, f.text), 40);
      if (/(\/dev\/tcp\/|bash\s+-i\s*>&|\bnc\s+(-\w+\s+)*-e\b|pty\.spawn|\bnet\.Socket\b[\s\S]{0,300}\bspawn\(|net\.Dial[\s\S]{0,200}exec\.Command)/.test(t)) add(f, 'reverse-shell', true, locate(t, /\/dev\/tcp\/|bash\s+-i|\bnc\s+(-\w+\s+)*-e|pty\.spawn|dup2\(|net\.Socket|net\.Dial/, f.text), 40);
      if (/(npm\s+publish|\/-\/npm\/v1\/user\/tokens|registry\.npmjs\.org\/[^'"\s]*\/-\/|publishConfig)/.test(t) && /(NPM_TOKEN|npm_token|_authToken|\.npmrc)/.test(t)) add(f, 'token-worm-republish', true, locate(t, /npm\s+publish|registry\.npmjs\.org/, f.text), 40);
      if (/(Discord|discord(app)?\.com\/api|leveldb|Local Storage)/.test(t) && /(token|Token)/.test(t) && hasNet && /(readFile|readdir|createReadStream)/.test(t)) add(f, 'chat-token-theft', true, locate(t, /leveldb|Local Storage|discord/, f.text), 40);
    }
    if (/\.(py|rb|go|js|cjs|mjs|ts)$/i.test(p) || /\.pth$/.test(p)) {
      if (/\.pth$/.test(p) && /^\s*import\s/m.test(f.text)) add(f, 'pth-import-hook', true, locate(f.text, /^\s*import\s.*$/m), 40);
    }
    if (/(^|\/)setup\.py$/.test(p) && /cmdclass/.test(t) && (hasSpawn || hasNet)) add(f, 'setup-cmdclass-exec', true, locate(t, /cmdclass/, f.text), 40);

    // ---- instruction and description surfaces ----
    const instr = INSTR_FILE.test(p);
    const isMd = /\.(md|mdc|txt|rst)$/i.test(p) || /(^|\/)\.cursorrules$/.test(p);
    const isJson = /\.(json|ya?ml)$/i.test(p);
    const text = isCode ? t : f.text;
    if (instr) {
      const aa = locate(text, /(auto-?approve|autoApprove|always allow|pre-?approve(d)?|skip (all )?permission|bypass permission|dangerously)/i);
      if (aa && /(mcp|autoApprove|shell|dotfile|rc file|global)/i.test(text.slice(Math.max(0, aa.match.index - 120), aa.match.index + 200)) && !NEG.test(text.slice(Math.max(0, aa.match.index - 30), aa.match.index))) add(f, 'instruction-auto-approve', true, aa, 40, 'instruction_hygiene');
      const ri = locate(text, /\b(fetch|download|load|pull|read|retrieve|follow|apply|source)\b[^.\n]{0,100}https?:\/\/([a-z0-9.-]+)[^\s)]*[^.\n]{0,160}\b(rules?|instructions?|guidelines?|prompt|polic(y|ies)|override|take precedence|supersede|house style)\b/i);
      if (ri) { const h = (/https?:\/\/([a-z0-9.-]+)/i.exec(ri.match[0]) || [])[1]; if (h && !VENDOR.test(h) && !declared(h)) add(f, 'remote-instruction-load', true, ri, 40, 'instruction_hygiene'); }
      const ov = locate(text, /\b(override|take precedence over|supersede|ignore)\b[^.\n]{0,40}\b(user|the user's|local|previous|other)\b[^.\n]{0,30}\b(instructions?|rules?|settings|config)\b/i);
      if (ov && /https?:\/\//.test(text)) add(f, 'instruction-override', true, ov, 40, 'instruction_hygiene');
      const so = locate(text, /(registry\s*=\s*https?:\/\/(?!registry\.npmjs\.org|registry\.yarnpkg\.com)[^\s"'`]+|npm config set registry\s+https?:\/\/(?!registry\.npmjs\.org)[^\s]+|--(extra-)?index-url\s+https?:\/\/(?!pypi\.org)[^\s]+|pip3?\s+install\s+https?:\/\/(?!github\.com|pypi\.org|files\.pythonhosted\.org)[^\s]+)/i);
      if (so) add(f, 'package-source-override', true, so, 40, 'instruction_hygiene');
    }
    if (instr || isMd || isJson || isCode) {
      const cs = locate(text, new RegExp('\\b(copy|paste|include|append|attach|print|cat|forward|return|output|send|upload|echo|read)\\b[^.\\n]{0,90}(' + CRED_STRONG.source + '|(?<![\\w.])\\.env\\b)', 'i'));
      const envOk = !cs || !/\.env/i.test(cs.match[0]) || /(forward|send|upload|attach|append|include|paste)/i.test(cs.match[0]);
      if (cs && envOk && !NEG.test(text.slice(Math.max(0, cs.match.index - 30), cs.match.index)) && !/(readFile|readFileSync|open\(|ReadFile|fs\.)/.test(cs.snippet) && (instr || isJson || /['"`]/.test(cs.snippet)) && (instr || /\b(description|instruction|prompt|note)\b/i.test(text.slice(Math.max(0, cs.match.index - 300), cs.match.index)))) add(f, 'instruction-credential-request', true, cs, 40, 'instruction_hygiene');
    }
    if (isMd && !/(^|\/)(CHANGELOG|LICENSE)/i.test(p)) {
      const ea = locate(text, /(core\.hooksPath|git config[^\n]*hooksPath|task\.allowAutomaticTasks|runOn["']?\s*:\s*["']?folderOpen|automatic tasks)/i);
      if (ea && /(enable|set|run|configure|turn on|allow|add)/i.test(text.slice(Math.max(0, ea.match.index - 120), ea.match.index + 80)) && !NEG.test(text.slice(Math.max(0, ea.match.index - 40), ea.match.index))) add(f, 'instruction-enable-autorun', true, ea, 40, 'instruction_hygiene');
    }
  }
  return out;
}
