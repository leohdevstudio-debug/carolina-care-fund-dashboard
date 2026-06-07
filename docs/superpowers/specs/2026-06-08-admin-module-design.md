# Admin Module Design Spec

## Context

The current app is a public read-only dashboard. It reads from Supabase REST views in the `fund` schema through `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_SUPABASE_SCHEMA`.

Current public data access is intentionally narrow:

- `services/dashboard.ts` reads `v_public_campaign_summary`.
- `services/dashboard.ts` reads `v_public_expense_by_category`.
- `services/dashboard.ts` reads `v_public_budget_vs_spent`.
- `services/dashboard.ts` reads `v_public_donation`.
- `services/dashboard.ts` reads `v_public_expense`.
- `docs/database/exchange-rates.sql` defines `fund.exchange_rates`, `fund.v_public_latest_exchange_rate`, and `fund.get_exchange_rate_for_date`.

The repository does not currently include the base table schema for donations, expenses, categories, budgets, campaigns, or audit logging. Because of that, the admin module must start by defining or confirming the writable database contract before UI mutations are implemented.

## Goals

- Add a private `/admin` area for one administrator.
- Authenticate the admin with a password stored in server-only environment variables.
- Support create, read, update, soft delete, and restore for financial records.
- Start with a table plus right-side edit panel layout.
- Keep the public dashboard read-only and isolated from admin mutations.
- Ensure deleted records are hidden from public views.
- Store exchange-rate snapshots for USD and TWD on every donation and expense record at creation time.
- Preserve a durable audit trail for inserts, updates, soft deletes, restores, and exchange-rate corrections.
- Keep the implementation small enough for a personal admin workflow.

## Non-Goals

- No multi-user account system in the first version.
- No role matrix or permission editor.
- No Supabase Auth requirement in the first version.
- No hard delete action in the admin UI.
- No bulk spreadsheet-style editing in the first version.
- No direct browser writes to Supabase using public keys.

## Recommended MVP Scope

The first implementation should ship in this order:

1. Admin authentication, session cookie, protected admin shell, and protected admin API routes.
2. Expenses table, filters, create, edit, soft delete, and restore.
3. Donations table, filters, create, edit, soft delete, and restore.
4. Categories and budgets with conservative editing controls.
5. Exchange-rate management for historical correction and manual review.
6. Audit log browsing.

This order makes expenses the first complete vertical slice. It proves auth, server-side writes, validation, exchange-rate snapshots, soft delete, and audit logging before duplicating the same pattern for donations.

## Authentication

Use server-only environment variables:

- `ADMIN_PASSWORD`: the admin password for the MVP.
- `ADMIN_SESSION_SECRET`: a long random secret used to sign the session cookie.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only Supabase key used only by admin API routes.

Recommended behavior:

- Add `/admin/login`.
- Add `/api/admin/login`.
- Add `/api/admin/logout`.
- Add `/api/admin/session`.
- Compare the submitted password on the server.
- Use a signed HTTP-only cookie for the admin session.
- Use `sameSite: "lax"`.
- Use `secure: true` when `NODE_ENV === "production"`.
- Set a short absolute session lifetime, such as 8 hours.
- Never expose `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, or `SUPABASE_SERVICE_ROLE_KEY` to client components.

For a personal dashboard, plain `ADMIN_PASSWORD` in `.env` is acceptable for the first version. For a hosted production version, the next hardening step should be `ADMIN_PASSWORD_HASH` with a slow password hash, plus basic login throttling.

## Server-Side Data Access

The admin module should not reuse `lib/supabase.ts` for writes because that helper is built around public anonymous reads.

Create a server-only admin data helper that:

- Reads `NEXT_PUBLIC_SUPABASE_URL`.
- Reads `SUPABASE_SERVICE_ROLE_KEY`.
- Uses the `fund` schema through the correct PostgREST profile headers.
- Sends `apikey` and `Authorization: Bearer <service role key>` only from route handlers.
- Returns structured errors instead of raw Supabase response text where possible.

Public dashboard reads should continue using the anonymous key and public views.

## Admin UI

Use option A: table plus right-side panel.

Layout:

- `/admin` redirects to `/admin/expenses`.
- Left navigation contains Expenses, Donations, Categories, Budgets, Exchange Rates, and Audit.
- Main area contains a dense table optimized for scanning.
- Right-side drawer handles create and edit.
- Filters sit above the table.
- Row actions stay compact: edit, soft delete, restore, and view audit.

Expected table features:

- Search by description, donor name, category, campaign, or note.
- Filter by active, deleted, or all.
- Filter by campaign.
- Filter by category for expenses.
- Filter by date range.
- Sort by date and amount.
- Pagination or capped page size.

Expected drawer behavior:

- Create mode opens with empty fields.
- Edit mode opens with current values.
- Save validates before sending.
- Failed save keeps the drawer open and shows inline errors.
- Successful save refreshes the table and closes the drawer.
- Soft delete requires a confirmation and reason.
- Restore requires confirmation.

## Database Model

The admin should write to base tables, not public views. The exact table names need to be confirmed against Supabase before implementation. The recommended contract is:

- `fund.campaigns`
- `fund.donations`
- `fund.expenses`
- `fund.expense_categories`
- `fund.budgets` or `fund.budget_allocations`
- `fund.exchange_rates`
- `fund.admin_audit_log`

Every admin-managed financial table should include:

- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `deleted_at timestamptz`
- `deleted_reason text`
- `deleted_by text`

For donations and expenses, store exchange-rate snapshots directly on the record:

- `aud_to_usd_rate numeric(18, 8)`
- `aud_to_twd_rate numeric(18, 8)`
- `exchange_rate_date date`
- `exchange_rate_source text`
- `exchange_rate_fetched_at timestamptz`

This intentionally duplicates the rate into the financial record. It is the correct tradeoff here because financial records need an audit-safe historical snapshot, not just a live join to whatever the current rate table returns.

## Public View Rules

All public views should exclude soft-deleted rows:

- `where deleted_at is null` on expenses.
- `where deleted_at is null` on donations.
- `where deleted_at is null` on categories if categories can be deleted.
- `where deleted_at is null` on budgets if budgets can be deleted.

The public dashboard should never query admin tables directly from the browser.

## Exchange-Rate Rules

For live public currency switching:

- Continue using the current latest-rate flow for AUD to USD and AUD to TWD.
- If the selector is changed, fetch the latest rates server-side through the existing API.

For admin inserts and edits:

- Donations use `received_date` as the financial date.
- Expenses use `expense_date` as the financial date.
- When a donation or expense is created, ensure AUD to USD and AUD to TWD rates exist for the financial date.
- If a rate is missing, fetch it, insert it into `fund.exchange_rates`, then copy the rate values into the financial record snapshot fields.
- If an existing financial record changes date or currency amount, update the exchange-rate snapshot and write an audit event.
- If only descriptive fields change, keep the original exchange-rate snapshot unchanged.

For manual exchange-rate correction:

- Admin can edit a rate row.
- Editing a historical rate does not silently rewrite existing financial records.
- A separate explicit recalculation action should be required if historical records ever need to be updated.
- Every correction writes old and new values into the audit log.

## Audit Log

Create `fund.admin_audit_log` with fields equivalent to:

- `audit_id bigint generated always as identity primary key`
- `entity_table text not null`
- `entity_id text not null`
- `action text not null`
- `old_data jsonb`
- `new_data jsonb`
- `reason text`
- `actor text not null default 'admin'`
- `created_at timestamptz not null default now()`

Supported actions:

- `create`
- `update`
- `soft_delete`
- `restore`
- `exchange_rate_correction`

The mutation should fail if the audit write fails. For financial data, audit logging is part of the transaction, not a best-effort side effect.

## Validation

Validate on the server before writing:

- Amounts must be positive.
- Dates must be valid ISO dates.
- Currency code must be supported by the app.
- Expense category must exist and be active.
- Campaign must exist and be active.
- Donation donor display name can be optional only if the public display fallback is defined.
- Soft delete requires a non-empty reason.
- Restore is blocked if the parent campaign or category is deleted.
- Exchange rates must be positive.

Client-side validation can improve UX, but server-side validation is authoritative.

## API Surface

Recommended route handlers:

- `POST /api/admin/login`
- `POST /api/admin/logout`
- `GET /api/admin/session`
- `GET /api/admin/expenses`
- `POST /api/admin/expenses`
- `PATCH /api/admin/expenses/[id]`
- `POST /api/admin/expenses/[id]/soft-delete`
- `POST /api/admin/expenses/[id]/restore`
- `GET /api/admin/donations`
- `POST /api/admin/donations`
- `PATCH /api/admin/donations/[id]`
- `POST /api/admin/donations/[id]/soft-delete`
- `POST /api/admin/donations/[id]/restore`
- `GET /api/admin/categories`
- `POST /api/admin/categories`
- `PATCH /api/admin/categories/[id]`
- `POST /api/admin/categories/[id]/soft-delete`
- `POST /api/admin/categories/[id]/restore`
- `GET /api/admin/budgets`
- `POST /api/admin/budgets`
- `PATCH /api/admin/budgets/[id]`
- `GET /api/admin/exchange-rates`
- `PATCH /api/admin/exchange-rates/[id]`
- `GET /api/admin/audit`

Every route except login must require the admin session cookie.

## UX Recommendations

- Do not expose the admin link in the public dashboard navigation.
- Use compact tables and practical controls instead of marketing-style cards.
- Show totals for the current filtered result at the top of Expenses and Donations.
- Show deleted records with muted styling and a clear deleted timestamp.
- Keep destructive actions behind explicit confirmations.
- Show when a record has historical exchange-rate snapshots.
- Show audit history from the row action so corrections are easy to understand.

## Testing Strategy

Before implementation is considered complete:

- Add tests for session signing and verification.
- Add tests for admin route auth blocking.
- Add tests for expense validation.
- Add tests for donation validation.
- Add tests for soft delete requiring a reason.
- Add tests for exchange-rate snapshot decisions.
- Run `npm run test`.
- Run `npm run lint`.
- Run `npm run build` with `NODE_OPTIONS=--use-system-ca` if local certificates require it.
- Verify login, create, edit, soft delete, restore, and filtering in the browser.

## Implementation Prerequisites

Before writing the admin API routes, confirm or add database SQL for the writable base tables. The current repository only includes the exchange-rate SQL artifact, so the next implementation plan should start with a database contract task.

The safest next step is to create a focused implementation plan for the MVP vertical slice:

1. Auth and admin shell.
2. Expense CRUD with soft delete.
3. Expense exchange-rate snapshots.
4. Expense audit logging.

After that slice works, donations can reuse the same route, validation, drawer, audit, and snapshot patterns.
