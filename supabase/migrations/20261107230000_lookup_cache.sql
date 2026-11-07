-- Product search cache + manual confirmations (API_CONTRACTS.md §2). Owner: Dev 1.

-- Persistent cache of product lookups (Open Food Facts, Open Beauty Facts, Open Prices, LLM label expansions,
-- Linkup) for production, where Vercel has no disk. Only real answers are stored: never an error, a 429/5xx
-- or a timeout. Empty answers ("not found") are flagged and expire after 24 h (filter on created_at).
-- Service role only (RLS on, no policy). Written with upsert on key.
create table lookup_cache (
  key text primary key,                       -- sha1 of the request (URL, LLM prompt, Linkup query)
  value jsonb,                                -- the answer (null = 404 / not found)
  empty boolean not null default false,       -- true = "not found" / empty result: expires after 24 h
  created_at timestamptz not null default now()
);
alter table lookup_cache enable row level security;

-- Only explicit user choices (a click on a candidate, a typed barcode) count. Automatic validations never write
-- to product_matches, so the "already confirmed" shortcut can't feed itself or freeze a wrong guess.
-- Existing rows (tests + automatic validations) keep 0 and are ignored until a user confirms them again.
alter table product_matches add column manual_confirmations integer not null default 0;
