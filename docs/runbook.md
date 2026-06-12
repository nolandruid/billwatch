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
| `DISCORD_FEEDBACK_WEBHOOK_URL`  | feedback (server) | Server-only; never client-exposed. |
| `NEXT_PUBLIC_SITE_URL`          | email links       | Public base URL.                   |

## The sync job

- **Schedule:** every 2 hours via Vercel Cron (`vercel.json`).
- **Endpoint:** `POST`/`GET` `/api/cron/sync`, requires `Authorization: Bearer $CRON_SECRET`.
- **What it does:** pulls each session in `ACTIVE_SESSIONS` ([`src/lib/sync.ts`](../src/lib/sync.ts)),
  upserts bills, logs status changes, queues notifications.
- **Run manually:**
  ```bash
  curl -X POST "$NEXT_PUBLIC_SITE_URL/api/cron/sync" -H "Authorization: Bearer $CRON_SECRET"
  ```
  Response is JSON: `{ ok, results: [{ session, fetched, inserted, changed, notificationsQueued }] }`.

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
