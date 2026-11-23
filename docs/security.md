# Security

## Authentication & Authorization
- Owner-only access; no public bot controls.
- Passwords hashed with `bcryptjs` (cost 12).
- Sessions stored as hashed tokens in DB; cookie is `httpOnly`, `sameSite=lax`, `secure` in production.
- Password change revokes other sessions.
- All sensitive API routes check authenticated owner server-side.

## Rate Limiting
- Login and sensitive operations rate-limited via DB-backed counters.
- `Retry-After` returned on 429.

## Secrets
- Secrets are environment variables only; no hardcoded credentials.
- `.env.example` contains placeholders only.
- `.gitignore` excludes `.env`, DB files, keys.

## Worker Communication
- Dashboard -> worker commands are HMAC-SHA256 signed.
- Worker -> dashboard state pushes are HMAC-SHA256 signed with separate key id.
- Signatures include method, path, timestamp, nonce, body hash.
- Timestamp skew limit and nonce replay cache enforced.

## Input Validation
- Zod validation on config, login, logs query, worker payloads.
- Host/port/version/username/worker endpoint constraints enforced.
- Microsoft auth rejected by config validation in this deployment.

## Transport & Headers
- Security headers set in `next.config.ts` (nosniff, frame deny, referrer policy, permissions policy, HSTS).
- Deploy behind HTTPS in production.

## Operational Guidance
- Restrict worker port to trusted sources/firewall.
- Rotate `WORKER_SHARED_SECRET` if compromised.
- Use strong unique `SEED_ADMIN_PASSWORD`.
- Monitor logs for auth failures and worker signature rejections.
