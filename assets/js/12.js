
    /* Lazy loaders: heavy libs only when actually needed */
    window.__loadLib = function (name, src) { return new Promise(function (res, rej) { if (window[name]) return res(window[name]); var sc = document.createElement('script'); sc.src = src; sc.async = true; sc.onload = function () { res(window[name]); }; sc.onerror = rej; document.head.appendChild(sc); }); };
    window.ensureHtml2Canvas = function () { return window.__loadLib('html2canvas', 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'); };
    window.ensureQRCode = function () { return window.__loadLib('QRCode', 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'); };
    