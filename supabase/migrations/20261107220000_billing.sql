-- Billing (Stripe, test mode): 1 free receipt scan per calendar month; unlimited with the
-- "Refundit Illimité" subscription (€9.99/month). Usage = receipts created this month.
alter table profiles add column stripe_customer_id text;
alter table profiles add column subscription_status text;        -- Stripe status: active, trialing, past_due, canceled…
alter table profiles add column subscription_period_end timestamptz;
