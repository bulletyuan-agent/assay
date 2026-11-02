// Classifies a nomination issue, checks gates, runs static evaluation, labels and comments.
// Usage: REPO=owner/repo ISSUE_NUMBER=12 node scripts/triage.mjs [--dry-run]
// Test: ISSUE_JSON_FILE=fixture.json node scripts/triage.mjs --dry-run
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { F, parseIssueForm, normalizeType, scenarioId, parseTarget, fetchMeta, ensureLabels, gh } from './lib.mjs';
import { checkGates, evaluateStatic, githubFiles, WEIGHTS } from './evaluate.mjs';

const DRY = process.argv.includes('--dry-run');
const REPO = process.env.REPO || process.env.GITHUB_REPOSITORY || 'bulletyuan-agent/assay';
const NUMBER = process.env.ISSUE_NUMBER || '0';
const issue = process.env.ISSUE_JSON_FILE
  ? JSON.parse(readFileSync(process.env.ISSUE_JSON_FILE, 'utf8'))
  : JSON.parse(gh(['issue', 'view', NUMBER, '--repo', REPO, '--json', 'number,title,body,labels']));

const labels = (issue.labels || []).map((l) => l.name);
const crawler = labels.includes('source:crawler');
const form = parseIssueForm(issue.body || '');
const type = normalizeType(form[F.type]);
const scenario = scenarioId(form[F.scenario]);
const target = parseTarget(form[F.url]);
const REASON = {
  public: 'Repository or package is not reachable as a public project.',
  license: 'No open-source license detected, so testing permission is unclear.',
  fresh: 'Last update is older than 180 days, or the project is archived.',
  install: 'No install or run instructions found in the form or README.',
  consent: 'Confirmations are incomplete. All three boxes must be checked (two for crawler discoveries).',
};
const reasons = [];
let decision;
let meta = null;
let gates = null;
let ev = null;

if (!type) {
  decision = 'out-of-scope';
  reasons.push('Target type is not an MCP server or Skill (phase 1 scope).');
} else if (!target) {
  decision = 'needs-info';
  reasons.push('Repository URL must be a GitHub, GitLab or npm project URL.');
} else {
  meta = await fetchMeta(target);
  gates = checkGates(meta, form, { crawler });
  for (const [k, v] of Object.entries(gates)) if (k !== 'passed' && !v) reasons.push(REASON[k]);
  decision = gates.passed ? 'eligible' : 'needs-info';
  if (gates.passed) {
    const files = target.source === 'github' ? await githubFiles(target, meta.defaultBranch || 'HEAD') : null;
    ev = evaluateStatic(meta, files);
  }
}

const addLabels = ['status:triaged', `triage:${decision}`, `scenario:${scenario}`];
if (type) addLabels.push(`type:${type}`);

function renderComment() {
  const typeText = type === 'mcp' ? 'MCP server' : type === 'skill' ? 'Skill' : form[F.type] || 'unspecified';
  const lines = [
    '<!-- assay-triage -->', '## 🤖 Automated triage · 自动分类结果', '',
    '| Field | Value |', '| --- | --- |',
    `| Type | ${typeText} |`,
    `| Scenario | ${form[F.scenario] || 'unspecified'} (\`scenario:${scenario}\`) |`,
    `| Decision | **${decision}** |`, '',
    '### Gates · 纳入门槛',
  ];
  if (gates) {
    for (const [k, v] of Object.entries(gates)) if (k !== 'passed') lines.push(`- ${v ? '✅' : '❌'} \`${k}\``);
  } else {
    lines.push('- Not checked (type or URL invalid).');
  }
  if (reasons.length) { lines.push('', '### Reasons · 原因'); for (const r of reasons) lines.push(`- ${r}`); }
  if (ev) {
    lines.push('', '### Static screening · 静态初筛 (not a trust rating · 不是信任评级)', '',
      '| Dimension | Score | Weight |', '| --- | ---: | ---: |');
    for (const [k, v] of Object.entries(ev.dims)) lines.push(`| ${k} | ${v ?? 'n/a'} | ${WEIGHTS[k]} |`);
    lines.push('', `**Screening score ${ev.composite}/100** (no grade: grades are reserved for full evaluations) · coverage ${Math.round(ev.coverage * 100)}% · ${ev.static_scan ? 'code scanned' : 'code scan skipped (not GitHub in phase 1)'}`);
    lines.push('', `Evidence: \`${JSON.stringify(ev.evidence)}\``);
    lines.push('', '> A high screening score does **not** mean the target is safe. Nothing was executed. Dynamic tests (task success, uplift over baseline, cross-model stability) have not run yet. They will be published as a separate report with model, version and date.');
  }
  lines.push('', '<sub>Re-run: Actions → triage-issue → Run workflow with this issue number.</sub>');
  return lines.join('\n') + '\n';
}

if (DRY) {
  console.log(renderComment());
  console.log(JSON.stringify({ decision, labels: addLabels }, null, 2));
} else {
  ensureLabels(REPO);
  const file = join(tmpdir(), `assay-triage-${NUMBER}-${Date.now()}.md`);
  writeFileSync(file, renderComment());
  gh(['issue', 'comment', NUMBER, '--repo', REPO, '--body-file', file]);
  gh(['issue', 'edit', NUMBER, '--repo', REPO, '--add-label', addLabels.join(',')]);
  try { gh(['issue', 'edit', NUMBER, '--repo', REPO, '--remove-label', 'status:needs-triage']); } catch { /* label absent */ }
  console.log(`issue #${NUMBER}: ${decision}`);
}
