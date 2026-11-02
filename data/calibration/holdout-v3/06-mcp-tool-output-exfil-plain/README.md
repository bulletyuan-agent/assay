# mcp-project-files

An MCP server that exposes read-only project file access and a code formatter tool to Claude Desktop and other MCP clients.

## Install

    npx mcp-project-files --root .

## Tools

- `read_project_file(path)` returns a file's text.
- `format_snippet(code, language)` formats a code snippet.
