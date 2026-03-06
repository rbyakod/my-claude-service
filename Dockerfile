# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — builder
#   Only exists to copy source; we use it so production stage gets nothing extra
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Copy only what the service needs at runtime (no test files, no dev tooling)
COPY package.json ./
COPY src/         ./src/
COPY config/      ./config/
COPY public/      ./public/

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — production
#   - Minimal alpine image
#   - Non-root user (node, uid 1000) built into the official node image
#   - No shell tools, no package manager, no build leftovers
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS production

# Create the data directory and set ownership BEFORE switching user
WORKDIR /app
RUN mkdir -p /app/data && chown -R node:node /app

# Switch to the non-root node user for all subsequent instructions
USER node

# Copy only the built artefacts from stage 1, owned by node
COPY --from=builder --chown=node:node /app ./

# Node.js listens on this port — document it (does NOT publish it)
EXPOSE 3000

# Docker will poll this endpoint; container is unhealthy if it fails 3 times
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"

# SIGTERM triggers graceful shutdown in src/index.js
CMD ["node", "src/index.js"]
