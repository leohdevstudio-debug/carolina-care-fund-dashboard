create schema if not exists fund;

create table if not exists fund.exchange_rates (
  exchange_rate_id bigint generated always as identity primary key,
  rate_date date not null,
  base_currency_code text not null,
  quote_currency_code text not null,
  rate numeric(18, 8) not null,
  source text not null,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint exchange_rates_positive_rate check (rate > 0),
  constraint exchange_rates_supported_base check (base_currency_code = 'AUD'),
  constraint exchange_rates_supported_quote check (
    quote_currency_code in ('USD', 'TWD')
  ),
  constraint exchange_rates_unique_pair_per_date unique (
    rate_date,
    base_currency_code,
    quote_currency_code
  )
);

alter table fund.exchange_rates enable row level security;

drop policy if exists "Public can read exchange rates" on fund.exchange_rates;

create policy "Public can read exchange rates"
on fund.exchange_rates
for select
using (true);

create or replace view fund.v_public_latest_exchange_rate as
select distinct on (base_currency_code, quote_currency_code)
  rate_date,
  base_currency_code,
  quote_currency_code,
  rate,
  source,
  fetched_at
from fund.exchange_rates
where base_currency_code = 'AUD'
  and quote_currency_code in ('USD', 'TWD')
order by
  base_currency_code,
  quote_currency_code,
  rate_date desc,
  fetched_at desc;

create or replace function fund.get_exchange_rate_for_date(
  p_rate_date date,
  p_quote_currency_code text
)
returns table (
  rate_date date,
  base_currency_code text,
  quote_currency_code text,
  rate numeric,
  source text,
  fetched_at timestamptz
)
language sql
stable
as $$
  select
    er.rate_date,
    er.base_currency_code,
    er.quote_currency_code,
    er.rate,
    er.source,
    er.fetched_at
  from fund.exchange_rates er
  where er.base_currency_code = 'AUD'
    and er.quote_currency_code = p_quote_currency_code
    and er.rate_date <= p_rate_date
  order by er.rate_date desc, er.fetched_at desc
  limit 1
$$;

grant select on fund.exchange_rates to anon;
grant select on fund.v_public_latest_exchange_rate to anon;
grant execute on function fund.get_exchange_rate_for_date(date, text) to anon;

-- Operational rule:
-- When a donation is inserted, ensure rows exist for received_date with
-- quote_currency_code values 'USD' and 'TWD'.
-- When an expense is inserted, ensure rows exist for expense_date with
-- quote_currency_code values 'USD' and 'TWD'.
-- Existing transaction creation code is not present in this repo, so this
-- schema artifact is the handoff point for the Supabase-side process.
