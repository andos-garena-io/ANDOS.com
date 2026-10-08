const { getAdminApp } = require('./_lib/firebase-admin');
const { SESSION_COOKIE, SESSION_MAX_AGE, securityHeaders, json } = require('./_lib/security');

module.exports = async function session(req, res) {
  securityHeaders(res);
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method_not_allowed' });

  try {
    const idToken = req.body && typeof req.body.idToken === 'string' ? req.body.idToken.trim() : '';
    if (!idToken || idToken.length > 10000) return json(res, 400, { ok: false, error: 'id_token_required' });

    const app = getAdminApp();
    const decoded = await app.auth().verifyIdToken(idToken, true);
    const expiresIn = SESSION_MAX_AGE * 1000;
    const sessionCookie = await app.auth().createSessionCookie(idToken, { expiresIn });
    const cookie = [
      `${SESSION_COOKIE}=${encodeURIComponent(sessionCookie)}`,
      'Path=/',
      'HttpOnly',
      'Secure',
      'SameSite=Lax',
      `Max-Age=${SESSION_MAX_AGE}`,
    ].join('; ');
    res.setHeader('Set-Cookie', cookie);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).json({
      ok: true,
      user: {
        uid: decoded.uid,
        role: decoded.admin === true || decoded.role === 'admin' ? 'admin' : (decoded.role || 'user'),
        email: decoded.email || '',
        name: decoded.name || decoded.email || 'ANDOS Member',
      },
      expiresIn: SESSION_MAX_AGE,
    });
  } catch (error) {
    // Never return credential, token, or service-account details.
    json(res, 401, { ok: false, error: 'session_create_failed' });
  }
};
