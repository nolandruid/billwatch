# Architecture

BillWatch is a Next.js app on Vercel backed by Supabase (PostgreSQL). There are three moving
parts: the **web app** (search + subscribe + bill pages), the **sync job** (detects status
changes), and the **notifier** (sends emails).

```
                 ┌──────────────────────────────────────────┐
   LEGISinfo  →  │  Sync job  (cron, /api/cron/sync)         │
  (JSON)         │  fetch session bills → diff stored status │
                 │  → log change → queue notifications       │
                 └───────────────┬──────────────────────────┘
                                 │ writes (service role)
                          ┌──────▼───────┐
                          │  Supabase    │  bills, bill_status_history,
                          │  (Postgres)  │  subscribers, subscriptions,
                          └──────┬───────┘  notifications_outbox
                                 │
        ┌────────────────────────┼─────────────────────────┐
        │                        │                          │
 ┌──────▼──────┐         ┌───────▼────────┐         ┌───────▼────────┐
 │ Next.js web │         │ Notifier       │         │ Feedback       │
 │ search/sub  │         │ outbox → email │         │ Tally popup    │
 │ bill pages  │         │ (Resend)       │         │ (hosted form)  │
 └─────────────┘         └────────────────┘         └────────────────┘
```

## Data flow: detecting a status change

1. **Cron** (`vercel.json` → `/api/cron/sync`, every 2h) calls `syncAll()`.
2. `fetchBills(session)` ([`src/lib/legisinfo.ts`](../src/lib/legisinfo.ts)) pulls the full
   bill list for each active session and normalizes it. One request carries status +
   milestones, so no per-bill calls are needed.
3. `syncSession()` ([`src/lib/sync.ts`](../src/lib/sync.ts)) loads existing bills, upserts
   each fetched bill, and compares `current_status` / `current_stage`:
   - **New bill** → recorded in `bill_status_history`, **no** notifications.
   - **Changed bill** → new `bill_status_history` row + one `notifications_outbox` row per
     confirmed subscriber. The `(subscriber_id, status_history_id)` unique constraint makes
     re-runs idempotent.
4. The **notifier** (added in v1) drains `notifications_outbox` via Resend and marks rows
   `sent` / `failed`.

## Why the change signal is stored, not recomputed

We diff on the stored `current_status` + `current_stage`. LEGISinfo also exposes a
`LatestActivityDateTime`; `normalizeBill` folds that into a `statusKey` for finer-grained
detection if we ever need it. Keeping all LEGISinfo-shape knowledge in `legisinfo.ts` means a
format change on Parliament's side only touches that one file.

## Trust & correctness

A false or missed alert erodes trust in a tool people may act on. Therefore:

- Notifications fire only on a **confirmed, persisted** status change (diff against the DB).
- Every bill page and every email links to the **official LEGISinfo page** so users can verify.
- The outbox is **append-once / idempotent**; retries never double-send.

## Security boundaries

- The browser uses the Supabase **anon key** and can only read public bill data (enforced by
  RLS — see [`supabase/migrations/0001_initial_schema.sql`](../supabase/migrations/0001_initial_schema.sql)).
- All privileged writes go through **server routes** using the **service-role key**
  ([`src/lib/supabase/admin.ts`](../src/lib/supabase/admin.ts)), which is server-only.
- The cron route is gated by `CRON_SECRET`. The Discord feedback webhook is server-side only.

See [`runbook.md`](./runbook.md) for operations and [`data-sources.md`](./data-sources.md) for
data provenance.
