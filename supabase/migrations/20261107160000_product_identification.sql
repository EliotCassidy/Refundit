-- Product identification, step 2 of the receipt parser (API_CONTRACTS.md §2-3). Owner: Dev 1.

-- line_items.product_candidates: top 5 products found for this receipt line (+ llm_guess, uncertainty).
--   Written by POST /api/receipts/:id/identify. Display only: never a result by itself.
-- line_items.confirmed_product: NULL until the user validates.
--   {"status":"confirmed", ean, brand, name, quantity, image_url, source} or {"status":"not_found"}.
--   This is the ONLY product field the claim agent may trust.
alter table line_items
  add column product_candidates jsonb,
  add column confirmed_product jsonb
    check (confirmed_product is null or confirmed_product->>'status' in ('confirmed', 'not_found'));

-- Shared cache of products confirmed by users: (store chain, normalized receipt label) -> EAN.
-- A confirmed match is ranked first next time, but the user still confirms: never auto-confirmed.
-- Service role only: RLS on, no policy (server routes /identify and /confirm).
create table product_matches (
  id uuid primary key default gen_random_uuid(),
  store_chain text not null default '',     -- normalized chain printed on the receipt ('' if none)
  label_key text not null,                  -- normalized raw_label (uppercase, no accents/punctuation)
  raw_label text not null,                  -- last raw label seen, exactly as printed
  ean text not null,
  product jsonb not null,                   -- same shape as a confirmed confirmed_product
  confirmations integer not null default 1,
  last_confirmed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (store_chain, label_key, ean)
);
create index product_matches_lookup_idx on product_matches(store_chain, label_key);
alter table product_matches enable row level security;
