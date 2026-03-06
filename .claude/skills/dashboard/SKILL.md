# Skill: dashboard

## When to use
Run when the user asks about the dashboard, monitoring, or agent activity.
Triggers: "open dashboard", "check agents", "monitor the service", "what are agents doing".

## Open the dashboard
```bash
PORT=$(node -e "console.log(require('./config/default.json').port)" 2>/dev/null || echo 3000)
open "http://localhost:${PORT}/dashboard"
```
If the service is not running, start it first: `node src/index.js`

## Register a sub-agent (from a Claude Code sub-agent or script)
```bash
PORT=3000
curl -s -X POST http://localhost:${PORT}/agents \
  -H "Content-Type: application/json" \
  -d '{"id":"agent-1","name":"Data Processor","capability":"data-processing"}'
```

## Update agent status / send heartbeat
```bash
# Mark active with a current task
curl -s -X PATCH http://localhost:${PORT}/agents/agent-1 \
  -H "Content-Type: application/json" \
  -d '{"status":"active","currentTask":"Processing batch job #42"}'

# Mark idle
curl -s -X PATCH http://localhost:${PORT}/agents/agent-1 \
  -H "Content-Type: application/json" \
  -d '{"status":"idle","currentTask":null}'
```

## List all agents
```bash
curl -s http://localhost:${PORT}/agents | node -e \
  "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
    JSON.parse(d).forEach(a=>console.log(a.status.padEnd(10), a.name, '|', a.currentTask??'idle'))
  })"
```

## Deregister an agent
```bash
curl -s -X DELETE http://localhost:${PORT}/agents/agent-1
```

## Agent states
| Status | Meaning | Dashboard display |
|--------|---------|-------------------|
| idle   | Registered, no active work | Grey dot |
| active | Working on a task | Blue pulsing dot |
| error  | Failed, needs attention | Red dot |
| stale  | No heartbeat for 30s | Dimmed card |

## Integrating a Claude Code sub-agent
When orchestrating sub-agents with the Agent tool, instruct each sub-agent
to register itself and send heartbeats:

1. At start: POST /agents with its id, name, and capability
2. When work begins: PATCH /agents/:id with status=active and currentTask description
3. Periodically: PATCH /agents/:id to refresh lastHeartbeat (every 15–20s)
4. When done: PATCH /agents/:id with status=idle and currentTask=null
5. On exit: DELETE /agents/:id

## Diagnosing dashboard issues
- Dashboard blank → check that the service is running: `bash scripts/status.sh`
- No events updating → check browser console for EventSource errors
- Agent shows as stale → no heartbeat received in 30s; check the agent process
- SSE disconnected banner → service restarted; dashboard auto-reconnects in 3s
