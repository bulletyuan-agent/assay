# 草稿 1:codefuturist/email-mcp — 多账号邮件 MCP,功能最全

> 草稿,未经事实复核之外的测试。提交号 `7d31cd5`(2026-10-16)。证据标记:【代码】已读源码并给出行号;【README】只来自作者说明,未在代码中核实。

## 一句话
让 AI 助手在一个地方读、搜、回复、转发和发送多个邮箱里的邮件,并能下载附件、提取验证码。【README】第 11 行。

## 谁会用、什么场景
- 同时管理 Gmail、Outlook 和自建邮箱的个人用户:每天让 AI 先看未读邮件,列出需要回复的。
- 需要从邮件里找验证码或附件的用户。

## 会碰到什么问题、带来什么影响
- **权限范围大。** 它能读、搜、发、删邮件,并能把附件下载到本地。【README】第 11 行列出的能力。
- **有一个容易误解的开关。** `sender_allowlist` 只用于**通知提醒**,不管外发邮件:【代码】`src/config/schema.ts:210-211` 注释写的是 "Sender globs (hooks syntax)",对应的是通知钩子。想限制"发给谁",这个配置帮不上忙。
- **附件下载有扩展名白名单。**【代码】`src/config/schema.ts:274` 使用默认的 `DEFAULT_ATTACHMENT_DOWNLOAD_ALLOWED_EXTENSIONS`。这能减少把可执行文件存到磁盘的风险,但白名单的具体内容没有在草稿里列出。
- **日历邀请默认需要确认。**【代码】`src/config/schema.ts:134` `calendar_confirm` 默认 `true`。
- **OAuth(Gmail/M365)仍是实验性功能。**【README】第 30 行。
- **本地缓存。** 默认会把邮件同步到本地缓存,并可清理。【README】第 548 行附近 `cache clear`;同步范围默认是收件箱、回溯 90 天,【代码】`src/config/schema.ts:140`。这意味着邮件内容会在本机留存一段时间。

## 我们的测试(目前)
- **未测。** 没有在真实或测试邮箱上运行。
- **已核实:** 上面带【代码】标记的配置默认值。
- **未核实:** README 第 50 行 "密码不写入日志"、速率限制等安全声明。

## 结论(草稿)
适合希望统一管理多个邮箱、并愿意把邮件内容交给本地服务进程的用户。不要把"sender_allowlist"当作外发限制。装之前先确认:是否需要 OAuth 以外的凭据、缓存目录放在哪里。

## 补充核实(2026-11-03,读代码)
- **`read_only` 存在且默认关闭。**【代码】`src/config/schema.ts:280` 默认 `false`;`loader.ts:570` 注释说明开启后禁用"mailbox-write tools";环境变量 `MCP_EMAIL_READ_ONLY=true`。**默认情况下写工具可用。**未核实它是否也禁用发信。
- **HTTP 模式有 Bearer 鉴权,但可为空。**【代码】`src/cli/http.ts:7、121` 常量时间比较;`loader.ts:612` 注释:空 token = 无鉴权(仅限回环)。
- **`update` 命令会联网。**【代码】`src/cli/update.ts:29` 请求 GitHub releases/latest;README 称下载后做 sha256 校验,**校验逻辑未读**。
