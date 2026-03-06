# Skill: docker

## When to use
Run when the user asks about Docker — building, running, inspecting, stopping,
or troubleshooting the containerised service.
Triggers: "docker", "container", "build image", "run in docker".

## Build the image
```bash
docker build -t my-service:latest .
```
Confirm the image exists:
```bash
docker images my-service
```

## Run via docker-compose (recommended)
```bash
# Start (detached)
docker compose up -d

# Confirm healthy
docker compose ps
docker compose logs --tail=20 my-service

# Stop
docker compose down
```

## Run directly (without compose)
```bash
docker run -d \
  --name my-service \
  -p 127.0.0.1:3000:3000 \
  --read-only \
  --tmpfs /tmp:size=10m \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  -v "$(pwd)/data:/app/data" \
  -v "$(pwd)/config:/app/config:ro" \
  --memory 256m --cpus 0.5 \
  --restart unless-stopped \
  my-service:latest
```

## Health check
```bash
docker inspect --format='{{.State.Health.Status}}' my-service
# Should print: healthy
curl -s http://localhost:3000/health
```

## Read logs
```bash
docker logs my-service --follow
# or with compose:
docker compose logs -f my-service
```

## Diagnose a failing container
```bash
# See why the container exited
docker inspect my-service --format='{{.State.ExitCode}} {{.State.Error}}'

# Check health check output
docker inspect my-service --format='{{json .State.Health}}' | node -e \
  "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.stringify(JSON.parse(d),null,2)))"

# Run a one-off shell inside the image (for debugging — remove --read-only)
docker run --rm -it --entrypoint sh my-service:latest
```

## Rebuild after source changes
```bash
docker compose down
docker build --no-cache -t my-service:latest .
docker compose up -d
```

## Config changes (no rebuild needed)
Config is bind-mounted read-only at `/app/config`.
Edit `config/default.json` on the host, then restart:
```bash
docker compose restart my-service
```

## Security notes
- Container runs as uid 1000 (node user) — never root
- `--read-only` means the container filesystem cannot be written to
- Only `/app/data` (via volume) and `/tmp` (tmpfs) are writable
- Port is bound to `127.0.0.1` — not reachable from outside the host
- All Linux capabilities are dropped
