# Skill: add-feature

## When to use
Run this skill when the user asks to add a new API endpoint or middleware.
Trigger phrases: "add a route for", "I need an endpoint", "add feature".

## What you do

### 1. Clarify the requirement
Ask the user:
- What resource or action this endpoint handles
- Which HTTP method(s)
- What the request body looks like (if any)
- What the response should look like

### 2. Create the route file
Create `src/routes/<resource>.js` following the pattern in `src/routes/tasks.js`:
- Export a single `handle<Resource>` async function
- Accept `(req, res, urlParts)`
- Use the `json()` helper pattern for responses
- Use `readBody()` for POST/PATCH bodies
- Validate all inputs, return 400 on bad input
- Import logger and log meaningful events
- Never use external dependencies

### 3. Register the route in src/index.js
Add a new `if (resource === '<resource>') return handle<Resource>(req, res, urlParts);`
line inside the request handler, following the existing pattern.

### 4. Document the new endpoint in CLAUDE.md
Add a row to the API reference table.

### 5. Test the new route
```bash
node src/index.js &
sleep 1
# Replace with appropriate curl for the new endpoint
curl -s http://localhost:3000/<resource> | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d)))"
kill %1
```

### 6. Restart the service
macOS: `launchctl kickstart -k gui/$(id -u)/com.myservice`
Linux: `systemctl --user restart my-service`
