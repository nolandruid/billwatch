-- Per-subscription notification preference (issue #22).
--   all        every status change (the original behaviour, and the default)
--   milestones passed a chamber or received Royal Assent
--   law        received Royal Assent
--   died       defeated, withdrawn or not proceeded with
alter table public.subscriptions
  add column if not exists notify_on text not null default 'all'
    check (notify_on in ('all', 'milestones', 'law', 'died'));
