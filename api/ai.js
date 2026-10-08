const { verifyRequestSession, securityHeaders, json } = require('./_lib/security');

module.exports = async function aiProxy(req, res) {
  securityHeaders(res);
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method_not_allowed' });
  try {
    const session = await verifyRequestSession(req);
    if (!session) return json(res, 401, { ok: false, error: 'unauthorized' });
    const worker = process.env.AI_WORKER_URL;
    const shared = process.env.ANDOS_WORKER_SHARED_SECRET;
    if (!worker || !shared) return json(res, 503, { ok: false, error: 'ai_unavailable' });
    const messages = Array.isArray(req.body && req.body.messages) ? req.body.messages.slice(-12) : [];
    const safe = messages
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant'))
      .map((m) => ({ role: m.role, content: String(m.content || '').slice(0, 2000) }))
      .filter((m) => m.content);
    if (!safe.length || safe[0].role !== 'user') return json(res, 400, { ok: false, error: 'messages_required' });
    const upstream = await fetch(worker.replace(/\/$/, '') + '/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-ANDOS-Internal': shared },
      body: JSON.stringify({ messages: safe }),
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) return json(res, 502, { ok: false, error: 'ai_upstream_failed' });
    res.status(200).json({ reply: String(data.reply || '').slice(0, 6000), provider: data.provider || 'server' });
  } catch (_) {
    json(res, 502, { ok: false, error: 'ai_unavailable' });
  }
};
