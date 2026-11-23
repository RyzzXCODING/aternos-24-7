"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ApiResponse } from "./shared/types";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  });
  let payload: ApiResponse<T>;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError("The server returned an invalid response", "INVALID_RESPONSE", response.status);
  }
  if (!payload.ok) {
    throw new ApiError(payload.error.message, payload.error.code, response.status, payload.error.details);
  }
  return payload.data;
}

export function useApi<T>(url: string | null, options: { intervalMs?: number } = {}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(url));
  const mounted = useRef(true);

  const reload = useCallback(async () => {
    if (!url) return;
    try {
      const result = await apiFetch<T>(url);
      if (mounted.current) {
        setData(result);
        setError(null);
      }
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    mounted.current = true;
    if (!url) return;
    void apiFetch<T>(url)
      .then((result) => {
        if (!mounted.current) return;
        setData(result);
        setError(null);
      })
      .catch((err: unknown) => {
        if (mounted.current) setError(err instanceof Error ? err.message : "Request failed");
      })
      .finally(() => {
        if (mounted.current) setLoading(false);
      });
    return () => { mounted.current = false; };
  }, [url]);

  useEffect(() => {
    if (!url || !options.intervalMs) return;
    const timer = setInterval(() => { void reload(); }, options.intervalMs);
    return () => clearInterval(timer);
  }, [reload, url, options.intervalMs]);

  return { data, error, loading, reload, setData };
}
