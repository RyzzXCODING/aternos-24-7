"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { apiFetch } from "@/lib/use-api";
import { Button, Field } from "@/components/ui";
import { useToast } from "@/components/toast";

export function LoginForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      toast({ title: "Welcome back", description: "Signed in to AlpoyyAternos", variant: "success" });
      router.replace("/");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign-in failed";
      setError(message);
      toast({ title: "Sign-in failed", description: message, variant: "error" });
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <Field label="Username" htmlFor="username">
        <input
          id="username"
          className="input"
          autoComplete="username"
          placeholder="owner"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          required
          minLength={3}
          maxLength={32}
        />
      </Field>

      <Field label="Password" htmlFor="password">
        <div className="relative">
          <input
            id="password"
            className="input pr-11"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={12}
            maxLength={128}
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted hover:text-text"
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </Field>

      {error ? (
        <div role="alert" className="rounded-xl border border-danger/25 bg-danger/10 px-3.5 py-2.5 text-xs text-danger">
          {error}
        </div>
      ) : null}

      <Button type="submit" variant="primary" loading={loading} className="w-full">
        {!loading && <ShieldCheck className="size-4" />}
        Sign in securely
        {!loading && <ArrowRight className="size-4" />}
      </Button>

      <p className="text-center text-[11px] leading-relaxed text-muted">
        Owner-only access. All sessions are httpOnly and rate limited.
      </p>
    </form>
  );
}
