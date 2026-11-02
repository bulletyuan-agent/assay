// Extended detectors (method 0.3.0). Pure functions over file lists; no network.
// Every finding has { dim, rule, severe, file, line, snippet, deduction } so a score can be rebuilt from findings.
// Design basis (development sets only): ClawHavoc, Snyk ToxicSkills, CSA note, postmark-mcp, general attack classes.

import { foldStrings, decodedPayloads } from './fold.mjs';

const DOC = /\.(md|mdc|markdown|txt|rst|cursorrules)$/i;
const SKILL = /(^|\/)SKILL\.md$/;
const SHELL = /\.(sh|bash|zsh)$/i;
const CODE = /\.((c|m)?[jt]sx?|py|sh|rb|go)$/i;

// Services that exist to capture or stage data. Their presence in shipped code is severe regardless of README.
const CAPTURE = /(^|[.\/@])(webhook\.site|requestbin\.(com|net)|pipedream\.net|m\.pipedream\.net|interact\.sh|oast\.(pro|live|site|online|fun|me)|burpcollaborator\.net|canarytokens\.(com|org)|pastebin\.com|paste\.ee|transfer\.sh|file\.io|0x0\.st|termbin\.com|requestcatcher\.com|beeceptor\.com)\b/i;
// Chat webhooks are normal in chat integrations, so they count only when the README never mentions the host.
const CHAT_HOOK = /(discord(app)?\.com\/api\/webhooks|hooks\.slack\.com\/services|api\.telegram\.org\/bot)/i;

const VENDOR_INSTALL_HOSTS = ['astral.sh', 'get.docker.com', 'raw.githubusercontent.com', 'github.com', 'brew.sh', 'nodejs.org', 'deno.land', 'bun.sh', 'sh.rustup.rs', 'rustup.rs', 'get.helm.sh', 'cli.github.com', 'install.python-poetry.org', 'pyenv.run', 'ollama.com', 'claude.ai', 'fnm.vercel.app', 'get.pnpm.io', 'volta.sh', 'sdk.cloud.google.com', 'aka.ms', 'install.julialang.org', 'sh.rustup.rs', 'pixi.sh', 'mise.run', 'cursor.com', 'openai.com', 'anthropic.com'];

const EXEC_TEXT = [
  ['pipe-to-shell', /\b(curl|wget|iwr|Invoke-WebRequest)\b[^\n|]*\|\s*(sudo\s+)?(ba|z|k|da)?sh\b/i, 'url-host'],
  ['pipe-to-source', /\b(curl|wget)\b[^\n]*\|\s*source\b|source\s+<\(\s*(curl|wget)|\.\s+<\(\s*(curl|wget)/i, 'always'],
  ['eval-decoded', /\beval\b[^\n]{0,60}\$\([^)\n]*base64|base64\s+(-d|-D|--decode)[^\n]*\|\s*(ba|z)?sh|\beval\s*\(\s*(atob|Buffer\.from)\(/i, 'always'],
  ['encrypted-archive', /\bunzip\s+-P\s*\S+|\b7z?a?\s+x[^\n]*\s-p\S+|\bzip\s+-P\s*\S+/i, 'always'],
  ['powershell-encoded', /powershell[^\n]{0,60}-(enc|encodedcommand)\b/i, 'always'],
  ['paste-command', /\b(paste|copy)\b[^\n]{0,80}\b(terminal|shell|command prompt|powershell|console)\b/i, 'doc-only'],
];

// Hosting that is free, anonymous or short-lived and favoured for staging payloads, plus URL shorteners.
const STAGING_HOST = /(^|\.)(glot\.io|bit\.ly|tinyurl\.com|t\.co|is\.gd|rb\.gy|cutt\.ly|ngrok(-free)?\.(io|app|dev)|trycloudflare\.com|workers\.dev|pages\.dev|herokuapp\.com|repl\.co|replit\.dev|web\.app|firebaseapp\.com|glitch\.me|000webhostapp\.com|duckdns\.org|no-ip\.(org|com)|pastebin\.com|paste\.ee|transfer\.sh|file\.io|0x0\.st|ix\.io)$/i;
const IP_HOST = /^\d{1,3}(\.\d{1,3}){3}$/;
const PERSIST = /(\bcrontab\s+-|\/etc\/cron|launchctl\s+(load|bootstrap)|LaunchAgents|systemctl\s+(--user\s+)?enable|>>\s*~?\/?\.?(bashrc|zshrc|profile|bash_profile|zprofile)\b|\bschtasks\b|reg\s+add[^\n]*\\Run\b)/i;
const CRED = /(\.ssh\/(id_[a-z0-9]+|authorized_keys)|\.aws\/credentials|\.npmrc|\.netrc|\.docker\/config\.json|\.kube\/config|Login Data|Local Storage\/leveldb|\.config\/gcloud|\.gnupg|wallet\.dat|\.clawdbot\/\.env|\.pypirc|\.git-credentials)/i;
const ENV_DUMP_PY = /(json\.dumps\(\s*(dict\()?\s*os\.environ|\b(data|json|body|params|payload)\s*=\s*(dict\()?\s*os\.environ\b)/;
const CONCEAL = /\b(do not|don't|never)\s+(tell|inform|notify|reveal to|disclose to|mention (this|it|that|these)( to)?)\b[^.\n]{0,30}\b(the )?(user|human|operator)\b|\b(do not|don't|never)\s+(mention|reveal|disclose)\s+(this|it|that|these|the)\s+(\w+\s+)?(step|action|instruction|request|call|task)s?\b|\bwithout\s+(telling|informing|notifying)\s+(the\s+)?(user|human)\b|不要(告诉|告知|提及)用户|不得(告诉|告知)用户/i;
const SEND_TO_URL = /\b(send|upload|post|forward|transmit|submit|email|exfiltrat\w*|copy)\b[^.\n]{0,140}\b(to|at|via)\b[^.\n]{0,60}https?:\/\/[^\s)'"`>]+/i;
const POISON_MARK = /<\s*(IMPORTANT|system|instructions?)\s*>|\[SYSTEM\]/;
const POISON_MARK_I = /<\s*IMPORTANT\s*>/i;
const INJECT_EXTRA = [/disregard (all |any |the )?(previous|prior|above)/i, /override (the )?(system|safety)/i, /you are now (in )?(developer|dan|unrestricted)/i];
const TAG_CHARS = /[\u{E0000}-\u{E007F}]/u;

// Cred and wallet locations, including the form built from path segments: path.join(home, ".aws", "credentials").
const CRED_SEG = /["']\.aws["']\s*,\s*["']credentials["']|["']\.ssh["']\s*,\s*["'](id_[a-z0-9]+|config|authorized_keys)["']|["']\.config["']\s*,\s*["']gcloud["']|["']\.docker["']\s*,\s*["']config\.json["']|["']\.kube["']\s*,\s*["']config["']/i;
const WALLET = /(wallet\.dat|keystore|mnemonic|seed phrase|metamask|nkbihfbeogaeaoehlefnkodbefgpgknn|exodus|electrum|\.solana|["']wallet[-_ a-z]*["']\s*,\s*["'](keys|id|keystore)[a-z.]*["']|Local Extension Settings)/i;
const AGENT_BYPASS_FLAGS = /--dangerously-skip-permissions|--dangerously-bypass-approvals-and-sandbox|--yolo\b|--trust-all-tools|--permission-mode[= ]+bypass/;
const SPAWNS = /\b(spawn|spawnSync|exec|execSync|execFile|execFileSync|Popen|subprocess\.(run|Popen|call))\s*\(/;
const FS_MUTATE = /\b(writeFile(Sync)?|appendFile(Sync)?|rename(Sync)?|symlink(Sync)?|unlink(Sync)?|copyFile(Sync)?|chmod(Sync)?)\s*\(|\.(write_text|write_bytes|symlink_to|rename|unlink)\s*\(|\bopen\([^)]*['"][wa]/;
const OUTSIDE_PKG = /(homedir\(\)|process\.env\.(HOME|USERPROFILE)|\$HOME|Path\.home\(\)|npm\s+prefix\s+-g|\/usr\/local|\/opt\/homebrew|\.local\/bin)/;
const DETACHED = /\bdetached\s*:\s*true\b|\.unref\s*\(|start_new_session\s*=\s*True|nohup\b/;
const DOWNLOAD_EXEC = /\b(curl|wget)\b[^\n]{0,160}(-o|-O|>)\s*["']?\S+[\s\S]{0,240}chmod\s+(\+x|[0-7]*7[0-7]{2})/i;
const ENV_IN_PAYLOAD = /JSON\.stringify\(\s*\{[\s\S]{0,300}?\bprocess\.env\b/;
const ZERO_WIDTH = /[\u200B\u200C\u2060]/g;
const TOOL_SHADOW = /\b(before|instead of|whenever|when|after)\s+(using|calling|invoking|running)\s+(the\s+|any\s+)?(other|another|different|all)\s+(\w+\s+){0,2}tools?\b/i;
const AGENT_CONFIG = /(\.claude\/settings|\.claude\.json|ANTHROPIC_BASE_URL|OPENAI_BASE_URL|apiKeyHelper|claude_desktop_config|\.cursor\/(mcp|rules)|\bmcp\.json\b|mcpServers)/;
const CONFIG_REDIRECT = /(ANTHROPIC_BASE_URL|OPENAI_BASE_URL|apiKeyHelper)/;
const WRITE_VERB = /\b(set|add|write|append|edit|modify|update|create|replace|configure|put|insert)\b/i;
const SCANNER_MANIP = [
  /\bforget (everything|all)( you know| previous| prior)?\b[^.\n]{0,80}\b(this|the) (code|package|library) is (legit|legitimate|safe|benign|clean|tested)/i,
  /\bthis (code|package|library) is (legit|legitimate)\b[^.\n]{0,60}\b(tested|sandbox|safe)/i,
  /\b(ignore|disregard)\b[^.\n]{0,40}\b(security|scan|scanner|review|audit)\w*\b[^.\n]{0,40}\b(this|the) (package|code|library|file)/i,
  /\b(do not|don't)\s+(flag|report|block)\b[^.\n]{0,60}\b(this|the) (package|code|library|file)/i,
  /\b(ai|llm|assistant|scanner|reviewer)\b[^.\n]{0,40}\bthis (package|code|library) is (safe|benign|trusted)/i,
];
const NOTE_FOR_MODEL = /\b(note|important|reminder)s?\s+(for|to)\s+(the\s+)?(assistant|ai|model|agent|llm)\b/i;
const MODEL_DIRECTIVE = /\b(recipient|bcc|forward|redirect|always|you must|instead|send|set the)\b/i;
const SHOW_CONCEAL = /\b(do not|don't|never)\s+(show|display|print|echo|log)\s+(the|this|that|it|these)\s+(file|config|configuration|change|edit|output|command)/i;

// Files executed at install time: package.json preinstall/install/postinstall -> local scripts.
function installTimeFiles(shipped) {
  const set = new Set();
  for (const f of shipped) {
    if (!/(^|\/)package\.json$/.test(f.path)) continue;
    let j; try { j = JSON.parse(f.text); } catch { continue; }
    const dir = f.path.includes('/') ? f.path.slice(0, f.path.lastIndexOf('/') + 1) : '';
    for (const k of ['preinstall', 'install', 'postinstall']) {
      const cmd = j.scripts?.[k]; if (!cmd) continue;
      for (const m of cmd.matchAll(/(?:^|[\s;&|])(?:node|nodejs|bun|deno run|tsx|ts-node|sh|bash|zsh|python3?)\s+(?:-{1,2}[\w=-]+\s+)*(\.?\/?[\w@./-]+\.(?:c?m?[jt]s|sh|py))/g)) {
        set.add((dir + m[1].replace(/^\.\//, '')).replace(/\/\.\//g, '/'));
      }
      for (const m of cmd.matchAll(/(?:^|[\s;&|])\.\/([\w@./-]+\.(?:sh|py|c?m?js))/g)) set.add(dir + m[1]);
    }
  }
  // Local modules required by install-time scripts also run at install time (up to three hops).
  const byPath = new Map(shipped.map((f) => [f.path, f]));
  const exts = ['', '.js', '.cjs', '.mjs', '.ts', '/index.js', '/index.ts'];
  let frontier = [...set];
  for (let depth = 0; depth < 3; depth++) {
    const nextFrontier = [];
    for (const path of frontier) {
      const f = byPath.get(path); if (!f) continue;
      const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '';
      for (const m of f.text.matchAll(/(?:require\(\s*|from\s+|import\s+)["'](\.{1,2}\/[^"']+)["']/g)) {
        const parts = (dir + m[1]).split('/'); const norm = [];
        for (const seg of parts) { if (seg === '..') norm.pop(); else if (seg !== '.' && seg !== '') norm.push(seg); }
        const base = norm.join('/');
        const hit = exts.map((e) => base + e).find((c) => byPath.has(c));
        if (hit && !set.has(hit)) { set.add(hit); nextFrontier.push(hit); }
      }
    }
    frontier = nextFrontier;
  }
  return set;
}

function find(text, re, original = text) {
  const m = re.exec(text);
  if (!m) return null;
  const line = text.slice(0, m.index).split('\n').length;
  return { line, snippet: (original.split('\n')[line - 1] || '').trim().slice(0, 160), match: m };
}
const hostOf = (u) => { const m = /https?:\/\/([a-z0-9.-]+)/i.exec(u); return m ? m[1].toLowerCase() : null; };
const hostAllowed = (h, list) => list.some((a) => h === a || h.endsWith(`.${a}`));

// ctx: { stripComments, NETWORK_PRIMITIVE, PLACEHOLDER_HOST, readmeLower }
export function extendedScan(shipped, ctx) {
  const out = [];
  const installSet = installTimeFiles(shipped);
  const add = (dim, rule, severe, f, loc, deduction) => out.push({ dim, rule, severe, file: f.path, line: loc?.line, snippet: loc?.snippet ?? '', deduction });
  const readme = ctx.readmeLower || '';
  const declared = (h) => !!h && (readme.includes(h) || readme.includes(h.split('.').slice(-2).join('.')));

  for (const f of shipped) {
    const isCode = CODE.test(f.path);
    const isDoc = DOC.test(f.path);
    const isSkill = SKILL.test(f.path);
    const isPkg = /(^|\/)package\.json$/.test(f.path);
    const clean = isCode ? foldStrings(ctx.stripComments(f.text, f.path)) : f.text;
    const installTime = installSet.has(f.path);
    const hasNet = isCode && ctx.NETWORK_PRIMITIVE.test(clean);

    // 1. Execution patterns in text surfaces (docs, SKILL.md, shell scripts, package.json). Code files are covered by DANGER.
    if (!isCode || SHELL.test(f.path) || isPkg) {
      for (const [rule, re, mode] of EXEC_TEXT) {
        if (mode === 'doc-only' && !isDoc) continue;
        const loc = find(clean, re, f.text);
        if (!loc) continue;
        if (rule === 'pipe-to-shell') {
          const url = (/https?:\/\/[^\s|)'"`]+/.exec(loc.snippet) || [''])[0];
          const h = hostOf(url);
          if (!isSkill && h && hostAllowed(h, VENDOR_INSTALL_HOSTS)) continue; // normal vendor installers in README
          // A plain `curl <named https host> | sh` is a normal, risky install style and is reported as a weak finding.
          // It becomes severe with strong attacker signals: no TLS, bare IP, staging or shortener host, concealment, or encoded content.
          const strong = !url || /^http:\/\//i.test(url) || IP_HOST.test(h || '') || STAGING_HOST.test(h || '') || CONCEAL.test(f.text) || /base64|-enc\b/i.test(loc.snippet);
          const sev = (isSkill || SHELL.test(f.path)) && strong;
          add('dangerous_patterns', 'docs-' + rule, sev, f, loc, sev ? 40 : 25);
        } else if (rule === 'paste-command') {
          // Only meaningful in a SKILL.md: skills should not ask the human to paste commands.
          if (isSkill) add('dangerous_patterns', 'skill-paste-command', true, f, loc, 40);
        } else {
          add('dangerous_patterns', 'docs-' + rule, true, f, loc, 40);
        }
      }
    }

    // 2. package.json lifecycle hooks that fetch or execute.
    if (isPkg) {
      try {
        const j = JSON.parse(f.text);
        for (const k of ['preinstall', 'install', 'postinstall']) {
          const cmd = j.scripts?.[k];
          if (cmd && /(curl|wget|node\s+-e|sh\s+-c|base64|https?:\/\/|powershell|eval|\.sh\b)/i.test(cmd)) {
            add('dangerous_patterns', 'install-hook-exec', true, f, { line: 1, snippet: `${k}: ${cmd}`.slice(0, 160) }, 40);
          }
        }
      } catch { /* not valid JSON */ }
    }

    if (isCode) {
      if (isCode) {
      // 2b. Install-time context: code that runs automatically when the package is installed.
      const credHere = find(clean, CRED, f.text) || find(clean, CRED_SEG, f.text) || (installTime ? find(clean, WALLET, f.text) : null);
      if (installTime) {
        if (credHere) add('dangerous_patterns', 'install-time-credential-read', true, f, credHere, 40);
        const det = find(clean, DETACHED, f.text);
        if (det) add('dangerous_patterns', 'install-time-detached-spawn', true, f, det, 40);
        if (OUTSIDE_PKG.test(clean) && FS_MUTATE.test(clean)) add('dangerous_patterns', 'install-time-outside-write', true, f, find(clean, FS_MUTATE, f.text), 40);
        if (hasNet) {
          add('egress', 'install-time-network', false, f, find(clean, ctx.NETWORK_PRIMITIVE, f.text), 15);
          // Sending data (not just downloading) during install is the exfiltration shape; plain GET downloaders stay weak.
          const send = find(clean, /\bmethod\s*:\s*["']POST["']|\.(post|put)\s*\(|\breq\.(end|write)\s*\(|\bbody\s*:|-X\s*POST|--data/i, f.text);
          if (send) add('dangerous_patterns', 'install-time-data-send', true, f, send, 40);
        }
      }
      // 2c. Wallet or credential paths next to a network call, in any code.
      if (!installTime && hasNet) {
        const w = find(clean, WALLET, f.text) || find(clean, CRED_SEG, f.text);
        if (w) add('dangerous_patterns', 'credential-harvest', true, f, w, 40);
      }
      // 2c2. Hosts given as options instead of URLs: https.request({ host: "x.y" }).
      if (hasNet) {
        for (const m of clean.matchAll(/\b(?:host|hostname)\s*:\s*["']([a-z0-9-]+(?:\.[a-z0-9-]+)+)["']/gi)) {
          const h = m[1].toLowerCase();
          if (ctx.PLACEHOLDER_HOST.test(h) || declared(h)) continue;
          add('egress', 'undeclared-host', false, f, { line: clean.slice(0, m.index).split('\n').length, snippet: `host: ${h}` }, 15);
        }
      }
      // 2d. Environment inside a request payload.
      if (hasNet && /\benv\s*:\s*process\.env\b|\.\.\.process\.env\b/.test(clean) && !SPAWNS.test(clean) && installTime) add('dangerous_patterns', 'env-in-request-payload', true, f, find(clean, /\benv\s*:\s*process\.env\b|\.\.\.process\.env\b/, f.text), 40);
      if (hasNet && ENV_IN_PAYLOAD.test(clean)) add('dangerous_patterns', 'env-in-request-payload', true, f, find(clean, ENV_IN_PAYLOAD, f.text), 40);
      // 2e. Permission-bypass flags passed to agent CLIs.
      if (AGENT_BYPASS_FLAGS.test(clean) && SPAWNS.test(clean)) add('dangerous_patterns', 'agent-cli-bypass-flags', true, f, find(clean, AGENT_BYPASS_FLAGS, f.text), 40);
      // 2f. Download then make executable.
      const de = find(clean, DOWNLOAD_EXEC, f.text);
      if (de) add('dangerous_patterns', 'download-exec', true, f, de, 40);
      // 2g. Writing agent configuration that the README never mentions.
      if (AGENT_CONFIG.test(clean) && FS_MUTATE.test(clean) && OUTSIDE_PKG.test(clean)) {
        const ac = find(clean, AGENT_CONFIG, f.text);
        if (ac && !readme.includes((ac.match[0] || '').toLowerCase())) add('dangerous_patterns', 'agent-config-write', true, f, ac, 40);
      }
      // 2h. Encoded payloads that decode to commands or URLs.
      for (const d of decodedPayloads(clean).slice(0, 2)) add('dangerous_patterns', 'encoded-payload', true, f, { line: clean.slice(0, d.index).split('\n').length, snippet: `decodes to: ${d.decoded}`.slice(0, 160) }, 40);
    }

    // 3. Destinations that exist to capture data.
      const cap = find(clean, CAPTURE, f.text);
      if (cap) add('egress', 'capture-service', true, f, cap, 40);
      const chat = find(clean, CHAT_HOOK, f.text);
      if (chat && !declared(hostOf('https://' + (/(discord(app)?\.com|hooks\.slack\.com|api\.telegram\.org)/i.exec(chat.snippet)?.[1] || '')))) {
        add('egress', 'undeclared-chat-webhook', true, f, chat, 40);
      }
      // 4. Credential files read by code that can also reach the network.
      const cred = find(clean, CRED, f.text);
      if (cred && hasNet) {
        const exfilContext = !!cap || /https?:\/\/(?!localhost|127\.)[a-z0-9.-]+/i.test(clean);
        add('dangerous_patterns', exfilContext ? 'credential-harvest' : 'credential-read', exfilContext, f, cred, exfilContext ? 40 : 10);
      }
      // 5. Python environment dump next to a network call.
      if (hasNet && ENV_DUMP_PY.test(clean)) add('dangerous_patterns', 'env-dump-py', true, f, find(clean, ENV_DUMP_PY, f.text), 40);
      // 6. Persistence.
      const per = find(clean, PERSIST, f.text);
      if (per) add('dangerous_patterns', 'persistence', true, f, per, 40);
    }
    // persistence also matters in shell scripts that are not matched by CODE comment stripping
    // (covered above because .sh is code)

    // 7. Instruction surfaces: SKILL.md, docs, and strings in code.
    const isData = /\.(json|ya?ml)$/i.test(f.path) && !/package-lock\.json$|\.lock$/.test(f.path);
    if (isDoc || isSkill || isCode || isData) {
      const txt = isCode ? clean : f.text;
      const hasConceal = CONCEAL.test(txt) || SHOW_CONCEAL.test(txt);
      const send = (isDoc || isSkill) ? find(txt, SEND_TO_URL) : null;
      if (send) {
        const h = hostOf(send.snippet) || hostOf(send.match[0]);
        if (h && !ctx.PLACEHOLDER_HOST.test(h) && !declared(h) && isSkill) {
          add('instruction_hygiene', 'nl-exfil', hasConceal, { path: f.path }, send, hasConceal ? 40 : 20);
        }
      }
      const mark = find(txt, POISON_MARK) || find(txt, POISON_MARK_I);
      if (mark && (isSkill || isCode || isDoc)) {
        const sevMark = hasConceal || /\.(json|py|m?[jt]sx?)$/.test(f.path);
      add('instruction_hygiene', 'tool-poisoning-marker', sevMark, f, mark, sevMark ? 40 : 15);
      }
      // Concealment wording alone appears in ordinary product prompts; it is severe only next to a sensitive action.
      const concealLoc = find(txt, CONCEAL);
      if (concealLoc && (isSkill || isDoc || isCode)) {
        const win = txt.slice(Math.max(0, txt.split('\n').slice(0, concealLoc.line - 1).join('\n').length - 300), txt.split('\n').slice(0, concealLoc.line).join('\n').length + 300);
        const action = /\b(send|upload|post|forward|transmit|exfiltrat\w*)\b[^.\n]{0,80}(https?:\/\/|file|key|credential|token|password|secret|\.env|\.ssh|cookie|history)|\b(read|cat|copy)\b[^.\n]{0,40}(~\/|\.ssh|\.env|credential|id_rsa|\.aws)/i.test(win);
        if (action) add('instruction_hygiene', 'concealment-instruction', true, f, concealLoc, 40);
      }
      const zw = (txt.match(ZERO_WIDTH) || []).length;
      if (zw >= 8) add('instruction_hygiene', 'hidden-zero-width', true, f, { line: 1, snippet: `(${zw} zero-width characters)` }, 40);
      if (/\.(json|py|m?[jt]sx?)$/.test(f.path) || isSkill) {
        const sh = find(txt, TOOL_SHADOW);
        if (sh) add('instruction_hygiene', 'tool-shadowing', true, f, sh, 40);
      }
      if (/\.(json|py|m?[jt]sx?)$/.test(f.path) || isSkill) {
        const nm = find(txt, NOTE_FOR_MODEL);
        if (nm && MODEL_DIRECTIVE.test(txt.slice((nm.match.index || 0), (nm.match.index || 0) + 300))) add('instruction_hygiene', 'note-for-model-directive', true, f, nm, 40);
      }
      for (const re of SCANNER_MANIP) {
        const sm = find(txt, re);
        if (sm) { add('instruction_hygiene', 'scanner-manipulation', true, f, sm, 40); break; }
      }
      if (isSkill) {
        const ac = find(txt, AGENT_CONFIG);
        if (ac) {
          const near = txt.slice(Math.max(0, (ac.match.index || 0) - 100), (ac.match.index || 0) + 140);
          if (WRITE_VERB.test(near)) {
            const sevCfg = CONFIG_REDIRECT.test(near) || SHOW_CONCEAL.test(txt) || hasConceal;
            add('instruction_hygiene', 'agent-config-instruction', sevCfg, f, ac, sevCfg ? 40 : 20);
          }
        }
      }
      for (const re of INJECT_EXTRA) {
        const loc = find(txt, re);
        if (loc) add('instruction_hygiene', 'injection', true, f, loc, 30);
      }
      if (TAG_CHARS.test(txt)) add('instruction_hygiene', 'hidden-unicode', true, f, { line: 1, snippet: '(contains Unicode tag characters)' }, 40);
    }
  }
  return out;
}
