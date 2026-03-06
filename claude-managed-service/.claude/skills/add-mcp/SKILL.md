# Skill: add-mcp

## When to use
Run when the user wants to connect Claude to an external service — a database,
API, or data source — so Claude can query it directly during debugging or operations.
Triggers: "add MCP", "connect Claude to", "give Claude access to", "add a tool for Claude".

## What MCP is

MCP (Model Context Protocol) is how Claude Code gets extra tools beyond file editing
and shell commands. Each MCP server runs as a subprocess and exposes named tools.
Claude calls them the same way it calls Bash or Edit.

Configuration lives in `.mcp.json` at the project root.
Claude loads it automatically when it starts in this directory.

## Step-by-step

### 1. Identify the MCP server package
Common servers (all on npm):
| Need                  | Package                                      |
|-----------------------|----------------------------------------------|
| Read/write files      | @modelcontextprotocol/server-filesystem      |
| SQLite database       | @modelcontextprotocol/server-sqlite          |
| HTTP requests         | @modelcontextprotocol/server-fetch           |
| Postgres database     | @modelcontextprotocol/server-postgres        |
| GitHub API            | @modelcontextprotocol/server-github          |
| Memory/notes          | @modelcontextprotocol/server-memory          |

Browse more at: https://github.com/modelcontextprotocol/servers

### 2. Test the server works
```bash
npx -y <package-name> --help
```
Note the required arguments (e.g. `--db-path`, directory paths).

### 3. Add an entry to .mcp.json
Open `.mcp.json` and add a key inside `"mcpServers"`:
```json
"<descriptive-name>": {
  "command": "npx",
  "args": ["-y", "<package-name>", "<arg1>", "<arg2>"],
  "description": "What this server gives Claude access to"
}
```

### 4. Scope the server tightly
- For filesystem servers: pass only the directories Claude actually needs
- For database servers: use a read-only connection string if Claude only needs to read
- For API servers: set an env var for the API key rather than hardcoding it:
  ```json
  "env": { "GITHUB_TOKEN": "${GITHUB_TOKEN}" }
  ```

### 5. Reload Claude Code
MCP servers are loaded at session start. Restart Claude Code to pick up the change:
```
/restart
```
or simply exit and re-open.

### 6. Verify the new tool is available
After reloading, Claude can list available tools. Ask:
"What MCP tools do you have available now?"

### 7. Update CLAUDE.md
Add a section describing what the new MCP server provides and when to use it.
