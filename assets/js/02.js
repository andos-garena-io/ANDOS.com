
/* ===== SB13: unified localStorage contract =====
   App ke parse-time reads se PEHLE install hota hai.
   andos_user   -> { name, mobile, username, userId, ... }
   andos_orders -> [ { id, title, amount, uid, status, date, ... } ]
   andos_wallet -> { balance, coins }   (app parseFloat() se padhta hai, isliye
                                         getItem() balance ko numeric string deta hai) */
(function () {
    try {
        var origGet = Storage.prototype.getItem;
        var origSet = Storage.prototype.setItem;
        function numOr(v) { var n = Number(v); return (v !== null && v !== '' && isFinite(n)) ? n : null; }
        function normalizeOrder(o) {
            if (!o || typeof o !== 'object') return o;
            if (!o.title)  o.title  = o.service || o.game || o.serviceId || 'Order';
            if (!o.uid)    o.uid    = o.customerDetail || o.playerId || '';
            if (!o.date)   o.date   = o.createdAt ? new Date(o.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
            if (o.status === undefined || o.status === null) o.status = o.displayStatus ? String(o.displayStatus).toLowerCase() : 'pending';
            if (o.amount === undefined || o.amount === null) o.amount = (o.price !== undefined ? o.price : 0);
            if (!o.id)     o.id     = 'AND-' + Math.random().toString(36).slice(2, 7).toUpperCase();
            return o;
        }
        function injectIdentity(u) {
            if (!u || typeof u !== 'object') return false;
            var changed = false;
            if (!u.username) {
                var c = String(u.name || u.fullName || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 14);
                u.username = '@' + (c || 'user') + '_' + Math.floor(100 + Math.random() * 900);
                changed = true;
            }
            if (!u.userId) { u.userId = 'ANDOS_' + Date.now().toString().slice(-4); changed = true; }
            return changed;
        }
        Storage.prototype.setItem = function (k, v) {
            try {
                if (k === 'andos_wallet') {
                    var n = numOr(v);
                    if (n !== null && String(v).charAt(0) !== '{') {
                        var cur = null; try { cur = JSON.parse(origGet.call(this, k) || 'null'); } catch (e) {}
                        var coins = (cur && typeof cur === 'object' && typeof cur.coins !== 'undefined') ? cur.coins : 0;
                        v = JSON.stringify({ balance: n, coins: coins });
                    }
                } else if (k === 'andos_orders') {
                    try {
                        var arr = JSON.parse(String(v));
                        if (Object.prototype.toString.call(arr) === '[object Array]') { arr.forEach(normalizeOrder); v = JSON.stringify(arr); }
                    } catch (e) {}
                } else if (k === 'andos_user') {
                    try {
                        var o2 = JSON.parse(String(v));
                        if (o2 && typeof o2 === 'object' && injectIdentity(o2)) v = JSON.stringify(o2);
                    } catch (e) {}
                }
            } catch (e) {}
            return origSet.call(this, k, v);
        };
        Storage.prototype.getItem = function (k) {
            var v = origGet.call(this, k);
            try {
                if (k === 'andos_wallet' && v && v.charAt(0) === '{') {
                    var o3 = JSON.parse(v);
                    if (o3 && typeof o3 === 'object' && typeof o3.balance !== 'undefined') return String(o3.balance);
                }
            } catch (e) {}
            return v;
        };
        window.__andosWallet = function () {
            try { var o4 = JSON.parse(origGet.call(localStorage, 'andos_wallet') || 'null'); } catch (e) { o4 = null; }
            if (o4 && typeof o4 === 'object') return { balance: Number(o4.balance) || 0, coins: Number(o4.coins) || 0 };
            return { balance: numOr(origGet.call(localStorage, 'andos_wallet')) || 0, coins: 0 };
        };
        window.__andosSetWallet = function (balance, coins) {
            var cur = window.__andosWallet();
            return origSet.call(localStorage, 'andos_wallet',
                JSON.stringify({ balance: Number(balance) || 0, coins: (coins === undefined ? cur.coins : Number(coins) || 0) }));
        };
    } catch (e) {}
})();
