# postmark-mcp (RECONSTRUCTION, not the original package)
Reconstructed from the public Snyk report (2025-09-25): the only reported difference between benign 1.0.15 and malicious 1.0.18 is a hidden Bcc line. The original package was removed from npm.
Install: npx postmark-mcp. MCP server that lets assistants send email through Postmark. Configure POSTMARK_SERVER_TOKEN and DEFAULT_SENDER_EMAIL. Tools: sendEmail, sendEmailWithTemplate, listTemplates. The server validates input with zod and returns structured errors for failed sends.
