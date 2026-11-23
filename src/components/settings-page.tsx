"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  Check,
  Database,
  KeyRound,
  LockKeyhole,
  MonitorCog,
  Moon,
  Save,
  ServerCog,
  ShieldCheck,
} from "lucide-react";
import { Button, Card, CardHeader, Field, Modal, PageHeader, Skeleton, Toggle } from "@/components/ui";
import { useToast } from "@/components/toast";
import { apiFetch, useApi } from "@/lib/use-api";
import { formatDuration, formatTime } from "@/lib/format";
import type { SettingsData, StatusData } from "@/lib/dashboard-types";
import type { ServerConfig } from "@/lib/shared/types";

interface HealthData {
  api: string;
  database: string;
  dbLatencyMs: number;
  auth: string;
  workerAuthConfigured: boolean;
  timestamp: string;
}

export function SettingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const settings = useApi<SettingsData>("/api/settings");
  const status = useApi<StatusData>("/api/status", { intervalMs: 10000 });
  const health = useApi<HealthData>("/api/health", { intervalMs: 15000 });
  const config = useApi<{ config: ServerConfig }>("/api/config");

  const [compact, setCompact] = useState(false);
  const [refreshMs, setRefreshMs] = useState(5000);
  const [notifyOnError, setNotifyOnError] = useState(true);
  const [saving, setSaving] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changing, setChanging] = useState(false);

  const [syncedSettings, setSyncedSettings] = useState(settings.data);
  if (settings.data && settings.data !== syncedSettings) {
    setSyncedSettings(settings.data);
    setCompact(settings.data.compact);
    setRefreshMs(settings.data.refreshMs);
    setNotifyOnError(settings.data.notifyOnError);
  }

  async function saveSettings() {
    setSaving(true);
    try {
      await apiFetch("/api/settings", {
        method: "PUT",
        body: JSON.stringify({ compact, refreshMs, notifyOnError }),
      });
      toast({ title: "Settings saved", variant: "success" });
      await settings.reload();
    } catch (error) {
      toast({ title: "Save failed", description: error instanceof Error ? error.message : "Unknown error", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    setChanging(true);
    try {
      await apiFetch("/api/auth/password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setPasswordOpen(false);
      setCurrentPassword("");
      setNewPassword("");
      toast({ title: "Password changed", description: "Other sessions were revoked.", variant: "success" });
    } catch (error) {
      toast({ title: "Password change failed", description: error instanceof Error ? error.message : "Unknown error", variant: "error" });
    } finally {
      setChanging(false);
    }
  }

  async function signOut() {
    await apiFetch("/api/auth/logout", { method: "POST", body: "{}" });
    router.replace("/login");
    router.refresh();
  }

  if (settings.loading && !settings.data) return <Skeleton className="h-96 rounded-2xl" />;

  return (
    <>
      <PageHeader
        eyebrow="Preferences"
        title="Settings"
        description="Dashboard preferences, security controls and live service status."
        action={<Button variant="primary" onClick={() => void saveSettings()} loading={saving}><Save className="size-4" /> Save settings</Button>}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Theme preferences" subtitle="Visual appearance" icon={<Moon className="size-4" />} />
          <div className="p-5">
            <div className="flex items-center gap-4 rounded-xl border border-primary-hover/30 bg-primary/10 p-4">
              <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#111111] to-[#222222] text-muted border border-border">
                <Moon className="size-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-text">Industrial Dark</p>
                <p className="mt-0.5 text-xs text-muted">Black, gray, and dark red. Minimal, technical, and optimized for long sessions.</p>
              </div>
              <Check className="size-5 text-muted" />
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-muted">
              The dashboard uses a fixed industrial dark theme for consistency and reduced visual noise.
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader title="Dashboard settings" subtitle="Polling and layout" icon={<MonitorCog className="size-4" />} />
          <div className="space-y-3 p-5">
            <Toggle label="Compact layout" description="Reduce card and row spacing on data-heavy pages." checked={compact} onChange={setCompact} />
            <Field label="Status refresh interval" htmlFor="refreshMs" hint="How often the dashboard polls the backend API">
              <select id="refreshMs" className="input" value={refreshMs} onChange={(event) => setRefreshMs(Number(event.target.value))}>
                <option value={2000}>2 seconds</option>
                <option value={5000}>5 seconds</option>
                <option value={10000}>10 seconds</option>
                <option value={30000}>30 seconds</option>
              </select>
            </Field>
            <Toggle label="Error notifications" description="Show toast notifications when a command or status check fails." checked={notifyOnError} onChange={setNotifyOnError} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Security" subtitle="Owner account and sessions" icon={<LockKeyhole className="size-4" />} />
          <div className="space-y-3 p-5">
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-3.5">
              <ShieldCheck className="size-4 text-success" />
              <div className="flex-1">
                <p className="text-xs font-medium text-text">Owner session active</p>
                <p className="mt-0.5 text-[11px] text-muted">httpOnly cookie · 7 day expiry · rate limited login</p>
              </div>
            </div>
            <Button variant="secondary" className="w-full" onClick={() => setPasswordOpen(true)}><KeyRound className="size-4" /> Change password</Button>
            <Button variant="ghost" className="w-full" onClick={() => void signOut()}>Sign out of this device</Button>
          </div>
        </Card>

        <Card>
          <CardHeader title="Connection preferences" subtitle="Managed in server configuration" icon={<ServerCog className="size-4" />} />
          <div className="space-y-3 p-5 text-xs">
            <div className="flex items-center justify-between rounded-xl border border-border bg-surface px-3.5 py-3">
              <span className="text-muted">Controlled reconnect</span>
              <span className={config.data?.config.reconnectEnabled ? "text-success" : "text-muted"}>
                {config.data?.config.reconnectEnabled ? "Enabled" : "Disabled"}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border bg-surface px-3.5 py-3">
              <span className="text-muted">Max reconnect attempts</span>
              <span className="text-text">{config.data?.config.reconnectMaxAttempts ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border bg-surface px-3.5 py-3">
              <span className="text-muted">Worker endpoint</span>
              <span className="max-w-[60%] truncate font-mono text-text">{config.data?.config.workerEndpoint || "—"}</span>
            </div>
            <Button className="w-full" onClick={() => router.push("/server")}>Edit connection settings</Button>
          </div>
        </Card>

        <Card>
          <CardHeader title="API status" subtitle="Dashboard backend health" icon={<Database className="size-4" />} />
          <div className="space-y-3 p-5 text-xs">
            {health.data ? (
              <>
                {[
                  ["API", health.data.api === "healthy" ? "Healthy" : health.data.api],
                  ["Database", `${health.data.database} · ${health.data.dbLatencyMs}ms`],
                  ["Authentication", health.data.auth],
                  ["Worker secret", health.data.workerAuthConfigured ? "Configured" : "Missing"],
                  ["Last check", formatTime(health.data.timestamp)],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between border-b border-border/60 pb-2.5 last:border-0">
                    <span className="text-muted">{label}</span>
                    <span className="text-text">{value}</span>
                  </div>
                ))}
              </>
            ) : health.error ? (
              <p className="flex items-center gap-2 text-danger"><AlertTriangle className="size-4" /> {health.error}</p>
            ) : (
              <Skeleton className="h-32" />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Worker status" subtitle="Persistent Minecraft connection host" icon={<Activity className="size-4" />} />
          <div className="space-y-3 p-5 text-xs">
            {status.data ? (
              <>
                <div className="flex items-center justify-between rounded-xl border border-border bg-surface px-3.5 py-3">
                  <span className="text-muted">Worker</span>
                  <span className={status.data.worker.alive ? "text-success" : "text-danger"}>
                    {status.data.worker.alive ? "Online" : "Offline"}
                  </span>
                </div>
                {[
                  ["Version", status.data.worker.version || "—"],
                  ["Response time", status.data.worker.latencyMs !== null ? `${status.data.worker.latencyMs}ms` : "—"],
                  ["Last state sync", formatTime(status.data.worker.lastPushAt)],
                  ["API uptime", formatDuration(status.data.system.uptimeSeconds * 1000)],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between border-b border-border/60 pb-2.5 last:border-0">
                    <span className="text-muted">{label}</span>
                    <span className="text-text">{value}</span>
                  </div>
                ))}
                {status.data.worker.error ? (
                  <p className="break-words rounded-lg border border-danger/25 bg-danger/[0.07] p-2.5 text-danger">{status.data.worker.error}</p>
                ) : null}
              </>
            ) : (
              <Skeleton className="h-32" />
            )}
          </div>
        </Card>
      </div>

      <Modal
        open={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        title="Change owner password"
        description="Your current session stays active. All other sessions will be revoked."
        confirmLabel="Change password"
        loading={changing}
        onConfirm={() => void changePassword()}
      >
        <div className="mt-4 space-y-3">
          <Field label="Current password" htmlFor="current-password">
            <input id="current-password" className="input" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" />
          </Field>
          <Field label="New password" htmlFor="new-password" hint="At least 12 characters">
            <input id="new-password" className="input" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" minLength={12} />
          </Field>
        </div>
      </Modal>
    </>
  );
}
