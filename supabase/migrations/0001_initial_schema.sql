-- BillWatch initial schema (v0.1)
-- Federal bill tracking + double-opt-in email subscriptions + notification outbox.
--
-- Security model:
--   * Anon (browser) clients use the Supabase anon key and may only do tightly-scoped
--     things via RLS policies below (read public bill data; nothing else).
--   * All privileged writes (sync job, subscribe/confirm, notifier) go through Next.js
--     server routes using the SERVICE ROLE key, which bypasses RLS. Server code is
--     responsible for validating input.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- bills: one row per federal bill, mirrored from LEGISinfo.
-- ---------------------------------------------------------------------------
create table if not exists public.bills (
  id              uuid primary key default gen_random_uuid(),
  bill_number     text not null,            -- e.g. 'C-15', 'S-216'
  parliament      integer not null,         -- e.g. 45
  session         integer not null,         -- e.g. 1
  title           text not null,
  short_title     text,
  sponsor         text,
  categories      text[] not null default '{}',
  current_status  text,                     -- human-readable LEGISinfo status
  current_stage   text,                     -- normalized stage (e.g. 'second_reading_senate')
  chamber         text,                     -- 'house' | 'senate' | null
  legisinfo_url   text not null,
  source_json     jsonb,                    -- raw LEGISinfo snapshot for debugging/audit
  last_synced_at  timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- A bill number is unique within a given parliament+session.
  unique (parliament, session, bill_number)
);

create index if not exists bills_bill_number_idx on public.bills (bill_number);
create index if not exists bills_categories_idx on public.bills using gin (categories);
-- Trigram search over title for topic/keyword lookups.
create extension if not exists "pg_trgm";
create index if not exists bills_title_trgm_idx on public.bills using gin (title gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- bill_status_history: append-only log of status changes (powers timelines + alerts).
-- ---------------------------------------------------------------------------
create table if not exists public.bill_status_history (
  id           uuid primary key default gen_random_uuid(),
  bill_id      uuid not null references public.bills (id) on delete cascade,
  status       text,
  stage        text,
  chamber      text,
  changed_at   timestamptz,                 -- when Parliament records the change (if known)
  detected_at  timestamptz not null default now() -- when our sync first saw it
);

create index if not exists bill_status_history_bill_id_idx
  on public.bill_status_history (bill_id, detected_at desc);

-- ---------------------------------------------------------------------------
-- subscribers: one row per email. Double opt-in lives here.
-- ---------------------------------------------------------------------------
create table if not exists public.subscribers (
  id                uuid primary key default gen_random_uuid(),
  email             text not null unique,
  confirmed         boolean not null default false,
  confirm_token     uuid not null default gen_random_uuid(),
  unsubscribe_token uuid not null default gen_random_uuid(),
  confirmed_at      timestamptz,
  created_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- subscriptions: many-to-many between subscribers and bills.
-- ---------------------------------------------------------------------------
create table if not exists public.subscriptions (
  id            uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null references public.subscribers (id) on delete cascade,
  bill_id       uuid not null references public.bills (id) on delete cascade,
  created_at    timestamptz not null default now(),
  unique (subscriber_id, bill_id)
);

create index if not exists subscriptions_bill_id_idx on public.subscriptions (bill_id);
create index if not exists subscriptions_subscriber_id_idx on public.subscriptions (subscriber_id);

-- ---------------------------------------------------------------------------
-- notifications_outbox: queue of emails to send on a status change.
-- ---------------------------------------------------------------------------
create table if not exists public.notifications_outbox (
  id                uuid primary key default gen_random_uuid(),
  subscriber_id     uuid not null references public.subscribers (id) on delete cascade,
  bill_id           uuid not null references public.bills (id) on delete cascade,
  status_history_id uuid not null references public.bill_status_history (id) on delete cascade,
  state             text not null default 'pending'
                      check (state in ('pending', 'sent', 'failed')),
  attempts          integer not null default 0,
  last_error        text,
  sent_at           timestamptz,
  created_at        timestamptz not null default now(),
  -- Never enqueue the same change twice for the same subscriber.
  unique (subscriber_id, status_history_id)
);

create index if not exists notifications_outbox_state_idx
  on public.notifications_outbox (state, created_at);

-- ---------------------------------------------------------------------------
-- updated_at trigger for bills.
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists bills_set_updated_at on public.bills;
create trigger bills_set_updated_at
  before update on public.bills
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.bills                enable row level security;
alter table public.bill_status_history  enable row level security;
alter table public.subscribers          enable row level security;
alter table public.subscriptions        enable row level security;
alter table public.notifications_outbox enable row level security;

-- Public, read-only access to bill data and history (this is open government data).
drop policy if exists "bills are publicly readable" on public.bills;
create policy "bills are publicly readable"
  on public.bills for select
  to anon, authenticated
  using (true);

drop policy if exists "bill history is publicly readable" on public.bill_status_history;
create policy "bill history is publicly readable"
  on public.bill_status_history for select
  to anon, authenticated
  using (true);

-- subscribers, subscriptions, notifications_outbox have NO anon/authenticated policies:
-- with RLS enabled and no permissive policy, all anon access is denied. Only the
-- service-role key (used by trusted server routes) can read/write these tables.
