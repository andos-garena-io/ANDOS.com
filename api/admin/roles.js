const { getAdminApp } = require('../_lib/firebase-admin');
const { verifyRequestSession, roleOf, json, securityHeaders } = require('../_lib/security');

module.exports = async function assignRole(req, res) {
  securityHeaders(res);
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method_not_allowed' });
  let session;
  try { session = await verifyRequestSession(req); } catch (_) { return json(res, 401, { ok: false, error: 'unauthorized' }); }
  if (!session || roleOf(session) !== 'admin') return json(res, 403, { ok: false, error: 'admin_required' });
  const uid = String(req.body && req.body.uid || '').trim();
  const role = String(req.body && req.body.role || '').trim().toLowerCase();
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(uid) || !['admin', 'user', 'guest'].includes(role)) {
    return json(res, 400, { ok: false, error: 'invalid_role_request' });
  }
  try {
    const auth = getAdminApp().auth();
    const existing = await auth.getUser(uid);
    const claims = { ...(existing.customClaims || {}) };
    delete claims.admin;
    delete claims.role;
    claims.role = role;
    if (role === 'admin') claims.admin = true;
    await auth.setCustomUserClaims(uid, claims);
    return json(res, 200, { ok: true, uid, role, appliesOnNextToken: true });
  } catch (err) {
    console.error('[admin/roles]', err && err.message);
    return json(res, 500, { ok: false, error: 'role_update_failed' });
  }
};
