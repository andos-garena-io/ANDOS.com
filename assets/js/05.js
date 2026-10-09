
      (function () {
        function deepLink() {
          var h = (location.hash || '').replace('#', '');
          if (!h) return;
          setTimeout(function () {
            try {
              if (h === 'wallet') navigate('wallet');
              else if (h === 'support') navigate('support');
              else if (h === 'freefire') navigate('plans', { service: 'freefire' });
              else if (h === 'bgmi') navigate('plans', { service: 'bgmi' });
              else if (h === 'explore') navigate('categories');
            } catch (e) {}
          }, 700);
        }
        window.addEventListener('load', deepLink);
      })();
    