const fs = require('fs');
const path = require('path');
const { verifyRequestSession, securityHeaders } = require('./_lib/security');

function sendRecoveryShell(res) {
  /* Do not redirect a returning Firebase user through the visible login page
     just because the bounded server cookie was lost or expired. This shell
     contains no dashboard HTML; it silently recreates the server session from
     Firebase and retries /dashboard. Signed-out visitors fall back to /. */
  const file = path.join(__dirname, '_private', 'auth-recover.html');
  const html = fs.readFileSync(file);
  securityHeaders(res, { html: true });
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(html);
}

module.exports = async function protectedDashboard(req, res) {
  try {
    const session = await verifyRequestSession(req);
    if (!session) return sendRecoveryShell(res);
    const file = path.join(__dirname, '_private', 'dashboard.html');
    const html = fs.readFileSync(file);
    securityHeaders(res, { html: true });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
  } catch (_) {
    // Fail closed: only the non-sensitive recovery shell is allowed through.
    try { return sendRecoveryShell(res); } catch (_) {
      res.setHeader('Location', '/');
      securityHeaders(res);
      return res.status(302).end();
    }
  }
};
