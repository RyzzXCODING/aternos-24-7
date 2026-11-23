# Deployment

## 1. Web Dashboard (Vercel)

The Next.js app can be deployed on Vercel. It includes UI and API routes, but **not** the persistent Minecraft bot connection.

### Steps
1. Push repo to GitHub.
2. In Vercel, import `aternos-24/7`.
3. Configure environment variables:
   - `DATABASE_URL` (use remote libSQL/Turso for production persistence)
   - `DATABASE_AUTH_TOKEN` (if required)
   - `WORKER_SHARED_SECRET` (strong random, >=32 chars)
   - `WORKER_ENDPOINT` (public/private URL to worker, reachable from Vercel)
   - `WORKER_KEY_ID`, `WORKER_PUSH_KEY_ID`
   - `SEED_ADMIN_USERNAME`, `SEED_ADMIN_PASSWORD` for initial seed
4. Build command: `npm run build`
5. Deploy.

### Notes
- Local `file:./data/alpoyy.db` is not suitable for Vercel serverless production persistence.
- Run migrations/seed from a trusted environment connected to the production DB.

## 2. Persistent Worker (Required)

Deploy the worker on a platform that supports long-lived Node.js processes and outbound TCP.

### Options
- Docker container on VM (DigitalOcean, Hetzner, AWS EC2, Fly.io, Railway, Render worker)

### Environment
Set at minimum:
- `WORKER_SHARED_SECRET` (same as dashboard)
- `WORKER_KEY_ID` / `WORKER_PUSH_KEY_ID` (match dashboard expectations)
- `WORKER_DASHBOARD_URL` (https://your-dashboard.vercel.app)
- `WORKER_HOST=0.0.0.0`
- `WORKER_PORT=8787`

### Run
```bash
npm ci
npm run worker
```

### Docker
```bash
docker build -f worker/Dockerfile -t alpoyyaternos-worker .
docker run -d --name alpoyyaternos-worker --env-file .env -p 8787:8787 alpoyyaternos-worker
```

## 3. Database

For production, use Turso/libSQL or another managed libSQL-compatible database.

```bash
npm run db:migrate
SEED_ADMIN_PASSWORD='...' npm run db:seed
```

## 4. Post-deploy Checklist

- [ ] Dashboard loads on Vercel
- [ ] Login works with seeded owner
- [ ] Worker health reachable from dashboard
- [ ] Config save persists after redeploy
- [ ] Start/stop/restart return real worker responses
- [ ] Logs record events
- [ ] No secrets exposed in client bundle
