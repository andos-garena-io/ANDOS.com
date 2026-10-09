
      (function () {
        var PINK = '#F9A8D4', WHITE = '#ffffff';
        // Har page ka color usi page ke HEADER CSS se nikala gaya hai (seamless feel ke liye)
        function baseColor() {
          var shell = document.querySelector('.andos-shell');
          var page = shell ? shell.getAttribute('data-page') : '';
          if (page === 'home' || !page) return PINK;                 // home pink hero
          if (page === 'wallet') return '#4f2a67';                   // .wal-hero design blend (gradient+gold glow)
          if (page === 'leaderboard') return '#f8f5ff';              // shell lavender
          if (page === 'account') return '#eef2ff';                  // .pf-page gradient top
          if (page === 'activity') return '#fff7ed';                 // shell cream
          if (page === 'loyalty') return '#081b26';                  // loyalty design blend (emerald glow)
          if (page === 'search') return '#1e214d';                   // search head design blend
          if (page === 'refer') return '#392a54';                    // rf-hero design blend (gold glow)
          if (page === 'payment') return '#221b50';                  // payx-hero design blend (violet glow)
          if (page === 'freefiremegadrop') return '#572d15';         // ff mega drop design blend (amber+red)
          if (page === 'garenasync') return '#100b10';               // garena sync design blend
          if (page === 'garenaevent') return '#f6f7fb';              // ge-shell
          if (page === 'adminpanel') return '#0f172a';                 // slate-900 gradient
          if (page === 'eventff') return '#f7f8fc';                  // .dp-page
          if (page === 'plans') {
            var svc = (typeof selectedService !== 'undefined') ? String(selectedService) : '';
            if (svc === 'freefire') return '#1c1917';
            if (svc === 'bgmi') return '#365314';
            return '#1e1e2f';
          }
          return '#ffffff'; // categories/category/events/orders/orderdetail/orderform/paymentverify/pending/trustvideo/notifications/contact/upcoming/adminpanel
        }
        var startY = 0, pulling = false;
        function writeMetaTheme(c) {
          var ms = document.querySelectorAll('meta[name="theme-color"]');
          for (var i = 0; i < ms.length; i++) { if (ms[i].getAttribute('content') !== c) ms[i].setAttribute('content', c); }
        }
        window.__andosWriteMetaTheme = writeMetaTheme;
        function setTheme(c) {
          if (window.__andosSplashActive) return; // splash chal raha hai -> status bar BLACK rahega
          var m = document.querySelector('meta[name="theme-color"]');
          if (m && m.getAttribute('content') === c) return;
          writeMetaTheme(c); // light + dark dono scheme metas -> Chrome DARK mode bhi header color uthayega
          // Purane Chrome/WebView (84-87) ko force repaint: meta node hatao-wapas lagao
          try { if (m) { var p = m.parentNode || document.head; p.removeChild(m); p.appendChild(m); } } catch (e) {}
        }
        // Read the real rendered background at the very top of the current page (header) → status bar merges with it
        function sampledColor() {
          try {
            if (document.getElementById('yuvaGate') && !document.getElementById('yuvaGate').classList.contains('yg-out')) return '#000000';
            if (window.__andosSplashActive) return '#000000';
            var overlays = ['#soSheet', '.ios-wallet-alert-backdrop', '.newbie-offer-backdrop'];
            for (var o = 0; o < overlays.length; o++) { if (document.querySelector(overlays[o])) return null; }
            var xs = [Math.round(window.innerWidth * 0.5), Math.round(window.innerWidth * 0.12), Math.round(window.innerWidth * 0.88)];
            var best = null;
            for (var i = 0; i < xs.length; i++) {
              var el = document.elementFromPoint(xs[i], 2);
              var guard = 0;
              while (el && el !== document.documentElement && guard++ < 25) {
                var cs = getComputedStyle(el);
                if (cs.position === 'fixed' && (el.classList.contains('glass-nav') || el.tagName === 'NAV')) { return null; } // home nav handled by existing logic
                var bg = cs.backgroundColor, img = cs.backgroundImage;
                var m = bg && bg.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
                if (m && (m[4] === undefined || Number(m[4]) > 0.85)) { best = 'rgb(' + m[1] + ',' + m[2] + ',' + m[3] + ')'; break; }
                if (img && img !== 'none') {
                  // multiple layers: last layer is the base; take its first OPAQUE stop (skip glow overlays)
                  var layers = img.split(/\)\s*,\s*(?=[a-z-]+gradient\(|url\()/i);
                  for (var L = layers.length - 1; L >= 0 && !best; L--) {
                    var stops = layers[L].match(/rgba?\([^)]+\)|#[0-9a-f]{3,8}/ig) || [];
                    for (var S = 0; S < stops.length; S++) {
                      var a = stops[S].match(/rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/);
                      if (!a || Number(a[1]) > 0.85) { best = stops[S]; break; }
                    }
                  }
                  if (best) break;
                }
                el = el.parentElement;
              }
              if (best) return best;
            }
          } catch (e) {}
          return null;
        }
        function onScroll() {
          var gate = document.getElementById('yuvaGate');
          if ((gate && !gate.classList.contains('yg-out')) || window.__andosSplashActive) { writeMetaTheme('#000000'); return; }
          var shell = document.querySelector('.andos-shell');
          var pg = shell ? shell.getAttribute('data-page') : '';
          var isHome = (pg === 'home' || !pg);
          if (pulling && isHome) { setTheme(WHITE); return; }
          if (isHome) {
            var nav = document.querySelector('nav.glass-nav');
            var scrolled = nav ? nav.classList.contains('is-scrolled') : (window.scrollY > 18);
            setTheme(scrolled ? WHITE : baseColor());
          } else {
            var sc = sampledColor();
            setTheme(sc || baseColor()); // real header color; map only as fallback
          }
        }
        // re-sync on page change / DOM updates (header can change without scroll)
        try {
          var _mo = new MutationObserver(function () { clearTimeout(window.__tcT); window.__tcT = setTimeout(onScroll, 80); });
          document.addEventListener('DOMContentLoaded', function () { var app = document.getElementById('app') || document.body; _mo.observe(app, { childList: true, subtree: false, attributes: true, attributeFilter: ['data-page', 'class'] }); });
        } catch (e) {}
        document.addEventListener('andos:splash:done', function () { setTimeout(onScroll, 50); });
        document.addEventListener('touchstart', function (e) { startY = e.touches[0].clientY; }, { passive: true });
        document.addEventListener('touchmove', function (e) {
          if ((window.scrollY || 0) <= 0 && e.touches[0].clientY - startY > 24) {
            pulling = true; setTheme(WHITE);
            var n = document.querySelector('nav.glass-nav');   // white blur barrier ko top tak le jao
            if (n) n.classList.add('is-scrolled');
          }
        }, { passive: true });
        document.addEventListener('touchend', function () {
          if (pulling) {
            pulling = false;
            var n = document.querySelector('nav.glass-nav');
            if (n && (window.scrollY || 0) <= 18) n.classList.remove('is-scrolled');
            onScroll();
          }
        }, { passive: true });
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('load', onScroll);
        document.addEventListener('click', function () { setTimeout(onScroll, 60); }, { passive: true });
        window.__andosApplyStatus = function () { onScroll(); setTimeout(onScroll, 120); setTimeout(onScroll, 420); setTimeout(onScroll, 900); };
      })();
    