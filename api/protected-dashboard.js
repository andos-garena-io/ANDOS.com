const fs = require('fs');
const path = require('path');
const { verifyRequestSession, securityHeaders } = require('./_lib/security');

module.exports = async function protectedDashboard(req, res) {
  try {
    const session = await verifyRequestSession(req);
    if (!session) {
      res.setHeader('Location', '/');
      securityHeaders(res);
      return res.status(302).end();
    }
    const file = path.join(__dirname, '_private', 'dashboard.html');
    const html = fs.readFileSync(file);
    securityHeaders(res, { html: true });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
  } catch (_) {
    // Fail closed: an Admin SDK/env failure must not expose the dashboard.
    res.setHeader('Location', '/');
    securityHeaders(res);
    res.status(302).end();
  }
};
