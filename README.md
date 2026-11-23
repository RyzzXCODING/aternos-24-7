# AlpoyyAternos

AlpoyyAternos is a web-based Minecraft Java bot manager with a secure dashboard, backend API, SQLite/libSQL persistence, and a persistent Node.js worker that runs the Mineflayer bot process.

> **Hosting/automation note:** This project is for authorized testing, monitoring, and servers that explicitly permit bot connections. It does **not** implement automated-player mechanisms designed to circumvent Aternos or another host's idle shutdown, uptime, or anti-automation restrictions.

## Features

- **Web dashboard** (no CLI as primary interface) with industrial dark UI (black/gray/dark red)
- **Secure owner auth**: login/logout, httpOnly session cookie, bcrypt password hashing, rate limiting, protected routes
- **Server configuration**: editable host/port/version/username/auth mode, validation, test action, DB persistence
- **Bot control panel**: Start/Stop/Restart with confirmation, loading states, toast feedback, real worker calls
- **Live status**: bot status, worker status, last attempt/disconnect, connection duration, system health
- **Activity logs**: searchable/filterable/paginated, clear with confirmation
- **Persistent worker**: separate Node.js process with signed dashboard communication, health endpoint, graceful shutdown
- **Vercel-ready web app**: Next.js frontend/API routes; worker deployed separately

## Screenshots

_Add dashboard screenshots here._

## Architecture

The app is split intentionally:

- **Next.js app (Vercel-compatible)**: UI, auth, config/log APIs, database access, server-side control requests.
- **Persistent worker (VM/container/Render/Railway/Fly/etc.)**: maintains the long-lived Mineflayer TCP connection to Minecraft.
- **SQLite/libSQL database**: users, sessions, config, bot state, logs, settings, rate limits.

See [docs/architecture.md](docs/architecture.md).

## Tech Stack

- Next.js 16 (App Router), TypeScript, Tailwind CSS 4, Lucide icons
- SQLite/libSQL via `@libsql/client` + Drizzle ORM
- Mineflayer for Minecraft Java bot
- HMAC-signed worker/dashboard communication
- Vitest for tests

## Minecraft 1.21.11 Compatibility

- **Target version:** Minecraft Java Edition `1.21.11`
- **Mineflayer:** installed `mineflayer@4.39.0` reports `testedVersions` includes `1.21.11` and `latestSupportedVersion: 26.1` (checked locally).
- **minecraft-data protocol:** `1.21.11` protocol version `774`, release.
- **Authentication mode:** offline-mode username auth only for servers configured to permit offline connections. Microsoft auth is intentionally disabled in validation for this deployment.

If you see protocol incompatibilities, pin/adjust Mineflayer and verify with `node -e "require('mineflayer').testedVersions"` in the worker environment.

## Requirements

- Node.js >= 20.9
- npm
- A persistent host for the worker (not Vercel serverless)
- A Minecraft Java server that permits the configured auth/bot connection

## Installation

```bash
git clone https://github.com/aternos-24/7.git
cd 7
npm install
cp .env.example .env
# edit .env with strong secrets
npm run db:migrate
SEED_ADMIN_PASSWORD='a-long-random-password' npm run db:seed
```

## Environment Variables

See [.env.example](.env.example). Important values:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | SQLite/libSQL URL (`file:./data/alpoyy.db` local) |
| `DATABASE_AUTH_TOKEN` | Remote libSQL/Turso token if used |
| `WORKER_SHARED_SECRET` | HMAC secret shared by dashboard and worker (>=32 chars) |
| `WORKER_ENDPOINT` | Dashboard-to-worker URL |
| `WORKER_DASHBOARD_URL` | Worker-to-dashboard URL for state pushes |
| `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD` | Initial owner account for seed script |

Never commit `.env` or secrets.

## Database Setup

```bash
npm run db:generate   # generate migration from schema changes
npm run db:migrate    # apply migrations
npm run db:seed       # create/update owner + default config/state rows
```

## Local Development

Run dashboard and worker in separate terminals:

```bash
# Terminal 1 - web app
npm run dev

# Terminal 2 - persistent worker
npm run worker
```

Open `http://localhost:3000`, sign in with the seeded owner credentials, configure server settings, then use Bot Control.

## Vercel Deployment (Web App)

1. Import the repo into Vercel.
2. Set environment variables from `.env.example` (use production DB/worker URLs and strong secrets).
3. Use build command `npm run build`.
4. Deploy. The dashboard/API will run on Vercel; bot controls show worker status/errors if worker is unreachable.

`vercel.json` is included. Do **not** deploy the persistent Mineflayer TCP bot as a Vercel serverless function.

## Worker Deployment

Deploy `worker/` as a long-running Node process on a VM/container platform.

```bash
# on worker host
npm install
npm run db:migrate # not required for worker runtime, but harmless if shared env
WORKER_SHARED_SECRET=... WORKER_DASHBOARD_URL=https://your-vercel-app.vercel.app npm run worker
```

Docker:

```bash
docker build -f worker/Dockerfile -t alpoyyaternos-worker .
docker run --env-file .env -p 8787:8787 alpoyyaternos-worker
```

Expose worker only to trusted networks where possible; it requires HMAC-signed requests.

## Authentication Setup

- Seed owner with `SEED_ADMIN_PASSWORD`.
- Sign in at `/login`.
- Change password in Settings; other sessions are revoked.
- All bot/config/log APIs require authenticated owner session.

## Configuration Guide

1. Go to **Server Configuration**.
2. Set host, port, version (`1.21.11` default), bot username, offline auth mode.
3. Set worker endpoint reachable from the dashboard.
4. Save, optionally Test Configuration, then use Bot Control.

## API Overview

All API responses use structured JSON: `{ ok: true, data }` or `{ ok: false, error: { code, message, details? } }`.

- `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `POST /api/auth/password`
- `GET /api/status`, `GET /api/health`
- `GET/PUT /api/config`, `POST /api/config/test`
- `POST /api/bot/start|stop|restart`, `GET /api/bot/status`
- `GET/DELETE /api/logs`
- `GET/PUT /api/settings`
- Internal signed worker push: `POST /api/internal/worker/state`

## Troubleshooting

- **Worker offline in dashboard:** verify worker process is running, `WORKER_ENDPOINT` is reachable from dashboard, and `WORKER_SHARED_SECRET` matches.
- **Bot cannot connect:** verify server allows offline bots/target version; check logs and disconnect reason.
- **401 Unauthorized:** sign in again; session cookie may be expired.
- **Database errors on Vercel:** use persistent remote libSQL/Turso DB; local file DB is not suitable for serverless multi-instance persistence.

## Security Notes

- No secrets in source; use `.env.example` as template.
- Passwords hashed with bcrypt.
- Login/config/bot routes rate-limited.
- Worker and dashboard requests are HMAC-signed with timestamp+nonce replay protection.
- Proxy/middleware-style route protection via Next `src/proxy.ts`.
- Do not expose worker publicly without network controls.

## Known Limitations

- Offline-mode auth only; no Microsoft login flow implemented.
- Persistent Minecraft connection requires separate always-on worker.
- Local SQLite file is single-node; use libSQL/Turso for production multi-instance web deployments.
- Bot behavior depends on target server rules/plugins and Mineflayer/protocol compatibility.
