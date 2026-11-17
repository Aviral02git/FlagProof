# Verification: evidence upgrade

Private pre-event prototype begun 17 November 2026. Verified on Node 22.23.5 and Google Chrome on Linux. Other operating systems remain untested.

## Commands

```sh
npm ci
npm run build
CHROME_PATH=/usr/bin/google-chrome npm test
CHROME_PATH=/usr/bin/google-chrome npm run capture
CHROME_PATH=/usr/bin/google-chrome node test/capture-upgrade.mjs
```

Set `CHROME_PATH` for your machine or install the bundled Playwright Chromium. The path above is this test machine, not a universal install path.

## Measured results

- Automated suite: **32 tests passed, zero failed**. The prior twenty checks remain passing; twelve new checks cover persisted history, safe interruption, malformed saved records, comparison restrictions, readable reports, history API blocking live writes before any adapter access when cleanup is unresolved, and missing SDK flags being invalid rather than false.
- Seeded fixture: eight matrix cases, six pass and two fail. The pair `new_checkout` + `express_shipping` fails the $115 independent price contract with a measured $130 total; a ninth fresh browser case reproduces it.
- Healthy fixture: eight pass, no minimal failing set.
- Both suites: original flags restored and read-back verified.
- Expanded subset evidence: all OFF, checkout only and express only each pass, with direct screenshot links.
- Forward comparison: zero regressions, two improvements, six unchanged. Reverse comparison: two regressions, zero improvements, six unchanged. These are synthetic fixture comparisons, not deployed fixes.
- A stopped/restarted server reloads both saved suites and their screenshots. No tests are silently resumed.
- Readable Markdown report downloads successfully. JSON report and case evidence remain available.
- Chromium UI checks: desktop 1440px, mobile 390px and 320px; no whole-page horizontal overflow or browser page errors. Tables scroll within their panel on small screens.

`evidence/upgrade-ui-check.json` and `evidence/upgrade-test-summary.txt` contain machine-captured results. `test/capture-upgrade.mjs` regenerates screenshots and measurements. The source/evidence archive shared privately includes fresh binary screenshots and traces. GitHub's upload widget rejected binary and text file uploads in this session, so only ordinary text-editor commits are relied on for repository delivery. Do not assume original PNGs or trace ZIPs are in the repo.

## Remaining limits

Default mode is local-fixture and manual-template, not live Flagsmith and not AI. Separate real integration verification in the approved environment used the management API and actual browser SDK: seeded 6 pass / 2 fail plus a reproduced pair, healthy 8 pass, both with verified OFF restoration. Existing `show_demo_button` was unchanged in Development and Production, and the three new definitions were OFF across both originals and the demo. See `evidence/live-*-report.json` and `evidence/live-preservation.json`. Raw live traces are not shared because they can contain SDK keys. This is separate from the simulated contract/SDK tests. The model adapter remains unverified. Live writes are serial, not transactional; partial writes or unknown concurrent edits can require manual restoration. There is no distributed environment lock. Atomic rename is not a guarantee against disk failure or power loss.

No public deployment, public repository, paid service or hackathon submission was performed by this verification.
