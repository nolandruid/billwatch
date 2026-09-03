-- Sitting-end digest (issue #34).
-- Opt-in list-wide newsletter, separate from per-bill status emails.
-- digest_opt_in defaults to false so existing per-bill subscribers are not enrolled.

alter table public.subscribers
  add column if not exists digest_opt_in boolean not null default false;

-- One digest email per subscriber per Ottawa sitting date. Unique constraint makes
-- evening-cron retries idempotent (same pattern as notifications_outbox).
create table if not exists public.digest_outbox (
  id            uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null references public.subscribers (id) on delete cascade,
  sitting_date  date not null,
  state         text not null default 'pending'
                  check (state in ('pending', 'sent', 'failed')),
  attempts      integer not null default 0,
  last_error    text,
  sent_at       timestamptz,
  created_at    timestamptz not null default now(),
  unique (subscriber_id, sitting_date)
);

create index if not exists digest_outbox_state_idx
  on public.digest_outbox (state, created_at);

create index if not exists subscribers_digest_opt_in_idx
  on public.subscribers (id)
  where digest_opt_in = true and confirmed = true;

alter table public.digest_outbox enable row level security;
-- No anon/authenticated policies: service-role only, same as notifications_outbox.
