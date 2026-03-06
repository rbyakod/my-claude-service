/**
 * Security middleware and utilities.
 *
 * Applied globally in index.js. Also imported by individual routes for
 * input sanitization before data reaches the store.
 */

// ── Prompt-injection detection ──────────────────────────────────────────────
// These patterns look like CLAUDE.md headings, system prompts, or common injection attempts.
// They must never appear verbatim in task titles, agent names, or currentTask.
const INJECTION_RE = new RegExp([
  '^#+\\s',                          // Markdown headings
  '```',                             // Code fences
  '<script[\\s>]',                   // Script tags
  'ignore\\s+(all\\s+)?(previous|prior|all|instructions?)', // Ignore patterns
  'disregard\\s+(all|previous|prior|instructions?)',        // Disregard patterns
  'forget\\s+(all|previous|prior|everything|instructions?)', // Forget patterns
  'system\\s*:',                     // System prompt markers
  '\\[system\\]',                    // Bracket markers [SYSTEM]
  '\\[instruction\\]',               // Bracket markers [INSTRUCTION]
  '<\\|im_start\\|>',                // OpenAI-style markers
  'you\\s+are\\s+now',               // Role manipulation
  'act\\s+as\\s+(if|a|an|you)',      // Role manipulation
  'pretend\\s+(you\\s+are|to\\s+be)', // Role manipulation
  'new\\s+instructions?',            // Instruction replacement
  'override\\s+(previous|all|default)', // Override attempts
].join('|'), 'im');

// Additional check for multi-line injection (newline followed by dangerous content)
const MULTILINE_INJECTION_RE = /\n[\s]*[#\[\{<]/;

/**
 * Strip null bytes, ASCII control chars, and trim. Returns at most maxLen chars.
 */
export function sanitizeText(str, maxLen = 300) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/\0/g, '')                          // null bytes
    .replace(/[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '') // control chars (keep \t \n)
    .trim()
    .slice(0, maxLen);
}

/**
 * Sanitize user-supplied text before storing it in a place Claude will read.
 * In addition to sanitizeText, strips markdown headings and fenced code blocks
 * that could be mistaken for CLAUDE.md structure when Claude reads tasks.json.
 */
export function sanitizeForClaude(str, maxLen = 300) {
  const clean = sanitizeText(str, maxLen);
  if (INJECTION_RE.test(clean)) {
    // Replace the dangerous pattern rather than reject — callers that need to
    // reject should call hasInjectionAttempt first.
    return clean
      .replace(/^#+\s/gm, '')
      .replace(/```[\s\S]*?```/g, '[removed]')
      .replace(/<script[\s\S]*?<\/script>/gi, '[removed]');
  }
  return clean;
}

/** Returns true if the string contains a known prompt-injection pattern. */
export function hasInjectionAttempt(str) {
  if (!str || typeof str !== 'string') return false;
  const normalized = str.toLowerCase().trim();
  return INJECTION_RE.test(normalized) || MULTILINE_INJECTION_RE.test(str);
}

// ── Security headers ────────────────────────────────────────────────────────
export function addSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'no-referrer');
  // Allow inline scripts/styles for the dashboard; restrict everything else
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'"
  );
}

// ── API key authentication ───────────────────────────────────────────────────
/**
 * Returns true if the request is authenticated.
 * When API_KEY env var is not set the endpoint is open (useful for local dev).
 * Set API_KEY in .env for any internet-facing deployment.
 */
export function isAuthenticated(req) {
  const key = process.env.API_KEY;
  if (!key) return true;  // not configured — allow all
  return req.headers['x-api-key'] === key;
}

// ── Rate limiter ─────────────────────────────────────────────────────────────
const _counts = new Map();
let _resetAt = Date.now();

const RATE_MAX_REQS  = 120;   // requests
const RATE_WINDOW_MS = 60_000; // per minute per IP

export function isRateLimited(ip) {
  const now = Date.now();
  if (now > _resetAt) {
    _counts.clear();
    _resetAt = now + RATE_WINDOW_MS;
  }
  const n = (_counts.get(ip) ?? 0) + 1;
  _counts.set(ip, n);
  return n > RATE_MAX_REQS;
}

// ── Body reading with size limit ─────────────────────────────────────────────
const MAX_BODY_BYTES = 8_192; // 8 KB

export function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let raw  = '';
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        // Drain remaining data then reject — don't destroy so caller can still write response
        req.resume();
        return reject(Object.assign(new Error('Request body too large'), { status: 413 }));
      }
      raw += chunk;
    });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch { reject(Object.assign(new Error('Invalid JSON body'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}

// ── Allowlist validation helpers ─────────────────────────────────────────────
export const VALID_TASK_STATUSES  = new Set(['pending', 'in_progress', 'done', 'failed']);
export const VALID_AGENT_STATUSES = new Set(['idle', 'active', 'error']);
export const VALID_PRIORITIES     = new Set(['low', 'normal', 'high']);
