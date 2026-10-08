const fs = require('fs');
const path = require('path');
const { verifyRequestSession, securityHeaders } = require('./_lib/security');

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
};

module.exports = async function protectedAsset(req, res) {
  try {
    const session = await verifyRequestSession(req);
    if (!session) {
      res.setHeader('Location', '/');
      securityHeaders(res);
      return res.status(302).end();
    }
    const requested = String((req.query && req.query.file) || '');
    if (!requested || requested.includes('..') || requested.startsWith('/') || !/^[A-Za-z0-9/_-]+\.(?:css|js)$/.test(requested)) {
      return res.status(404).end();
    }
    const root = path.resolve(__dirname, '_private', 'app-assets');
    const file = path.resolve(root, requested);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) return res.status(404).end();
    securityHeaders(res);
    res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream');
    res.status(200).send(fs.readFileSync(file));
  } catch (_) {
    res.setHeader('Location', '/');
    securityHeaders(res);
    res.status(302).end();
  }
};
