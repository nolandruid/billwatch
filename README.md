# BillWatch

**Get notified when a Canadian federal bill changes status.**

BillWatch is a free, open-source, neutral public utility. Search for a bill before
Parliament (by number like `C-15`, by title, or by topic), subscribe with your email, and
receive a notification each time the bill moves — first reading, committee, House → Senate,
Royal Assent, and so on. No manual checking of the Parliament website required.

- **Data source of truth:** [LEGISinfo](https://www.parl.ca/legisinfo) (Parliament of Canada).
- **Scope:** Federal bills only (for now). Provincial may follow if there's demand.
- **Not for profit.** Licensed under [AGPLv3](./LICENSE).

> Inspiration & benchmarks: [GovTrack.us](https://www.govtrack.us/) and
> [Congress.gov](https://www.congress.gov/) (US — the UX bar we aim for),
> [openparliament.ca](https://openparliament.ca/) (Canadian open-parliament data pioneer).
> See [`docs/data-sources.md`](./docs/data-sources.md) for full attribution.

---

## How it works (at a glance)

1. A scheduled job pulls all bills for the active session from LEGISinfo's JSON export.
2. It compares each bill's status against what we last stored. On a change, it logs the new
   status and queues a notification for every confirmed subscriber to that bill.
3. A sender drains the queue and emails subscribers, linking to our bill page **and** the
   official LEGISinfo page.

Full design: [`docs/architecture.md`](./docs/architecture.md).

## Tech stack

| Layer        | Choice                                     |
| ------------ | ------------------------------------------ |
| Framework    | Next.js (App Router) + TypeScript          |
| Styling      | Tailwind CSS                               |
| Database     | Supabase (PostgreSQL) + Row Level Security |
| Email        | Resend                                     |
| Hosting/Cron | Vercel (Vercel Cron)                       |

## Getting started (local development)

Prerequisites: Node 20+ and a Supabase project.

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local      # then fill in real values (see comments in the file)

# 3. Apply the database schema
#    Run the SQL in supabase/migrations/ against your Supabase project
#    (Supabase Studio -> SQL editor, or the Supabase CLI).

# 4. Run the dev server
npm run dev                     # http://localhost:3000
```

### Useful scripts

```bash
npm run dev          # start the dev server
npm run build        # production build
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm test             # Vitest unit tests
npm run format       # Prettier (write)
```

### Triggering a sync locally

The sync job runs on a schedule in production. To run it by hand against your dev database:

```bash
curl -X POST http://localhost:3000/api/cron/sync \
  -H "Authorization: Bearer $CRON_SECRET"
```

See [`docs/runbook.md`](./docs/runbook.md) for operational details.

## Contributing

This project is built to outlive any single maintainer. Please read
[`CONTRIBUTING.md`](./CONTRIBUTING.md) and the docs in [`docs/`](./docs) before opening a PR.
Found a security issue? See [`SECURITY.md`](./SECURITY.md).

## License

[GNU AGPLv3](./LICENSE). If you run a modified version as a network service, you must make
your source available to its users.
