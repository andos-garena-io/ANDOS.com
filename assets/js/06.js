
      (function () {
        var SEQ = ['home', 'categories', 'orders', 'wallet', 'profile'];
        /* ---- SB13 FIX #2: profile screen ka asli data-page 'account' hai (aur loyalty/activity usi ke
           sub-pages). Isliye SEQ.indexOf('account') = -1 aa kar swipe dead ho jata tha. Alias map: ---- */
        var SEQ_ALIAS = { account: 'profile' };
        function seqIndex(p) {
            var i = SEQ.indexOf(p);
            if (i === -1 && Object.prototype.hasOwnProperty.call(SEQ_ALIAS, p)) i = SEQ.indexOf(SEQ_ALIAS[p]);
            return i;
        }
        var sx = 0, sy = 0, tracking = false, scroller = null, scLeft = 0, scFull = false; dragMoved = false;
        document.addEventListener('touchstart', function (e) {
          scroller = null; tracking = false;
          if (e.touches.length !== 1) return;
          var el = e.target;
          if (el.closest && el.closest('.home-carousel, .banner-strip, .promo-rail, .home-carousel-track, .cpn-rail, .od-scroller, .txn-filters, [data-noswipe], input, textarea, select, video, #homeServiceHscroll, .sidebar, .idrawer, .exq-strip, #supportChat')) return;   /* SB13: banner swipe -> page swipe nahi */
          for (var n = el; n && n !== document.body; n = n.parentElement) {
            if (n.scrollWidth > n.clientWidth + 8) {
              var ox = window.getComputedStyle(n).overflowX;
              if (ox === 'scroll' || ox === 'auto') { scroller = n; scLeft = n.scrollLeft; scFull = n.clientWidth > window.innerWidth * 0.9; tracking = false; return; }
            }
          }
          tracking = true; sx = e.touches[0].clientX; sy = e.touches[0].clientY;
        }, { passive: true });
        var dragPg = null, dragMoved = false;
        document.addEventListener('touchmove', function (e) {
          if (!tracking) return;
          var dx = e.touches[0].clientX - sx, dy = e.touches[0].clientY - sy;
          if (Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy) * 1.2) {
            if (!dragPg) { var __sh = document.querySelector('.andos-shell'); if (seqIndex(__sh ? __sh.getAttribute('data-page') : '') === -1) { tracking = false; return; } dragPg = document.querySelector('.page-enter'); }
            if (dragPg) { dragPg.classList.remove('andos-page-slide'); dragMoved = true; dragPg.style.transition = 'none'; dragPg.style.transform = 'translateX(' + (dx * 0.85) + 'px)'; dragPg.style.opacity = String(Math.max(.55, 1 - Math.abs(dx) / (window.innerWidth * 1.4))); }
          }
        }, { passive: true });
        document.addEventListener('touchend', function (e) {
          /* SB13: banner/carousel par touch khatam -> page navigation bilkul nahi */
          if (e.target && e.target.closest && e.target.closest('.home-carousel, .banner-strip, .promo-rail, .home-carousel-track, .cpn-rail, .od-scroller, .txn-filters, .sp-topics, .exq-strip')) { tracking = false; dragPg = null; return; }
          if (!tracking) return; tracking = false;
          var pg2 = dragPg; dragPg = null;
          var willNav = false;
          if (scroller && scFull && Math.abs(scroller.scrollLeft - scLeft) > 4) { if (pg2 && dragMoved) { pg2.style.transition = 'transform .22s ease'; pg2.style.transform = 'none'; } return; }
          var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
          if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.4) {
            var shell = document.querySelector('.andos-shell');
            var cur = shell ? shell.getAttribute('data-page') : 'home';
            var i = seqIndex(cur);
            if (i === -1) { if (pg2 && dragMoved) { pg2.style.transition = 'transform .2s ease'; pg2.style.transform = 'none'; pg2.style.opacity = '1'; } return; }
            var next = dx < 0 ? SEQ[Math.min(i + 1, SEQ.length - 1)] : SEQ[Math.max(i - 1, 0)];
            if (next !== cur && typeof navigate === 'function') { willNav = true; window.__swipeDir = dx < 0 ? 'left' : 'right'; navigate(next); }
          }
          if (pg2 && dragMoved && !willNav) { pg2.style.transition = 'transform .28s cubic-bezier(.22,1,.36,1), opacity .28s'; pg2.style.transform = 'none'; pg2.style.opacity = '1'; }
        }, { passive: true });
      })();
    