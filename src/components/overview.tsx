"use client";

import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock3,
  Database,
  ExternalLink,
  Globe2,
  HardDrive,
  RefreshCw,
  Server,
  Wifi,
} from "lucide-react";
import { Button, Card, CardHeader, EmptyState, ErrorState, PageHeader, Skeleton, SkeletonPage, StatusBadge } from "@/components/ui";
import { useApi } from "@/lib/use-api";
import { formatDuration, formatTime, relativeTime } from "@/lib/format";
import type { LogsData, StatusData } from "@/lib/dashboard-types";

function StatCard({
  label,
  value,
  hint,
  icon,
  children,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <Card className="card-hover p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle">{label}</p>
          <p className="mt-2 truncate text-lg font-semibold tracking-tight text-text">{value}</p>
          {hint ? <p className="mt-1 truncate text-xs text-muted">{hint}</p> : null}
        </div>
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-elevated text-muted">{icon}</div>
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </Card>
  );
}

function DetailRow({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2.5 last:border-0">
      <span className="text-xs text-muted">{label}</span>
      <span className={`max-w-[65%] text-right text-xs text-text ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

export function OverviewPage() {
  const status = useApi<StatusData>("/api/status", { intervalMs: 5000 });
  const logs = useApi<LogsData>("/api/logs?limit=8");

  if (status.loading && !status.data) return <SkeletonPage />;
  if (!status.data) return <ErrorState message={status.error || "Status is unavailable"} onRetry={() => void status.reload()} />;

  const data = status.data;
  const online = data.bot.status === "ONLINE";

  return (
    <>
      <PageHeader
        eyebrow="Dashboard overview"
        title="System at a glance"
        description="Live state of your authorized Minecraft bot, worker connection and recent activity."
        action={
          <div className="flex gap-2">
            <Button onClick={() => void status.reload()}><RefreshCw className="size-4" /> Refresh</Button>
            <Link href="/bot" className="btn-primary"><Bot className="size-4" /> Bot control</Link>
          </div>
        }
      />

      {!data.worker.alive ? (
        <div className="mb-5 flex flex-wrap items-start gap-3 rounded-lg border border-primary-hover/30 bg-primary/10 px-4 py-3.5">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#d46a73]" />
          <div className="flex-1 text-xs leading-relaxed text-text/90">
            <p className="font-semibold text-[#d46a73]">Persistent worker is unreachable</p>
            <p className="mt-1 text-muted">
              {data.worker.error || "No response from worker."} Bot controls will report an error until the worker is running.
            </p>
          </div>
          <Link href="/settings" className="text-xs font-medium text-muted hover:text-text">View worker settings</Link>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Bot status" value={data.bot.status === "WORKER_OFFLINE" ? "WORKER OFFLINE" : data.bot.status} icon={<Bot className="size-4" />}>
          <StatusBadge status={data.bot.status} />
        </StatCard>
        <StatCard
          label="Server connection"
          value={data.server.address || "Not configured"}
          hint={online ? "Connected" : data.server.host ? "Configured" : "Add a server address"}
          icon={<Server className="size-4" />}
        />
        <StatCard
          label="Minecraft"
          value={`Java ${data.server.version || "—"}`}
          hint={`Bot: ${data.server.username || "not set"}`}
          icon={<Globe2 className="size-4" />}
        />
        <StatCard
          label={online ? "Connection duration" : "Last connection"}
          value={online ? formatDuration(data.connectionDurationMs) : relativeTime(data.bot.lastAttemptAt)}
          hint={online ? `Since ${formatTime(data.bot.connectedAt)}` : "No active session"}
          icon={<Clock3 className="size-4" />}
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Connection details"
            subtitle="Reported by the persistent worker"
            icon={<Wifi className="size-4" />}
            action={<StatusBadge status={data.bot.status} />}
          />
          <div className="px-5 py-2">
            <DetailRow label="Address" value={data.server.address || "—"} mono />
            <DetailRow label="Version" value={data.server.version || "—"} />
            <DetailRow label="Bot username" value={data.server.username || "—"} mono />
            <DetailRow label="Last attempt" value={formatTime(data.bot.lastAttemptAt)} />
            <DetailRow label="Last disconnect reason" value={data.bot.lastDisconnectReason || "—"} />
            <DetailRow label="Players online" value={data.bot.players.length ? data.bot.players.join(", ") : data.bot.maxPlayers !== null ? `0 / ${data.bot.maxPlayers}` : "—"} />
            <DetailRow label="Detail" value={data.bot.detail || "No additional detail"} />
          </div>
        </Card>

        <Card>
          <CardHeader title="System health" subtitle="Dashboard services" icon={<Activity className="size-4" />} />
          <div className="space-y-3 p-5">
            {[
              { label: "API", value: data.system.api, ok: data.system.api === "healthy", icon: CheckCircle2 },
              { label: "Database", value: `${data.system.database} · ${data.system.dbLatencyMs}ms`, ok: data.system.database === "healthy", icon: Database },
              { label: "Worker", value: data.worker.alive ? `online · ${data.worker.latencyMs ?? 0}ms` : "offline", ok: data.worker.alive, icon: HardDrive },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5">
                <item.icon className={`size-4 ${item.ok ? "text-success" : "text-[#d46a73]"}`} />
                <span className="flex-1 text-xs text-muted">{item.label}</span>
                <span className="text-xs font-medium text-text">{item.value}</span>
              </div>
            ))}
            <div className="rounded-lg border border-border bg-surface px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-widest text-subtle">API uptime</p>
              <p className="mt-1 font-mono text-sm text-text">{formatDuration(data.system.uptimeSeconds * 1000)}</p>
              <p className="mt-1 text-[10px] text-subtle">Node {data.system.node}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader
          title="Recent activity"
          subtitle="Latest connection, configuration and system events"
          icon={<Activity className="size-4" />}
          action={<Link href="/logs" className="flex items-center gap-1 text-xs font-medium text-muted hover:text-text">View all <ExternalLink className="size-3" /></Link>}
        />
        {logs.loading && !logs.data ? (
          <div className="space-y-2 p-5">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-10" />)}</div>
        ) : logs.data?.items.length ? (
          <div className="divide-y divide-border px-5">
            {logs.data.items.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 text-xs">
                <span className="font-mono text-[11px] text-subtle">{formatTime(item.at)}</span>
                <span className="rounded-md border border-border bg-white/[0.02] px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted">{item.type}</span>
                <span className="min-w-0 flex-1 text-text/90">{item.message}</span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={<Activity className="size-5" />} title="No activity yet" description="Connection and configuration events will appear here." />
        )}
      </Card>
    </>
  );
}
