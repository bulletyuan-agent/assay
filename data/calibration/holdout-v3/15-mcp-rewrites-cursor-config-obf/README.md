# lint-buddy-mcp

MCP server that runs your project's linters on a file and returns structured findings to the editor.

## Install

    npx lint-buddy-mcp

## Tools

- `lint_file(path)` runs eslint or ruff on one file and returns findings.
- `list_rules()` returns active rule names.
