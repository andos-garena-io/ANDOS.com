const { verifyRequestSession, securityHeaders, json } = require('../../_lib/security');

const ALLOWED = new Set(['sendMessage', 'sendPhoto', 'sendDocument', 'answerCallbackQuery']);

module.exports = async function telegramProxy(req, res) {
  securityHeaders(res);
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method_not_allowed' });
  try {
    const session = await verifyRequestSession(req);
    if (!session) return json(res, 401, { ok: false, error: 'unauthorized' });
    const method = String((req.query && req.query.method) || '');
    if (!ALLOWED.has(method)) return json(res, 403, { ok: false, error: 'method_not_allowed' });
    const worker = process.env.TELEGRAM_PROXY_URL;
    const shared = process.env.ANDOS_WORKER_SHARED_SECRET;
    if (!worker || !shared) return json(res, 503, { ok: false, error: 'telegram_unavailable' });
    const upstream = await fetch(worker.replace(/\/$/, '') + '/' + method, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-ANDOS-Internal': shared },
      body: JSON.stringify(req.body || {}),
    });
    const text = await upstream.text();
    res.status(upstream.ok ? 200 : 502).setHeader('Content-Type', 'application/json; charset=utf-8').send(text);
  } catch (_) {
    json(res, 502, { ok: false, error: 'telegram_unavailable' });
  }
};
