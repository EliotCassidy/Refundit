-- Civility collected at onboarding: brand forms often require it, and the agent must never guess it.
-- "if not exists": a first push under a clashing version number already created the column.
alter table profiles add column if not exists civility text check (civility in ('madame', 'monsieur', 'autre'));
