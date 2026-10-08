/* Fast dashboard boot. The old remote video splash blocked the first paint and
   was especially slow after a mobile app background/reopen. Keep the existing
   splash lifecycle flags for dashboard auth code, but do not fetch or animate
   any image/video before the dashboard renders. */
(function () {
  window.__andosSplashActive = false;
  window.__andosSplashDone = true;
  var overlay = document.getElementById("appSplashOverlay");
  if (overlay) overlay.remove();
  try { document.dispatchEvent(new CustomEvent("andos:splash:done")); } catch (_) {}
  try { window.__andosApplyStatus && window.__andosApplyStatus(); } catch (_) {}
})();
