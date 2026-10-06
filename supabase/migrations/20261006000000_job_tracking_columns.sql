-- Columns the tech app writes when starting/completing a job.
-- Without these, the Start Job and Complete Job updates fail (Postgres error 42703).
alter table public.jobs
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists time_spent_seconds integer,
  add column if not exists customer_signature_name text;
