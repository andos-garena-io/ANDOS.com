
      (function () {
        function block(e) {
          var t = e.target;
          if (!t) return;
          if (t.tagName === 'IMG' || t.tagName === 'SVG' || t.tagName === 'VIDEO' || t.tagName === 'CANVAS' ||
              (t.closest && t.closest('img,picture,svg,video,canvas,.no-save'))) {
            e.preventDefault();
            e.stopPropagation();
            return false;
          }
        }
        document.addEventListener('contextmenu', block, true);
        document.addEventListener('dragstart', block, true);
        document.addEventListener('selectstart', block, true);
        var hold;
        document.addEventListener('touchstart', function (e) {
          var t = e.target;
          if (t && (t.tagName === 'IMG' || (t.closest && t.closest('img,picture,.no-save')))) {
            hold = setTimeout(function () {}, 80);
          }
        }, { passive: true });
        document.addEventListener('touchend', function () { clearTimeout(hold); }, { passive: true });
      })();
    