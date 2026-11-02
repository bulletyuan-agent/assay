# Nominate a target · 推荐待测对象

This file is written for **both humans and AI agents**. If you are an agent, follow "Agent procedure" exactly.
本文件同时面向**人类与 AI Agent**。如果你是 Agent,请严格按「Agent 流程」执行。

## For humans · 给人类

1. Open **Issues → New issue → "推荐待测对象 · Nominate a target"**, or
2. Copy this prompt to your agent, and paste the target URL:

```text
请阅读 https://github.com/bulletyuan-agent/assay/blob/main/NOMINATE.md ,
按其中的字段为我推荐一个待测对象(MCP server 或 Skill),
然后用 gh 在 bulletyuan-agent/assay 创建一个 issue(模版 nominate-target.yml)。
推荐对象: <在这里粘贴 GitHub / npm / GitLab 地址>
如果该对象不满足纳入标准,或你与它有利益关系,请直接告诉我,不要提交。
```

After submission, triage runs automatically: it labels the issue, checks the gates and runs the static evaluation, then comments the result.
提交后会自动分类、检查门槛、运行静态评测,并在 issue 下评论结果。

## Scope · 范围

Phase 1 accepts **MCP servers** and **Skills** only. Agents and other kinds are labelled `triage:out-of-scope`.
第一阶段只收 **MCP server** 与 **Skill**。其他类型会被标记为 `triage:out-of-scope`。

## Gates · 纳入门槛 (all required)

| Gate | Rule |
| --- | --- |
| public | Repository or package is publicly readable (GitHub, GitLab or npm) |
| license | An open-source license is detected |
| fresh | Updated within 180 days and not archived |
| install | Install or run instructions exist (form field or README) |
| consent | All three confirmation boxes ticked |

Full standard: [METHODOLOGY.md](METHODOLOGY.md).

## Agent procedure · Agent 流程

1. **Check the target yourself first.** Open the URL, confirm it is public, has a license, was updated in the last 180 days, and has install instructions. If any gate fails, or the user has a commercial interest in it, **stop and tell the user. Do not submit.**
2. **Check for duplicates:** `gh issue list --repo bulletyuan-agent/assay --state all --search "<name>"`. If one exists, tell the user and stop.
3. **Never tick the third confirmation on the user's behalf** unless the user has said they have no commercial interest in the target.
4. **Create the issue** with the body below. Headings must match exactly, because the parser reads them.

```bash
gh issue create --repo bulletyuan-agent/assay \
  --title "[Nominate] <MCP server|Skill>: <name>" \
  --label nomination --label status:needs-triage \
  --body-file body.md
```

### Body format · Issue 正文格式

Each field is a `### ` heading followed by a blank line and the value. Use `_No response_` for an empty optional field.

```markdown
### Target type / 对象类型

MCP server

### Name / 名称

<name>

### Repository or package URL / 仓库或包地址

<https://github.com/owner/repo | https://www.npmjs.com/package/name | https://gitlab.com/group/project>

### Source / 来源

GitHub

### Scenario / 垂直场景

Office: documents

### How to install or run / 安装与运行方式

<exact command, or _No response_>

### Claimed capabilities and permissions / 声称的能力与权限

<what the README claims and what access it requests, or _No response_>

### Why it is worth testing / 推荐理由

<who uses it, what risk you suspect, what to verify>

### Confirmations / 确认事项

- [x] The repository or package is public / 仓库或包是公开的
- [x] Its license permits testing / 许可证允许测试
- [x] I have no commercial interest in this target / 我与该对象没有商业利益关系
```

### Allowed values · 可选值

- **Target type:** `MCP server` · `Skill` · `Agent or other (out of phase-1 scope / 第一阶段范围外)`
- **Source:** `GitHub` · `npm` · `GitLab` · `Other`
- **Scenario:** `Office: documents` · `Office: spreadsheets` · `Office: calendar` · `Office: mail` · `Developer: code & repos` · `Databases` · `Design & media` · `Search & research` · `Finance` · `DevOps & cloud` · `Customer support` · `Education` · `Browser automation` · `Cloud storage` · `Project management` · `Translation` · `Data & visualization` · `Other`

Pick the scenario by what the target is **for**, not by keywords in its name.
按目标的**用途**选场景,不要按名字里的关键词。

## Rules for agents · Agent 守则

- Nominate one target per issue. Do not batch.
- Do not invent fields, licenses, or install commands. If unknown, write `_No response_`.
- Do not nominate your own or your employer's products.
- Tell the user what you submitted and give the issue URL.
