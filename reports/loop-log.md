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
**Change.** Non-shipped paths widened; placeholder, single-label, `.internal` hosts and XML-namespace hosts ignored; a URL preceded by prose is a message, not a call target; weak signals capped; `| source` needs `curl`/`wget` on the line; `[SYSTEM]` marker case-sensitive; blob cache.
**Result.** On `good-set-v1` (first 40 files budget): 5 of 40 flagged, all false positives (vendor installer one-liners in SKILL.md, a concealment sentence in an agent prompt). Coverage only 50%.
**Retrospective.** The truncation to 80 files had been hiding noise. The coverage fix in round 3 exposed it.

## Round 3 · coverage 400 files, concurrent fetch (method 0.3.2)
**Change.** File budget 80 → 400, fetched by 10 workers in a fixed order; a plain `curl <named https host> | sh` is weak unless attacker signals exist (no TLS, bare IP, staging host, encoded content); concealment wording needs a sensitive action.
**Result: false-positive explosion.** Coverage reached 100% for most repos, but **21 of 39 repos were flagged**. Causes found by aggregating findings by rule: `concealment-instruction` fired 398 times because the wording list contained "silently", "secretly", "don't show"; `curl | sh` strings in docs-site configs; `rm -rf /var/lib/apt/lists/*` matched as destructive; many-host red flag fired on SDKs; `dict(os.environ)` for subprocess env was read as an exfiltration.
**Retrospective.** I added the concealment rule without measuring it against a large clean corpus. The lesson is process: every new detector must be run on the good set before the next step, and findings must be aggregated by rule, not eyeballed.

## Round 4 · precision pass (methods 0.3.3 and 0.3.4)
**Change.** Concealment narrowed to explicit "do not tell the user" wording and emitted only next to a sensitive action; `rm -rf` severe only for `/`, `~`, `$HOME` and system roots; weak findings capped at 30 per dimension; the many-hosts red flag removed (legitimate multi-service projects contact many hosts); the install-snippet URL is read from the full match, not the truncated snippet; `env` dump only when the environment is the request payload.
**Result on `good-set-v1` (development): 1 of 40 flagged (2.5%, Wilson 0.4% to 12.9%), 35 of 40 with coverage of at least 80%.** The one flag is `auth0/auth0-mcp-server`: an onboarding prompt that tells the agent not to tell the user about a step. Intent cannot be separated statically; left as a measured false positive.
**Cost.** Removing the host-count flag made the synthetic `bad-egress-hosts` fixture a miss (87).

## Round 5 · first independent holdout (holdout-v2, method 0.3.4) — G1 FAILED
Fixtures were written by an independent author who never saw the detector, frozen in commit `aeaa4ef`, and scored once.
**Result: recall 3 of 16 = 18.8% (Wilson 95% 6.6% to 43.0%).** plain 2/4, obfuscated 0/8, instruction-only 1/4. Hits: tool-description poisoning with concealment, Unicode tag characters, shell rc persistence. Misses include env-posting postinstall hooks, a postinstall that spawns AI CLIs with permission-bypass flags, credential harvesting split across path segments, wallet beacons, a typosquat that writes MCP config, split-string payloads, zero-width steganography, config hijack by instruction.
**Retrospective.** Real attackers put the payload in install-time scripts and split or encode strings. The current rules look at literal strings in single files and ignore install-time context. Gate G1 requires recall of at least 0.80; it is at 0.19. `holdout-v2` is now a development set; a fresh holdout is required before any claim.

## Round 6 · install-time context and string folding (methods 0.4.0 and 0.4.1)
**Change.** Install-time files (package.json hooks and the local modules they require) are read strictly: credential or wallet reads, detached processes, writes outside the package, data sent by POST. String-literal splits are folded before matching (concatenation, array join, Python join, named lists). Added detectors: environment in request payload, download-then-chmod, permission-bypass flags for agent CLIs, base64 payloads that decode to commands, zero-width runs, notes addressed to the model, text that talks a scanner out of flagging, agent-config instructions in SKILL.md. `.cjs` files are now code. JSON and YAML are scanned for instructions.
**Result on the development holdout-v2: 16 of 16.** This is **not** a measurement: the rules were written after reading those fixtures. It shows that the classes are coverable, nothing more.
**Regression check on development good sets.** First pass flagged 4 of 40 and 1 of 15 legitimate install-hook projects through new rules: MCP installers that edit the Claude Desktop config (python-sdk, auth0, serena), a "before calling other tools" description (pinecone), and a `<system>` placeholder in a console message (playwright). Fixes: agent-config writes are severe only at install time; tool-shadowing wording is weak; only `<IMPORTANT>` and `[SYSTEM]` count as poisoning markers. After the fixes: **good-set-v1 1 of 40 flagged (2.5%, Wilson 0.4% to 12.9%), legit-install-v1 0 of 15 flagged**, coverage of at least 80% on 87.5% and 73.3% of them.
**Retrospective.** Each new detector class cost one false-positive round, always from a legitimate use of the same mechanism. The remaining honest false positive is auth0's onboarding prompt.
**Next.** A fresh holdout (`holdout-v3`, 24 or more items from a new independent author, new incident classes) is being written. It will be scored once. `good-set-v2` stays unscored until the rules stop changing.

## Gate G6 (independent evasion test) · not executed
An independent subagent was asked to build inert evasion fixtures against the public description of the checks. It **declined**: such fixtures are a playbook for evading supply-chain detection, even when inert. I am not going to rephrase the request to get around that, and I am not going to author evasion samples myself. G6 therefore cannot be measured. Consequence for any publication: **evasion resistance is untested and must be stated as such.** The documented limits (obfuscation beyond literal splitting, runtime-assembled or remotely fetched payloads, files beyond the first 400, install-hook shapes not parsed, behaviour split across more than three module hops) are published in METHODOLOGY.md. A defender-side alternative that was offered, mapping each documented limit to a detection requirement, is the substitute; it is a to-do list, not evidence of robustness.

## Round 7 · fresh holdout-v3 (method 0.4.1) — G1 FAILED, loop stopped
Fixtures: 27, written by an independent author who never saw the detector, frozen in commit `73aed33`, scored once.
**Recall 2 of 27 = 7.4% (Wilson 95% 2.1% to 23.4%)**; plain 2/8, obfuscated 0/11, instruction-only 0/8. Gate G1 requires at least 0.80.
**Retrospective.** On the development set holdout-v2 recall reached 16/16, but on a new author's fixtures it is 2/27. The 100% was fitted to the examples it was written against, not evidence of detection ability. Misses include: a Python `setup.py` cmdclass hook, git hooks, VS Code folder-open autorun, MCP tool-output exfiltration, `.pth` persistence, Go `init()`, hex/char-code payloads, sidecar payloads, DNS exfiltration, clipboard swapping, GitHub Actions `pull_request_target`, and every instruction/config-only attack. Each extra regex round fixes the examples at hand and leaves the next author's variants uncovered; this process does not converge on a measurable recall of 0.80.
**Decision.** Stop tuning. `holdout-v3` is now a development set. Do not publish any rating, grade or "safe" claim. Gates G1 (recall), G6 (evasion test: declined, see above) and G2 (`good-set-v2` never scored, because the rules are not release candidates) are unmet.

## Round 8 · behaviour-class redesign (method 0.5.0) — G1 and G2 FAILED on fresh sets
**Change.** New `scripts/behavior.mjs`: files are placed in an execution context (install hooks, setup.py, Go `init()`, `.pth`, VS Code folder-open, Claude hooks, git hooks, MCP config) and checked for capabilities (network, credential access, decoding, spawn, write, delay), plus detectors for DNS exfiltration, clipboard swapping, browser credential paths, authorized_keys, miners, reverse shells, token worms, CI secret dumps, and instruction-file attacks. Config surfaces (`.github/workflows`, `.vscode`, `.claude`, `.cursor`, `.githooks`) are now fetched and read.
**Development numbers (not measurements).** holdout-v3 21/27 after the change; good-set-v1 flagged 10/40 then 2/40 after four precision fixes (husky/pre-commit hooks, `process.env` matching `.env`, `dup2` matching stdout redirects, `mozilla.org` matching `.mozilla`, PR-target without head checkout).
**Fresh measurements, rules frozen at commit `695440d`:**
- **G1: holdout-v4 (24 fixtures, second independent author, frozen unread) recall 5 of 24 = 20.8% (Wilson 9.2% to 40.5%).** plain 3/9, obfuscated 1/10, instruction-only 1/5. Gate: at least 0.80.
- **G2: good-set-v2 (pre-registered reputation set) 6 of 28 scored results flagged = 21.4% (Wilson 10.2% to 39.5%).** Gate: at most 8%. Only 28 of the 38 pre-registered repos produced results in the run (not investigated; recorded as a gap). Flags: mcp-use (README tells users to set hooksPath), MCP inspector (env in a request payload; package-source wording), pydantic-ai (injection phrases in test-like text), DesktopCommanderMCP (install hook), repomix (a base64 literal), servers-archived (score 69, no flag).
**Retrospective.** The architecture change raised recall on a new author from 7.4% to 20.8%, and the same rules score 78% on the set they were written against. That 57-point gap is the over-fit. False positives rose at the same time: every new capability rule has a legitimate twin (installers, hook setups, test strings). Both gates fail on fresh data, in opposite directions, so a regex-level static screen is not converging to 80% recall at 8% false positives. `holdout-v4` and `good-set-v2` are now development sets.
**Decision.** No release. Gates unchanged. Further progress needs a different kind of evidence (dynamic sandbox observation, or provenance signals) rather than more patterns.
