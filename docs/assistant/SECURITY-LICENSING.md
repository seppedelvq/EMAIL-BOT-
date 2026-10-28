# Security and commercial redistribution review

## Project license

The inherited `LICENSE` is MIT, copyright (c) 2026 petter100, and is retained.
MIT permits commercial use, modification and distribution, subject to preserving
its copyright and permission notice in copies/substantial portions. This does not
transfer ownership of the original code. No model weights or credentials are
included in this repository.

## Third-party dependency inspection

`dependency-licenses.json` inventories installed non-development packages from
both lockfiles, using their actual package manifests. Run
`node scripts/license-inventory.mjs` after changes and on each target OS.
Most are permissive MIT/Apache/BSD/ISC. The current Linux install includes
LGPL-3.0-or-later libvips/sharp native or WASM packages and CC-BY-4.0 caniuse data.
These are not blanket bans on commercial use. Before shipping a self-contained
binary bundle, determine which artifacts are actually included, preserve their
notices and fulfill their applicable redistribution/source/relinking requirements.
This inventory is not a completed legal audit of binary redistribution. Windows
and macOS native payloads differ and must be inventoried on those platforms.
Review the chosen Ollama model license independently.

## Applied controls

- Gmail browser OAuth with state and PKCE; no mailbox password forms in assistant.
- AES-256-GCM refresh-token encryption; key supplied outside the database.
- Separate demo/live databases and separate directory per customer installation.
- Local-only listener, strict Host and Origin checks, cross-site browser request
  rejection, no permissive CORS, no raw credential configuration endpoint.
- Legacy developer API routes disabled by default. Existing code preserved behind
  explicit local developer opt-in; do not use its plaintext config for customers.
- No automatic sending by default. Server rejects enabling acknowledgments with
  a fabricated client confirmation timestamp. Each message/rule change needs
  renewed confirmation. Demo cannot obtain or use a provider instance.
- Zod schema validation and bounded requests/model text, category allowlist,
  confidence fallback, literal deadline and lead evidence checks. Email is treated
  as untrusted data. Existing classify/summarize prompts hardened; AI gets no tools.
- Deterministic acknowledgment exclusions for malformed senders/message IDs,
  self-sent mail, drafts, spam/trash, bulk/list/no-reply/automated messages,
  delivery reports and differing Reply-To addresses. In-thread delivery uses the
  original Gmail thread and suppression headers. Only recent messages after
  opt-in qualify. Persistent opaque claims prevent repetition per conversation.
- Ambiguous send outcomes remain uncertain and are not automatically retried.
  Interrupted pending work recovers as uncertain on startup.
- Only additive provider labels; no deletion or automatic archival paths.
- No full mail bodies/attachments retained by assistant. Configurable summary
  retention and explicit local deletion; opaque anti-duplicate records retained
  until full clear. Metadata/contact retention is documented separately.
- Raw provider errors and model text are not logged. Next development request,
  fetch URL and server-function logging is disabled to avoid OAuth callback codes
  in request logs. Environment files and data directories are excluded from
  standalone file tracing and Git.

## Dependency updates and validation

Compatible updates were applied to the inherited dependencies, including Next,
Vitest and mail libraries. Nodemailer was moved to a patched major release.
Zod was moved to 4.6.7; its existing Anthropic/extraction schema helpers were
adapted, while the existing regression suite remains passing. esbuild is pinned
through an override to a patched version. Lockfiles record exact resolutions.
Audit results are recorded in VALIDATIE.md; rerun npm audit before a release.
Zero advisory findings does not mean a complete security audit.

## Remaining release requirements

- Controlled Gmail end-to-end OAuth, renewal, consent/revocation and delivery tests.
- Google commercial verification/organization approvals where applicable.
- Model accuracy and adversarial prompt-injection evaluation with Dutch/English
  business mail. Structured outputs cannot guarantee factual model judgments.
- Sender spoofing/authentication tests and an explicit SPF/DMARC policy for pilots.
- OS keychain integration and signed installer/uninstaller/update testing.
- Appropriate customer privacy information and cloud-processor arrangements if
  cloud AI is enabled. This change does not assert GDPR compliance.
- Target-platform binary license notices and redistribution review.
- Microsoft 365 adapter token renewal and live Graph tests before enabling it.
- Multi-process locks and real user authentication before any shared/remote hosting.

This branch is a local development/pilot candidate. It has not been deployed,
publicly hosted, connected to production mail, or approved as a commercial release.
