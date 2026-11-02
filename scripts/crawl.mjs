// Daily crawler: picks CRAWL_LIMIT unseen MCP/Skill candidates, breadth-first across verticals,
// and opens nomination issues in the template format. Usage: REPO=owner/repo node scripts/crawl.mjs [--dry-run]
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  F, VERTICALS, WINDOW_DAYS, http, ghHeaders, guessType, daysSince, parseTarget, dedupeKey,
  parseIssueForm, buildBody, ensureLabels, gh, sleep, githubHasFile,
} from './lib.mjs';

const DRY = process.argv.includes('--dry-run');
const REPO = process.env.REPO || 'bulletyuan-agent/assay';
const LIMIT = Number(process.env.CRAWL_LIMIT || 10);
const STATE_FILE = 'data/seen.json';
const state = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : { seen: {} };
const buckets = VERTICALS.filter((v) => v.terms.length > 0);
const dayIndex = Math.floor(Date.now() / 86400000);
// Daily rotation: day N starts at bucket N*LIMIT, so consecutive days cover different verticals.
const start = (dayIndex * LIMIT) % buckets.length;
const since = new Date(Date.now() - WINDOW_DAYS * 86400000).toISOString().slice(0, 10);
const cache = new Map();

function existingKeys() {
  try {
    const list = JSON.parse(gh(['issue', 'list', '--repo', REPO, '--state', 'all', '--limit', '1000', '--json', 'body']));
    const keys = new Set();
    for (const i of list) {
      const t = parseTarget(parseIssueForm(i.body)[F.url] || '');
      if (t) keys.add(dedupeKey(t));
    }
    return keys;
  } catch (e) {
    console.warn(`could not list existing issues: ${e.message.split('\n')[0]}`);
    return new Set();
  }
}

async function search(term) {
  if (cache.has(term)) return cache.get(term);
  const out = [];
  for (const q of [`${term} mcp`, `${term} skill`]) {
    const gr = await http(`https://api.github.com/search/repositories?q=${encodeURIComponent(`${q} pushed:>=${since} fork:false archived:false`)}&sort=stars&order=desc&per_page=20`, { headers: ghHeaders() });
    for (const it of gr.data?.items || []) {
      out.push({ source: 'github', id: it.full_name, name: it.name, url: it.html_url, description: it.description || '', updatedAt: it.pushed_at, query: q });
    }
    await sleep(1200);
    const npm = await http(`https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(q)}&size=20`);
    for (const o of npm.data?.objects || []) {
      const p = o.package;
      out.push({ source: 'npm', id: p.name, name: p.name, url: `https://www.npmjs.com/package/${p.name}`, description: p.description || '', updatedAt: o.updated || p.date, query: q });
    }
    await sleep(1200);
    const gl = await http(`https://gitlab.com/api/v4/projects?search=${encodeURIComponent(q)}&visibility=public&order_by=last_activity_at&sort=desc&per_page=20&simple=true`);
    for (const p of Array.isArray(gl.data) ? gl.data : []) {
      out.push({ source: 'gitlab', id: p.path_with_namespace, name: p.name, url: p.web_url, description: p.description || '', updatedAt: p.last_activity_at, query: q });
    }
    await sleep(1200);
  }
  cache.set(term, out);
  return out;
}

async function pickFirst(cands, bucket, seen) {
  for (const c of cands) {
    const type = guessType(`${c.name} ${c.description}`);
    if (!type || daysSince(c.updatedAt) > WINDOW_DAYS) continue;
    const t = parseTarget(c.url);
    if (!t) continue;
    const key = dedupeKey(t);
    if (seen.has(key)) continue;
    if (type === 'skill') {
      // Skills are only accepted when the repo really ships a SKILL.md (GitHub only in phase 1).
      if (c.source !== 'github' || !(await githubHasFile(t.id, 'SKILL.md'))) continue;
    }
    return { ...c, type, key, scenario: bucket.label, target: t };
  }
  return null;
}

const existing = existingKeys();
const seen = new Set([...Object.keys(state.seen), ...existing]);
const picked = [];
for (let round = 0; round < 3 && picked.length < LIMIT; round++) {
  for (let i = 0; i < buckets.length && picked.length < LIMIT; i++) {
    const b = buckets[(start + i) % buckets.length];
    const term = b.terms[(dayIndex + round) % b.terms.length];
    const hit = await pickFirst(await search(term), b, seen);
    if (hit) { picked.push(hit); seen.add(hit.key); }
  }
}

console.log(`picked ${picked.length}/${LIMIT} · buckets ${buckets.length} · start ${start} · known before run ${seen.size - picked.length}`);
if (!DRY) ensureLabels(REPO);

for (const c of picked) {
  const title = `[Nominate] ${c.type === 'mcp' ? 'MCP server' : 'Skill'}: ${c.name}`;
  if (DRY) { console.log(`- ${title} · ${c.source} · ${c.scenario} · ${c.url}`); continue; }
  const file = join(tmpdir(), `assay-nominate-${Date.now()}-${Math.random().toString(36).slice(2)}.md`);
  writeFileSync(file, buildBody(c));
  const url = gh(['issue', 'create', '--repo', REPO, '--title', title, '--body-file', file,
    '--label', 'nomination', '--label', 'source:crawler', '--label', 'status:needs-triage']).trim();
  const num = url.split('/').pop();
  state.seen[c.key] = { at: new Date().toISOString(), issue: url, scenario: c.scenario };
  if (process.env.DISPATCH_TRIAGE === '1') gh(['workflow', 'run', 'triage-issue.yml', '--repo', REPO, '-f', `issue_number=${num}`]);
  console.log(`created ${url}`);
}

if (!DRY) {
  mkdirSync('data', { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');
}
