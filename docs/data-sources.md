# Data sources & attribution

## Primary source: LEGISinfo (Parliament of Canada)

[LEGISinfo](https://www.parl.ca/legisinfo) is the official, collaborative service of the
Senate, the House of Commons, and the Library of Parliament. It is our **single source of
truth** for federal bill data.

### Endpoints we use

All return JSON, require no authentication, and have no documented rate limits. Be a good
citizen: send a descriptive `User-Agent`, cache where reasonable, and poll on a modest
interval (we sync every 2 hours).

| Purpose            | URL pattern                                                      |
| ------------------ | --------------------------------------------------------------- |
| All bills, session | `https://www.parl.ca/legisinfo/en/bills/json?parlsession=45-1`  |
| Single bill        | `https://www.parl.ca/legisinfo/en/bill/45-1/c-15/json`          |
| Human bill page    | `https://www.parl.ca/legisinfo/en/bill/45-1/c-15`               |

LEGISinfo also offers XML and a customizable RSS feed; we use JSON. All LEGISinfo-shape
parsing lives in [`src/lib/legisinfo.ts`](../src/lib/legisinfo.ts) — if their format changes,
that is the only file to update.

### Fields we depend on

`BillNumberFormatted`, `ParliamentNumber`, `SessionNumber`, `ParlSessionCode`, `LongTitleEn`,
`ShortTitleEn`, `SponsorEn`, `OriginatingChamberId`, `CurrentStatusId`, `CurrentStatusEn`,
`LatestCompletedMajorStageEn`, `LatestCompletedMajorStageChamberId`, `LatestActivityDateTime`.

Chamber IDs: **1 = House of Commons, 2 = Senate**.

### Attribution & contact

We surface a "Source: LEGISinfo" link on every bill page and in every email. Parliamentary
data is open government data. Technical contact for the data: `infonet@parl.gc.ca`. If
Parliament publishes formal terms or a different preferred access method, we will adopt it.

## Inspiration & benchmarks (not data sources)

- **[GovTrack.us](https://www.govtrack.us/)** — the US gold standard for public bill tracking
  with email/RSS alerts. Our UX benchmark for search, bill pages, and alert design.
- **[Congress.gov](https://www.congress.gov/)** — the official US tracker with email alerts
  and an open API. Reference for "official + usable".
- **[openparliament.ca](https://openparliament.ca/)** ([source](https://github.com/michaelmulley/openparliament),
  AGPLv3) — pioneering Canadian open-parliament project. Has keyword alerts; BillWatch focuses
  on per-bill lifecycle notifications. A potential future data ally.
- **[BuildCanada/BillsTracker](https://github.com/BuildCanada/BillsTracker)** — a Canadian
  bill *analysis* tool (editorial positions). Distinct from our neutral notification utility.

## Future sources (not yet integrated)

- **Provincial legislatures** — 13 separate sites, mostly without APIs. Deferred until/unless
  demand justifies the per-legislature scraping effort.
- **Elections Canada** riding/postal-code data — for future "your MP / your riding" features.
