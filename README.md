# ANDOS — Website Overview

ANDOS is a premium, gaming-focused digital service platform built around a secure account area, discovery dashboard, service catalogue, checkout flow, order tracking, support tools, and operational notifications.

This README is the product and interface overview for `andos-garena-io/ANDOS.com`. It explains what a visitor sees, how the main journey works, and how the application is structured.

---

## 1. Product at a glance

ANDOS is designed as a **digital space for gaming, recharge, social-growth, gift-card, subscription, and support services**. The interface uses a dark, high-contrast gaming aesthetic with crimson accents, glass-style surfaces, animated ambience, clear calls to action, and mobile-first layouts.

The main user journey is:

```text
Landing / Login
      ↓
Firebase-authenticated session
      ↓
ANDOS Dashboard
      ↓
Discover a service
      ↓
Select a plan or value
      ↓
Enter user/order details
      ↓
Choose payment method
      ↓
Payment verification
      ↓
Order tracking and support
```

---

## 2. What the user sees

### Login screen

The login experience is a branded entry point titled **“Your Digital Space”**. It is intentionally visual rather than form-heavy and provides:

- Google sign-in as the primary Firebase provider
- Email/password sign-in and account creation
- Email verification for newly created accounts
- Password reset flow
- Discord OAuth
- Telegram Login Widget
- GitHub OAuth
- Steam OpenID 2.0
- Terms, Privacy Policy, and Cookie Use links
- English user-facing status, error, and success messages

The intended UI rule is to keep the provider controls clean and avoid duplicate buttons. Telegram must be represented by the official widget only; a custom Telegram button must not be rendered beside it.

### Dashboard

After authentication, the user reaches the canonical dashboard at `/dashboard`. The dashboard is served internally from `ANDO.html` and contains:

- Premium dark/gaming visual system
- Animated background and brand hero area
- Service discovery and search
- Category navigation
- Featured and popular service cards
- Service detail pages
- Plan/value selection
- Checkout and payment-method screens
- Payment verification state
- Order history and order-progress timeline
- Wallet/profile-related areas
- Coupons and promotional surfaces
- Support and issue-ticket flow
- Related-service recommendations
- Operational Telegram notifications through the protected backend

### Service catalogue

The current catalogue includes examples such as:

- Free Fire Max diamond top-ups
- BGMI UC packs
- Jio and Airtel recharge
- Google Play redeem codes
- Instagram followers and likes
- YouTube watch time and subscribers
- Facebook likes and followers
- Amazon Prime-related services

The catalogue is data-driven inside the dashboard so that cards, plans, descriptions, categories, and checkout metadata can evolve without redesigning the whole shell.

---

## 3. Authentication and routing

| Public URL | Purpose | Source/target |
|---|---|---|
| `/` | Public entry point | Rewrite to `ANDO.html`; unauthenticated users are redirected to `/login` |
| `/login` | Clean login route | Rewrite to `login.html` |
| `/login.html` | Legacy login route and exact OAuth callback | `login.html` |
| `/dashboard` | Canonical successful-login route | Rewrite to `ANDO.html` |
| `/ANDO.html` | Direct legacy dashboard route | `ANDO.html` |
| `/reset-password` | Branded password-reset route | Rewrite to `reset-password.html` |

Successful login redirects to:

```text
https://andos-com.vercel.app/dashboard
```

The exact Telegram redirect callback remains:

```text
https://andos-com.vercel.app/login.html
```

The dashboard keeps a Firebase `onAuthStateChanged` guard. If Firebase reports no authenticated user, or an anonymous user, the page sends the browser to `/login`.

> Important: static Vercel HTML can still be fetched directly. The client-side guard controls the application view, while real data protection must also be enforced by Firebase Security Rules and server-side token verification.

---

## 4. Password reset experience

The custom reset flow is designed to replace the generic Firebase reset screen with an ANDOS-branded page:

1. Firebase sends the reset email using the `%LINK%` placeholder.
2. The link opens `/reset-password`.
3. Vercel rewrites it to `reset-password.html` while preserving query parameters.
4. The page reads `oobCode` from the URL.
5. `verifyPasswordResetCode(auth, oobCode)` validates the action code.
6. The user enters a new password and confirms it.
7. `confirmPasswordReset(auth, oobCode, newPassword)` updates the password.
8. A success state appears, followed by a redirect to `/login`.

The page includes:

- ANDOS dark glassmorphism card
- Crimson and white accents
- Password-reset banner
- New Password and Confirm Password fields
- Show/Hide controls
- Expired/invalid-link messaging
- Green success check state
- Back to Login and Go to Login actions

The Firebase email template is intended to use:

- Sender name: `ANDOS Support`
- Subject: `Reset your ANDOS password`
- `%DISPLAY_NAME%`
- `%EMAIL%`
- `%LINK%`
- A red `RESET PASSWORD` button instead of visible raw-link text

---

## 5. Technical architecture

### Frontend

- `login.html` — branded authentication entry point
- `ANDO.html` — authenticated dashboard and application shell
- `reset-password.html` — custom Firebase password-reset handler
- Inline CSS and JavaScript are used heavily to keep the visual system self-contained.

### Authentication

- Firebase Authentication for Google and email/password
- Telegram Login Widget with server-side hash verification
- GitHub and Discord OAuth through the protected auth worker
- Steam OpenID 2.0 verification through the protected auth worker
- Firebase persistence and redirect handling for returning sessions

### Data and application state

- Firebase/Firestore-backed user and application state
- Local browser state for non-authoritative UI preferences and short-lived interface data
- Firebase Rules and server verification must remain the authority for protected data

### Backend workers

The Cloudflare Worker `io` is the pre-existing authentication backend. Its source is maintained in:

```text
workers/andos-auth-worker.js
```

The worker exposes protected verification endpoints for Telegram, GitHub, Discord, and Steam. Provider secrets and service credentials stay server-side and must never be placed in frontend HTML.

Other worker sources in the project support bot operations, AI support, Drive backup, and Telegram proxy workflows.

### Deployment

The Vercel project is hosted at:

```text
https://andos-com.vercel.app
```

`vercel.json` uses explicit rewrites (including `/` to `ANDO.html`) and `trailingSlash: false`. `cleanUrls` is intentionally not enabled because the exact `.html` callback routes must remain backward-compatible.

---

## 6. Security model

- Provider secrets, bot tokens, service-account JSON, and API keys remain server-side.
- Telegram authentication is hash-checked in the worker and has a short freshness window.
- OAuth flows use state values and strict redirect validation.
- Firebase ID tokens should be verified by protected APIs before accepting sensitive operations.
- Firestore and Storage Rules must require authenticated access and appropriate ownership/role checks.
- URLs must not be treated as proof of authentication.
- `localStorage` is not an authority for permissions or privileged access.
- Public static HTML must not contain private credentials.
- Deployment credentials belong in protected secret storage, never in repository files or chat messages.

---

## 7. Repository map

```text
ANDOS.com/
├── login.html
├── ANDO.html
├── reset-password.html
├── assets/
│   └── password-banner.png
├── vercel.json
├── workers/
│   ├── andos-auth-worker.js
│   ├── andos-ai-worker.js
│   ├── andos-backup-worker.js
│   └── andos-bot-worker.js
└── README.md
```

Local development and secret material are kept outside the public repository structure. No secret values belong in this README.

---

## 8. Current implementation status

- Login and dashboard routes are already deployed and verified with HTTP 200 responses.
- Firebase dashboard auth guard is present.
- Custom reset page, reset route, banner asset, and Firebase email-template HTML are included in the deployment candidate.
- After the repository commit, verify the Vercel deployment and then configure the Firebase action URL.
- After deployment, verify:
  - `/reset-password` returns HTTP 200
  - `/assets/password-banner.png` returns HTTP 200
  - Firebase Console uses `https://andos-com.vercel.app/reset-password` as the customized action URL
  - An actual password-reset email opens the ANDOS page and successfully completes the reset

---

## 9. Operational principle

ANDOS should remain visually premium but operationally simple:

- One clear action per provider
- No duplicate authentication controls
- English user-facing messages
- Secure server-side verification
- Explicit route compatibility
- Drive-first archival for backups
- No secrets in public source
- Test the real provider flow before calling authentication “100% working”
