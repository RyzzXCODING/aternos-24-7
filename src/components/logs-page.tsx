"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Filter, RefreshCw, Search, Trash2 } from "lucide-react";
import { Button, Card, CardHeader, EmptyState, ErrorState, Field, Modal, PageHeader, Skeleton } from "@/components/ui";
import { useToast } from "@/components/toast";
import { apiFetch, useApi } from "@/lib/use-api";
import { formatTime } from "@/lib/format";
import type { LogsData } from "@/lib/dashboard-types";

const typeOptions = [
  { value: "all", label: "All events" },
  { value: "connection", label: "Connection" },
  { value: "disconnection", label: "Disconnection" },
  { value: "error", label: "Error" },
  { value: "config", label: "Configuration" },
  { value: "auth", label: "Authentication" },
  { value: "system", label: "System" },
];

export function LogsPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [type, setType] = useState("all");
  const [page, setPage] = useState(1);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => { setDebounced(search); setPage(1); }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const query = new URLSearchParams({ q: debounced, type, page: String(page), limit: "15" });
  const logs = useApi<LogsData>(`/api/logs?${query.toString()}`);

  async function clearLogs() {
    setClearing(true);
    try {
      const result = await apiFetch<{ removed: number }>("/api/logs", {
        method: "DELETE",
        body: JSON.stringify({ confirm: "CLEAR_LOGS" }),
      });
      toast({ title: "Logs cleared", description: `${result.removed} entries removed.`, variant: "success" });
      setConfirmClear(false);
      setPage(1);
      await logs.reload();
    } catch (error) {
      toast({ title: "Could not clear logs", description: error instanceof Error ? error.message : "Unknown error", variant: "error" });
    } finally {
      setClearing(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Monitoring"
        title="Activity Logs"
        description="Search and filter connection, configuration, authentication and system events."
        action={
          <div className="flex gap-2">
            <Button onClick={() => void logs.reload()}><RefreshCw className={`size-4 ${logs.loading ? "animate-spin" : ""}`} /> Refresh</Button>
            <Button variant="danger" onClick={() => setConfirmClear(true)}><Trash2 className="size-4" /> Clear logs</Button>
          </div>
        }
      />

      <Card>
        <CardHeader
          title="Event history"
          subtitle={logs.data ? `${logs.data.total} total entries` : "Loading entries"}
          icon={<Filter className="size-4" />}
        />
        <div className="grid gap-3 border-b border-border/70 p-4 sm:grid-cols-[1fr_220px]">
          <Field label="Search logs" htmlFor="log-search">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <input
                id="log-search"
                className="input pl-10"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search messages or event types…"
                maxLength={120}
              />
            </div>
          </Field>
          <Field label="Event type" htmlFor="log-type">
            <select id="log-type" className="input" value={type} onChange={(event) => { setType(event.target.value); setPage(1); }}>
              {typeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </Field>
        </div>

        {logs.loading && !logs.data ? (
          <div className="space-y-2 p-5">{Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-10" />)}</div>
        ) : !logs.data ? (
          <div className="p-5"><ErrorState message={logs.error || "Could not load logs"} onRetry={() => void logs.reload()} /></div>
        ) : logs.data.items.length === 0 ? (
          <EmptyState icon={<Filter className="size-5" />} title="No matching events" description="Try a different search term or event filter." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border/70 text-[11px] uppercase tracking-wider text-muted">
                    <th className="px-5 py-3 font-medium">Timestamp</th>
                    <th className="px-3 py-3 font-medium">Event type</th>
                    <th className="px-3 py-3 font-medium">Message</th>
                    <th className="px-5 py-3 text-right font-medium">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {logs.data.items.map((item) => (
                    <tr key={item.id} className="transition-colors hover:bg-white/[0.02]">
                      <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-muted">{formatTime(item.at)}</td>
                      <td className="px-3 py-3">
                        <span className={`badge ${item.type === "error" ? "border-danger/30 bg-danger/10 text-danger" : item.type === "connection" ? "border-success/25 bg-success/10 text-success" : item.type === "config" ? "border-border bg-white/[0.03] text-muted" : ""}`}>
                          {item.type}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs text-text/90">{item.message}</td>
                      <td className="max-w-[260px] truncate px-5 py-3 text-right font-mono text-[11px] text-muted">
                        {item.metadata ? Object.entries(item.metadata).map(([key, value]) => `${key}=${String(value)}`).join(" · ") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 px-5 py-3.5">
              <p className="text-xs text-muted">
                Page {logs.data.page} of {logs.data.pages} · {logs.data.total} entries
              </p>
              <div className="flex gap-2">
                <Button disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                  <ChevronLeft className="size-4" /> Previous
                </Button>
                <Button disabled={page >= logs.data.pages} onClick={() => setPage((value) => Math.min(logs.data?.pages ?? 1, value + 1))}>
                  Next <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      <Modal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Clear all activity logs?"
        description="This permanently removes all stored events. A new system event will be recorded to note the clear action."
        confirmLabel="Clear all logs"
        danger
        loading={clearing}
        onConfirm={() => void clearLogs()}
      />
    </>
  );
}
