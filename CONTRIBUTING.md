# Contributing to BillWatch

Thanks for helping! BillWatch is meant to outlive any single maintainer, so we keep the
process explicit and the docs current. If something here is unclear or stale, fixing it is a
welcome first contribution.

## Before you start

- Read [`docs/architecture.md`](./docs/architecture.md) and
  [`docs/data-sources.md`](./docs/data-sources.md).
- Browse open [Issues](../../issues) and the [Milestones](../../milestones) (one per version,
  e.g. `v1.0`). Pick an issue, or open one to discuss before large changes.
- Issues labelled `good-first-issue` are a good entry point.

## Development setup

See the "Getting started" section of the [README](./README.md). In short: `npm install`,
copy `.env.example` to `.env.local`, apply `supabase/migrations/`, then `npm run dev`.

## Before opening a pull request

Run the full local check suite — CI runs the same:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run format       # auto-format; CI checks formatting with format:check
```

## Commit messages: Conventional Commits

Format: `type(scope): summary` in the imperative mood. Reference issues in the body
(`Closes #12`).

- **Types:** `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `ci`.
- **Examples:**
  - `feat(subscribe): add double opt-in confirmation flow`
  - `fix(sync): handle bills with no current status`
  - `docs(runbook): document session rollover`

## Pull requests

- One logical change per PR. Keep them reviewable.
- Fill in the PR template: what changed, why, how you tested it, linked issue.
- All CI checks must pass. PRs are squash-merged, so the PR title becomes the commit — make
  it a good Conventional Commit.
- New behaviour should come with a test where practical (pure logic like `src/lib/*` is easy
  to unit-test with Vitest).

## Security

Do **not** open a public issue for vulnerabilities. Follow [`SECURITY.md`](./SECURITY.md).
Never commit secrets; only `.env.example` (placeholders) is tracked.

## Code style

Prettier + ESLint are the source of truth (`npm run format`, `npm run lint`). Prefer small,
well-named functions; keep external-data parsing isolated (e.g. all LEGISinfo-shape knowledge
stays in `src/lib/legisinfo.ts`).

By contributing, you agree your contributions are licensed under the project's
[AGPLv3](./LICENSE).
