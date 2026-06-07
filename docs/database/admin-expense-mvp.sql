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
    action in (
      'create',
      'update',
      'soft_delete',
      'restore',
      'exchange_rate_snapshot'
    )
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
join fund.expense_categories ec
  on ec.expense_category_id = e.expense_category_id;

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
grant execute on function fund.admin_insert_audit_log(
  text,
  text,
  text,
  jsonb,
  jsonb,
  text
) to service_role;

-- Public transparency views must filter deleted records with
-- `where deleted_at is null` once this migration is applied.
