const { getAdminApp } = require('../_lib/firebase-admin');
const { SESSION_COOKIE, securityHeaders, json } = require('../_lib/security');

module.exports = async function logout(req, res) {
  securityHeaders(res);
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method_not_allowed' });
  try {
    const cookie = require('../_lib/security').sessionCookie(req);
    if (cookie) {
      const app = getAdminApp();
      const decoded = await app.auth().verifySessionCookie(cookie, false);
      await app.auth().revokeRefreshTokens(decoded.uid);
    }
  } catch (_) {
    // Clearing the cookie is still safe when the old session is already invalid.
  }
  res.status(200).json({ ok: true });
};
