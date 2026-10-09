
(function () {
    var ov = document.getElementById('appSplashOverlay');
    if (!ov) return;
    function kill() { ov.style.opacity = '0'; ov.style.pointerEvents = 'none'; setTimeout(function () { ov.remove(); }, 550); }
    // warm resume (app background se wapas) / bfcache / hidden load => splash NAHIN
    try { if (sessionStorage.getItem('andos_splash_done')) { ov.remove(); window.__andosSplashDone = true; return; } } catch (e) {}
    if (document.visibilityState === 'hidden') { ov.remove(); window.__andosSplashDone = true; return; }
    window.addEventListener('pageshow', function (e) {
        if (e.persisted) { var o = document.getElementById('appSplashOverlay'); if (o) o.remove(); window.__andosSplashActive = false; try { if (typeof window.__andosApplyStatus === 'function') window.__andosApplyStatus(); } catch (err) {} }
    });
    var v = document.getElementById('appSplashVideo'), done = false;
    // STATUS BAR SYNC: black splash video ke dauran upar ka system-bar bhi BLACK
    window.__andosSplashActive = true;
    try { if (typeof window.__andosWriteMetaTheme === 'function') window.__andosWriteMetaTheme('#000000'); else { var _mts = document.querySelectorAll('meta[name="theme-color"]'); for (var _i = 0; _i < _mts.length; _i++) _mts[_i].setAttribute('content', '#000000'); } } catch (e) {}
    function finish() { if (done) return; done = true; try { sessionStorage.setItem('andos_splash_done', '1'); } catch (e) {}
        window.__andosSplashActive = false; setTimeout(function () { window.__andosSplashDone = true; try { document.dispatchEvent(new CustomEvent('andos:splash:done')); } catch (e) {} }, 450);
        // ab screen ke header ke hisab se color wapas lagao
        try { if (typeof window.__andosApplyStatus === 'function') window.__andosApplyStatus(); else window.dispatchEvent(new Event('scroll')); } catch (e) {}
        kill(); }
    var to = setTimeout(finish, 1400);
    ov.addEventListener('click', function () { clearTimeout(to); finish(); });
    v.addEventListener('ended', function () { clearTimeout(to); finish(); });
    v.addEventListener('error', function () { clearTimeout(to); finish(); });
    try {
        v.src = (typeof getAsset === 'function') ? getAsset('videos', 'splash-loading.mp4') : 'assets/videos/splash-loading.mp4';
        v.play().catch(function () { clearTimeout(to); finish(); });
    } catch (e) { finish(); }
})();
