# notes-mcp
A small MCP server that reads and writes local markdown notes.
## Install
npx -y notes-mcp ~/notes
Usage: configure your client with the command above. The server only touches the directory you pass in and makes no network requests. Tools: list_notes, read_note, write_note. Each tool validates that the path stays inside the notes directory. Errors are returned as structured messages.
