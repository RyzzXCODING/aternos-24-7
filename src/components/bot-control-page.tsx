"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  Bot,
  CircleStop,
  Info,
  Play,
  RefreshCw,
  RotateCcw,
  Server,
  Terminal,
} from "lucide-react";
import { Button, Card, CardHeader, EmptyState, Modal, PageHeader, Skeleton, StatusBadge } from "@/components/ui";
import { useToast } from "@/components/toast";
import { apiFetch, useApi } from "@/lib/use-api";
import { formatDuration, formatTime } from "@/lib/format";
import type { LogsData, StatusData, WorkerCommandData } from "@/lib/dashboard-types";

type Action = "start" | "stop" | "restart";

export function BotControlPage() {
  const status = useApi<StatusData>("/api/status", { intervalMs: 4000 });
  const logs = useApi<LogsData>("/api/logs?limit=5", { intervalMs: 10000 });
  const { toast } = useToast();
  const [busy, setBusy] = useState<Action | null>(null);
  const [confirm, setConfirm] = useState<Action | null>(null);
  const [lastMessage, setLastMessage] = useState<string | null>(null);

  const data = status.data;
  const statusValue = data?.bot.status;
  const canStart = Boolean(data && data.server.host && data.server.username) && statusValue !== "ONLINE" && statusValue !== "CONNECTING";
  const canStop = statusValue === "ONLINE" || statusValue === "CONNECTING" || statusValue === "ERROR" || statusValue === "WORKER_OFFLINE";
  const canRestart = Boolean(data && data.server.host && data.server.username) && statusValue !== "STOPPED" && statusValue !== "OFFLINE";

  async function execute(action: Action) {
    setBusy(action);
    setLastMessage(null);
    try {
      const result = await apiFetch<WorkerCommandData>(`/api/bot/${action}`, { method: "POST", body: "{}" });
      setLastMessage(result.message);
      toast({
        title: `Bot ${action} ${action === "stop" ? "stopped" : "command sent"}`,
        description: result.message,
        variant: "success",
      });
      setConfirm(null);
      await Promise.all([status.reload(), logs.reload()]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Command failed";
      setLastMessage(message);
      toast({
        title: action === "stop" ? "Stop failed" : `Bot ${action} failed`,
        description: message,
        variant: "error",
      });
      await status.reload();
    } finally {
      setBusy(null);
    }
  }

  const needsConfig = Boolean(data && (!data.server.host || !data.server.username));

  return (
    <>
      <PageHeader
        eyebrow="Bot control"
        title="Connection controls"
        description="Start, stop and restart the bot through the authenticated backend and persistent worker."
        action={
          <Button onClick={() => { void status.reload(); void logs.reload(); }}>
            <RefreshCw className={`size-4 ${status.loading ? "animate-spin" : ""}`} /> Refresh status
          </Button>
        }
      />

      {!data ? (
        <div className="grid gap-5 lg:grid-cols-3">
          <Skeleton className="h-72 rounded-2xl lg:col-span-2" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      ) : (
        <>
          {needsConfig ? (
            <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-warning/25 bg-warning/10 px-4 py-3 text-xs">
              <AlertTriangle className="size-4 shrink-0 text-warning" />
              <span className="flex-1 text-text/90">Server address or bot username is missing. Configure them before starting.</span>
              <Link href="/server" className="font-medium text-muted hover:text-text">Open configuration</Link>
            </div>
          ) : null}

          {!data.worker.alive ? (
            <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-primary-hover/30 bg-primary/10 px-4 py-3 text-xs">
              <AlertTriangle className="size-4 shrink-0 text-danger" />
              <span className="flex-1 text-text/90">
                Worker unavailable: {data.worker.error || "no response"}. Controls will surface the exact error; no fake online state is shown.
              </span>
              <Link href="/settings" className="font-medium text-muted hover:text-text">Worker details</Link>
            </div>
          ) : null}

          <div className="grid gap-5 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader
                title="Bot controls"
                subtitle="Commands are sent only to your configured worker"
                icon={<Bot className="size-4" />}
                action={<StatusBadge status={statusValue || "OFFLINE"} />}
              />
              <div className="p-5">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Button
                    variant="primary"
                    className="h-24 flex-col gap-2"
                    loading={busy === "start"}
                    disabled={!canStart}
                    onClick={() => void execute("start")}
                  >
                    {busy !== "start" && <Play className="size-5" />}
                    <span>Start bot</span>
                  </Button>
                  <Button
                    variant="secondary"
                    className="h-24 flex-col gap-2"
                    loading={busy === "restart"}
                    disabled={!canRestart}
                    onClick={() => setConfirm("restart")}
                  >
                    {busy !== "restart" && <RotateCcw className="size-5" />}
                    <span>Restart bot</span>
                  </Button>
                  <Button
                    variant="danger"
                    className="h-24 flex-col gap-2"
                    loading={busy === "stop"}
                    disabled={!canStop}
                    onClick={() => setConfirm("stop")}
                  >
                    {busy !== "stop" && <CircleStop className="size-5" />}
                    <span>Stop bot</span>
                  </Button>
                </div>

                {lastMessage ? (
                  <div className="mt-4 flex items-start gap-2 rounded-xl border border-border bg-surface px-3.5 py-3 text-xs text-muted">
                    <Terminal className="mt-0.5 size-4 shrink-0 text-muted" />
                    <span className="break-words">{lastMessage}</span>
                  </div>
                ) : null}

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-border bg-surface p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">Target server</p>
                    <p className="mt-1.5 truncate font-mono text-sm text-text">{data.server.address || "Not configured"}</p>
                    <p className="mt-1 text-xs text-muted">Minecraft Java {data.server.version}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-surface p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">Session</p>
                    <p className="mt-1.5 text-sm text-text">
                      {statusValue === "ONLINE" ? formatDuration(data.connectionDurationMs) : "No active session"}
                    </p>
                    <p className="mt-1 text-xs text-muted">Last attempt {formatTime(data.bot.lastAttemptAt)}</p>
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader title="Connection details" subtitle="Live worker state" icon={<Activity className="size-4" />} />
              <div className="space-y-3 p-5 text-xs">
                {[
                  ["Status", data.bot.status],
                  ["Bot username", data.bot.username || "—"],
                  ["Connected at", formatTime(data.bot.connectedAt)],
                  ["Last disconnect", data.bot.lastDisconnectReason || "—"],
                  ["Reconnect attempt", String(data.bot.reconnectAttempt)],
                  ["Players", data.bot.players.length ? data.bot.players.join(", ") : "—"],
                  ["Worker version", data.worker.version || "unavailable"],
                  ["Detail", data.bot.detail || "—"],
                ].map(([label, value]) => (
                  <div key={label} className="flex flex-wrap items-start justify-between gap-2 border-b border-border/60 pb-2.5 last:border-0">
                    <span className="text-muted">{label}</span>
                    <span className="max-w-[60%] break-words text-right text-text">{value}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card className="mt-5">
            <CardHeader title="Recent control events" subtitle="Start, stop and connection activity" icon={<Server className="size-4" />} />
            {logs.data?.items.length ? (
              <div className="divide-y divide-border/60 px-5">
                {logs.data.items.map((item) => (
                  <div key={item.id} className="flex flex-wrap items-center gap-3 py-3 text-xs">
                    <span className="font-mono text-[11px] text-muted">{formatTime(item.at)}</span>
                    <span className="rounded-md border border-border px-2 py-0.5 text-[10px] uppercase text-muted">{item.type}</span>
                    <span className="flex-1 text-text/90">{item.message}</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={<Info className="size-5" />} title="No control events" description="Start or stop the bot to see events here." />
            )}
          </Card>
        </>
      )}

      <Modal
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm === "stop" ? "Stop the bot?" : "Restart the bot?"}
        description={
          confirm === "stop"
            ? "The bot will disconnect gracefully. You can start it again from this page."
            : "The current connection will be closed and a new connection attempt will be made with the saved configuration."
        }
        confirmLabel={confirm === "stop" ? "Stop bot" : "Restart bot"}
        danger={confirm === "stop"}
        loading={busy !== null}
        onConfirm={() => { if (confirm) void execute(confirm); }}
      />
    </>
  );
}
