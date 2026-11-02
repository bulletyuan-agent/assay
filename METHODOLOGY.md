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
