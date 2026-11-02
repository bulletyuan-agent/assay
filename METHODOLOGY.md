# Methodology (draft v0)

Public from day one, so anyone can challenge or rerun it. 中文要点见下方。

## Scope (phase 1)
Office-scenario **MCP servers** and **Skills**: documents, spreadsheets, calendar, mail. Agents on closed platforms are out of scope for now (no stable automation interface, results expire with model updates). They come later as *task-based* evaluations, labelled with platform version and date.

## Sources
GitHub (primary), npm / PyPI, official registries and marketplaces. Stars and download counts are recorded but never used as a quality signal. Everything is merged into one index: name, type, source, repo, version, license, last update.

## Sampling (published before testing)
1. Sampling frame = every indexed item in scope; the total is reported.
2. Inclusion: updated in last 6 months, runnable install instructions, license permits testing.
3. Strata: top by attention, random from the middle, fast-rising newcomers.
4. Open nomination and report channel for any item.
5. First batch 20 to 30 items, tested deeply.

## What is tested
**MCP server:** installs and starts; tool descriptions match behaviour; permissions requested vs needed; undeclared network egress; error handling and stability; success rate on a fixed task set.
**Skill:** static scan (deletion, exfiltration, credential reads); prompt-injection and privilege-escalation content; task success under a fixed runtime and model; variance across models.
Every result states model, version, and date; at least two models are used.

## Conduct
Respect terms of service. Authors get a notice period before negative findings are published. Evidence is retained. Revenue never comes from the items rated.

---

## 中文要点
范围:办公场景的 MCP server 与 Skill。来源:GitHub 为主,辅以 npm / PyPI 与官方注册表。抽样规则测试前公开,分层抽样,首批 20 到 30 个深测。测试内容覆盖安装、行为一致性、权限、外发、稳定性、任务成功率。每份结果注明模型、版本、日期;负面结论发布前给作者通知期。

---

## What the static screen checks (method 0.4.x) · 静态初筛检查项

The screen reads files; it never executes anything. It is a **hygiene and known-pattern check, not a security guarantee and not a trust rating.** Unknown, heavily obfuscated, dynamically assembled or runtime-downloaded attacks can pass. A result is a screening score plus findings, each with file, line and snippet.

Score = per-dimension scores (maintenance, install documentation, dangerous patterns, egress, instruction hygiene), each 100 minus the deductions of its findings. Any severe finding caps the score at 49 and sets a red flag. Weak findings are capped at 30 points per dimension.

**What is read.** Up to 400 shipped files, install hooks and entry points first. Tests, mocks, examples, demos, docs and CI configuration are not read as shipped behaviour. Comments are ignored. Literal-only string splits (`"a"+"b"`, `["a","b"].join("")`, `"".join([...])`, a named literal list that is joined) are folded before matching. Base64 literals that decode to commands or URLs are reported.

**Install-time context.** Files run by `preinstall`/`install`/`postinstall` in package.json, and local modules they require (three hops), are read more strictly: credential or wallet file reads, detached background processes, writes outside the package directory (home, global bin, shell startup files), and sending data (POST, request bodies) are severe there; plain downloads stay weak.

**Severe findings.** Destructive deletes of `/`, `~` or system roots; piping a download into a shell or `source` with attacker signals (no TLS, bare IP, staging or shortener host, encoded content); `eval` of decoded content; encrypted archives; encoded PowerShell; download-then-`chmod +x`; install hooks that fetch or run code; capture or staging services (webhook.site and similar) and undeclared chat webhooks; credential or wallet files read by code that can reach the network; the environment placed in a request payload; persistence (cron, launchd, shell startup files); permission-bypass flags passed to agent CLIs; agent configuration written at install time; hard-coded copy/forward email recipients; prompt-injection phrases; hidden Unicode tag characters or runs of zero-width characters; `<IMPORTANT>`/`[SYSTEM]` markers in code or JSON; instructions to send data to a URL or to alter agent configuration, combined with concealment; notes addressed to the model that direct tool behaviour; text that tries to talk a reviewer or scanner out of flagging the package.

**Weak findings.** `eval`, `os.system`, `shell=True`, undeclared hosts, plain installer one-liners, instructions in a skill to call an undeclared URL, wording about other tools.

**Coverage and honesty.** Every result states how many shipped files were read and flags partial coverage. Hosts mentioned in the README count as declared. Every result stores the method version, tool commit, tree sha, scanned paths with blob shas, findings, network log and run log; `scripts/verify-run.mjs` recomputes the score from the findings.

**Measured performance** is published with every release in `reports/`: recall on frozen independent holdouts, false-positive rate on reputable projects, both with Wilson 95% intervals, and the evasion rate found by an independent red team.
