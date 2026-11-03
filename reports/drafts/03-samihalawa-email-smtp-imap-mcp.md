# 草稿 3:samihalawa/email-smtp-imap-mcp — 收发与整理,多账号

> 草稿,未经事实复核之外的测试。提交号 `dc32584`(2026-10-31)。【代码】已读源码并给出行号;【README】只来自作者说明。

## 一句话
用 IMAP 检索和整理邮件,用 SMTP 发送和回复,支持多个账号。【README】第 7、25 行。

## 谁会用、什么场景
- 在多个邮箱之间做日常整理:查找发票邮件、归档、移动到文件夹、标记。
- 用 AI 起草并回复客户邮件。

## 会碰到什么问题、带来什么影响
- **共 6 个工具。** `accounts_list`、`emails_find`、`emails_modify`、`email_send`、`email_respond`、`folders_list`。【代码】`src/emailTools.ts:9、21、97、140、204、270`。
- **发件人可以限制。** 当账号配置了 `sender_emails` 时,`from_email` 必须在列表中。【代码】`src/emailTools.ts:170`。这一点是已核实的保护;但**没配置时不做任何限制**,默认情况需要用户自己去配。
- **读取有只读模式。** 打开收件箱时使用了 `readOnly: true`。【代码】`src/imapService.ts:381`。但修改类工具 `emails_modify` 仍可以移动、标记、归档邮件。
- **凭据通过环境变量。**`IMAP_PASS`、`SMTP_PASS` 等。【代码】变量名见工具定义。
- **代码里有一处外部地址**指向 `raw.githubusercontent.com`,位置未记录,需要补查。

## 我们的测试(目前)
- **未测。** 草稿阶段还没有用测试邮箱运行。

## 结论(草稿)
功能覆盖日常整理,发件人限制是可选的、需要主动开启。装之前务必配置 `sender_emails`。

## 补充核实(2026-11-03,读代码)
- **`raw.githubusercontent.com` 出处已查明:**仅在 `scripts/license-compliance.py:40、113`,用于许可证合规脚本拉取 URI.js 的 LICENSE(固定到某提交),**不在运行时代码路径**。此前的待查项关闭。
