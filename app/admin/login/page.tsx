"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { sanitizeAdminNextPath } from "@/lib/admin/adminRedirect";

function getNextPath(): string {
  if (typeof window === "undefined") {
    return "/admin";
  }

  const params = new URLSearchParams(window.location.search);

  return sanitizeAdminNextPath(params.get("next"));
}

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isCurrent = true;

    async function redirectAuthenticatedAdmin() {
      const response = await fetch("/api/admin/session").catch(() => null);
      const body = (await response?.json().catch(() => null)) as {
        authenticated?: boolean;
      } | null;

      if (isCurrent && body?.authenticated) {
        router.replace(getNextPath());
      }
    }

    redirectAuthenticatedAdmin();

    return () => {
      isCurrent = false;
    };
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });

    setIsSubmitting(false);

    if (!response.ok) {
      setError("Password is not valid.");
      return;
    }

    router.replace(getNextPath());
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-5 rounded-lg border border-border bg-surface p-6 shadow-sm"
      >
        <div>
          <h1 className="font-serif text-2xl font-semibold text-foreground">
            Admin
          </h1>
          <p className="mt-1 text-sm text-muted">Private access</p>
        </div>

        <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
          Password
          <input
            autoComplete="current-password"
            className="rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </label>

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <button
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </main>
  );
}
