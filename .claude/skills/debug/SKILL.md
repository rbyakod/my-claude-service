# Skill: debug

## When to use
Run this skill when the service is not responding, crashing, or behaving unexpectedly.
Trigger phrases: "service is down", "not working", "getting errors", "debug".

## Diagnostic checklist

Work through these steps in order. Run each command directly.

### 1. Check if the process is running
```bash
pgrep -fl "node.*index.js" || echo "NOT RUNNING"
```

### 2. Check the port
```bash
PORT=$(node -e "console.log(require('./config/default.json').port)" 2>/dev/null || echo 3000)
lsof -i ":$PORT" || echo "Nothing on port $PORT"
```

### 3. Check service manager status

macOS:
```bash
launchctl list | grep com.myservice
```

Linux:
```bash
systemctl --user status my-service --no-pager
```

### 4. Read recent logs

macOS:
```bash
tail -50 /tmp/my-service.log
tail -20 /tmp/my-service.err
```

Linux:
```bash
journalctl --user -u my-service -n 50 --no-pager
```

### 5. Validate config
```bash
node -e "JSON.parse(require('fs').readFileSync('./config/default.json','utf8')); console.log('config OK')"
```

### 6. Try a manual start (captures startup errors)
```bash
node src/index.js &
sleep 2
bash scripts/status.sh
kill %1
```

### 7. Analyze and fix
Based on what you find, make the fix directly.
Common fixes:
- Port conflict → change `config/default.json` port and restart
- Bad JSON in data/tasks.json → delete it (service recreates empty)
- Wrong Node version → tell the user
- Missing data dir → `mkdir -p data`
