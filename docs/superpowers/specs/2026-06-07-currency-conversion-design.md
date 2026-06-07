# Currency Conversion Design

## Context

The dashboard currently reports financial values in AUD. The code already treats AUD as the base reporting currency through `BASE_CURRENCY` in `lib/format.ts`, and public Supabase views expose monetary fields such as `original_amount`, `currency_code`, and `base_currency_amount`.

The requested change is to let visitors switch the displayed currency between AUD, USD, and TWD, while preserving accurate historical exchange information for expenses and donations.

## Goals

- Keep AUD as the official accounting and reporting currency.
- Let visitors switch displayed dashboard values between AUD, USD, and TWD.
- Fetch a fresh exchange rate when the visitor changes the display currency, subject to server-side caching.
- Store historical AUD-to-USD and AUD-to-TWD exchange rates for the financial date of each new donation or expense.
- Make converted values transparent as approximate display values, not official bank-settled amounts.

## Non-Goals

- Do not change the official accounting base away from AUD.
- Do not recalculate historical accounting records using today's exchange rate.
- Do not add fixed `amount_usd` and `amount_twd` columns to every transaction table unless the database already strongly favors that pattern.
- Do not expose exchange-rate provider credentials to the browser.

## Recommended Approach

Use AUD as the source of truth and add a display-currency layer.

The browser keeps a selected display currency: `AUD`, `USD`, or `TWD`. When the visitor selects USD or TWD, the client calls an internal Next.js API route. That route returns the latest cached AUD exchange rates and metadata such as source and fetch time. Dashboard values that come from `*_base` fields are converted on the client for display.

Historical transaction rates should be stored separately by date and currency pair. When a donation or expense is created, the backend should ensure exchange-rate rows exist for the transaction's financial date:

- Donations use `received_date`.
- Expenses use `expense_date`.

This keeps historical audit data stable while allowing current display conversion to stay fresh.

## Data Model

Add an exchange-rate table in the Supabase `fund` schema:

```sql
create table fund.exchange_rates (
  exchange_rate_id bigint generated always as identity primary key,
  rate_date date not null,
  base_currency_code text not null,
  quote_currency_code text not null,
  rate numeric(18, 8) not null,
  source text not null,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (rate_date, base_currency_code, quote_currency_code)
);
```

Expected rows for each relevant date:

- `AUD -> USD`
- `AUD -> TWD`

Rates should be decimal values where:

```text
converted_amount = aud_amount * rate
```

For example, if `AUD -> USD = 0.66`, then `100 AUD` displays as about `66 USD`.

## API Design

Add an internal route:

```text
GET /api/exchange-rates?base=AUD&quotes=USD,TWD
```

Response shape:

```json
{
  "baseCurrency": "AUD",
  "rates": {
    "AUD": 1,
    "USD": 0.66,
    "TWD": 21.2
  },
  "source": "configured-exchange-rate-provider",
  "fetchedAt": "2026-06-07T13:30:00Z",
  "isFallback": false
}
```

Behavior:

- Return `AUD: 1` without calling an external provider.
- Use server-side caching for current rates.
- If fresh fetch fails, return the last known stored rate and set `isFallback: true`.
- If no stored rate exists, return a clear error so the UI can keep showing AUD.

## Frontend Design

Add a currency selector near the existing language selector:

```text
AUD | USD | TWD
```

Display rules:

- Default to AUD.
- Save the selected currency in `localStorage`.
- Show loading state only for USD/TWD rate fetches.
- Convert summary cards, progress amounts, chart values, and base amount columns from AUD.
- Keep original transaction amount columns in their original currency.
- Rename table label `Base amount` to `Reported amount` or `Displayed amount` once conversion is enabled.
- Update the footer to show the selected currency and rate metadata.

Footer example:

```text
Amounts shown in USD are approximate conversions from AUD. Rate updated Jun 7, 2026.
```

If fallback data is used:

```text
Amounts shown in USD use the latest available saved rate from Jun 7, 2026.
```

## Historical Rate Workflow

When creating a new donation or expense:

1. Read the financial date from `received_date` or `expense_date`.
2. Ensure exchange-rate rows exist for `AUD -> USD` and `AUD -> TWD` on that date.
3. Store the rates in `fund.exchange_rates`.
4. Store transaction amounts in the existing original currency and AUD base fields.
5. Do not mutate historical exchange-rate rows after insertion unless an admin deliberately corrects bad data.

This provides an audit trail without duplicating converted amounts across transaction tables.

## Error Handling

- If live exchange rates fail, use the last saved rate and mark it as fallback.
- If no saved rate exists, leave display currency as AUD and show a small warning.
- Never block the dashboard from loading because the exchange-rate provider is unavailable.
- Log provider errors server-side only.

## Testing

Add focused tests or manual verification for:

- `AUD` selection does not call the exchange-rate API.
- `USD` and `TWD` selection fetch rates and convert summary values.
- Charts receive converted values and display the selected currency.
- Original transaction amounts remain unchanged.
- Fallback rate messaging appears when live fetch fails.
- Missing-rate errors keep the UI usable in AUD.

## Observations

The message files currently appear to contain mojibake in Spanish and Traditional Chinese strings. This is separate from currency conversion, but it should be fixed before or during any localization polish because new currency messages will otherwise inherit an already fragile translation setup.

## Decision: Historical Rate Date

Use the transaction's financial date for historical rates:

- `received_date` for donations.
- `expense_date` for expenses.

If the business rule changes later to use the date when the record is entered into the system, update this spec and the implementation plan before changing code.
