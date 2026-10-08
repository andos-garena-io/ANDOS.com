const fs = require('fs');
const path = require('path');
const { verifyRequestSession, securityHeaders } = require('./_lib/security');

function publicIndexPath() {
  const candidates = [
    path.join(process.cwd(), 'index.html'),
    path.join(__dirname, '..', 'index.html'),
    path.join(__dirname, 'index.html'),
  ];
  return candidates.find(file => fs.existsSync(file)) || candidates[0];
}

module.exports = async function authEntry(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    securityHeaders(res);
    return res.status(405).end();
  }

  try {
    const session = await verifyRequestSession(req);
    if (session) {
      securityHeaders(res);
      res.setHeader('Location', '/dashboard');
      return res.status(302).end();
    }
  } catch (_) {
    // Fail open only for the public login entry: an invalid/expired session
    // must see login, never protected content.
  }

  try {
    const file = publicIndexPath();
    securityHeaders(res);
    res.setHeader('Cache-Control', 'private, no-store, max-age=0, must-revalidate');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    if (req.method === 'HEAD') return res.status(200).end();
    return res.status(200).send(fs.readFileSync(file));
  } catch (_) {
    securityHeaders(res);
    return res.status(500).end();
  }
};
