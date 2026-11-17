# Verification record

Pre-event prototype, 17 November 2026. Final browser capture: 2026-11-17T12:57:21.552Z.

## Automated checks

A clean extraction of the delivered source archive passed `npm ci --offline`, `npm run build` and all 20 tests again. This checks that the archive, not only the working folder, is runnable in the tested environment.

`npm run build` succeeded. `npm test`: **20 tests passed, 0 failed**, including real Chromium runs and injected safety failures. The named checks are in `evidence/automated-test-summary.txt`.

## Final UI-driven measurements

These runs were started using the visible Prepare / Approve buttons in the dashboard, not by writing results into the UI.

| | Seeded defect | Healthy control |
| --- | --- | --- |
| Run ID | `f5a894db-d051-4666-81d8-2196bc8c3d62` | `99c909f8-46b6-46e5-949d-69ed5dd7d5c4` |
| Valid matrix cases | 8 | 8 |
| Pass / fail | 6 / 2 | 8 / 0 |
| Extra reproduction | Confirmed failure in a fresh browser | Not applicable |
| Original flag restoration | verified | verified |

The failing pair was `new_checkout + express_shipping`. Its $115 contract produced a measured $130 receipt. Every proper subset passed. Enabling the promo flag did not remove the defect.

Each final local case produced a PNG screenshot, Playwright trace ZIP and assertion record. The repository includes the copied JSON reports in `evidence/`, but the original binary screenshots/traces were not uploaded because the file-upload form returned HTTP400. Fresh local runs regenerate evidence in `artifacts/<run-id>/`. The extra seeded case is labelled `reproduce` and is not counted as a ninth matrix combination.

## Visual and interaction checks

Actual rendered pixels were inspected for the review panel, completed failing matrix, failure receipt, healthy matrix, and the full dashboard at 320, 390, 1280 and 1440 px. A mobile page overflow was found, corrected, and rechecked. The table intentionally scrolls horizontally at narrow widths and says so; the page itself does not overflow.

The UI capture also verified plan rejection without starting a new suite. No uncaught dashboard page errors were recorded. The API tests cover approval fingerprints, state drift, foreign Origin / missing token rejection, simultaneous approval exclusion and cancellation restoration. The fault tests check invalid setup and failed cleanup without presenting a clean result.

## Boundaries

- This verification used **local-fixture flags** and **manual-template plans** only.
- Live Flagsmith and local-model adapters are not live-verified. Their presence and simulated contract tests do not complete those integrations.
- Nothing was deployed, submitted or purchased. After these local checks, the owner requested a private GitHub repository, which now holds the source and text reports. It is not a public release. No external account or environment was created or modified.
- This is pre-event work with truthful dates. Eligibility for early code remains unconfirmed.
- Linux / Node 22 / Chromium were tested. Other operating systems and browsers were not tested.

Read `README.md` before any later attempt at live flag writes.
