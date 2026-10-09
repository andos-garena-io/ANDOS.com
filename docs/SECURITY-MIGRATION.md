# ANDOS server-side security migration

Date: 2026-10-08

## Enforcement model

The project is a Vercel static/"Others" deployment rather than a framework deployment that executes a `middleware.js` file. A file named `middleware.js` would therefore be inert and would create a false security boundary. Protected dashboard routes rewrite to a Node function before protected HTML is read:

- `/dashboard`, `/dashboard.html`, and `/ANDO.html` -> `api/protected-dashboard.js`
- direct `/api/_private/*` access -> 404

The dashboard shell, app CSS, and app JavaScript are bundled in `api/_private/dashboard.html`; there is no separate public `/app-assets/*` route. The deploy bundle must not contain public root copies of `dashboard.html` or `ANDO.html`; `.vercelignore` excludes those aliases so the rewrite cannot be bypassed by Vercel's filesystem-first static routing.

The dashboard function verifies `__Host-andos_session` with Firebase Admin `verifySessionCookie(cookie, true)` before returning dashboard HTML. API handlers independently verify sessions for protected actions. Responses are private/no-store and use the security headers/CSP in `api/_lib/security.js`; a per-response nonce authorizes the dashboard's inline JavaScript.

## Login/session contract

The public index/login pages keep the existing Google popup-first flow, redirect fallback, handoff guard, duplicate redirect protection, and `/login.html` callback compatibility. After Firebase client sign-in, the browser POSTs the ID token to `/api/session`. The server verifies it with Firebase Admin, creates a bounded five-day `HttpOnly; Secure; SameSite=Lax` `__Host-` cookie, and returns only a UID/role summary. Logout POSTs to `/api/session/logout`, clears the cookie, and revokes refresh tokens.

Required Vercel variables (production and preview as appropriate):

- `FIREBASE_SERVICE_ACCOUNT_JSON` (or the three split Firebase Admin variables)
- `NUMLOOKUP_API_KEY` (newly rotated value only)
- `AI_WORKER_URL`
- `TELEGRAM_PROXY_URL`
- `ANDOS_WORKER_SHARED_SECRET`

The Firebase web configuration remains public. Admin credentials and upstream keys must never be committed, put in HTML/JavaScript, or put in backup names/content.

## Money and role boundaries

`api/actions.js` is the authenticated server action boundary. It derives plan prices from `api/_lib/catalog.json`; it does not trust a browser amount, status, reward, balance, or role. Wallet debits, transaction records, pending orders, and top-up requests are written with Admin SDK transactions. Browser Firestore writers for wallets, transactions, orders, requests, and financial profile fields were removed; profile metadata remains subject to the allowlist in the Firestore rules.

`api/admin/roles.js` is the only role-assignment endpoint. It requires a verified admin claim and accepts only `admin`, `user`, or `guest`; claims take effect on the next token/session. Anonymous or `guest` sessions can use catalog browsing only. Money, orders, top-ups, referrals, profile editing, spins, and reward mutations fail closed in both the API and rules.

The Cloudflare AI and Telegram workers now require `X-ANDOS-Internal: $ANDOS_WORKER_SHARED_SECRET` on proxy calls. The Vercel functions add that header; the worker-side secret must be configured before those worker versions are deployed.

## Firestore release

The hardened rules are in `docs/rules/firestore_hardened.rules` and are released to `cloud.firestore` as ruleset `projects/andos-49b6a/rulesets/b929712e-84d6-4346-8490-6561fd1902d8` (released 2026-10-08 14:05:38 UTC). The rules default deny, enforce ownership, prevent client writes to money/order/request/transaction collections, and support signed-in catalog reads.

## Rollback

1. Keep the current protected HTML/assets and the five pre-change Drive snapshots intact.
2. To roll back the Vercel code, redeploy the immediately preceding known-good GitHub commit; do not make dashboard files public while rolling back.
3. If the new server action contract is not ready, temporarily disable the affected client action UI rather than restoring client financial writes.
4. To roll back Firestore only, release the previous ruleset from the Firebase Rules console/API. Record the exact ruleset ID and time in the incident log; do not replace it with permissive test rules.
5. If a worker deployment fails, restore the previous worker script and keep the shared secret out of source. Rotate the shared secret if it may have been disclosed.
6. Rotate any upstream credential that appeared in historical source/backups; do not copy the old value into the rollback source.

## Validation status

Production deployment `dpl_6iWqeSi1uzCxYC5fTfryAi4GoSFG` is READY and aliased to `https://andos-com.vercel.app`. Vercel environment variables for Firebase Admin, AI worker, Telegram proxy, and the shared secret are encrypted and present for production/preview. `NUMLOOKUP_API_KEY` is intentionally not set until the historically exposed provider key is revoked and a new value is issued; `/api/numlookup` therefore fails closed with 503 rather than exposing or using the old key.

At the 2026-10-08 migration check, the then-current deployment passed JavaScript syntax checks, Firestore rules checks, temporary-account ownership/write-boundary tests, Admin-backed session/API tests, and production checks for ID-token exchange, dashboard aliases, logout/revocation, and server action rejection. At that time the CSS was a separate protected asset, so unauthenticated requests to `/app-assets/dashboard.css` returned 302; that URL is historical because the current dashboard bundles CSS and JavaScript into the private HTML shell. Direct `/api/_private/*` access returned 404. Re-run unauthenticated/signed-in dashboard checks against the consolidated shell after deploying this refactor. Firebase Auth configuration includes `andos-com.vercel.app` in `authorizedDomains`.

A real Google account/popup/redirect browser test was not executed because no supported browser/account automation is available in this environment. The production login code still preserves popup-first, redirect fallback, handoff, and `/login.html` callback behavior; the server ID-token exchange was tested with a real temporary Firebase account. Cloudflare worker-side secret enforcement source is committed, but the local Cloudflare API token was rejected as invalid, so its worker deployment remains a separate follow-up. A static HTTP 200 check is not a full security validation.
