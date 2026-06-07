# Admin Expense MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first private admin vertical slice: password login, protected admin shell, expense CRUD, soft delete/restore, exchange-rate snapshots, and audit logging.

**Architecture:** Keep the public dashboard read-only and isolated. Admin pages call protected Next.js route handlers, route handlers validate the admin session, and all database writes happen server-side through Supabase PostgREST with `SUPABASE_SERVICE_ROLE_KEY`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict mode, Vitest, Supabase REST/PostgREST, existing Tailwind CSS theme tokens.

---

## File Structure

- Create `docs/database/admin-expense-mvp.sql`: database contract for admin audit log, expense soft-delete fields, exchange-rate snapshot fields, and admin-facing views/RPC helpers.
- Create `lib/admin/session.ts`: pure session signing, verification, password comparison, and cookie constants.
- Create `lib/admin/session.test.ts`: Vitest coverage for session creation, expiry, tampering, and password comparison.
- Create `lib/admin/auth.ts`: Next server helpers that read cookies and guard pages/API routes.
- Create `app/api/admin/login/route.ts`: admin password login route.
- Create `app/api/admin/logout/route.ts`: admin logout route.
- Create `app/api/admin/session/route.ts`: admin session status route.
- Create `app/admin/login/page.tsx`: client login screen.
- Create `app/admin/layout.tsx`: protected admin layout.
- Create `app/admin/page.tsx`: redirect from `/admin` to `/admin/expenses`.
- Create `components/admin/AdminShell.tsx`: shared admin navigation and content frame.
- Create `lib/admin/supabaseAdmin.ts`: server-only Supabase REST helper using the service role key.
- Create `lib/admin/supabaseAdmin.test.ts`: tests for request headers and structured error behavior.
- Create `lib/admin/expenseValidation.ts`: pure validation and payload normalization for expense writes.
- Create `lib/admin/expenseValidation.test.ts`: tests for required fields, positive amounts, dates, currency, and delete reason.
- Create `services/admin/expenses.ts`: server service for expense list, create, update, soft delete, restore, audit, and snapshots.
- Create `app/api/admin/expenses/route.ts`: protected list/create route.
- Create `app/api/admin/expenses/[id]/route.ts`: protected update route.
- Create `app/api/admin/expenses/[id]/soft-delete/route.ts`: protected soft delete route.
- Create `app/api/admin/expenses/[id]/restore/route.ts`: protected restore route.
- Create `app/admin/expenses/page.tsx`: server page that renders the expense admin client.
- Create `components/admin/ExpensesAdminClient.tsx`: table, filters, right-side drawer, and row actions.
- Modify `app/globals.css`: add restrained admin layout utility styles only if Tailwind classes cannot express the needed behavior cleanly.
- Modify `.env.example` if present, otherwise create `.env.example`: document `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, and `SUPABASE_SERVICE_ROLE_KEY`.

---

### Task 1: Database Contract

**Files:**
- Create: `docs/database/admin-expense-mvp.sql`

- [ ] **Step 1: Create the SQL contract file**

Create `docs/database/admin-expense-mvp.sql` with:

```sql
create schema if not exists fund;

create table if not exists fund.admin_audit_log (
  audit_id bigint generated always as identity primary key,
  entity_table text not null,
  entity_id text not null,
  action text not null,
  old_data jsonb,
  new_data jsonb,
  reason text,
  actor text not null default 'admin',
  created_at timestamptz not null default now(),
  constraint admin_audit_log_action_check check (
    action in ('create', 'update', 'soft_delete', 'restore', 'exchange_rate_snapshot')
  )
);

alter table fund.admin_audit_log enable row level security;

drop policy if exists "No public audit access" on fund.admin_audit_log;

create policy "No public audit access"
on fund.admin_audit_log
for select
using (false);

alter table if exists fund.expenses
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_reason text,
  add column if not exists deleted_by text,
  add column if not exists aud_to_usd_rate numeric(18, 8),
  add column if not exists aud_to_twd_rate numeric(18, 8),
  add column if not exists exchange_rate_date date,
  add column if not exists exchange_rate_source text,
  add column if not exists exchange_rate_fetched_at timestamptz;

create or replace view fund.v_admin_expense as
select
  e.expense_id,
  e.campaign_id,
  c.campaign_name,
  e.expense_date,
  e.expense_category_id,
  ec.category_name,
  ec.category_group,
  e.expense_description,
  e.original_amount,
  e.currency_code,
  e.base_currency_amount,
  e.aud_to_usd_rate,
  e.aud_to_twd_rate,
  e.exchange_rate_date,
  e.exchange_rate_source,
  e.exchange_rate_fetched_at,
  e.created_at,
  e.updated_at,
  e.deleted_at,
  e.deleted_reason,
  e.deleted_by
from fund.expenses e
join fund.campaigns c on c.campaign_id = e.campaign_id
join fund.expense_categories ec on ec.expense_category_id = e.expense_category_id;

create or replace function fund.admin_insert_audit_log(
  p_entity_table text,
  p_entity_id text,
  p_action text,
  p_old_data jsonb,
  p_new_data jsonb,
  p_reason text default null
)
returns fund.admin_audit_log
language plpgsql
security definer
as $$
declare
  v_row fund.admin_audit_log;
begin
  insert into fund.admin_audit_log (
    entity_table,
    entity_id,
    action,
    old_data,
    new_data,
    reason,
    actor
  )
  values (
    p_entity_table,
    p_entity_id,
    p_action,
    p_old_data,
    p_new_data,
    p_reason,
    'admin'
  )
  returning * into v_row;

  return v_row;
end;
$$;

grant select on fund.v_admin_expense to service_role;
grant insert on fund.admin_audit_log to service_role;
grant execute on function fund.admin_insert_audit_log(text, text, text, jsonb, jsonb, text) to service_role;
```

- [ ] **Step 2: Verify the SQL file is syntactically reviewable**

Run: `rg -n "fund\\.expenses|admin_audit_log|v_admin_expense|admin_insert_audit_log" docs/database/admin-expense-mvp.sql`

Expected: output includes the table, view, and function names.

- [ ] **Step 3: Commit**

Run:

```bash
git add docs/database/admin-expense-mvp.sql
git commit -m "Add admin expense database contract"
```

Expected: commit succeeds with one new SQL file.

---

### Task 2: Admin Session Primitives

**Files:**
- Create: `lib/admin/session.ts`
- Create: `lib/admin/session.test.ts`

- [ ] **Step 1: Write failing tests for session behavior**

Create `lib/admin/session.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  createAdminSessionToken,
  verifyAdminPassword,
  verifyAdminSessionToken,
} from "@/lib/admin/session";

const secret = "test-secret-with-enough-length";

describe("admin session tokens", () => {
  it("verifies a freshly created token", () => {
    const token = createAdminSessionToken(secret, () =>
      new Date("2026-06-08T00:00:00.000Z")
    );

    expect(
      verifyAdminSessionToken(token, secret, () =>
        new Date("2026-06-08T00:10:00.000Z")
      )
    ).toMatchObject({
      sub: "admin",
      exp: Date.parse("2026-06-08T08:00:00.000Z"),
    });
  });

  it("rejects an expired token", () => {
    const token = createAdminSessionToken(secret, () =>
      new Date("2026-06-08T00:00:00.000Z")
    );

    expect(
      verifyAdminSessionToken(token, secret, () =>
        new Date("2026-06-08T08:00:01.000Z")
      )
    ).toBeNull();
  });

  it("rejects a tampered token", () => {
    const token = createAdminSessionToken(secret, () =>
      new Date("2026-06-08T00:00:00.000Z")
    );

    expect(
      verifyAdminSessionToken(`${token}x`, secret, () =>
        new Date("2026-06-08T00:10:00.000Z")
      )
    ).toBeNull();
  });
});

describe("admin password comparison", () => {
  it("accepts the configured password", () => {
    expect(verifyAdminPassword("admin-pass", "admin-pass")).toBe(true);
  });

  it("rejects a different password", () => {
    expect(verifyAdminPassword("wrong", "admin-pass")).toBe(false);
  });

  it("rejects an empty configured password", () => {
    expect(verifyAdminPassword("anything", "")).toBe(false);
  });
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npm run test -- lib/admin/session.test.ts`

Expected: FAIL because `@/lib/admin/session` does not exist.

- [ ] **Step 3: Implement session primitives**

Create `lib/admin/session.ts`:

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_SESSION_COOKIE = "ccf_admin_session";
export const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

export type AdminSessionPayload = {
  sub: "admin";
  iat: number;
  exp: number;
};

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function createAdminSessionToken(
  secret: string,
  now: () => Date = () => new Date()
): string {
  const issuedAt = now().getTime();
  const payload: AdminSessionPayload = {
    sub: "admin",
    iat: issuedAt,
    exp: issuedAt + ADMIN_SESSION_TTL_MS,
  };
  const body = encodeBase64Url(JSON.stringify(payload));
  const signature = sign(body, secret);

  return `${body}.${signature}`;
}

export function verifyAdminSessionToken(
  token: string | undefined,
  secret: string,
  now: () => Date = () => new Date()
): AdminSessionPayload | null {
  if (!token || !secret || !token.includes(".")) {
    return null;
  }

  const [body, signature] = token.split(".");

  if (!body || !signature || !safeEqual(signature, sign(body, secret))) {
    return null;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(body)) as AdminSessionPayload;

    if (payload.sub !== "admin" || payload.exp <= now().getTime()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function verifyAdminPassword(
  submittedPassword: string,
  configuredPassword: string | undefined
): boolean {
  if (!configuredPassword) {
    return false;
  }

  return safeEqual(submittedPassword, configuredPassword);
}
```

- [ ] **Step 4: Run the focused test and verify pass**

Run: `npm run test -- lib/admin/session.test.ts`

Expected: PASS for 6 tests.

- [ ] **Step 5: Commit**

Run:

```bash
git add lib/admin/session.ts lib/admin/session.test.ts
git commit -m "Add admin session primitives"
```

Expected: commit succeeds with session helper and tests.

---

### Task 3: Admin Auth Routes

**Files:**
- Create: `lib/admin/auth.ts`
- Create: `app/api/admin/login/route.ts`
- Create: `app/api/admin/logout/route.ts`
- Create: `app/api/admin/session/route.ts`

- [ ] **Step 1: Create server auth helpers**

Create `lib/admin/auth.ts`:

```ts
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_SESSION_COOKIE,
  createAdminSessionToken,
  verifyAdminSessionToken,
} from "@/lib/admin/session";

export function getAdminSessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;

  if (!secret) {
    throw new Error("Missing ADMIN_SESSION_SECRET");
  }

  return secret;
}

export function getAdminPassword(): string {
  const password = process.env.ADMIN_PASSWORD;

  if (!password) {
    throw new Error("Missing ADMIN_PASSWORD");
  }

  return password;
}

export async function hasAdminSession(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  return verifyAdminSessionToken(token, getAdminSessionSecret()) !== null;
}

export async function requireAdminPageSession(): Promise<void> {
  if (!(await hasAdminSession())) {
    redirect("/admin/login");
  }
}

export async function requireAdminApiSession(): Promise<Response | null> {
  if (await hasAdminSession()) {
    return null;
  }

  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

export function buildAdminSessionToken(): string {
  return createAdminSessionToken(getAdminSessionSecret());
}
```

- [ ] **Step 2: Add login route**

Create `app/api/admin/login/route.ts`:

```ts
import { cookies } from "next/headers";
import { buildAdminSessionToken, getAdminPassword } from "@/lib/admin/auth";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_TTL_MS,
  verifyAdminPassword,
} from "@/lib/admin/session";

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as {
    password?: string;
  } | null;

  if (!verifyAdminPassword(body?.password ?? "", getAdminPassword())) {
    return Response.json({ error: "Invalid password" }, { status: 401 });
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, buildAdminSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: Math.floor(ADMIN_SESSION_TTL_MS / 1000),
    path: "/admin",
  });

  return Response.json({ ok: true });
}
```

- [ ] **Step 3: Add logout route**

Create `app/api/admin/logout/route.ts`:

```ts
import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin/session";

export async function POST(): Promise<Response> {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE);

  return Response.json({ ok: true });
}
```

- [ ] **Step 4: Add session status route**

Create `app/api/admin/session/route.ts`:

```ts
import { hasAdminSession } from "@/lib/admin/auth";

export async function GET(): Promise<Response> {
  return Response.json({ authenticated: await hasAdminSession() });
}
```

- [ ] **Step 5: Run lint and tests**

Run: `npm run test -- lib/admin/session.test.ts`

Expected: PASS.

Run: `npm run lint`

Expected: exit 0.

- [ ] **Step 6: Commit**

Run:

```bash
git add lib/admin/auth.ts app/api/admin/login/route.ts app/api/admin/logout/route.ts app/api/admin/session/route.ts
git commit -m "Add admin auth routes"
```

Expected: commit succeeds with protected auth endpoints.

---

### Task 4: Admin Login and Protected Shell

**Files:**
- Create: `app/admin/login/page.tsx`
- Create: `app/admin/layout.tsx`
- Create: `app/admin/page.tsx`
- Create: `components/admin/AdminShell.tsx`

- [ ] **Step 1: Create admin login page**

Create `app/admin/login/page.tsx`:

```tsx
"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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

    router.replace("/admin/expenses");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-background px-6 py-16">
      <form
        onSubmit={handleSubmit}
        className="mx-auto flex w-full max-w-sm flex-col gap-5 rounded-lg border border-border bg-surface p-6 shadow-sm"
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
            className="rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
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
```

- [ ] **Step 2: Create protected admin layout**

Create `app/admin/layout.tsx`:

```tsx
import { requireAdminPageSession } from "@/lib/admin/auth";
import AdminShell from "@/components/admin/AdminShell";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireAdminPageSession();

  return <AdminShell>{children}</AdminShell>;
}
```

- [ ] **Step 3: Redirect `/admin` to expenses**

Create `app/admin/page.tsx`:

```tsx
import { redirect } from "next/navigation";

export default function AdminPage() {
  redirect("/admin/expenses");
}
```

- [ ] **Step 4: Create the shared shell**

Create `components/admin/AdminShell.tsx`:

```tsx
import Link from "next/link";

const navItems = [
  { href: "/admin/expenses", label: "Expenses" },
  { href: "/admin/donations", label: "Donations" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/budgets", label: "Budgets" },
  { href: "/admin/exchange-rates", label: "Exchange Rates" },
  { href: "/admin/audit", label: "Audit" },
];

export default function AdminShell({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="min-h-screen bg-background">
      <div className="grid min-h-screen grid-cols-[220px_1fr]">
        <aside className="border-r border-border bg-surface px-4 py-6">
          <div className="mb-8">
            <p className="font-serif text-xl font-semibold text-foreground">
              Care Fund
            </p>
            <p className="text-xs uppercase tracking-wide text-muted">Admin</p>
          </div>

          <nav className="flex flex-col gap-1">
            {navItems.map((item) => (
              <Link
                className="rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-accent-bg"
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <section className="min-w-0 px-6 py-6">{children}</section>
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Run lint**

Run: `npm run lint`

Expected: exit 0.

- [ ] **Step 6: Commit**

Run:

```bash
git add app/admin/login/page.tsx app/admin/layout.tsx app/admin/page.tsx components/admin/AdminShell.tsx
git commit -m "Add protected admin shell"
```

Expected: commit succeeds with login and protected layout files.

---

### Task 5: Supabase Admin REST Helper

**Files:**
- Create: `lib/admin/supabaseAdmin.ts`
- Create: `lib/admin/supabaseAdmin.test.ts`

- [ ] **Step 1: Write failing tests for admin REST headers**

Create `lib/admin/supabaseAdmin.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { adminFetch } from "@/lib/admin/supabaseAdmin";

describe("adminFetch", () => {
  it("uses service role headers and fund schema profile", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_SCHEMA", "fund");

    const fetcher = vi.fn(async () => Response.json([{ ok: true }]));

    await adminFetch("v_admin_expense", "select=*", { fetcher });

    expect(fetcher).toHaveBeenCalledWith(
      "https://example.supabase.co/rest/v1/v_admin_expense?select=*",
      expect.objectContaining({
        headers: expect.objectContaining({
          apikey: "service-key",
          Authorization: "Bearer service-key",
          "Accept-Profile": "fund",
          "Content-Profile": "fund",
        }),
      })
    );
  });
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npm run test -- lib/admin/supabaseAdmin.test.ts`

Expected: FAIL because `@/lib/admin/supabaseAdmin` does not exist.

- [ ] **Step 3: Implement admin REST helper**

Create `lib/admin/supabaseAdmin.ts`:

```ts
type FetchLike = typeof fetch;

type AdminFetchOptions = {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
  prefer?: string;
  fetcher?: FetchLike;
};

export type SupabaseAdminError = {
  message: string;
  status: number;
};

function getEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing ${name}`);
  }

  return value;
}

export async function adminFetch<T>(
  resource: string,
  query: string,
  options: AdminFetchOptions = {}
): Promise<T> {
  const url = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  const schema = process.env.NEXT_PUBLIC_SUPABASE_SCHEMA ?? "fund";
  const fetcher = options.fetcher ?? fetch;

  const response = await fetcher(`${url}/rest/v1/${resource}?${query}`, {
    method: options.method ?? "GET",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Accept-Profile": schema,
      "Content-Profile": schema,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(options.prefer ? { Prefer: options.prefer } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw {
      message: text || `Supabase admin request failed with ${response.status}`,
      status: response.status,
    } satisfies SupabaseAdminError;
  }

  return response.json() as Promise<T>;
}
```

- [ ] **Step 4: Run focused test and verify pass**

Run: `npm run test -- lib/admin/supabaseAdmin.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add lib/admin/supabaseAdmin.ts lib/admin/supabaseAdmin.test.ts
git commit -m "Add Supabase admin REST helper"
```

Expected: commit succeeds with helper and test.

---

### Task 6: Expense Validation

**Files:**
- Create: `lib/admin/expenseValidation.ts`
- Create: `lib/admin/expenseValidation.test.ts`

- [ ] **Step 1: Write failing validation tests**

Create `lib/admin/expenseValidation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  parseExpenseInput,
  parseSoftDeleteInput,
} from "@/lib/admin/expenseValidation";

const validExpense = {
  campaignId: 1,
  expenseDate: "2026-06-08",
  expenseCategoryId: 2,
  expenseDescription: "Clinic invoice",
  originalAmount: 125.5,
  currencyCode: "AUD",
};

describe("parseExpenseInput", () => {
  it("accepts a valid expense payload", () => {
    expect(parseExpenseInput(validExpense)).toEqual(validExpense);
  });

  it("rejects non-positive amounts", () => {
    expect(() =>
      parseExpenseInput({ ...validExpense, originalAmount: 0 })
    ).toThrow("Amount must be greater than zero");
  });

  it("rejects unsupported currency codes", () => {
    expect(() =>
      parseExpenseInput({ ...validExpense, currencyCode: "EUR" })
    ).toThrow("Currency must be AUD, USD, or TWD");
  });

  it("rejects invalid dates", () => {
    expect(() =>
      parseExpenseInput({ ...validExpense, expenseDate: "2026-02-30" })
    ).toThrow("Expense date must be a valid ISO date");
  });
});

describe("parseSoftDeleteInput", () => {
  it("accepts a reason", () => {
    expect(parseSoftDeleteInput({ reason: "Duplicate entry" })).toEqual({
      reason: "Duplicate entry",
    });
  });

  it("rejects an empty reason", () => {
    expect(() => parseSoftDeleteInput({ reason: "   " })).toThrow(
      "Soft delete reason is required"
    );
  });
});
```

- [ ] **Step 2: Run focused test and verify failure**

Run: `npm run test -- lib/admin/expenseValidation.test.ts`

Expected: FAIL because validation file does not exist.

- [ ] **Step 3: Implement validation**

Create `lib/admin/expenseValidation.ts`:

```ts
import { SUPPORTED_CURRENCIES, type DisplayCurrency } from "@/lib/currency";

export type AdminExpenseInput = {
  campaignId: number;
  expenseDate: string;
  expenseCategoryId: number;
  expenseDescription: string;
  originalAmount: number;
  currencyCode: DisplayCurrency;
};

export type SoftDeleteInput = {
  reason: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function requirePositiveInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || Number(value) <= 0) {
    throw new Error(`${label} is required`);
  }

  return Number(value);
}

function requirePositiveAmount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error("Amount must be greater than zero");
  }

  return value;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} is required`);
  }

  return value.trim();
}

function requireIsoDate(value: unknown, label: string): string {
  const text = requireString(value, label);
  const parsed = new Date(`${text}T00:00:00.000Z`);

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(text) ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== text
  ) {
    throw new Error(`${label} must be a valid ISO date`);
  }

  return text;
}

function requireCurrency(value: unknown): DisplayCurrency {
  if (
    typeof value !== "string" ||
    !SUPPORTED_CURRENCIES.includes(value as DisplayCurrency)
  ) {
    throw new Error("Currency must be AUD, USD, or TWD");
  }

  return value as DisplayCurrency;
}

export function parseExpenseInput(value: unknown): AdminExpenseInput {
  if (!isRecord(value)) {
    throw new Error("Expense payload is required");
  }

  return {
    campaignId: requirePositiveInteger(value.campaignId, "Campaign"),
    expenseDate: requireIsoDate(value.expenseDate, "Expense date"),
    expenseCategoryId: requirePositiveInteger(
      value.expenseCategoryId,
      "Expense category"
    ),
    expenseDescription: requireString(
      value.expenseDescription,
      "Expense description"
    ),
    originalAmount: requirePositiveAmount(value.originalAmount),
    currencyCode: requireCurrency(value.currencyCode),
  };
}

export function parseSoftDeleteInput(value: unknown): SoftDeleteInput {
  if (!isRecord(value)) {
    throw new Error("Soft delete payload is required");
  }

  const reason = requireString(value.reason, "Soft delete reason");

  return { reason };
}
```

- [ ] **Step 4: Run focused test and verify pass**

Run: `npm run test -- lib/admin/expenseValidation.test.ts`

Expected: PASS for 6 tests.

- [ ] **Step 5: Commit**

Run:

```bash
git add lib/admin/expenseValidation.ts lib/admin/expenseValidation.test.ts
git commit -m "Add admin expense validation"
```

Expected: commit succeeds with validation helper and tests.

---

### Task 7: Expense Service and API Routes

**Files:**
- Create: `services/admin/expenses.ts`
- Create: `app/api/admin/expenses/route.ts`
- Create: `app/api/admin/expenses/[id]/route.ts`
- Create: `app/api/admin/expenses/[id]/soft-delete/route.ts`
- Create: `app/api/admin/expenses/[id]/restore/route.ts`

- [ ] **Step 1: Create expense service**

Create `services/admin/expenses.ts`:

```ts
import { getCurrentExchangeRates } from "@/lib/exchangeRates";
import { adminFetch } from "@/lib/admin/supabaseAdmin";
import type { AdminExpenseInput } from "@/lib/admin/expenseValidation";

export type AdminExpenseRow = {
  expense_id: number;
  campaign_id: number;
  campaign_name: string;
  expense_date: string;
  expense_category_id: number;
  category_name: string;
  category_group: string;
  expense_description: string;
  original_amount: number;
  currency_code: string;
  base_currency_amount: number;
  aud_to_usd_rate: number | null;
  aud_to_twd_rate: number | null;
  exchange_rate_date: string | null;
  exchange_rate_source: string | null;
  exchange_rate_fetched_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_reason: string | null;
  deleted_by: string | null;
};

type ExpenseListFilters = {
  status?: "active" | "deleted" | "all";
  search?: string;
};

function statusFilter(status: ExpenseListFilters["status"]): string {
  if (status === "deleted") {
    return "deleted_at=not.is.null";
  }

  if (status === "all") {
    return "";
  }

  return "deleted_at=is.null";
}

function buildListQuery(filters: ExpenseListFilters): string {
  const query = new URLSearchParams();
  query.set("select", "*");
  query.set("order", "expense_date.desc");
  query.set("limit", "100");

  const status = statusFilter(filters.status);
  if (status) {
    const [key, value] = status.split("=");
    query.set(key, value);
  }

  if (filters.search) {
    query.set(
      "or",
      `(expense_description.ilike.*${filters.search}*,category_name.ilike.*${filters.search}*,campaign_name.ilike.*${filters.search}*)`
    );
  }

  return query.toString();
}

async function writeAudit(
  entityId: string,
  action: string,
  oldData: unknown,
  newData: unknown,
  reason?: string
): Promise<void> {
  await adminFetch("rpc/admin_insert_audit_log", "", {
    method: "POST",
    body: {
      p_entity_table: "expenses",
      p_entity_id: entityId,
      p_action: action,
      p_old_data: oldData,
      p_new_data: newData,
      p_reason: reason ?? null,
    },
  });
}

export async function listAdminExpenses(
  filters: ExpenseListFilters = {}
): Promise<AdminExpenseRow[]> {
  return adminFetch<AdminExpenseRow[]>(
    "v_admin_expense",
    buildListQuery(filters)
  );
}

export async function createAdminExpense(
  input: AdminExpenseInput
): Promise<AdminExpenseRow> {
  const rates = await getCurrentExchangeRates();
  const rows = await adminFetch<AdminExpenseRow[]>("expenses", "select=*", {
    method: "POST",
    prefer: "return=representation",
    body: {
      campaign_id: input.campaignId,
      expense_date: input.expenseDate,
      expense_category_id: input.expenseCategoryId,
      expense_description: input.expenseDescription,
      original_amount: input.originalAmount,
      currency_code: input.currencyCode,
      aud_to_usd_rate: rates.rates.USD,
      aud_to_twd_rate: rates.rates.TWD,
      exchange_rate_date: input.expenseDate,
      exchange_rate_source: rates.source,
      exchange_rate_fetched_at: rates.fetchedAt,
    },
  });
  const row = rows[0];

  await writeAudit(String(row.expense_id), "create", null, row);

  return row;
}

export async function updateAdminExpense(
  expenseId: number,
  input: AdminExpenseInput
): Promise<AdminExpenseRow> {
  const existing = await adminFetch<AdminExpenseRow[]>(
    "v_admin_expense",
    `select=*&expense_id=eq.${expenseId}&limit=1`
  );
  const previous = existing[0];
  const needsRateSnapshot =
    previous.expense_date !== input.expenseDate ||
    previous.original_amount !== input.originalAmount ||
    previous.currency_code !== input.currencyCode;
  const rates = needsRateSnapshot ? await getCurrentExchangeRates() : null;
  const rows = await adminFetch<AdminExpenseRow[]>(
    "expenses",
    `expense_id=eq.${expenseId}&select=*`,
    {
      method: "PATCH",
      prefer: "return=representation",
      body: {
        campaign_id: input.campaignId,
        expense_date: input.expenseDate,
        expense_category_id: input.expenseCategoryId,
        expense_description: input.expenseDescription,
        original_amount: input.originalAmount,
        currency_code: input.currencyCode,
        updated_at: new Date().toISOString(),
        ...(rates
          ? {
              aud_to_usd_rate: rates.rates.USD,
              aud_to_twd_rate: rates.rates.TWD,
              exchange_rate_date: input.expenseDate,
              exchange_rate_source: rates.source,
              exchange_rate_fetched_at: rates.fetchedAt,
            }
          : {}),
      },
    }
  );
  const row = rows[0];

  await writeAudit(String(expenseId), "update", previous, row);

  return row;
}

export async function softDeleteAdminExpense(
  expenseId: number,
  reason: string
): Promise<AdminExpenseRow> {
  const existing = await adminFetch<AdminExpenseRow[]>(
    "v_admin_expense",
    `select=*&expense_id=eq.${expenseId}&limit=1`
  );
  const previous = existing[0];
  const rows = await adminFetch<AdminExpenseRow[]>(
    "expenses",
    `expense_id=eq.${expenseId}&select=*`,
    {
      method: "PATCH",
      prefer: "return=representation",
      body: {
        deleted_at: new Date().toISOString(),
        deleted_reason: reason,
        deleted_by: "admin",
        updated_at: new Date().toISOString(),
      },
    }
  );
  const row = rows[0];

  await writeAudit(String(expenseId), "soft_delete", previous, row, reason);

  return row;
}

export async function restoreAdminExpense(
  expenseId: number
): Promise<AdminExpenseRow> {
  const existing = await adminFetch<AdminExpenseRow[]>(
    "v_admin_expense",
    `select=*&expense_id=eq.${expenseId}&limit=1`
  );
  const previous = existing[0];
  const rows = await adminFetch<AdminExpenseRow[]>(
    "expenses",
    `expense_id=eq.${expenseId}&select=*`,
    {
      method: "PATCH",
      prefer: "return=representation",
      body: {
        deleted_at: null,
        deleted_reason: null,
        deleted_by: null,
        updated_at: new Date().toISOString(),
      },
    }
  );
  const row = rows[0];

  await writeAudit(String(expenseId), "restore", previous, row);

  return row;
}
```

- [ ] **Step 2: Create list/create route**

Create `app/api/admin/expenses/route.ts`:

```ts
import { requireAdminApiSession } from "@/lib/admin/auth";
import { parseExpenseInput } from "@/lib/admin/expenseValidation";
import {
  createAdminExpense,
  listAdminExpenses,
} from "@/services/admin/expenses";

export async function GET(request: Request): Promise<Response> {
  const unauthorized = await requireAdminApiSession();
  if (unauthorized) return unauthorized;

  const url = new URL(request.url);
  const status =
    url.searchParams.get("status") === "deleted"
      ? "deleted"
      : url.searchParams.get("status") === "all"
        ? "all"
        : "active";
  const search = url.searchParams.get("search") ?? undefined;

  return Response.json(await listAdminExpenses({ status, search }));
}

export async function POST(request: Request): Promise<Response> {
  const unauthorized = await requireAdminApiSession();
  if (unauthorized) return unauthorized;

  try {
    const input = parseExpenseInput(await request.json());
    const expense = await createAdminExpense(input);

    return Response.json(expense, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to create expense" },
      { status: 400 }
    );
  }
}
```

- [ ] **Step 3: Create update route**

Create `app/api/admin/expenses/[id]/route.ts`:

```ts
import { requireAdminApiSession } from "@/lib/admin/auth";
import { parseExpenseInput } from "@/lib/admin/expenseValidation";
import { updateAdminExpense } from "@/services/admin/expenses";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const unauthorized = await requireAdminApiSession();
  if (unauthorized) return unauthorized;

  const { id } = await context.params;
  const expenseId = Number(id);

  if (!Number.isInteger(expenseId) || expenseId <= 0) {
    return Response.json({ error: "Invalid expense id" }, { status: 400 });
  }

  try {
    const input = parseExpenseInput(await request.json());
    return Response.json(await updateAdminExpense(expenseId, input));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to update expense" },
      { status: 400 }
    );
  }
}
```

- [ ] **Step 4: Create soft delete route**

Create `app/api/admin/expenses/[id]/soft-delete/route.ts`:

```ts
import { requireAdminApiSession } from "@/lib/admin/auth";
import { parseSoftDeleteInput } from "@/lib/admin/expenseValidation";
import { softDeleteAdminExpense } from "@/services/admin/expenses";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const unauthorized = await requireAdminApiSession();
  if (unauthorized) return unauthorized;

  const { id } = await context.params;
  const expenseId = Number(id);

  if (!Number.isInteger(expenseId) || expenseId <= 0) {
    return Response.json({ error: "Invalid expense id" }, { status: 400 });
  }

  try {
    const { reason } = parseSoftDeleteInput(await request.json());
    return Response.json(await softDeleteAdminExpense(expenseId, reason));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to delete expense" },
      { status: 400 }
    );
  }
}
```

- [ ] **Step 5: Create restore route**

Create `app/api/admin/expenses/[id]/restore/route.ts`:

```ts
import { requireAdminApiSession } from "@/lib/admin/auth";
import { restoreAdminExpense } from "@/services/admin/expenses";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const unauthorized = await requireAdminApiSession();
  if (unauthorized) return unauthorized;

  const { id } = await context.params;
  const expenseId = Number(id);

  if (!Number.isInteger(expenseId) || expenseId <= 0) {
    return Response.json({ error: "Invalid expense id" }, { status: 400 });
  }

  return Response.json(await restoreAdminExpense(expenseId));
}
```

- [ ] **Step 6: Run tests and lint**

Run: `npm run test -- lib/admin/expenseValidation.test.ts lib/admin/supabaseAdmin.test.ts`

Expected: PASS.

Run: `npm run lint`

Expected: exit 0.

- [ ] **Step 7: Commit**

Run:

```bash
git add services/admin/expenses.ts app/api/admin/expenses 'app/api/admin/expenses/[id]'
git commit -m "Add admin expense API routes"
```

Expected: commit succeeds with service and routes.

---

### Task 8: Expenses Admin UI

**Files:**
- Create: `app/admin/expenses/page.tsx`
- Create: `components/admin/ExpensesAdminClient.tsx`

- [ ] **Step 1: Create expenses page**

Create `app/admin/expenses/page.tsx`:

```tsx
import { listAdminExpenses } from "@/services/admin/expenses";
import ExpensesAdminClient from "@/components/admin/ExpensesAdminClient";

export default async function AdminExpensesPage() {
  const expenses = await listAdminExpenses({ status: "active" });

  return <ExpensesAdminClient initialExpenses={expenses} />;
}
```

- [ ] **Step 2: Create the expense admin client**

Create `components/admin/ExpensesAdminClient.tsx`:

```tsx
"use client";

import { FormEvent, useMemo, useState } from "react";
import type { AdminExpenseRow } from "@/services/admin/expenses";

type Props = {
  initialExpenses: AdminExpenseRow[];
};

type FormState = {
  campaignId: string;
  expenseDate: string;
  expenseCategoryId: string;
  expenseDescription: string;
  originalAmount: string;
  currencyCode: "AUD" | "USD" | "TWD";
};

const emptyForm: FormState = {
  campaignId: "",
  expenseDate: "",
  expenseCategoryId: "",
  expenseDescription: "",
  originalAmount: "",
  currencyCode: "AUD",
};

function rowToForm(row: AdminExpenseRow): FormState {
  return {
    campaignId: String(row.campaign_id),
    expenseDate: row.expense_date,
    expenseCategoryId: String(row.expense_category_id),
    expenseDescription: row.expense_description,
    originalAmount: String(row.original_amount),
    currencyCode: row.currency_code as "AUD" | "USD" | "TWD",
  };
}

export default function ExpensesAdminClient({ initialExpenses }: Props) {
  const [expenses, setExpenses] = useState(initialExpenses);
  const [status, setStatus] = useState<"active" | "deleted" | "all">("active");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<AdminExpenseRow | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const total = useMemo(
    () =>
      expenses.reduce(
        (sum, expense) =>
          expense.deleted_at ? sum : sum + Number(expense.base_currency_amount),
        0
      ),
    [expenses]
  );

  async function refresh(nextStatus = status, nextSearch = search) {
    const params = new URLSearchParams({
      status: nextStatus,
      ...(nextSearch ? { search: nextSearch } : {}),
    });
    const response = await fetch(`/api/admin/expenses?${params}`);
    setExpenses(await response.json());
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setIsDrawerOpen(true);
  }

  function openEdit(row: AdminExpenseRow) {
    setEditing(row);
    setForm(rowToForm(row));
    setError("");
    setIsDrawerOpen(true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError("");

    const payload = {
      campaignId: Number(form.campaignId),
      expenseDate: form.expenseDate,
      expenseCategoryId: Number(form.expenseCategoryId),
      expenseDescription: form.expenseDescription,
      originalAmount: Number(form.originalAmount),
      currencyCode: form.currencyCode,
    };
    const response = await fetch(
      editing ? `/api/admin/expenses/${editing.expense_id}` : "/api/admin/expenses",
      {
        method: editing ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    setIsSaving(false);

    if (!response.ok) {
      const body = await response.json();
      setError(body.error ?? "Unable to save expense");
      return;
    }

    await refresh();
    setIsDrawerOpen(false);
  }

  async function softDelete(row: AdminExpenseRow) {
    const reason = window.prompt("Reason for soft delete");

    if (!reason) {
      return;
    }

    await fetch(`/api/admin/expenses/${row.expense_id}/soft-delete`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    await refresh();
  }

  async function restore(row: AdminExpenseRow) {
    await fetch(`/api/admin/expenses/${row.expense_id}/restore`, {
      method: "POST",
    });
    await refresh();
  }

  return (
    <div className="grid h-[calc(100vh-3rem)] grid-cols-[1fr_380px] gap-6">
      <section className="min-w-0">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl font-semibold text-foreground">
              Expenses
            </h1>
            <p className="mt-1 text-sm text-muted">
              Active total: AUD {total.toLocaleString("en-AU")}
            </p>
          </div>

          <button
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white"
            onClick={openCreate}
            type="button"
          >
            New expense
          </button>
        </div>

        <div className="mb-4 flex gap-3">
          <input
            className="w-72 rounded-md border border-border bg-white px-3 py-2 text-sm"
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search expenses"
            value={search}
          />
          <select
            className="rounded-md border border-border bg-white px-3 py-2 text-sm"
            onChange={async (event) => {
              const nextStatus = event.target.value as "active" | "deleted" | "all";
              setStatus(nextStatus);
              await refresh(nextStatus);
            }}
            value={status}
          >
            <option value="active">Active</option>
            <option value="deleted">Deleted</option>
            <option value="all">All</option>
          </select>
          <button
            className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium"
            onClick={() => refresh()}
            type="button"
          >
            Apply
          </button>
        </div>

        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-accent-bg text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((row) => (
                <tr
                  className={`border-b border-border last:border-b-0 ${row.deleted_at ? "text-muted" : "text-foreground"}`}
                  key={row.expense_id}
                >
                  <td className="px-3 py-2">{row.expense_date}</td>
                  <td className="px-3 py-2">{row.expense_description}</td>
                  <td className="px-3 py-2">{row.category_name}</td>
                  <td className="px-3 py-2 text-right">
                    {row.currency_code} {Number(row.original_amount).toLocaleString("en-AU")}
                  </td>
                  <td className="px-3 py-2">
                    {row.deleted_at ? "Deleted" : "Active"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      className="mr-2 text-primary"
                      onClick={() => openEdit(row)}
                      type="button"
                    >
                      Edit
                    </button>
                    {row.deleted_at ? (
                      <button
                        className="text-primary"
                        onClick={() => restore(row)}
                        type="button"
                      >
                        Restore
                      </button>
                    ) : (
                      <button
                        className="text-danger"
                        onClick={() => softDelete(row)}
                        type="button"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <aside className="rounded-lg border border-border bg-surface p-5 shadow-sm">
        {isDrawerOpen ? (
          <form className="flex flex-col gap-4" onSubmit={submit}>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {editing ? "Edit expense" : "New expense"}
              </h2>
              <p className="text-sm text-muted">Amounts keep historical FX snapshots.</p>
            </div>

            <input
              className="rounded-md border border-border px-3 py-2 text-sm"
              onChange={(event) =>
                setForm((current) => ({ ...current, campaignId: event.target.value }))
              }
              aria-label="Campaign ID"
              value={form.campaignId}
            />
            <input
              className="rounded-md border border-border px-3 py-2 text-sm"
              onChange={(event) =>
                setForm((current) => ({ ...current, expenseDate: event.target.value }))
              }
              type="date"
              value={form.expenseDate}
            />
            <input
              className="rounded-md border border-border px-3 py-2 text-sm"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  expenseCategoryId: event.target.value,
                }))
              }
              aria-label="Category ID"
              value={form.expenseCategoryId}
            />
            <input
              className="rounded-md border border-border px-3 py-2 text-sm"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  expenseDescription: event.target.value,
                }))
              }
              aria-label="Expense description"
              value={form.expenseDescription}
            />
            <input
              className="rounded-md border border-border px-3 py-2 text-sm"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  originalAmount: event.target.value,
                }))
              }
              aria-label="Expense amount"
              type="number"
              value={form.originalAmount}
            />
            <select
              className="rounded-md border border-border px-3 py-2 text-sm"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  currencyCode: event.target.value as "AUD" | "USD" | "TWD",
                }))
              }
              value={form.currencyCode}
            >
              <option value="AUD">AUD</option>
              <option value="USD">USD</option>
              <option value="TWD">TWD</option>
            </select>

            {error ? <p className="text-sm text-danger">{error}</p> : null}

            <div className="flex gap-2">
              <button
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                disabled={isSaving}
                type="submit"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
              <button
                className="rounded-md border border-border px-4 py-2 text-sm font-medium"
                onClick={() => setIsDrawerOpen(false)}
                type="button"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted">
            Select an expense or create a new one.
          </div>
        )}
      </aside>
    </div>
  );
}
```

- [ ] **Step 3: Run lint and build**

Run: `npm run lint`

Expected: exit 0.

Run: `$env:NODE_OPTIONS='--use-system-ca'; npm run build`

Expected: production build completes.

- [ ] **Step 4: Commit**

Run:

```bash
git add app/admin/expenses/page.tsx components/admin/ExpensesAdminClient.tsx
git commit -m "Add expenses admin UI"
```

Expected: commit succeeds with admin expense UI.

---

### Task 9: Environment Documentation

**Files:**
- Create or modify: `.env.example`

- [ ] **Step 1: Add admin environment variables**

If `.env.example` does not exist, create it. The file should include:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SUPABASE_SCHEMA=fund
SUPABASE_SERVICE_ROLE_KEY=
EXCHANGE_RATE_PROVIDER_URL=https://open.er-api.com/v6/latest/AUD
ADMIN_PASSWORD=
ADMIN_SESSION_SECRET=
```

- [ ] **Step 2: Verify `.env.example` does not contain secrets**

Run: `rg -n "SUPABASE_SERVICE_ROLE_KEY=.+|ADMIN_PASSWORD=.+|ADMIN_SESSION_SECRET=.+" .env.example`

Expected: no output.

- [ ] **Step 3: Commit**

Run:

```bash
git add .env.example
git commit -m "Document admin environment variables"
```

Expected: commit succeeds with environment documentation.

---

### Task 10: Final Verification

**Files:**
- Verify all files from previous tasks.

- [ ] **Step 1: Run all tests**

Run: `npm run test`

Expected: all Vitest suites pass.

- [ ] **Step 2: Run lint**

Run: `npm run lint`

Expected: exit 0.

- [ ] **Step 3: Run production build**

Run: `$env:NODE_OPTIONS='--use-system-ca'; npm run build`

Expected: production build completes.

- [ ] **Step 4: Start local production server**

Run: `Start-Process -FilePath npm.cmd -ArgumentList "run","start","--","-p","3002" -WorkingDirectory "C:\Users\vosto\LHDevStudio\Projects\carolina-care-fund-dashboard" -WindowStyle Hidden`

Expected: app starts on `http://127.0.0.1:3002`.

- [ ] **Step 5: Browser verification**

Open `http://127.0.0.1:3002/admin/login`.

Expected:

- Wrong password shows an error and stays on login.
- Correct password redirects to `/admin/expenses`.
- Expenses table renders.
- New expense drawer opens.
- Invalid payload shows inline error.
- Valid expense saves and appears in table.
- Edit changes the row.
- Soft delete requires a reason and marks the row deleted.
- Deleted filter shows the deleted row.
- Restore makes the row active again.

- [ ] **Step 6: Final commit if verification changed files**

Run: `git status --short`

Expected: no unstaged changes. If verification changed generated files, inspect them and either commit intentional changes or remove generated artifacts that are covered by `.gitignore`.

---

## Follow-Up Plans

After this MVP slice ships, create separate plans for:

- Donations admin CRUD using the same session, validation, service, audit, and snapshot patterns.
- Category and budget maintenance.
- Exchange-rate correction UI.
- Audit log browsing and row-level audit drawer.
