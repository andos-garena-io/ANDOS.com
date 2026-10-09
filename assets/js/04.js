
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', async () => {
          try {
            const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
            console.log('Service Worker Registered Successfully. Scope:', reg.scope);
          } catch (err) {
            console.warn('SW registration skipped:', err);
          }
        });
      }
    