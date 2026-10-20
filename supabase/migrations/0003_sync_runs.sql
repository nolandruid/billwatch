-- sync_runs: one row per cron run of /api/cron/sync, so the daily health check can see how
-- long the sync takes against Vercel's 60s limit (issue #33). A run that hits the limit is
-- killed before it can write, which shows up as no recent row.
create table if not exists public.sync_runs (
  id                   uuid primary key default gen_random_uuid(),
  started_at           timestamptz not null,
  duration_ms          integer not null,  -- whole cron run: sync + email drain
  sync_ms              integer not null,  -- syncAll only: fetch + upsert + change detection
  ok                   boolean not null,
  error                text,
  fetched              integer not null default 0,
  inserted             integer not null default 0,
  changed              integer not null default 0,
  notifications_queued integer not null default 0,
  emails_sent          integer not null default 0
);

create index if not exists sync_runs_started_at_idx on public.sync_runs (started_at desc);

-- Service role only, like subscribers: no anon policies.
alter table public.sync_runs enable row level security;
