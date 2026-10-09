const { getAdminApp } = require('./firebase-admin');

const SESSION_COOKIE = '__Host-andos_session';
const SESSION_MAX_AGE = 5 * 24 * 60 * 60;

function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i <= 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function sessionCookie(req) {
  return parseCookies(req.headers.cookie || '')[SESSION_COOKIE] || '';
}

async function verifyRequestSession(req) {
  const cookie = sessionCookie(req);
  if (!cookie) return null;
  const app = getAdminApp();
  return app.auth().verifySessionCookie(cookie, true);
}

function roleOf(decoded) {
  if (decoded && decoded.admin === true) return 'admin';
  if (decoded && (decoded.role === 'admin' || decoded.role === 'user' || decoded.role === 'guest')) return decoded.role;
  if (decoded && decoded.firebase && decoded.firebase.sign_in_provider === 'anonymous') return 'guest';
  return 'user';
}

function securityHeaders(res, options = {}) {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (options.noStore !== false) res.setHeader('Cache-Control', 'private, no-store, max-age=0, must-revalidate');
  if (options.html) res.setHeader('Content-Security-Policy', options.csp || dashboardCsp(options.nonce));
}

function dashboardCsp(nonce = '') {
  const nonceSource = nonce ? ` 'nonce-${nonce}'` : '';
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self' https://accounts.google.com",
    `script-src 'self'${nonceSource} https://www.gstatic.com https://apis.google.com https://accounts.google.com https://cdn.tailwindcss.com https://cdnjs.cloudflare.com https://static.cloudflareinsights.com`,
    "script-src-attr 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
    "font-src 'self' data: https://fonts.gstatic.com https://cdnjs.cloudflare.com",
    "img-src 'self' data: blob: https://raw.githubusercontent.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://*.googleusercontent.com https://*.gstatic.com",
    "media-src 'self' blob: https://raw.githubusercontent.com https://cdn.jsdelivr.net",
    "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com https://raw.githubusercontent.com https://cdn.jsdelivr.net https://api.qrserver.com https://text.pollinations.ai https://r.jina.ai https://api.allorigins.win https://api.codetabs.com https://info-api-free-six.vercel.app https://static.cloudflareinsights.com",
    "frame-src 'self' https://accounts.google.com https://*.firebaseapp.com",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    'upgrade-insecure-requests',
  ].join('; ');
}

function json(res, status, body) {
  securityHeaders(res);
  res.status(status).json(body);
}

function unauthorized(res) {
  json(res, 401, { ok: false, error: 'unauthorized' });
}

module.exports = {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  sessionCookie,
  verifyRequestSession,
  roleOf,
  securityHeaders,
  dashboardCsp,
  json,
  unauthorized,
};
