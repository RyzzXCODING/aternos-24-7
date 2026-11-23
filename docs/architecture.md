# Architecture

## Overview

AlpoyyAternos uses a split architecture because persistent Minecraft TCP connections cannot run reliably on Vercel serverless functions.

```text
Browser (Dashboard UI)
        │
        ▼
Next.js App Router (Vercel)
  - Auth/session
  - Config/log/settings APIs
  - SQLite/libSQL persistence
  - Worker control proxy (signed HMAC)
        │  signed HTTP
        ▼
Persistent Worker (Node.js, long-lived host)
  - Mineflayer bot process
  - Connection state machine
  - Health endpoint
  - Signed state push back to dashboard
        │  TCP
        ▼
Minecraft Java Server (1.21.11 target, authorized/offline-permitted)
```

## Components

### Web app (`src/app`, `src/components`, `src/lib`)
- **UI:** Next.js App Router pages, Tailwind industrial dark design, responsive layout.
- **Auth:** owner-only login, bcrypt hash, httpOnly cookie session, DB-backed sessions, rate limiting.
- **Data:** Drizzle ORM over libSQL/SQLite. Tables: users, sessions, app_config, bot_state, activity_logs, user_settings, rate_limits.
- **API:** structured JSON, validation with Zod, server-side auth checks.
- **Worker client:** signs requests with shared secret; handles worker unavailable errors explicitly.

### Worker (`worker/src`)
- **BotManager:** Mineflayer lifecycle, connect/stop/restart, reconnect policy, state reporting.
- **HTTP server:** signed `/v1/health` and `/v1/command` endpoints.
- **State push:** signs and posts bot state/events to dashboard `/api/internal/worker/state`.
- **Safety:** no Aternos idle-circumvention behavior; only user-requested connect/stop/restart.

## State Model

Statuses: `ONLINE`, `OFFLINE`, `CONNECTING`, `STOPPED`, `ERROR`, `WORKER_OFFLINE`.

- `WORKER_OFFLINE` is shown when dashboard cannot reach worker or worker heartbeat is stale.
- Dashboard never fabricates `ONLINE`.

## Security Boundaries

- Browser never receives worker shared secret, DB credentials, or password hashes.
- Worker endpoints require HMAC signature, timestamp freshness, key ID, nonce replay protection.
- Internal worker state endpoint requires worker push signature.
- Auth required for all dashboard APIs except login/health/internal signed worker push.
