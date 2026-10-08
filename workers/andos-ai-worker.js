
// ============================================================
// ANDOS AI v2 — support chat + @AndosAdminBot (clean UI + buttons)
// Secrets: GEMINI_KEY, GROQ_KEY, OPENROUTER_KEY, ADMIN_TG_TOKEN,
//          ADMIN_WEBHOOK_SECRET, SA_JSON
// ============================================================
const OWNER = '6775379996';
const NOW = () => Date.now();
const esc = (t) => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const when = (ts) => ts ? new Date(ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
const rupee = (n) => '\u20B9' + (Number(n) || 0);

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-ANDOS-Internal',
  'Content-Type': 'application/json'
};
function json(obj, status) { return new Response(JSON.stringify(obj), { status: status || 200, headers: cors }); }
const now = () => Date.now();

// ---------- provider chain ----------
function cleanMessages(messages) {
  if (!Array.isArray(messages)) return null;
  const out = [];
  for (const m of messages.slice(-12)) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) continue;
    const c = String(m.content || '').slice(0, 2000);
    if (c) out.push({ role: m.role, content: c });
  }
  if (!out.length || out[0].role !== 'user') return null;
  return out;
}

async function tryGemini(env, messages) {
  const res = await fetch(GEMINI_URL + '?key=' + env.GEMINI_KEY, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
      generationConfig: { maxOutputTokens: 700, temperature: 0.6 }
    })
  });
  const d = await res.json();
  if (!res.ok) throw new Error('gemini ' + res.status + ' ' + JSON.stringify(d).slice(0, 150));
  const t = d && d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts
    && d.candidates[0].content.parts.map((p) => p.text || '').join('');
  if (!t) throw new Error('gemini empty');
  return { reply: t.trim(), provider: 'gemini', model: 'gemini-2.5-flash' };
}

async function openaiCompat(url, key, model, messages, extraHeaders) {
  const res = await fetch(url, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key }, extraHeaders || {}),
    body: JSON.stringify({
      model: model,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }].concat(messages),
      max_tokens: 700, temperature: 0.6
    })
  });
  const d = await res.json();
  if (!res.ok || !d.choices || !d.choices[0]) throw new Error(model.split('/')[0] + ' ' + res.status + ' ' + JSON.stringify(d).slice(0, 150));
  return { reply: String(d.choices[0].message.content || '').trim(), provider: model, model: model };
}

const tryGroq = (env, m) => openaiCompat(GROQ_URL, env.GROQ_KEY, GROQ_MODEL, m);
async function tryOpenRouter(env, m) {
  let lastErr = null;
  for (const model of OR_MODELS) {
    try { return await openaiCompat(OR_URL, env.OPENROUTER_KEY, model, m); }
    catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('openrouter: no models');
}

async function aiChat(env, messages, force) {
  const chain = force === 'groq' ? [tryGroq]
    : force === 'openrouter' ? [tryOpenRouter]
    : force === 'gemini' ? [tryGemini]
      : [tryGemini, tryGroq, tryOpenRouter];
  const errs = [];
  for (const fn of chain) {
    try { return await fn(env, messages); } catch (e) { errs.push(String((e && e.message) || e)); }
  }
  const err = new Error('all providers failed: ' + errs.join(' | '));
  err.status = 502;
  throw err;
}


// ---------- very small rate limit (per-isolate, best effort) ----------
const rl = new Map();
function rateOk(ip) {
  const t = now(); const arr = (rl.get(ip) || []).filter((x) => t - x < 60000);
  if (arr.length >= 12) return false;
  arr.push(t); rl.set(ip, arr);
  if (rl.size > 2000) rl.clear();
  return true;
}


// ---------- Firestore admin helpers ----------
let _saTok = null, _saExp = 0;
function b64url(bytes) { let s = ''; const a = new Uint8Array(bytes); for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
async function saToken(env) {
  if (_saTok && NOW() < _saExp - 60000) return _saTok;
  const sa = JSON.parse(env.SA_JSON);
  const enc = new TextEncoder(); const t = Math.floor(NOW() / 1000);
  const h = b64url(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const p = b64url(enc.encode(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/cloud-platform', aud: TOKEN_URL, iat: t, exp: t + 3600 })));
  const b64 = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(h + '.' + p));
  const res = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' + h + '.' + p + '.' + b64url(sig) });
  const j = await res.json(); if (!j.access_token) throw new Error('SA token failed');
  _saTok = j.access_token; _saExp = t + (j.expires_in || 3600); return _saTok;
}
async function fsFetch(env, url, method, body) {
  const t = await saToken(env);
  const res = await fetch(url, { method, headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const txt = await res.text(); let j = null; try { j = JSON.parse(txt); } catch (e) {}
  if (!res.ok && res.status !== 404) throw new Error('FS ' + res.status + ' ' + txt.slice(0, 250));
  return { status: res.status, data: j };
}
const fsGet = async (env, path) => { const r = await fsFetch(env, FS + '/' + path, 'GET'); return r.status === 404 ? null : r.data; };
const fsPatch = async (env, path, fields) => {
  const mask = Object.keys(fields).map((k) => 'updateMask.fieldPaths=' + encodeURIComponent(k)).join('&');
  return fsFetch(env, FS + '/' + path + '?' + mask, 'PATCH', { fields: toFields(fields) });
};
const fsCreate = async (env, col, fields, docId) => fsFetch(env, FS + '/' + col + (docId ? '?documentId=' + encodeURIComponent(docId) : ''), 'POST', { fields: toFields(fields) });
async function fsAll(env, col, limit) {
  const r = await fsFetch(env, FS + ':runQuery', 'POST', { structuredQuery: { from: [{ collectionId: col }], limit: limit || 500 } });
  return (Array.isArray(r.data) ? r.data : []).filter((x) => x.document).map((x) => ({ id: x.document.name.split('/').pop(), data: fromFields(x.document.fields || {}) }));
}
const sv = (v) => v === null || v === undefined ? { nullValue: null } : typeof v === 'boolean' ? { booleanValue: v } : typeof v === 'number' ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }) : typeof v === 'object' ? { mapValue: { fields: toFields(v) } } : { stringValue: String(v) };
function toFields(o) { const f = {}; for (const k of Object.keys(o || {})) f[k] = sv(o[k]); return f; }
function fromVal(v) {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue; if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue; if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null; return null;
}
function fromFields(f) { const o = {}; for (const k of Object.keys(f || {})) o[k] = fromVal(f[k]); return o; }
const norm = (x) => String(x || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
function findReq(reqs, target) { const t = norm(target); return reqs.find((r) => norm(r.id) === t || norm(r.data.id) === t); }

// ============================================================
// ACTIONS — shared by text commands AND inline buttons
// returns { toast, card }  (toast = callback ack · card = message text)
// ============================================================
async function runAction(env, verb, idPart, arg) {
  const reqs = await fsAll(env, 'requests', 500);
  if (verb === 'pending') {
    const p = reqs.filter((r) => r.data.status === 'pending').slice(0, 8);
    if (!p.length) return { toast: '✅ No pending requests', card: '<b>✅ No pending requests</b>' };
    const rows = p.map((r) => '<code>' + esc(r.id) + '</code>  ' + esc(String(r.data.type || '').toUpperCase()) + '  ' + rupee(r.data.amount) + '  ' + esc(r.data.userName || '-'));
    return { toast: p.length + ' pending', card: '<b>📋 Pending · ' + p.length + '</b>\n\n' + rows.join('\n') + '\n\n<i>/ok_ID se approve</i>' };
  }
  if (!idPart) return { toast: 'ID missing', card: '⚠️ ID missing.' };

  const req = findReq(reqs, idPart);
  if (!req) return { toast: 'Not found', card: '⚠️ Request nahi mili: <code>' + esc(idPart) + '</code>' };
  const d = req.data; const uid = d.uid || ''; const amount = Number(d.amount || 0);
  const orderId = d.orderId || '';
  const order = orderId ? await fsGet(env, 'orders/' + orderId) : null;

  // idempotency guards — re-tap pe dobara paisa na jaaye (manual UPI error-proofing)
  if (verb === 'ok' && String(d.status || '') === 'approved') return { toast: '✅ Already approved', card: null };
  if (verb === 'no' && String(d.status || '') === 'rejected') return { toast: '❌ Already rejected', card: null };
  if (verb === 'proc' && (String(d.status || '') === 'approved' || String(d.status || '') === 'completed')) return { toast: '✅ Already done', card: null };

  if (verb === 'info') {
    const u = uid ? await fsGet(env, 'users/' + uid) : null;
    const ud = u ? fromFields(u.fields || {}) : {};
    const card = '<b>🔎 ' + esc(req.id) + '</b>\n\n'
      + 'Type      ' + esc(String(d.type || '-').toUpperCase()) + '\n'
      + 'Amount    <b>' + rupee(amount) + '</b>\n'
      + 'Status    ' + esc(d.status || '-') + '\n'
      + 'User      ' + esc(d.userName || '-') + '\n'
      + 'Email     ' + esc(d.userEmail || '-') + '\n'
      + 'Wallet    ' + rupee(Number(ud.wallet) || 0) + '\n'
      + 'Ref       <code>' + esc(d.reference || '-') + '</code>\n'
      + 'Order     <code>' + esc(d.orderId || '-') + '</code>\n'
      + 'UID       <code>' + esc(uid || '-') + '</code>\n'
      + 'Time      ' + when(d.createdAt);
    return { toast: req.id, card, reply: true };
  }

  if (verb === 'proc') {
    if (d.type === 'deposit') return { toast: 'Use /ok_ for deposits', card: '⚠️ Deposit ke liye <code>/ok_' + esc(req.id) + '</code>' };
    if (order) await fsPatch(env, 'orders/' + orderId, { status: 'processing', displayStatus: 'Processing', progress: 60, updatedAt: NOW() });
    await fsPatch(env, 'requests/' + req.id, { status: 'processing', updatedAt: NOW() });
    return { toast: '🔄 Processing', card: '<b>🔄 Processing</b>\n\n' + esc(orderId || req.id) + '\nPayment mila · top-up in progress\n<i>Complete: /ok_' + esc(req.id) + '</i>', edit: true };
  }

  if (verb === 'no') {
    const reason = (arg || '').trim() || 'Payment could not be verified.';
    if (d.type === 'order' && order) await fsPatch(env, 'orders/' + orderId, { status: 'failed', displayStatus: 'Failed', failReason: reason, progress: 0, updatedAt: NOW() });
    await fsPatch(env, 'requests/' + req.id, { status: 'rejected', note: reason, updatedAt: NOW() });
    return { toast: '❌ Rejected', card: '<b>❌ Rejected</b>\n\n' + esc(req.id) + '\n' + esc(reason), edit: true };
  }

  if (verb === 'code') {
    const code = (arg || '').trim();
    if (d.type !== 'order') return { toast: 'Orders only', card: '⚠️ Redeem code sirf order ke liye.' };
    if (!code) return { toast: 'Send: /code_ID XXXX-XXXX', card: null };
    if (order) await fsPatch(env, 'orders/' + orderId, { status: 'completed', displayStatus: 'Completed', adminCompleted: true, progress: 100, redeemCode: code, updatedAt: NOW() });
    await fsPatch(env, 'requests/' + req.id, { status: 'approved', redeemCode: code, updatedAt: NOW() });
    return { toast: '✅ Code sent', card: '<b>✅ Code + Completed</b>\n\n' + esc(orderId || req.id) + '\n<code>' + esc(code) + '</code>', edit: true };
  }

  if (verb === 'ok') {
    if (d.type === 'deposit') {
      if (!(amount > 0)) return { toast: 'Invalid amount', card: '⚠️ Deposit amount invalid.' };
      const u = await fsGet(env, 'users/' + uid);
      const oldW = u ? (Number(fromFields(u.fields || {}).wallet) || 0) : 0;
      const newW = oldW + amount;
      const upd = { wallet: newW, updatedAt: NOW() };
      const unlock = Number(d.unlockNeeded || 0) > 0 && newW >= Number(d.unlockNeeded || 0);
      if (unlock) upd.walletUnlocked = true;
      if (u) await fsPatch(env, 'users/' + uid, upd);
      else await fsCreate(env, 'users', Object.assign({ uid, wallet: newW, createdAt: NOW() }, unlock ? { walletUnlocked: true } : {}), uid);
      try {
        const w = await fsGet(env, 'wallets/' + uid);
        if (w) await fsPatch(env, 'wallets/' + uid, { balance: newW, updatedAt: NOW() });
        else await fsCreate(env, 'wallets', { balance: newW, updatedAt: NOW() }, uid);
      } catch (e) {}
      try {
        if (d.reference) {
          const txs = await fsAll(env, 'transactions', 300);
          const tx = txs.find((t) => t.data.reference === d.reference && t.data.uid === uid);
          if (tx) await fsPatch(env, 'transactions/' + tx.id, { status: 'approved', desc: 'Wallet Recharge - Approved', approvedAt: NOW() });
        }
      } catch (e) {}
      await fsPatch(env, 'requests/' + req.id, { status: 'approved', approvedAt: NOW(), updatedAt: NOW() });
      return { toast: '✅ ' + rupee(amount) + ' credited', edit: true,
        card: '<b>✅ Deposit Approved</b>\n\n' + rupee(amount) + ' credited · Wallet ' + rupee(oldW) + ' → <b>' + rupee(newW) + '</b>' + (unlock ? ' 🔓' : '') + '\n' + esc(d.userName || req.id) + ' · ' + esc(req.id) + '\n<i>' + when(NOW()) + '</i>' };
    }
    if (order) await fsPatch(env, 'orders/' + orderId, { status: 'completed', displayStatus: 'Completed', adminCompleted: true, progress: 100, updatedAt: NOW() });
    await fsPatch(env, 'requests/' + req.id, { status: 'approved', approvedAt: NOW(), updatedAt: NOW() });
    return { toast: '✅ Order completed', edit: true,
      card: '<b>✅ Order Completed</b>\n\n' + esc(orderId || req.id) + '\n' + esc(d.service || '') + (d.plan ? ' · ' + esc(d.plan) : '') + '\n<i>' + when(NOW()) + '</i>' };
  }
  return { toast: 'Unknown action', card: '⚠️ Unknown action.' };
}

function parseAction(str) {
  const s = String(str || '').trim().replace(/^\//, '');
  const m = s.match(/^([a-zA-Z]+)_?([A-Za-z0-9-]*)(?:\s+([\s\S]+))?$/);
  if (!m) return null;
  return { verb: m[1].toLowerCase(), id: m[2], arg: m[3] || '' };
}


// ---------- Telegram senders (admin bot) ----------
async function tgSend(env, text, extra) {
  try {
    await fetch('https://api.telegram.org/bot' + env.ADMIN_TG_TOKEN + '/sendMessage', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ chat_id: OWNER, text, parse_mode: 'HTML', disable_web_page_preview: true }, extra || {})) });
  } catch (e) {}
}
const tgAnswer = async (env, cbId, text) => {
  try { await fetch('https://api.telegram.org/bot' + env.ADMIN_TG_TOKEN + '/answerCallbackQuery', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: cbId, text, show_alert: false }) }); } catch (e) {}
};
const tgEdit = async (env, chatId, messageId, text, replyMarkup) => {
  try { await fetch('https://api.telegram.org/bot' + env.ADMIN_TG_TOKEN + '/editMessageText', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, text, parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: replyMarkup }) }); } catch (e) {}
};
const KB = (rows) => ({ inline_keyboard: rows.map((r) => r.map(([label, data]) => ({ text: label, callback_data: data }))) });

// ---------- admin message builders (minimalist) ----------
function statsCard(stats) {
  return '<b>\uD83D\uDCCA ANDOS \u00B7 Live Stats</b>\n\n'
    + '\uD83D\uDC65 Users <b>' + stats.users + '</b>\n'
    + '\uD83D\uDED2 Orders <b>' + stats.orders + '</b>  \u2705' + stats.oDone + ' \u23F3' + stats.oPend + '\n'
    + '\uD83E\uDDFE Requests <b>' + stats.requests + '</b>  \u23F3 <b>' + stats.rPend + '</b> pending\n'
    + '\uD83D\uDCB0 Wallet total <b>' + rupee(stats.walletTotal) + '</b>\n'
    + '\uD83D\uDCB3 Transactions <b>' + stats.txs + '</b>\n\n'
    + '<i>' + when(NOW()) + '</i>';
}
const STATS_KB = () => KB([['\uD83D\uDD04 Refresh', 'stats'], ['\uD83E\uDDFE Pending', 'pending'], ['\uD83D\uDD30 Ping', 'ping']]);
async function fetchStats(env) {
  const [users, orders, reqs, txs] = await Promise.all([fsAll(env, 'users', 500), fsAll(env, 'orders', 500), fsAll(env, 'requests', 500), fsAll(env, 'transactions', 500)]);
  return {
    users: users.length, orders: orders.length,
    oDone: orders.filter((o) => o.data.status === 'completed').length,
    oPend: orders.filter((o) => o.data.status === 'pending').length,
    requests: reqs.length, rPend: reqs.filter((r) => r.data.status === 'pending').length,
    walletTotal: users.reduce((s, u) => s + (Number(u.data.wallet) || 0), 0),
    txs: txs.length
  };
}
async function pendingCard(env) {
  const reqs = await fsAll(env, 'requests', 500);
  const p = reqs.filter((r) => r.data.status === 'pending').slice(0, 6);
  if (!p.length) return { text: '<b>\u2705 No pending requests</b>', kb: KB([['\uD83D\uDCCA Stats', 'stats'], ['\uD83D\uDD04 Refresh', 'pending']]), edit: true };
  let text = '<b>\uD83D\uDCCB Pending \u00B7 ' + p.length + '</b>\n\n';
  const rows = [];
  p.forEach((r, i) => {
    const d = r.data;
    text += (i + 1) + '. <code>' + esc(r.id) + '</code>  ' + rupee(d.amount) + '  ' + esc(d.userName || '-') + '\n';
    const k = String(r.id).replace(/[^A-Za-z0-9]/g, '');
    rows.push([['\u2705 Approve', 'ok_' + k], ['\u274C Reject', 'no_' + k], ['\uD83D\uDD0E', 'info_' + k]]);
  });
  rows.push([['\uD83D\uDCCA Stats', 'stats'], ['\uD83D\uDD04 Refresh', 'pending']]);
  return { text, kb: KB(rows), edit: true };
}

// ---------- admin dispatcher (text + callback) ----------
async function adminRun(env, verb, idPart, arg, ctx) {
  if (verb === 'ping') return { toast: 'pong', card: '\uD83C\uDFF3 pong \u00B7 @AndosAdminBot\n<i>' + when(NOW()) + '</i>', kb: null };
  if (verb === 'stats') { const s = await fetchStats(env); return { toast: 'Stats', card: statsCard(s), kb: STATS_KB(), edit: true }; }
  if (verb === 'pending') { const p = await pendingCard(env); return { toast: 'Pending', card: p.text, kb: p.kb }; }
  if (verb === 'help' || verb === 'start') return { toast: 'Help',
    card: '<b>\uD83D\uDEE0 ANDOS Admin Bot</b>\n\n'
      + '<code>/stats</code>  live numbers\n<code>/pending</code>  approvals\n<code>/ask &lt;sawaal&gt;</code>  AI assistant\n<code>/ping</code>  health\n\n'
      + '<i>Tracker bot: /ok_ /proc_ /no_ /code_</i>',
    kb: KB([['\uD83D\uDCCA Stats', 'stats'], ['\uD83E\uDDFE Pending', 'pending']]) };
  if (verb === 'ask') {
    if (!arg) return { toast: 'Usage: /ask <question>', card: null };
    const r = await aiChat(env, [{ role: 'user', content: arg }], null);
    return { toast: 'AI', card: '<b>\uD83E\uDD16 AI</b>\n\n' + esc(r.reply) + '\n\n<i>via ' + esc(r.provider) + '</i>', kb: null };
  }
  if (['ok', 'no', 'proc', 'code', 'info', 'pending'].includes(verb)) return runAction(env, verb, idPart, arg);
  return null;
}


// ---------- worker ----------
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

    if (url.pathname === '/admin-webhook') {
      if (req.method !== 'POST') return new Response('POST only', { status: 405 });
      const secret = req.headers.get('x-telegram-bot-api-secret-token') || '';
      if (!env.ADMIN_WEBHOOK_SECRET || secret !== env.ADMIN_WEBHOOK_SECRET) return new Response('forbidden', { status: 403 });
      let update = null;
      try { update = await req.json(); } catch (e) {}

      if (update && update.callback_query) {
        const cb = update.callback_query;
        const chatId = cb.message && cb.message.chat && String(cb.message.chat.id);
        if (chatId !== OWNER) { await tgAnswer(env, cb.id, '\u26D4'); return new Response('ok'); }
        const parsed = parseAction(cb.data);
        if (!parsed || !parsed.verb) { await tgAnswer(env, cb.id, 'Invalid'); return new Response('ok'); }
        try {
          const r = await adminRun(env, parsed.verb, parsed.id, parsed.arg, { cb: true });
          if (r) {
            await tgAnswer(env, cb.id, r.toast || 'Done');
            if (r.card && r.edit && cb.message) await tgEdit(env, chatId, cb.message.message_id, r.card, r.kb || undefined);
            else if (r.card && r.reply && cb.message) await tgSend(env, r.card, { reply_to_message_id: cb.message.message_id });
            else if (r.card) await tgSend(env, r.card, r.kb ? { reply_markup: r.kb } : null);
          } else await tgAnswer(env, cb.id, 'Unknown');
        } catch (e) { await tgAnswer(env, cb.id, '\u26A0\uFE0F ' + String((e && e.message) || 'error').slice(0, 60)); }
        return new Response('ok');
      }

      const msg = update && (update.message || update.edited_message);
      const chatId = msg && msg.chat && String(msg.chat.id);
      if (chatId !== OWNER) return new Response('ok');
      const text = msg && msg.text;
      if (text && text.startsWith('/')) {
        const parts = text.trim().split(/\s+/);
        const parsed = parseAction(parts[0].split('@')[0]);
        const arg = parts.slice(1).join(' ');
        if (parsed && parsed.verb) {
          try {
            const r = await adminRun(env, parsed.verb, parsed.id, parsed.arg || arg, { text: true });
            if (r && r.card) await tgSend(env, r.card, r.kb ? { reply_markup: r.kb } : null);
          } catch (e) { await tgSend(env, '\u26A0\uFE0F ' + esc(String((e && e.message) || e).slice(0, 200))); }
        }
      }
      return new Response('ok');
    }

    if (url.pathname === '/chat') {
      if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
      // /chat is reachable only through the authenticated Vercel proxy.
      if (!env.ANDOS_WORKER_SHARED_SECRET || req.headers.get('X-ANDOS-Internal') !== env.ANDOS_WORKER_SHARED_SECRET) {
        return json({ error: 'forbidden' }, 403);
      }
      const ip = req.headers.get('CF-Connecting-IP') || 'unknown';
      if (!rateOk(ip)) return json({ error: 'rate limit — thodi der baad try karo' }, 429);
      let body = null;
      try { body = await req.json(); } catch (e) {}
      const messages = body && cleanMessages(body.messages);
      if (!messages) return json({ error: 'messages invalid' }, 400);
      try { const r = await aiChat(env, messages, body.provider); return json(r); }
      catch (e) { return json({ error: String((e && e.message) || e).slice(0, 400) }, e.status || 500); }
    }

    if (req.method === 'GET') return new Response('andos-ai v2 OK · chat + admin', { status: 200 });
    return new Response('not found', { status: 404 });
  }
};
