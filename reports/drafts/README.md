# 办公邮件类 MCP 草稿索引

状态:**草稿,未经任务实测**。每份草稿的事实都标注了【代码】(已读源码、给出行号)或【README】(仅作者说明)。

| 草稿 | 项目 | 上游提交号 |
|---|---|---|
| 01 | codefuturist/email-mcp | 7d31cd5eac8788bd69237c18e3ee1e1fe2816ab7 |
| 02 | egyptianego17/email-mcp-server | c10baf8f2aed580203cbd0a54c1e3e542d4529ca |
| 03 | samihalawa/email-smtp-imap-mcp | dc3258498b49625f8025832fe1fc36a7f2c05b4c |
| 04 | dominikamann/agent-mail-gateway | 6f3c4ef2a1dfdf85d55a335c391ee9fd66d6c477 |
| 05 | henry200803/mailbridge | 870bdd5a533c67064323fa45c8adedcaae1604c4 |

## 局限(必须随草稿一起发布)
- 代码行号基于下载时的 HEAD 内容。提交号来自同一时间的 `gh api`,但我没有逐文件校验两者一致。
- 只读了与权限相关的代码,没有通读整个项目。
- 没有任何项目被实际运行。"可被提示注入诱导" 这类结论需要任务实测才能成立。
- 样本来自 GitHub 星数排序,不代表全部邮件类 MCP。

## 2026-11-03 补充核实(读代码,未运行)
已关闭:mailbridge 导出路径、gateway 监听器、samihalawa 外部地址、codefuturist read_only/HTTP/update、各工具说明文字。
新增高影响发现:egyptianego17 `--http` 绑定 0.0.0.0 且无鉴权(草稿 02)。
仍待做:B 供应链核对(npm/PyPI 包与源码一致性、安装钩子、OSV 漏洞)、C 本地假服务器实测、README 声称的安全功能核实。

## 2026-11-03 供应链核对(只查元数据,未安装)
| 项目 | 发布渠道 | 发现 |
|---|---|---|
| codefuturist/email-mcp | npm `@codefuturist/email-mcp` 0.6.0,首发 2026-02-18,8 个版本,单一维护者 | 仅 `prepare: lefthook install \|\| true`(开发钩子,无 postinstall);10 个依赖;OSV 0 条。**npm 包 gitHead `3b925b3` 与草稿所用仓库 HEAD `7d31cd5` 不同**:读者装的包与我读的源码不一定是同一版本,草稿结论只对仓库 HEAD 成立 |
| samihalawa/email-smtp-imap-mcp | npm `email-smtp-imap-mcp` 2.2.2,首发 2025-11-18,7 个版本,单一维护者 | `prepare: npm run build`(安装时会执行构建);5 个依赖;包无 gitHead,**无法对应到具体提交**;OSV 0 条 |
| egyptianego17/email-mcp-server | npm、PyPI 均无同名包(按 `egyptianego17-email-mcp-server` 查) | 只能从 GitHub 安装;`email-mcp-server` 在 npm/PyPI 都被**别的项目**占用,未核实归属,提示读者勿按名字直接装 |
| dominikamann/agent-mail-gateway | npm/PyPI 无同名包 | 通过 GitHub/Docker 分发(README 称 ghcr 镜像,未核实) |
| henry200803/mailbridge | PyPI 有 `mailbridge`,**未核实是否同一项目**;npm 无 | README 称 clone 安装;勿假设 PyPI 同名包就是它 |

局限:OSV 只查了两个 npm 包;egyptianego17/mailbridge 未查依赖(仓库内未找到 pyproject);维护者账号年龄、包名相似度未做。
