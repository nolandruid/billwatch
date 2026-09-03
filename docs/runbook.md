# Operations runbook

Practical guide for running and recovering BillWatch. Pairs with
[`architecture.md`](./architecture.md).

## Environment variables

All secrets live in Vercel project settings (and `.env.local` for local dev). See
[`.env.example`](../.env.example) for the full list and descriptions. Never commit real
values; only `.env.example` is tracked.

| Variable                        | Where used        | Notes                              |
| ------------------------------- | ----------------- | ---------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | client + server   | Public.                            |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client            | Public; RLS-restricted.            |
| `SUPABASE_SERVICE_ROLE_KEY`     | server only       | Bypasses RLS. Keep secret.         |
| `RESEND_API_KEY`                | notifier (server) | Email delivery.                    |
| `CRON_SECRET`                   | cron route        | Bearer token guarding `/api/cron/*`. |
| `NEXT_PUBLIC_TALLY_FORM_ID`     | feedback (client) | Public Tally form id; opens the feedback popup. |
| `NEXT_PUBLIC_SITE_URL`          | email links       | Public base URL.                   |

## The sync job

- **Schedule:** daily at 23:00 UTC via Vercel Cron (`vercel.json`). That is 6:00pm
  America/Toronto during EST (UTC−5, roughly November–March) and 7:00pm during EDT
  (UTC−4, roughly March–November). Vercel Cron is UTC-only, so the Ottawa clock
  hour shifts by one hour at the DST transitions. Chosen as an evening slot after
  5pm Ottawa so status-change emails land when people check inboxes later in the
  day, and so the sitting-end digest can run after typical House/Senate hours.
- **Endpoint:** `POST`/`GET` `/api/cron/sync`, requires `Authorization: Bearer $CRON_SECRET`.
- **What it does:** pulls each session in `ACTIVE_SESSIONS` ([`src/lib/sync.ts`](../src/lib/sync.ts)),
  upserts bills, logs status changes, queues per-bill notifications, drains that
  outbox, then sends the sitting-end digest to confirmed `digest_opt_in`
  subscribers if any bills moved that Ottawa calendar day.
- **Run manually:**
  ```bash
  curl -X POST "$NEXT_PUBLIC_SITE_URL/api/cron/sync" -H "Authorization: Bearer $CRON_SECRET"
  ```
  Response is JSON: `{ ok, results, notified, digest }`.

## Database migrations

Apply `supabase/migrations/` in order against the Supabase project (Studio SQL
editor or the CLI). `0002_sitting_digest.sql` adds `subscribers.digest_opt_in`
(default false) and `digest_outbox`. Deploy the app only after 0002 has been
applied, or digest enqueue will fail.

## Adding a new parliamentary session

When Parliament opens a new session, add its code (e.g. `"46-1"`) to `ACTIVE_SESSIONS` in
[`src/lib/sync.ts`](../src/lib/sync.ts) and deploy. No schema change needed.

## Common situations

**LEGISinfo returns an error / times out.**
The sync throws and returns HTTP 500; no partial-bad data is written (each bill is upserted
independently, changes are only logged on a real diff). The next scheduled run self-heals. If
LEGISinfo's JSON shape changed, fix [`src/lib/legisinfo.ts`](../src/lib/legisinfo.ts).

**A status change didn't notify someone.**
Check, in order: (1) is the subscriber `confirmed = true`? (2) is there a `subscriptions` row
linking them to the bill? (3) is there a `bill_status_history` row for the change? (4) is there
a `notifications_outbox` row, and what is its `state` / `last_error`?

**A digest didn't go out.**
Check, in order: (1) did any `bill_status_history` rows have `detected_at` on
today's America/Toronto date? (no movement = no digest); (2) is the subscriber
`confirmed = true` and `digest_opt_in = true`? (per-bill subscribe does not set
this); (3) is there a `digest_outbox` row for that `sitting_date`, and what is
its `state` / `last_error`?

**Suspected duplicate or missed sync.**
Re-running sync is safe: bill upserts are idempotent, the
`notifications_outbox (subscriber_id, status_history_id)` unique constraint prevents
double-queuing, and `digest_outbox (subscriber_id, sitting_date)` prevents a second
digest the same sitting day.

**Rotating a secret.**
Update it in Vercel, redeploy. For `CRON_SECRET`, update the Vercel Cron config too.

## Backups

Supabase provides managed Postgres backups. The `source_json` column on `bills` retains the
raw LEGISinfo snapshot for audit/replay.
