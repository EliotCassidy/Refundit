-- Demo brand "NotCoca" (fictional) + Stripe payouts (API_CONTRACTS.md §2).

-- NotCoca's own consumer-service requests, filled by the H agent on /notcoca/contact.
-- Service role only (no RLS policy): the public form and the admin go through route handlers.
create table notcoca_requests (
  id uuid primary key default gen_random_uuid(),
  ticket_number text not null unique,            -- shown to the customer, e.g. NC-482913
  reason text not null,
  still_has_product text,                        -- "Oui" / "Non"
  drink text,
  packaging text,
  format text,
  quantity integer,
  best_before text,
  production_code text,
  store text,
  purchase_date date,
  message text not null,
  civility text,
  last_name text not null,
  first_name text not null,
  address text,
  postal_code text,
  city text,
  phone text,
  email text not null,
  status text not null default 'new' check (status in ('new', 'refunded', 'rejected')),
  refund_cents integer,
  compensation_cents integer,
  stripe_payment_id text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
alter table notcoca_requests enable row level security;

-- Stripe Connect (test mode): the user's connected account, and the payout received on a claim.
alter table profiles add column stripe_account_id text;
alter table claims add column refund_cents integer;
alter table claims add column stripe_payment_id text;
