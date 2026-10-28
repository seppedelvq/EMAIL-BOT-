# Repository assessment and implementation plan

Source: seppedelvq/EMAIL-BOT-, baseline bf0f248. This is emai v0.2.0,
not a separate AI Email Triage application. Keep the existing TypeScript facade,
provider interface, AI adapters, tests, and Next.js playground.

## Source inspection

- Gmail: real OAuth-token adapter and message/label/thread operations. No end-user
  OAuth consent flow in playground; live integration needs a controlled account.
- Outlook: Graph adapter exists, but captures an access token at connect time.
  No verified ongoing refresh or end-user consent. Preserve; do not expose as ready.
- AI: real Zod-validated classify, priority, summarize, compose engines and optional
  local Ollama adapter. Tests use mocks; real model accuracy remains unverified.
- UI: Next.js 16 / React 19 developer playground with many feature pages.
- Backend: Next route handlers, process-global instance, plaintext JSON credentials
  returned by config API. Unsafe as customer-facing configuration.
- Storage: memory and optional better-sqlite3 adapters. Additional metadata engines
  for labels and reminders; reminder semantics are outgoing follow-up, not incoming
  reply obligations. No daily briefing scheduler or acknowledgment loop guard.
- License: root MIT, copyright 2026 petter100, retained. Third-party licenses must
  be inventoried from actually installed dependencies, including optional packages.

## Implementation sequence

1. Establish baseline test/typecheck/build; preserve old developer tools behind an
   explicit local-only opt-in. Link playground to this checkout, not npm upstream.
2. Add a local assistant domain layer: validated settings, tenant-specific SQLite,
   credential encryption, persistent automation claims, bounded retention.
3. Daily briefing builder and pluggable delivery; clock in configured IANA timezone,
   single daily claim, delivery/uncertain/error records. Then categories, contacts,
   incoming follow-ups, opt-in acknowledgments, grounded bilingual analysis.
4. Reuse Next and UI primitives for three simple screens, fictional demo by default.
5. Add Gmail browser OAuth with state and PKCE, provider reuse, local-only request
   checks. Keep Outlook a later live-tested phase. No password form in assistant.
6. Test safety, retries, idempotency, timezones, outputs and tenant isolation.
   Document installation, runtime requirements, packaging limits and costs.

No production mail access, public deployment or live automatic sending is part
of development validation. Gmail API, model and OS packaging tests require
separate external configuration; report them explicitly as unverified.
