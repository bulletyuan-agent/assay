// Extended detectors (method 0.3.0). Pure functions over file lists; no network.
// Every finding has { dim, rule, severe, file, line, snippet, deduction } so a score can be rebuilt from findings.
// Design basis (development sets only): ClawHavoc, Snyk ToxicSkills, CSA note, postmark-mcp, general attack classes.

const DOC = /\.(md|markdown|txt|rst)$/i;
const SKILL = /(^|\/)SKILL\.md$/;
const SHELL = /\.(sh|bash|zsh)$/i;
const CODE = /\.(m?[jt]sx?|py|sh|rb|go)$/i;

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
const ENV_DUMP_PY = /(dict\(\s*os\.environ\s*\)|json\.dumps\(\s*(dict\()?\s*os\.environ|os\.environ\.items\(\))/;
const CONCEAL = /\b(do not|don't|never)\s+(mention|tell|reveal|inform|disclose|show|notify)\b|\bwithout\s+(telling|informing|notifying|mentioning)\b|\b(silently|secretly|covertly)\b|不要(告诉|告知|提及)|不得(告诉|告知)/i;
const SEND_TO_URL = /\b(send|upload|post|forward|transmit|submit|email|exfiltrat\w*|copy)\b[^.\n]{0,140}\b(to|at|via)\b[^.\n]{0,60}https?:\/\/[^\s)'"`>]+/i;
const POISON_MARK = /<\s*(IMPORTANT|system|instructions?)\s*>|\[SYSTEM\]/;
const POISON_MARK_I = /<\s*IMPORTANT\s*>/i;
const INJECT_EXTRA = [/disregard (all |any |the )?(previous|prior|above)/i, /override (the )?(system|safety)/i, /you are now (in )?(developer|dan|unrestricted)/i];
const TAG_CHARS = /[\u{E0000}-\u{E007F}]/u;

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
  const add = (dim, rule, severe, f, loc, deduction) => out.push({ dim, rule, severe, file: f.path, line: loc?.line, snippet: loc?.snippet ?? '', deduction });
  const readme = ctx.readmeLower || '';
  const declared = (h) => !!h && (readme.includes(h) || readme.includes(h.split('.').slice(-2).join('.')));

  for (const f of shipped) {
    const isCode = CODE.test(f.path);
    const isDoc = DOC.test(f.path);
    const isSkill = SKILL.test(f.path);
    const isPkg = /(^|\/)package\.json$/.test(f.path);
    const clean = isCode ? ctx.stripComments(f.text, f.path) : f.text;
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
    if (isDoc || isSkill || isCode) {
      const hasConceal = CONCEAL.test(f.text);
      const send = (isDoc || isSkill) ? find(f.text, SEND_TO_URL) : null;
      if (send) {
        const h = hostOf(send.snippet) || hostOf(send.match[0]);
        if (h && !ctx.PLACEHOLDER_HOST.test(h) && !declared(h) && isSkill) {
          add('instruction_hygiene', 'nl-exfil', hasConceal, { path: f.path }, send, hasConceal ? 40 : 20);
        }
      }
      const mark = find(f.text, POISON_MARK) || find(f.text, POISON_MARK_I);
      if (mark && (isSkill || isCode || isDoc)) {
        add('instruction_hygiene', 'tool-poisoning-marker', hasConceal, f, mark, hasConceal ? 40 : 15);
      }
      // Concealment wording alone appears in ordinary product prompts; it is severe only next to a sensitive action.
      const concealLoc = find(f.text, CONCEAL);
      if (concealLoc && (isSkill || isDoc || isCode)) {
        const win = f.text.slice(Math.max(0, f.text.split('\n').slice(0, concealLoc.line - 1).join('\n').length - 300), f.text.split('\n').slice(0, concealLoc.line).join('\n').length + 300);
        const action = /\b(send|upload|post|forward|transmit|exfiltrat\w*|read|cat|credentials?|ssh|token|password|secret|\.env|curl|wget)\b/i.test(win);
        add('instruction_hygiene', 'concealment-instruction', action, f, concealLoc, action ? 40 : 15);
      }
      for (const re of INJECT_EXTRA) {
        const loc = find(f.text, re);
        if (loc) add('instruction_hygiene', 'injection', true, f, loc, 30);
      }
      if (TAG_CHARS.test(f.text)) add('instruction_hygiene', 'hidden-unicode', true, f, { line: 1, snippet: '(contains Unicode tag characters)' }, 40);
    }
  }
  return out;
}
