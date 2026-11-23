"use client";

import { useState } from "react";
import {
  Check,
  CircleAlert,
  KeyRound,
  Pencil,
  PlugZap,
  Save,
  ServerCog,
  ShieldCheck,
  Wifi,
} from "lucide-react";
import { Button, Card, CardHeader, Field, Modal, PageHeader, Skeleton, Toggle } from "@/components/ui";
import { useToast } from "@/components/toast";
import { apiFetch, useApi } from "@/lib/use-api";
import type { ConfigData } from "@/lib/dashboard-types";
import type { ServerConfig } from "@/lib/shared/types";

const emptyConfig: ServerConfig = {
  host: "",
  port: 25565,
  version: "1.21.11",
  username: "",
  authMode: "offline",
  reconnectEnabled: true,
  reconnectDelayMs: 5000,
  reconnectMaxAttempts: 5,
  chatMonitoring: true,
  playerListMonitoring: true,
  workerEndpoint: "http://127.0.0.1:8787",
};

export function ServerConfigPage() {
  const config = useApi<ConfigData>("/api/config");
  const { toast } = useToast();
  const [form, setForm] = useState<ServerConfig>(emptyConfig);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [confirmSave, setConfirmSave] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [testResult, setTestResult] = useState<{ passed: boolean; tcp: { reachable: boolean; latencyMs: number | null; error: string | null }; worker: { reachable: boolean; version: string | null; error: string | null } } | null>(null);

  const [syncedConfig, setSyncedConfig] = useState(config.data);
  if (config.data && config.data !== syncedConfig) {
    setSyncedConfig(config.data);
    setForm(config.data.config);
  }

  function patch<K extends keyof ServerConfig>(key: K, value: ServerConfig[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
  }

  function mapIssues(issues: unknown) {
    if (!Array.isArray(issues)) return;
    const mapped: Record<string, string> = {};
    for (const issue of issues as { path?: string; message?: string }[]) {
      if (issue.path && issue.message) mapped[issue.path] = issue.message;
    }
    setErrors(mapped);
  }

  async function save() {
    setSaving(true);
    setErrors({});
    try {
      await apiFetch("/api/config", { method: "PUT", body: JSON.stringify(form) });
      setConfirmSave(false);
      setEditing(false);
      await config.reload();
      toast({ title: "Configuration saved", description: "Changes are stored in the database.", variant: "success" });
    } catch (error) {
      const err = error as Error & { details?: unknown };
      if (err.message === "Please correct the highlighted fields") {
        mapIssues(err.details);
        toast({ title: "Validation failed", description: "Check the highlighted fields.", variant: "error" });
      } else {
        toast({ title: "Save failed", description: err.message, variant: "error" });
      }
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await apiFetch<{ passed: boolean; tcp: { reachable: boolean; latencyMs: number | null; error: string | null }; worker: { reachable: boolean; version: string | null; error: string | null } }>(
        "/api/config/test",
        { method: "POST", body: JSON.stringify(form) },
      );
      setTestResult(result);
      toast({
        title: result.passed ? "Configuration test passed" : "Configuration test found issues",
        variant: result.passed ? "success" : "warning",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Test failed";
      toast({ title: "Test failed", description: message, variant: "error" });
    } finally {
      setTesting(false);
    }
  }

  if (config.loading && !config.data) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  const disabled = !editing;

  return (
    <>
      <PageHeader
        eyebrow="Configuration"
        title="Server Configuration"
        description="Configure the Minecraft Java server and the persistent worker that holds the connection."
        action={
          <div className="flex flex-wrap gap-2">
            {!editing ? (
              <Button variant="primary" onClick={() => setEditing(true)}><Pencil className="size-4" /> Edit configuration</Button>
            ) : (
              <>
                <Button onClick={() => { setEditing(false); setErrors({}); if (config.data) setForm(config.data.config); }}>Cancel</Button>
                <Button variant="primary" onClick={() => setConfirmSave(true)}><Save className="size-4" /> Save configuration</Button>
              </>
            )}
          </div>
        }
      />

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <Card>
            <CardHeader
              title="Minecraft server"
              subtitle="Where the bot connects"
              icon={<ServerCog className="size-4" />}
              action={editing ? <span className="badge border-primary/30 bg-primary/10 text-[#d46a73]">Editing</span> : <span className="badge">Read only</span>}
            />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Field label="Server IP / hostname" htmlFor="host" error={errors.host} hint="No protocol or port — e.g. play.example.com">
                <input id="host" className="input font-mono" disabled={disabled} value={form.host} onChange={(e) => patch("host", e.target.value)} placeholder="play.example.com" />
              </Field>
              <Field label="Server port" htmlFor="port" error={errors.port} hint="Default Java port is 25565">
                <input id="port" className="input font-mono" type="number" min={1} max={65535} disabled={disabled} value={form.port} onChange={(e) => patch("port", Number(e.target.value))} />
              </Field>
              <Field label="Minecraft version" htmlFor="version" error={errors.version} hint="Default target: Minecraft Java 1.21.11 (verified Mineflayer support)">
                <input id="version" className="input font-mono" disabled={disabled} value={form.version} onChange={(e) => patch("version", e.target.value)} placeholder="1.21.11" />
              </Field>
              <Field label="Bot username" htmlFor="username" error={errors.username} hint="3–16 letters, numbers or underscores">
                <input id="username" className="input font-mono" disabled={disabled} value={form.username} onChange={(e) => patch("username", e.target.value)} placeholder="AlpoyyBot" />
              </Field>
              <Field label="Account mode" htmlFor="authMode" error={errors.authMode} hint="Offline mode only on servers that explicitly permit it">
                <select id="authMode" className="input" disabled={disabled} value={form.authMode} onChange={(e) => patch("authMode", e.target.value as ServerConfig["authMode"])}>
                  <option value="offline">Offline (permitted servers only)</option>
                </select>
              </Field>
              <Field label="Worker endpoint" htmlFor="workerEndpoint" error={errors.workerEndpoint} hint="Full http(s) URL of your persistent worker">
                <input id="workerEndpoint" className="input font-mono" disabled={disabled} value={form.workerEndpoint} onChange={(e) => patch("workerEndpoint", e.target.value)} placeholder="http://127.0.0.1:8787" />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="Connection settings" subtitle="Reconnect and monitoring behaviour" icon={<PlugZap className="size-4" />} />
            <div className="space-y-3 p-5">
              <Toggle
                label="Controlled reconnect"
                description="Retry only after ordinary connection interruptions, with a capped attempt count."
                checked={form.reconnectEnabled}
                disabled={disabled}
                onChange={(value) => patch("reconnectEnabled", value)}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Reconnect delay (ms)" htmlFor="reconnectDelayMs" error={errors.reconnectDelayMs} hint="Between 1,000 and 600,000 ms">
                  <input id="reconnectDelayMs" className="input font-mono" type="number" min={1000} max={600000} step={500} disabled={disabled || !form.reconnectEnabled} value={form.reconnectDelayMs} onChange={(e) => patch("reconnectDelayMs", Number(e.target.value))} />
                </Field>
                <Field label="Maximum attempts" htmlFor="reconnectMaxAttempts" error={errors.reconnectMaxAttempts} hint="0 disables automatic retries">
                  <input id="reconnectMaxAttempts" className="input font-mono" type="number" min={0} max={100} disabled={disabled || !form.reconnectEnabled} value={form.reconnectMaxAttempts} onChange={(e) => patch("reconnectMaxAttempts", Number(e.target.value))} />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Toggle label="Server message monitoring" description="Log chat and server messages as connection events." checked={form.chatMonitoring} disabled={disabled} onChange={(value) => patch("chatMonitoring", value)} />
                <Toggle label="Player list monitoring" description="Track the online player list where the server exposes it." checked={form.playerListMonitoring} disabled={disabled} onChange={(value) => patch("playerListMonitoring", value)} />
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Test configuration" subtitle="Non-invasive connectivity check" icon={<Wifi className="size-4" />} />
            <div className="space-y-4 p-5">
              <p className="text-xs leading-relaxed text-muted">
                Opens a short TCP probe to the configured server and verifies the signed worker health endpoint. No bot login is performed.
              </p>
              <Button variant="primary" className="w-full" onClick={() => void test()} loading={testing}>
                {!testing && <PlugZap className="size-4" />} Test configuration
              </Button>
              {testResult ? (
                <div className="space-y-2">
                  {[
                    { label: `TCP ${form.host}:${form.port}`, ok: testResult.tcp.reachable, detail: testResult.tcp.error || `${testResult.tcp.latencyMs ?? 0}ms` },
                    { label: "Worker endpoint", ok: testResult.worker.reachable, detail: testResult.worker.error || testResult.worker.version || "reachable" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-start gap-2 rounded-lg border border-border bg-surface p-2.5 text-xs">
                      {item.ok ? <Check className="mt-0.5 size-3.5 shrink-0 text-success" /> : <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-danger" />}
                      <div className="min-w-0">
                        <p className="font-medium text-text">{item.label}</p>
                        <p className="mt-0.5 break-words text-[11px] text-muted">{item.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </Card>

          <Card>
            <CardHeader title="Secrets" subtitle="Never exposed to the browser" icon={<KeyRound className="size-4" />} />
            <div className="space-y-2 p-5 text-xs">
              <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2.5">
                <span className="text-muted">Worker shared secret</span>
                <span className={config.data?.secrets.workerSharedSecretConfigured ? "text-success" : "text-warning"}>
                  {config.data?.secrets.workerSharedSecretConfigured ? "Configured" : "Missing"}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2.5">
                <span className="text-muted">Minecraft account token</span>
                <span className={config.data?.secrets.minecraftTokenConfigured ? "text-success" : "text-muted"}>
                  {config.data?.secrets.minecraftTokenConfigured ? "Configured" : "Not set"}
                </span>
              </div>
              <p className="flex items-start gap-2 pt-1 leading-relaxed text-muted">
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-muted" />
                Secrets live only in server environment variables. This page shows presence, never values.
              </p>
            </div>
          </Card>

          {config.data ? (
            <p className="px-1 text-[11px] text-muted">
              Last saved {new Date(config.data.updatedAt).toLocaleString()} {config.data.updatedBy ? `by ${config.data.updatedBy}` : ""}
            </p>
          ) : null}
        </div>
      </div>

      <Modal
        open={confirmSave}
        onClose={() => setConfirmSave(false)}
        title="Save server configuration?"
        description="These settings will be stored in the database and used for the next bot start. Existing connections are not changed automatically."
        confirmLabel="Save changes"
        loading={saving}
        onConfirm={() => void save()}
      >
        <div className="mt-4 rounded-lg border border-border bg-surface p-3 text-xs text-muted">
          <p><span className="text-text">Target:</span> {form.host}:{form.port}</p>
          <p className="mt-1"><span className="text-text">Version:</span> {form.version} · <span className="text-text">Bot:</span> {form.username}</p>
        </div>
      </Modal>
    </>
  );
}
