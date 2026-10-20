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
| `OWNER_NOTIFY_EMAIL`            | owner emails      | Gets signup alerts and the weekly status report. Unset turns both off. |

## The sync job

- **Schedule:** daily at 23:00 UTC via Vercel Cron (`vercel.json`). That is 6:00pm
  America/Toronto during EST (UTC−5, roughly November–March) and 7:00pm during EDT
  (UTC−4, roughly March–November). Vercel Cron is UTC-only, so the Ottawa clock
  hour shifts by one hour at the DST transitions. Chosen as an evening slot after
  5pm Ottawa so status-change emails land when people check inboxes later in the
  day, and so a future sitting-end digest can run after typical House/Senate hours.
- **Endpoint:** `POST`/`GET` `/api/cron/sync`, requires `Authorization: Bearer $CRON_SECRET`.
- **What it does:** pulls each session in `ACTIVE_SESSIONS` ([`src/lib/sync.ts`](../src/lib/sync.ts)),
  upserts bills, logs status changes, queues notifications.
- **Run manually:**
  ```bash
  curl -X POST "$NEXT_PUBLIC_SITE_URL/api/cron/sync" -H "Authorization: Bearer $CRON_SECRET"
  ```
  Response is JSON: `{ ok, results: [{ session, fetched, inserted, changed, notificationsQueued }] }`.

## Daily health check

`.github/workflows/health.yml` runs at 01:17 UTC (about two hours after the sync) and on
demand from the Actions tab. It fails if:

- the homepage isn't returning 200;
- `/api/health` reports the last sync is over 12 hours old, the bills table is empty, or
  notification emails failed or sat pending for over a day;
- the latest cron run in `sync_runs` failed, took over 45 seconds (Vercel stops the route at
  60s), or is over 12 hours old. Each run records its total and sync-only durations and
  fetched/inserted/changed/queued/emailed counts, so the alert says what got slower. A run
  that hits the 60s limit is killed before it records, so it shows up as "no recent run";
  check the Vercel function logs for a timeout;
- LEGISinfo's feed no longer normalizes into complete bills, or the per-bill record has
  lost its sponsor or activity date. That would have caught the August 2026 schema change
  on day one.

A failure emails the repo owner and opens a `health-check` issue with the failing checks,
and later failures comment on the same issue. The issue closes itself on the next passing
run. Run the same checks locally with `npm run health`; set `HEALTH_SITE_URL` to point at a
preview deployment.

## Weekly status report

`/api/cron/weekly-report` emails `OWNER_NOTIFY_EMAIL` every Saturday at 13:00 UTC (8am EST /
9am EDT) with the last 7 days: sync runs (count, failures, average and slowest duration,
changes detected), subscribers (confirmed, new this week, unconfirmed), bill subscriptions,
and notification emails sent and failed. The subject says "all good" or how many issues need
a look: days with no recorded run, failed or over-budget runs, failed emails. Send one now
with:

```bash
curl "$NEXT_PUBLIC_SITE_URL/api/cron/weekly-report" -H "Authorization: Bearer $CRON_SECRET"
```

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

**Suspected duplicate or missed sync.**
Re-running sync is safe: bill upserts are idempotent, and the
`notifications_outbox (subscriber_id, status_history_id)` unique constraint prevents
double-queuing.

**Rotating a secret.**
Update it in Vercel, redeploy. For `CRON_SECRET`, update the Vercel Cron config too.

## Backups

Supabase provides managed Postgres backups. The `source_json` column on `bills` retains the
raw LEGISinfo snapshot for audit/replay.
