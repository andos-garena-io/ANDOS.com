const { verifyRequestSession, roleOf, securityHeaders, json } = require('../_lib/security');

module.exports = async function verify(req, res) {
  securityHeaders(res);
  if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'method_not_allowed' });
  try {
    const decoded = await verifyRequestSession(req);
    if (!decoded) return json(res, 401, { ok: false, error: 'unauthorized' });
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).json({
      ok: true,
      uid: decoded.uid,
      role: roleOf(decoded),
      email: decoded.email || '',
      name: decoded.name || decoded.email || 'ANDOS Member',
    });
  } catch (_) {
    json(res, 401, { ok: false, error: 'unauthorized' });
  }
};
