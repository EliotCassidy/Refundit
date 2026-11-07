-- 0001_init: full schema from API_CONTRACTS.md §1–2.
-- Never edit this file once it is on main: add a new migration instead.

-- =========================================================
-- Enums
-- =========================================================
create type receipt_status as enum ('uploaded','parsing','parsed','failed');

create type issue_type as enum (
  'damaged','missing_quantity','expired','quality','foreign_object','flat_drink','other'
);

create type claim_status as enum (
  'draft','submitting','submitted','waiting_input','accepted','refused',
  'agent_failed','needs_manual','cancelled'
);

create type brand_source as enum ('seed','linkup','manual');

create type email_classification as enum (
  'acknowledgement','accepted','refused','waiting_input','other'
);

-- =========================================================
-- Helpers
-- =========================================================
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- =========================================================
-- profiles (owner: Dev 1)
-- =========================================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  phone text,
  address_line1 text not null,
  address_line2 text,
  postal_code text not null,
  city text not null,
  country text not null default 'FR',
  iban text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on profiles
  for each row execute function set_updated_at();

-- =========================================================
-- brands (owner: Dev 1)
-- =========================================================
create table brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  manufacturer text,
  aliases text[] not null default '{}',
  contact_url text,
  agent_hints text,
  requires_receipt_upload boolean not null default false,
  captcha_observed boolean not null default false,
  verified boolean not null default false,
  source brand_source not null,
  last_checked_at timestamptz,
  created_at timestamptz not null default now()
);

-- =========================================================
-- receipts (owner: Dev 1)
-- =========================================================
create table receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  image_path text not null,
  status receipt_status not null default 'uploaded',
  store_name text,
  purchased_at timestamptz,
  total_cents integer,
  currency text not null default 'EUR',
  raw_parse jsonb,
  error text,
  created_at timestamptz not null default now()
);
create index receipts_user_id_idx on receipts(user_id);

-- =========================================================
-- line_items (owner: Dev 1)
-- =========================================================
create table line_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references receipts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  position integer not null,
  raw_label text not null,
  product_name text not null,
  brand_id uuid references brands(id) on delete set null,
  brand_name_guess text,
  ean text,
  quantity numeric not null default 1,
  unit_price_cents integer,
  total_price_cents integer not null,
  created_at timestamptz not null default now()
);
create index line_items_receipt_id_idx on line_items(receipt_id);

-- =========================================================
-- claims (insert: Dev 1 as draft · later updates: Dev 2 via service role)
-- =========================================================
create table claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  receipt_id uuid not null references receipts(id) on delete cascade,
  line_item_id uuid not null references line_items(id) on delete cascade,
  brand_id uuid references brands(id) on delete set null,
  issue_type issue_type not null,
  issue_description text,
  issue_photo_path text,
  status claim_status not null default 'draft',
  inbound_alias text unique,
  complaint_text text,
  h_session_id text,
  h_agent_view_url text,
  attempt integer not null default 0,
  dry_run boolean not null default false,
  confirmation_number text,
  failure_reason text,
  submitted_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index claims_user_id_idx on claims(user_id);
create index claims_h_session_id_idx on claims(h_session_id);
create trigger claims_updated_at before update on claims
  for each row execute function set_updated_at();

-- =========================================================
-- claim_events (owner: Dev 2)
-- =========================================================
create table claim_events (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references claims(id) on delete cascade,
  type text not null check (type in ('status_change','agent_update','email_received','note')),
  from_status claim_status,
  to_status claim_status,
  payload jsonb,
  created_at timestamptz not null default now()
);
create index claim_events_claim_id_idx on claim_events(claim_id, created_at);

-- =========================================================
-- claim_emails (owner: Dev 2)
-- =========================================================
create table claim_emails (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid references claims(id) on delete cascade,
  provider_message_id text not null unique,
  from_address text not null,
  to_address text not null,
  subject text,
  body_text text,
  received_at timestamptz not null,
  classification email_classification,
  classification_reason text,
  created_at timestamptz not null default now()
);
create index claim_emails_claim_id_idx on claim_emails(claim_id, received_at);

-- =========================================================
-- Row Level Security (service role bypasses RLS)
-- =========================================================
alter table profiles     enable row level security;
alter table brands       enable row level security;
alter table receipts     enable row level security;
alter table line_items   enable row level security;
alter table claims       enable row level security;
alter table claim_events enable row level security;
alter table claim_emails enable row level security;

create policy "own profile" on profiles
  for all to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "brands readable" on brands
  for select to authenticated using (true);

create policy "own receipts" on receipts
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own line items" on line_items
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "read own claims" on claims
  for select to authenticated using (user_id = auth.uid());
create policy "insert own draft claims" on claims
  for insert to authenticated with check (user_id = auth.uid() and status = 'draft');

create policy "read own claim events" on claim_events
  for select to authenticated
  using (exists (select 1 from claims c where c.id = claim_id and c.user_id = auth.uid()));

create policy "read own claim emails" on claim_emails
  for select to authenticated
  using (exists (select 1 from claims c where c.id = claim_id and c.user_id = auth.uid()));

-- =========================================================
-- Storage: private bucket "receipts", paths start with {userId}/
-- =========================================================
insert into storage.buckets (id, name, public) values ('receipts', 'receipts', false)
  on conflict (id) do nothing;

create policy "read own receipt files" on storage.objects
  for select to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "upload own receipt files" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
