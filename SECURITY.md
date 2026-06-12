# Security Policy

## Reporting a vulnerability

Please report security issues **privately**. Do not open a public GitHub issue.

- Use [GitHub's private vulnerability reporting](../../security/advisories/new) for this
  repository, **or**
- email the maintainer (see the contact on the project's GitHub profile).

Include what you found, steps to reproduce, and the potential impact. We'll acknowledge
receipt as soon as we can and keep you updated on the fix.

## Scope / areas of particular concern

- **Secrets:** `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `CRON_SECRET`, and
  `DISCORD_FEEDBACK_WEBHOOK_URL` are server-only and must never reach the client bundle.
- **RLS:** the Supabase anon key is public by design; subscriber data is protected by Row
  Level Security. Report any way to read `subscribers`, `subscriptions`, or
  `notifications_outbox` with the anon key.
- **Cron route:** `/api/cron/*` must reject requests without a valid `CRON_SECRET`.
- **Email abuse:** subscriptions require double opt-in; report any way to subscribe an email
  without its owner's confirmation, or to enumerate subscribers.

## Handling of personal data

We store subscriber email addresses solely to deliver requested bill notifications. Every
email includes a one-click unsubscribe link. We aim to comply with Canadian law (CASL,
PIPEDA).

## Good practices for contributors

- Never commit real secrets. Only `.env.example` (placeholders) is tracked; `.env.local` is
  gitignored.
- CI includes a secret-scan step; do not disable it.
