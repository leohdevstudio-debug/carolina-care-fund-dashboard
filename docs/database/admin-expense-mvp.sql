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

alter table if exists fund.expense
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_reason text,
  add column if not exists deleted_by text,
  add column if not exists aud_to_usd_rate numeric(18, 8),
  add column if not exists aud_to_twd_rate numeric(18, 8),
  add column if not exists exchange_rate_date date,
  add column if not exists exchange_rate_source text,
  add column if not exists exchange_rate_fetched_at timestamptz;

alter table if exists fund.expense_category
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_reason text,
  add column if not exists deleted_by text;

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
  e.created_on as created_at,
  e.updated_on as updated_at,
  e.deleted_at,
  e.deleted_reason,
  e.deleted_by
from fund.expense e
join fund.campaign c on c.campaign_id = e.campaign_id
join fund.expense_category ec
  on ec.expense_category_id = e.expense_category_id;

create or replace view fund.v_admin_expense_category as
select
  ec.expense_category_id,
  ec.category_name,
  ec.category_group,
  ec.created_on as created_at,
  ec.updated_on as updated_at,
  ec.deleted_at,
  ec.deleted_reason,
  ec.deleted_by
from fund.expense_category ec;

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

grant usage on schema fund to service_role;
grant select on fund.campaign to service_role;
grant select on fund.currency to service_role;
grant select, insert, update on fund.expense_category to service_role;
grant select on fund.v_admin_expense to service_role;
grant select on fund.v_admin_expense_category to service_role;
grant select, insert, update on fund.expense to service_role;
grant insert on fund.admin_audit_log to service_role;
grant usage, select on all sequences in schema fund to service_role;
grant execute on function fund.admin_insert_audit_log(
  text,
  text,
  text,
  jsonb,
  jsonb,
  text
) to service_role;

create or replace view fund.v_public_expense as
select
  e.expense_id,
  e.campaign_id,
  c.campaign_name,
  e.expense_date,
  cat.expense_category_id,
  cat.category_name,
  cat.category_group,
  e.expense_description,
  e.original_amount,
  e.currency_code,
  e.base_currency_amount
from fund.expense e
join fund.campaign c on c.campaign_id = e.campaign_id
join fund.expense_category cat
  on cat.expense_category_id = e.expense_category_id
where c.is_public = true
  and c.is_active = true
  and cat.deleted_at is null
  and e.deleted_at is null;

create or replace view fund.v_public_expense_by_category as
select
  e.campaign_id,
  cat.expense_category_id,
  cat.category_name,
  cat.category_group,
  sum(coalesce(e.base_currency_amount, 0::numeric)) as total_spent_base
from fund.expense e
join fund.campaign c on c.campaign_id = e.campaign_id
join fund.expense_category cat
  on cat.expense_category_id = e.expense_category_id
where c.is_public = true
  and c.is_active = true
  and cat.deleted_at is null
  and e.deleted_at is null
group by
  e.campaign_id,
  cat.expense_category_id,
  cat.category_name,
  cat.category_group;

create or replace view fund.v_public_budget_vs_spent as
select
  b.campaign_id,
  cat.expense_category_id,
  cat.category_name,
  cat.category_group,
  sum(coalesce(b.base_currency_amount, 0::numeric)) as total_budget_base,
  coalesce(exp.total_spent_base, 0::numeric) as total_spent_base,
  (
    sum(coalesce(b.base_currency_amount, 0::numeric)) -
    coalesce(exp.total_spent_base, 0::numeric)
  ) as variance_base
from fund.budget b
join fund.campaign c on c.campaign_id = b.campaign_id
join fund.expense_category cat
  on cat.expense_category_id = b.expense_category_id
left join (
  select
    e.campaign_id,
    e.expense_category_id,
    sum(coalesce(e.base_currency_amount, 0::numeric)) as total_spent_base
  from fund.expense e
  where e.deleted_at is null
  group by e.campaign_id, e.expense_category_id
) exp
  on exp.campaign_id = b.campaign_id
  and exp.expense_category_id = b.expense_category_id
where c.is_public = true
  and c.is_active = true
  and cat.deleted_at is null
group by
  b.campaign_id,
  cat.expense_category_id,
  cat.category_name,
  cat.category_group,
  exp.total_spent_base;

create or replace view fund.v_public_campaign_summary as
select
  c.campaign_id,
  c.campaign_name,
  c.beneficiary_name,
  c.target_amount,
  c.target_currency_code,
  coalesce(don.total_received_base, 0::numeric) as total_received_base,
  coalesce(alloc.total_allocated_base, 0::numeric) as total_allocated_base,
  coalesce(exp.total_spent_base, 0::numeric) as total_spent_base,
  (
    coalesce(don.total_received_base, 0::numeric) -
    coalesce(exp.total_spent_base, 0::numeric)
  ) as remaining_balance_base,
  (
    coalesce(don.total_received_base, 0::numeric) -
    coalesce(alloc.total_allocated_base, 0::numeric)
  ) as unallocated_balance_base
from fund.campaign c
left join (
  select
    d.campaign_id,
    sum(coalesce(d.base_currency_amount, 0::numeric)) as total_received_base
  from fund.donation d
  where d.is_confirmed = true
  group by d.campaign_id
) don on don.campaign_id = c.campaign_id
left join (
  select
    fa.campaign_id,
    sum(coalesce(fa.base_currency_amount, 0::numeric)) as total_allocated_base
  from fund.fund_allocation fa
  group by fa.campaign_id
) alloc on alloc.campaign_id = c.campaign_id
left join (
  select
    e.campaign_id,
    sum(coalesce(e.base_currency_amount, 0::numeric)) as total_spent_base
  from fund.expense e
  join fund.expense_category cat
    on cat.expense_category_id = e.expense_category_id
  where e.deleted_at is null
    and cat.deleted_at is null
  group by e.campaign_id
) exp on exp.campaign_id = c.campaign_id
where c.is_public = true
  and c.is_active = true;

grant select on fund.v_public_expense to anon;
grant select on fund.v_public_expense_by_category to anon;
grant select on fund.v_public_budget_vs_spent to anon;
grant select on fund.v_public_campaign_summary to anon;
