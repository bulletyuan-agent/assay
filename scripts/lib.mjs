// Shared helpers for Assay automation. Node >= 20, zero dependencies.
import { execFileSync } from 'node:child_process';

export const WINDOW_DAYS = 180;

// Must match the labels of .github/ISSUE_TEMPLATE/nominate-target.yml exactly.
export const F = {
  type: 'Target type / 对象类型',
  name: 'Name / 名称',
  url: 'Repository or package URL / 仓库或包地址',
  source: 'Source / 来源',
  scenario: 'Scenario / 垂直场景',
  install: 'How to install or run / 安装与运行方式',
  claims: 'Claimed capabilities and permissions / 声称的能力与权限',
  why: 'Why it is worth testing / 推荐理由',
  confirm: 'Confirmations / 确认事项',
};

// Scenario taxonomy. `terms` drive the crawler (English search terms). Keep labels in sync with the form.
export const VERTICALS = [
  { id: 'office-docs', label: 'Office: documents', terms: ['docx', 'markdown document', 'pdf'] },
  { id: 'office-sheets', label: 'Office: spreadsheets', terms: ['excel spreadsheet', 'csv', 'google sheets'] },
  { id: 'office-calendar', label: 'Office: calendar', terms: ['calendar', 'google calendar', 'outlook calendar'] },
  { id: 'office-mail', label: 'Office: mail', terms: ['email', 'gmail', 'imap'] },
  { id: 'dev-code', label: 'Developer: code & repos', terms: ['github repository', 'code review', 'git'] },
  { id: 'databases', label: 'Databases', terms: ['postgres', 'mysql', 'sqlite'] },
  { id: 'design-media', label: 'Design & media', terms: ['figma', 'image generation', 'video'] },
  { id: 'search-research', label: 'Search & research', terms: ['web search', 'arxiv', 'scraping'] },
  { id: 'finance', label: 'Finance', terms: ['stock market', 'accounting', 'invoice'] },
  { id: 'devops-cloud', label: 'DevOps & cloud', terms: ['kubernetes', 'docker', 'aws'] },
  { id: 'customer-support', label: 'Customer support', terms: ['zendesk', 'helpdesk', 'ticket'] },
  { id: 'education', label: 'Education', terms: ['flashcards', 'quiz', 'tutor'] },
  { id: 'browser-automation', label: 'Browser automation', terms: ['playwright', 'puppeteer', 'browser'] },
  { id: 'cloud-storage', label: 'Cloud storage', terms: ['google drive', 's3', 'dropbox'] },
  { id: 'project-management', label: 'Project management', terms: ['jira', 'linear', 'notion'] },
  { id: 'translation', label: 'Translation', terms: ['translation', 'localization'] },
  { id: 'data-viz', label: 'Data & visualization', terms: ['chart', 'data analysis', 'dashboard'] },
  { id: 'other', label: 'Other', terms: [] },
];

export const SOURCE_LABEL = { github: 'GitHub', npm: 'npm', gitlab: 'GitLab' };

export const LABELS = {
  nomination: ['0E8A16', 'Community nomination of a test target'],
  'source:crawler': ['C5DEF5', 'Created by the daily crawler'],
  'status:needs-triage': ['FBCA04', 'Waiting for automated triage'],
  'status:triaged': ['BFD4F2', 'Automated triage finished'],
  'type:mcp': ['1D76DB', 'MCP server'],
  'type:skill': ['5319E7', 'Skill'],
  'triage:eligible': ['0E8A16', 'Passed gates and evaluated'],
  'triage:needs-info': ['D93F0B', 'Gates failed, needs more information'],
  'triage:out-of-scope': ['B60205', 'Outside phase 1 scope'],
  'grade:A': ['0E8A16', 'Composite score 85 and above'],
  'grade:B': ['A2EEEF', 'Composite score 70 to 84'],
  'grade:C': ['FBCA04', 'Composite score 50 to 69'],
  'grade:D': ['D93F0B', 'Composite score below 50'],
};

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function gh(args, { input } = {}) {
  return execFileSync('gh', args, { encoding: 'utf8', input, stdio: ['pipe', 'pipe', 'pipe'] });
}

export function ensureLabels(repo) {
  const all = { ...LABELS };
  for (const v of VERTICALS) all[`scenario:${v.id}`] = ['EDEDED', `Scenario: ${v.label}`];
  for (const [name, [color, description]] of Object.entries(all)) {
    try {
      gh(['label', 'create', name, '--repo', repo, '--color', color, '--description', description, '--force']);
    } catch (e) {
      console.warn(`label ${name}: ${e.message.split('\n')[0]}`);
    }
  }
}

export function parseIssueForm(body = '') {
  const out = {};
  const parts = String(body).split(/^### +(.+?)\s*$/m);
  for (let i = 1; i < parts.length; i += 2) {
    const v = (parts[i + 1] ?? '').trim();
    out[parts[i]] = v === '_No response_' ? '' : v;
  }
  return out;
}

export function normalizeType(v = '') {
  if (/^mcp server/i.test(v.trim())) return 'mcp';
  if (/^skill$/i.test(v.trim())) return 'skill';
  return null;
}

export function guessType(text = '') {
  if (/\bmcp\b|model context protocol/i.test(text)) return 'mcp';
  if (/\bskills?\b/i.test(text)) return 'skill';
  return null;
}

export function scenarioId(label = '') {
  const v = VERTICALS.find((x) => x.label === label.trim());
  return v ? v.id : 'other';
}

export function parseTarget(url = '') {
  const u = String(url).trim().replace(/[?#].*$/, '').replace(/\/+$/, '').replace(/\.git$/, '');
  let m;
  if ((m = u.match(/^https?:\/\/github\.com\/([^/\s]+)\/([^/\s]+)$/i))) {
    return { source: 'github', id: `${m[1]}/${m[2]}`, url: `https://github.com/${m[1]}/${m[2]}` };
  }
  if ((m = u.match(/^https?:\/\/gitlab\.com\/([^\s]+\/[^\s]+)$/i))) {
    return { source: 'gitlab', id: m[1], url: `https://gitlab.com/${m[1]}` };
  }
  if ((m = u.match(/^https?:\/\/(?:www\.)?npmjs\.com\/package\/((?:@[^/\s]+\/)?[^/\s]+)$/i))) {
    return { source: 'npm', id: m[1], url: `https://www.npmjs.com/package/${m[1]}` };
  }
  return null;
}

export const dedupeKey = (t) => `${t.source}:${t.id}`.toLowerCase();

export function daysSince(iso) {
  if (!iso) return Infinity;
  return (Date.now() - Date.parse(iso)) / 86400000;
}

export const INSTALL_RE = /(npx\s|uvx\s|npm (i|install)\s|pip install|docker (run|pull)|claude (mcp add|plugin)|\binstall\b|安装)/i;

export async function http(url, { headers = {}, json = true } = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 20000);
  try {
    const res = await fetch(url, { headers: { 'user-agent': 'assay-bot', ...headers }, signal: ctl.signal });
    if (!res.ok) return { ok: false, status: res.status, data: null };
    return { ok: true, status: res.status, data: json ? await res.json() : await res.text() };
  } catch (e) {
    return { ok: false, status: 0, data: null, error: String(e) };
  } finally {
    clearTimeout(timer);
  }
}

export function ghHeaders(extra = {}) {
  const tok = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  return { accept: 'application/vnd.github+json', ...(tok ? { authorization: `Bearer ${tok}` } : {}), ...extra };
}

export async function githubHasFile(repoId, path) {
  const r = await http(`https://api.github.com/repos/${repoId}/contents/${path}`, { headers: ghHeaders() });
  return r.ok;
}

// Normalised metadata for a target. Returns null when the project cannot be read publicly.
export async function fetchMeta(t) {
  if (!t) return null;
  if (t.source === 'github') {
    const r = await http(`https://api.github.com/repos/${t.id}`, { headers: ghHeaders() });
    if (!r.ok) return null;
    const d = r.data;
    const rd = await http(`https://api.github.com/repos/${t.id}/readme`, {
      headers: ghHeaders({ accept: 'application/vnd.github.raw' }), json: false,
    });
    return {
      ...t, name: d.name, description: d.description || '', updatedAt: d.pushed_at,
      license: d.license?.spdx_id && d.license.spdx_id !== 'NOASSERTION' ? d.license.spdx_id : null,
      archived: !!d.archived, isPrivate: !!d.private, defaultBranch: d.default_branch,
      readme: rd.ok ? rd.data : '',
    };
  }
  if (t.source === 'npm') {
    const r = await http(`https://registry.npmjs.org/${encodeURIComponent(t.id).replace('%40', '@')}`);
    if (!r.ok) return null;
    const d = r.data;
    const latest = d['dist-tags']?.latest;
    const v = d.versions?.[latest] || {};
    return {
      ...t, name: d.name, description: d.description || '', updatedAt: d.time?.modified || null,
      license: (typeof d.license === 'string' ? d.license : d.license?.type) || null,
      archived: !!v.deprecated, isPrivate: false, defaultBranch: null, readme: d.readme || '', version: latest,
    };
  }
  if (t.source === 'gitlab') {
    const r = await http(`https://gitlab.com/api/v4/projects/${encodeURIComponent(t.id)}`);
    if (!r.ok) return null;
    const d = r.data;
    const rd = await http(`https://gitlab.com/api/v4/projects/${d.id}/repository/files/README.md/raw?ref=${d.default_branch || 'main'}`, { json: false });
    return {
      ...t, name: d.name, description: d.description || '', updatedAt: d.last_activity_at,
      license: d.license?.nickname || d.license?.name || null, archived: !!d.archived,
      isPrivate: d.visibility !== 'public', defaultBranch: d.default_branch, readme: rd.ok ? rd.data : '',
    };
  }
  return null;
}

export function buildBody(c) {
  return [
    `### ${F.type}`, '', c.type === 'mcp' ? 'MCP server' : 'Skill', '',
    `### ${F.name}`, '', c.name, '',
    `### ${F.url}`, '', c.url, '',
    `### ${F.source}`, '', SOURCE_LABEL[c.source], '',
    `### ${F.scenario}`, '', c.scenario, '',
    `### ${F.install}`, '', '_No response_', '',
    `### ${F.claims}`, '', '_No response_', '',
    `### ${F.why}`, '', `Discovered by the daily crawler (${c.source}, query "${c.query}"). Upstream description: ${c.description || 'none'}`, '',
    `### ${F.confirm}`, '',
    '- [x] The repository or package is public / 仓库或包是公开的',
    '- [x] Its license permits testing / 许可证允许测试',
    '- [ ] I have no commercial interest in this target / 我与该对象没有商业利益关系 (not applicable to crawler discoveries)', '',
    `<!-- assay-crawler key=${c.key} -->`,
  ].join('\n');
}
