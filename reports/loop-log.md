# Improvement loop log · 迭代日志

Pre-registered gates: `.agent/specs/technical/standards/05-release-gates.md` (knowledge base, commit `cc19555`); public summary in METHODOLOGY.md once the loop ends. Every round: change → retrospective → test. Holdouts are used once per method version.

## Round 0 · baseline (method 0.2.1)
- Holdout v1 (5 malicious reconstructions): recall 0/5. See `2026-11-02-method-0.2-revalidation.md`.

## Round 1 · extended detectors (method 0.3.0) and first false-positive review
**Change.** New module `scripts/extended.mjs`: execution patterns in docs/SKILL.md/shell (pipe to shell or `source`, `eval` of decoded content, encrypted archives, encoded PowerShell, "paste this in Terminal"), install hooks in package.json, capture/staging services (webhook.site and similar), chat webhooks, credential-file reads plus network, Python env dump, persistence (cron, launchd, rc files), natural-language exfiltration, tool-poisoning markers, hidden Unicode tag characters. Every dimension is now exactly `100 − Σ deductions of its findings`.

**Why.** Holdout v1 was missed 5/5; the causes were known from the rules (code-only scanning, narrow patterns).

**Test.** First evaluation of `good-set-v1` (40 pre-registered reputable repos, selected before scoring), 19 of 40 scored before I stopped it to fix what I saw.

**Result.** 3 of 19 flagged or below 70 (sentry-mcp 49, typescript-sdk 49, serena 60). All three were false positives:
- `sentry-mcp`: a mock-data string `"pwn; rm -rf ~ #.dmp"` in a mocks package, and a CI workflow that installs through `curl | bash`.
- `typescript-sdk`: a Markdown table cell `| Source` matched `| source`.
- `serena`: three weak signals (`os.system` in maintainer scripts) stacked to 60.
Other noise: URLs in error messages or docstrings, XML namespace hosts, `[system]` array indexing read as a `[SYSTEM]` marker, hostnames like `remote-server` and `my-grafana.internal`, test files such as `*_test.go`.

**Retrospective.** The extended detectors work on the development set but are too eager on prose and test data. These fixes are tuned on `good-set-v1` and `holdout-v1`, so both are now **development sets**. G2 will be measured on `good-set-v2` (pre-registered, unscored) and G1 on `holdout-v2` (frozen, unscored). I did not read the holdout-v2 fixtures.

## Round 2 · false-positive fixes (method 0.3.1)
**Change.** Non-shipped paths widened (mocks, `.github`, `.devcontainer`, `*_test.*`); single-label, `.internal`, `.lan` hosts and XML-namespace hosts treated as non-egress; a URL preceded by prose words is a message, not a call target; weak signals (`eval`, `os.system`, shell=True) deduct 10 each, capped at 30 in total, severe ones unchanged at 40; `| source` needs `curl` or `wget` on the same line; poison marker made case-sensitive for `[SYSTEM]`; blob cache keyed by git blob sha.

**Test.** Full rerun of `good-set-v1` (in progress).
