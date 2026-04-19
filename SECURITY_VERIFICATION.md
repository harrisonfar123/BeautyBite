# BeautyBite Security Verification

All production secrets are managed as Heroku config vars.
**No secrets are committed to this repository.**

To inspect current secrets (requires Heroku auth):

```bash
heroku config -a <app-name>
```

## Security Controls

This document describes the security controls currently implemented in `production/server.js`.
It must be regenerated from runtime state — do not hand-edit claims that are not backed by code.

### Authentication
- JWT-based auth with short-lived access tokens (15 min) and rotating refresh tokens stored hashed in `refresh_tokens` (see `production/turso_schema.sql`).
- Password policy: minimum 12 characters, requires upper, lower, and digit.
- Passwords hashed with bcrypt (cost 12).
- Login attempts rate-limited at the middleware layer.

### Authorization
- Role claim carried in JWT (`role`).
- `requireAdmin` middleware enforces `role === 'admin'` on all `/api/admin/*` routes.

### Transport & Headers
- `helmet` middleware mounted globally (CSP, HSTS, X-Frame-Options, X-Content-Type-Options).
- CORS origin driven by `APP_ORIGIN` env var — no wildcards or localhost regex in production.

### Input Validation & Output Encoding
- All database queries use parameterized placeholders ($n) — no string concatenation.
- User-supplied fields rendered into outbound HTML email are HTML-escaped.
- Request bodies capped at 50kb; `extended: false` on urlencoded parser.

### Payment Security
- Stripe Elements tokenisation — card data never reaches the server.
- Webhook signatures verified via `stripe.webhooks.constructEvent`.
- Custom-order endpoint verifies `paymentIntent.status === 'succeeded'` and amount matches server-side unit price before recording the order.
- Guest payment endpoints are rate-limited.

### Secret Management
- All secrets loaded from environment variables (Heroku config vars).
- `.env` files and `heroku_config.txt` are gitignored.
- JWT secrets, Stripe keys, Turso tokens, Cloudflare/OpenAI keys are rotated on any suspected leak.

### Dependency Hygiene
- `npm audit` run after every dependency change.
- `bcrypt`, `nodemailer`, `express`, `path-to-regexp` tracked for upstream advisories.

## Incident Response

If a secret is suspected leaked:
1. Rotate the secret in the originating dashboard.
2. Redeploy with the new value.
3. Purge any commit or file containing the old value (`git filter-repo` if in history).
4. Invalidate outstanding user sessions (rotating `JWT_SECRET` is sufficient).

---

Last verified against runtime: see `git log production/server.js`.
