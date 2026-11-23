import { redirect } from "next/navigation";
import { Bot, ShieldCheck } from "lucide-react";
import { LoginForm } from "@/components/login-form";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(104,28,36,0.08),transparent_35%)]" />

      <div className="relative grid w-full max-w-4xl overflow-hidden rounded-2xl border border-border bg-card shadow-xl lg:grid-cols-2">
        <div className="hidden flex-col justify-between border-r border-border bg-surface p-9 lg:flex">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg border border-primary-hover/40 bg-primary/20 text-sm font-bold text-text">A</div>
            <div>
              <p className="text-sm font-semibold text-text">AlpoyyAternos</p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-subtle">Bot Manager</p>
            </div>
          </div>
          <div>
            <div className="mb-6 flex size-14 items-center justify-center rounded-xl border border-border bg-elevated text-muted">
              <Bot className="size-7" />
            </div>
            <h1 className="text-3xl font-semibold leading-tight tracking-tight text-text">
              Control your bot from<br />
              <span className="text-[#d46a73]">one clean dashboard.</span>
            </h1>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">
              Configure your authorized Minecraft Java server, monitor live connection state, and manage the bot from a secure web interface.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-subtle">
            <ShieldCheck className="size-4 text-muted" /> Secure sessions · Owner-only controls
          </div>
        </div>

        <div className="p-7 sm:p-10">
          <div className="mb-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-subtle">Welcome back</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-text">Sign in to dashboard</h2>
            <p className="mt-1.5 text-sm text-muted">Enter your owner credentials to continue.</p>
          </div>
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
