const { admin, getAdminApp } = require('./_lib/firebase-admin');
const {
  verifyRequestSession,
  roleOf,
  securityHeaders,
  json,
} = require('./_lib/security');
const catalog = require('./_lib/catalog.json');

const buckets = new Map();
const WINDOW_MS = 60_000;

function rateOk(key, limit) {
  const now = Date.now();
  const list = (buckets.get(key) || []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= limit) return false;
  list.push(now);
  buckets.set(key, list);
  if (buckets.size > 5000) buckets.clear();
  return true;
}

function clean(value, max = 200) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

function safeId(value, fallback) {
  const id = clean(value, 80).replace(/[^A-Za-z0-9_-]/g, '');
  return /^[A-Za-z0-9][A-Za-z0-9_-]{3,79}$/.test(id) ? id : fallback;
}

function amount(value, min = 1, max = 100000) {
  const n = Number(value);
  return Number.isFinite(n) && Number.isInteger(n) && n >= min && n <= max ? n : 0;
}

function planFor(serviceId, planId) {
  const service = clean(serviceId, 40).toLowerCase();
  const id = clean(planId, 100);
  if (!/^[a-z0-9_-]{2,40}$/.test(service) || !/^[A-Za-z0-9_-]{2,100}$/.test(id)) return null;
  const plan = (catalog[service] || []).find((item) => item.id === id);
  return plan ? { serviceId: service, ...plan } : null;
}

function randomId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function userOnly(session) {
  return roleOf(session) !== 'guest';
}

function publicOrder(order) {
  if (!order) return null;
  const fields = [
    'id', 'requestId', 'uid', 'serviceId', 'service', 'planId', 'plan', 'quantity',
    'amount', 'status', 'displayStatus', 'customerDetail', 'customerMobile',
    'paymentMethod', 'paymentCheckReference', 'baseDiamonds', 'bonusDiamonds',
    'createdAtMs', 'updatedAtMs', 'redeemCode', 'progress', 'failReason',
  ];
  const out = {};
  for (const key of fields) if (order[key] !== undefined) out[key] = order[key];
  return out;
}

async function createOrder(db, session, body) {
  const plan = planFor(body.serviceId, body.planId);
  if (!plan) return { status: 400, body: { ok: false, error: 'invalid_plan' } };
  const quantity = amount(body.quantity || 1, 1, 20);
  if (!quantity) return { status: 400, body: { ok: false, error: 'invalid_quantity' } };
  const total = plan.price * quantity;
  if (!Number.isSafeInteger(total) || total < 1 || total > 100000) {
    return { status: 400, body: { ok: false, error: 'invalid_total' } };
  }

  const orderId = safeId(body.orderId, randomId('ANDOS'));
  const requestId = safeId(body.requestId, randomId('ORD'));
  const detail = clean(body.customerDetail || body.detail, 160);
  const mobile = clean(body.customerMobile || body.mobile, 20).replace(/\D/g, '').slice(0, 15);
  const paymentReference = clean(body.paymentReference || body.reference, 120);
  const paymentMethod = clean(body.paymentMethod || (body.kind === 'wallet-order' ? 'wallet' : 'UPI'), 24).toLowerCase();
  if (!detail || detail.length < 2) return { status: 400, body: { ok: false, error: 'customer_detail_required' } };
  if (mobile && (mobile.length < 10 || mobile.length > 15)) return { status: 400, body: { ok: false, error: 'invalid_mobile' } };
  if (paymentMethod !== 'wallet' && !paymentReference && paymentMethod !== 'upi') {
    return { status: 400, body: { ok: false, error: 'payment_reference_required' } };
  }

  const orderRef = db.collection('orders').doc(orderId);
  const requestRef = db.collection('requests').doc(requestId);
  const txRef = db.collection('transactions').doc();
  const now = Date.now();
  const walletRef = db.collection('wallets').doc(session.uid);
  let result;

  await db.runTransaction(async (tx) => {
    const existing = await tx.get(orderRef);
    if (existing.exists) {
      const data = existing.data() || {};
      if (data.uid !== session.uid) throw Object.assign(new Error('order_conflict'), { status: 409 });
      result = { order: publicOrder({ id: orderId, ...data }), requestId: data.requestId || requestId, existing: true };
      return;
    }

    let balance = null;
    if (paymentMethod === 'wallet') {
      const walletSnap = await tx.get(walletRef);
      balance = Number((walletSnap.data() || {}).balance || 0);
      if (!Number.isFinite(balance) || balance < total) throw Object.assign(new Error('insufficient_wallet'), { status: 409 });
      tx.set(walletRef, {
        uid: session.uid,
        balance: balance - total,
        updatedAtMs: now,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      tx.set(txRef, {
        uid: session.uid,
        type: 'debit',
        amount: total,
        status: 'pending',
        description: `${plan.name} · wallet order`,
        orderId,
        createdAtMs: now,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      tx.set(txRef, {
        uid: session.uid,
        type: 'debit',
        amount: total,
        status: 'pending',
        description: `${plan.name} · payment pending`,
        orderId,
        reference: paymentReference,
        createdAtMs: now,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    const order = {
      id: orderId,
      requestId,
      uid: session.uid,
      serviceId: plan.serviceId,
      service: plan.serviceId,
      planId: plan.id,
      plan: plan.name,
      planPrice: plan.price,
      quantity,
      amount: total,
      status: 'pending',
      displayStatus: 'Pending',
      customerDetail: detail,
      customerMobile: mobile,
      paymentMethod,
      paymentCheckReference: paymentReference,
      baseDiamonds: 0,
      bonusDiamonds: 0,
      progress: 0,
      createdAtMs: now,
      updatedAtMs: now,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    const request = {
      id: requestId,
      uid: session.uid,
      type: 'order',
      orderId,
      amount: total,
      reference: paymentReference,
      service: plan.serviceId,
      plan: plan.name,
      serviceId: plan.serviceId,
      planId: plan.id,
      customerDetail: detail,
      customerMobile: mobile,
      paymentMethod,
      status: 'pending',
      createdAtMs: now,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    tx.set(orderRef, order);
    tx.set(requestRef, request, { merge: true });
    result = { order: publicOrder(order), requestId };
  });

  return { status: 200, body: { ok: true, ...result } };
}

async function createRequest(db, session, body) {
  const type = clean(body.type, 24).toLowerCase();
  if (type === 'order') {
    return createOrder(db, session, body);
  }
  if (type !== 'deposit' && type !== 'support') {
    return { status: 400, body: { ok: false, error: 'invalid_request_type' } };
  }
  const requestId = safeId(body.id, randomId(type === 'deposit' ? 'DEP' : 'REQ'));
  const now = Date.now();
  const data = {
    id: requestId,
    uid: session.uid,
    type,
    status: 'pending',
    createdAtMs: now,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (type === 'deposit') {
    const deposit = amount(body.amount, 10, 100000);
    if (!deposit) return { status: 400, body: { ok: false, error: 'invalid_deposit_amount' } };
    data.amount = deposit;
    data.reference = clean(body.reference, 120);
    if (data.reference.length < 3) return { status: 400, body: { ok: false, error: 'deposit_reference_required' } };
    data.unlockNeeded = amount(body.unlockNeeded, 0, 100000);
    const txRef = db.collection('transactions').doc();
    data.transactionId = txRef.id;
    await db.runTransaction(async (tx) => {
      tx.set(db.collection('requests').doc(requestId), data, { merge: true });
      tx.set(txRef, {
        uid: session.uid,
        type: 'credit',
        amount: deposit,
        status: 'pending',
        description: 'Wallet recharge · pending approval',
        reference: data.reference,
        requestId,
        createdAtMs: now,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
  } else {
    data.category = clean(body.category, 40);
    data.message = clean(body.message, 2000);
    data.orderId = clean(body.orderId, 80);
    if (!data.message || data.message.length < 10) return { status: 400, body: { ok: false, error: 'support_message_required' } };
    await db.collection('support_tickets').doc(requestId).set(data);
  }
  return { status: 200, body: { ok: true, requestId } };
}

async function handleAction(session, body) {
  const db = getAdminApp().firestore();
  const action = clean(body.action, 40).toLowerCase();
  if (!action) return { status: 400, body: { ok: false, error: 'action_required' } };

  if (action === 'catalog.list') return { status: 200, body: { ok: true, catalog } };
  if (['wallet.get', 'orders.list', 'referral.get'].includes(action)) {
    if (!userOnly(session)) return { status: 403, body: { ok: false, error: 'guest_action_forbidden' } };
    if (action === 'wallet.get') {
      const snap = await db.collection('wallets').doc(session.uid).get();
      const data = snap.exists ? snap.data() : {};
      return { status: 200, body: { ok: true, balance: Number(data.balance || 0), updatedAtMs: data.updatedAtMs || 0 } };
    }
    if (action === 'referral.get') {
      const snap = await db.collection('users').doc(session.uid).get();
      const data = snap.exists ? snap.data() : {};
      return { status: 200, body: { ok: true, refBy: clean(data.refBy, 80), referralCode: clean(data.referralCode, 80) } };
    }
    const snap = await db.collection('orders').where('uid', '==', session.uid).limit(50).get();
    return { status: 200, body: { ok: true, orders: snap.docs.map((doc) => publicOrder({ id: doc.id, ...doc.data() })) } };
  }

  if (!userOnly(session)) {
    return { status: 403, body: { ok: false, error: 'guest_action_forbidden' } };
  }
  if (action === 'order.create' || action === 'payment.create') return createOrder(db, session, body);
  if (action === 'request.create' || action === 'topup.create') return createRequest(db, session, body);
  if (action === 'ticket.create') return createRequest(db, session, { ...body, type: 'support' });
  if (['spin', 'referral.withdraw', 'wallet.update', 'transaction.create'].includes(action)) {
    return { status: 409, body: { ok: false, error: 'server_flow_required' } };
  }
  return { status: 400, body: { ok: false, error: 'unknown_action' } };
}

module.exports = async function actions(req, res) {
  securityHeaders(res);
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method_not_allowed' });
  let session;
  try {
    session = await verifyRequestSession(req);
  } catch (_) {
    return json(res, 401, { ok: false, error: 'unauthorized' });
  }
  if (!session) return json(res, 401, { ok: false, error: 'unauthorized' });
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const action = clean(body.action, 40).toLowerCase() || 'unknown';
  const limit = action.includes('list') || action.endsWith('.get') ? 60 : 12;
  if (!rateOk(`${session.uid}:${action}`, limit)) return json(res, 429, { ok: false, error: 'rate_limited' });

  try {
    // Do not rely on browser-supplied role flags. roleOf reads verified claims only.
    const result = await handleAction(session, body);
    return json(res, result.status || 200, result.body || { ok: true });
  } catch (err) {
    const status = Number(err && err.status) || 500;
    if (status >= 400 && status < 500) return json(res, status, { ok: false, error: err.message || 'request_rejected' });
    console.error('[actions]', err && err.message);
    return json(res, 500, { ok: false, error: 'server_action_failed' });
  }
};
