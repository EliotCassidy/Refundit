-- Missing-info workflow (API_CONTRACTS.md §2): when a brand form requires data we don't have
-- (DLC/DDM, batch number, "do you still have the product?"…), the claim goes to 'waiting_input',
-- the dashboard asks the user, and the claim is resubmitted with the answers.

-- Labels of the fields to ask the user, as printed on the brand's form (French).
alter table claims add column missing_fields text[] not null default '{}';

-- The user's answers, keyed by field label: { "Numéro de lot": "L23-0412", … }.
alter table claims add column user_answers jsonb not null default '{}'::jsonb;
