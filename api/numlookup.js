const { verifyRequestSession, securityHeaders, json } = require('./_lib/security');

const buckets = new Map();
function rateOk(uid) {
  const now = Date.now();
  const list = (buckets.get(uid) || []).filter((t) => now - t < 60_000);
  if (list.length >= 10) return false;
  list.push(now);
  buckets.set(uid, list);
  if (buckets.size > 5000) buckets.clear();
  return true;
}

module.exports = async function numlookup(req, res) {
  securityHeaders(res);
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method_not_allowed' });
  try {
    const session = await verifyRequestSession(req);
    if (!session) return json(res, 401, { ok: false, error: 'unauthorized' });
    if (!rateOk(session.uid)) return json(res, 429, { ok: false, error: 'rate_limited' });
    const number = String((req.body && req.body.number) || '').replace(/\D/g, '');
    if (!/^\d{10}$/.test(number)) return json(res, 400, { ok: false, error: 'invalid_number' });
    const key = process.env.NUMLOOKUP_API_KEY;
    if (!key) return json(res, 503, { ok: false, error: 'lookup_unavailable' });
    const upstream = await fetch(`https://api.numlookupapi.com/v1/validate/+91${number}?apikey=${encodeURIComponent(key)}`, {
      headers: { Accept: 'application/json' },
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) return json(res, 502, { ok: false, error: 'lookup_failed' });
    res.status(200).json({
      valid: Boolean(data.valid),
      carrier: data.carrier || '',
      location: data.location || '',
    });
  } catch (_) {
    json(res, 401, { ok: false, error: 'unauthorized' });
  }
};
