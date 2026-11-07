-- Email fallback + Linkup discovery (API_CONTRACTS.md §2).
-- brands.contact_email: customer-service email found by Linkup (or set by hand).
-- claims.submission_channel: how the complaint was actually sent.

alter table brands add column contact_email text;

alter table claims add column submission_channel text
  check (submission_channel in ('web_form', 'email'));
