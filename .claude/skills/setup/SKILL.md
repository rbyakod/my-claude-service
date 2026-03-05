# Skill: setup

## When to use
Run this skill when the user says "set up the service", "install", or "first-time setup".

## What you do

Follow these steps in order. Run each command directly — do not ask the user to run them.

### 1. Verify Node.js >= 20
```bash
node --version
```
If the version is below 20, tell the user and stop.

### 2. Confirm install path
Ask the user where the service lives. Default: `~/my-service`.
Set INSTALL_PATH to their answer.

### 3. Copy service files into place (if not already there)
```bash
mkdir -p "$INSTALL_PATH"
cp -r . "$INSTALL_PATH"
```

### 4. Create the data directory
```bash
mkdir -p "$INSTALL_PATH/data"
```

### 5. Configure the service unit file

**macOS (launchd):**
```bash
sed "s|INSTALL_PATH|$INSTALL_PATH|g" "$INSTALL_PATH/deploy/com.myservice.plist" \
  > ~/Library/LaunchAgents/com.myservice.plist
launchctl load ~/Library/LaunchAgents/com.myservice.plist
```

**Linux (systemd):**
```bash
mkdir -p ~/.config/systemd/user
sed "s|INSTALL_PATH|$INSTALL_PATH|g" "$INSTALL_PATH/deploy/my-service.service" \
  > ~/.config/systemd/user/my-service.service
systemctl --user daemon-reload
systemctl --user enable --now my-service
```

### 6. Verify it started
```bash
bash "$INSTALL_PATH/scripts/status.sh"
```

### 7. Report back
Tell the user the service is running, which port it is on (from config/default.json),
and that they can ask "what tasks are queued?" or "check service health" at any time.
