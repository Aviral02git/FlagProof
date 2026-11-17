# FlagProof

A private, pre-event prototype built on 17 November 2026. This is working local software, not a deployed service. The isolated Flagsmith API + SDK integration was verified across the night of 17-18 November 2026; AI planning and event eligibility remain unresolved.

**Review a bounded test plan. Exercise all eight configurations. Inspect real browser evidence.**

## Repository delivery

The private GitHub repository contains the runnable source tree, dependency lockfile, tests, measured JSON reports and verification summary. Original binary screenshots, trace ZIPs and the combined source/evidence archive could not be uploaded through the file-upload form. They are not included in this repository. Run a fresh approved local suite to generate screenshots, traces and reports, or run `npm run capture` for the UI verification flow. No demo is hosted by this repository.

## Run it

Requirements: Node.js 22 or later, npm, and a Chromium browser. Tested here with Node 22.23.4 and Google Chrome on Linux. Windows and macOS have not been tested.

```sh
npm ci
npx playwright install chromium
npm start
```

Open **http://127.0.0.1:4317** on the same computer. The server binds to loopback only. If the port is busy, set `PORT` to another free port and use the address printed at startup.

If Chromium is already installed, set `CHROME_PATH` to its executable instead of downloading a browser. The app automatically detects `/usr/bin/google-chrome-stable` on Linux. On Linux systems missing browser libraries, Playwright's browser installation may also need its documented system dependencies.

No account, API key, payment, or external model is required for the default demo. Installing npm dependencies and the browser requires internet access; running the default demo does not.

## Try the proof

1. Keep **Seeded interaction defect** selected. Click **Prepare reviewable plan**.
2. Inspect the target, exact actions, assertions, JSON and SHA-256 fingerprint. Preparing or rejecting a plan does not change flags.
3. Click **Approve & run 8 cases**. A fresh Chromium context runs each configuration serially.
4. Expect **6 passes, 2 failures**. The observed minimal failing set is `new_checkout` + `express_shipping`. A ninth browser case repeats that set.
5. Open a failed screenshot. The price is **$130**, but the independent contract is **$115**: a $100 item plus $15 express shipping. The fixture deliberately charges shipping twice for this pair. The promo flag is unrelated to the observed failure.
6. Check **Original flags restored and read-back verified**. Download the report, screenshots and traces.
7. Select **Healthy checkout control**, prepare a fresh plan and approve it. Expect **8 passes, 0 failures**, no culprit and verified restoration.
8. Try **Reject** or **Cancel safely**. Cancellation waits for the current browser operation and cleanup, so it is not instantaneous.

No actual order or charge is made.

## What is working, and what is not

| Capability | Status |
| --- | --- |
| Local checkout and three in-memory boolean flags | Working and browser-tested |
| Exact eight-configuration matrix | Working |
| Manual-template plan, strict schema, hash-bound approval and rejection | Working |
| One serial writer, state-drift check, fresh browser context, resolved-state check | Working locally |
| Real checkout clicks, independent assertions, console/page-error capture | Working |
| Screenshot, Playwright trace and JSON report per case | Working |
| Observed minimal set and fresh reproduction | Working for the seeded fixture |
| Restoration with read-back, cancellation and explicit failed-cleanup state | Tested locally, including injected failures |
| Responsive dashboard at 320, 390, 1280 and 1440 px | Checked in Chromium |
| Real Flagsmith management API writes and browser SDK resolution | **Verified in the approved disposable demo**: seeded 6/8 pass + reproduction; healthy 8/8 pass; restored OFF |
| AI-generated plan using a local Ollama model | **Prepared adapter only; not model-tested** |
| AI-authored result explanation | **Not implemented**. The summary is deterministic. |
| Durable history, interruption detection, compatible-run comparison, readable Markdown evidence reports | Working and browser-tested |
| Production app targeting, CI, multi-user isolation, deployment | **Not implemented** |

**The default demo is local-fixture / manual-template mode. It is not a live Flagsmith or AI demonstration.** Contract tests use simulated HTTP responses and are distinct from the actual isolated-account verification recorded in `evidence/live-*-report.json` and `evidence/live-preservation.json`. That real test proved the selected environment only, not arbitrary accounts, other flag types, concurrent writers or production safety.

## Safety boundary

- The only target is the bundled local checkout. Plans cannot add outside URLs, arbitrary actions, scripts or shell commands.
- Every plan is schema-validated, reviewed and hash-bound. A changed initial state blocks execution until a fresh review.
- The loopback API checks Host, Origin and a per-process action token. It is not a remotely deployable authentication system.
- Each run records its original flag state before writes, checks management read-back, checks browser-resolved booleans, and attempts restoration in `finally`.
- A setup mismatch is **invalid**, not a passing test. A failed restoration changes the overall run to **error**.
- No code can guarantee cleanup after a power loss or forced process kill. Reports are written throughout the run. Do not interrupt a live run; see the limitations below.
- Test cases are browser measurements against an intentionally synthetic defect. The failure itself is seeded; screenshots and assertion outcomes are not fabricated.
- A minimal set is an observed set whose every proper subset passed in this matrix. It is not proof of root cause. A green result only covers this journey and these configurations.

## Tests and evidence

```sh
npm test
node test/capture-ui.mjs
node test/capture-upgrade.mjs
```

The automated suite covers matrix/schema logic, subset evidence rules, API review guards, CSRF/origin checks, concurrent approvals, actual seeded/healthy browser runs, non-default-state restoration, cancellation, invalid setup and failed cleanup. It also checks the prepared Flagsmith adapter against simulated responses.

`evidence/` in this repository contains the measured JSON reports and test summary captured during verification. Original dashboard screenshots and per-case binary evidence are not committed here. A new local run writes screenshots, trace ZIPs and reports into `artifacts/<run-id>/`. `VERIFICATION.md` identifies the final checks. Example evidence remains available on disk after restart, and the dashboard now reloads saved reports after restart. The most recent twelve suites are selectable in Saved evidence. A previously unfinished suite is labelled interrupted and is never resumed automatically. Unverified live restoration blocks new live plans and approvals until an authorized operator verifies recovery; there is deliberately no one-click override.

To inspect a trace locally:

```sh
npx playwright show-trace artifacts/<run-id>/<case-id>.zip
```

Keep real traces private: if this is later adapted to a real application, traces can include page content and network data. The supplied demo traces contain only the synthetic checkout.

## Optional local model: not verified

The prepared planner calls only `http://127.0.0.1:11434/api/generate`. It sends the synthetic bounded plan, not credentials, application code, user messages or logs. Set `FLAGPROOF_PLANNER=ollama` and `OLLAMA_MODEL` to an already installed local model, then start the app. Do not install models or consume paid services without the owner's approval.

The result must pass the same strict schema and keep the selected fixture. It cannot change the available steps. Failure is explicit; there is no silent fallback to a manual plan. Review is still mandatory. Model behavior has not been tested in this delivery.

## Flagsmith integration: isolated demo only, never production

This layer uses experimental endpoints. It was verified in project `My first project` (53752), environment `FlagProof Disposable Demo` (117118), using exactly the three dedicated demo flags. Before any other use, obtain approval for an isolated throwaway demo environment and the required changes. Verify the account, exact environment, feature IDs, permissions, current API contract and recovery procedure. Use a single operator and no other flag writers.

Configuration names, all server-side except the normal client environment key returned to the demo SDK:

- `FLAGPROOF_MODE=flagsmith`
- `FLAGPROOF_ALLOW_LIVE=I_APPROVE_ISOLATED_DEMO_WRITES`
- `FLAGSMITH_MANAGEMENT_KEY`: management token, never commit or share it
- `FLAGSMITH_ENVIRONMENT_KEY`: the selected client-side environment key
- `FLAGSMITH_FEATURE_IDS`: JSON mapping the exact three flag names to their numeric feature IDs

The opt-in string is a code guard, not evidence of permission. With explicit owner approval, this upgrade created that disposable environment and three default-OFF project-wide flag definitions. The original `show_demo_button` flag was unchanged in Development and Production; all three new flags were verified OFF in all three environments after testing. No paid plan or billing method was added. The repository and delivered archive contain no credentials. Keys are stored securely, not in chat or source control. The source is not preconfigured with key values: local runs still need explicit server-side configuration. The recorded feature IDs are `new_checkout:295159`, `express_shipping:295160`, `promo_banner:295161`. Never reuse a management token in browser code.

The adapter supports default enabled booleans only, rejects segment overrides and variants, and does not create identities. Its updates are serial, not transactional. On a partial live write or unexpected external change, it refuses to overwrite unknown state and reports **manual restoration required**. The saved `report.json` includes `originalFlags`; an authorized operator must use the verified vendor dashboard to restore and confirm those booleans. Automatic crash recovery and distributed locking are not implemented. Saved interrupted/failed cleanup now blocks additional live runs, but restoration still requires an authorized operator and vendor read-back. Do not treat the adapter as safe for production.

The browser bundle includes the real Flagsmith JS SDK, disables its cache and analytics, and uses it only when this explicitly selected mode is active. The actual browser SDK resolved the requested booleans for all seventeen matrix/reproduction cases in the two live suites. Missing required SDK flags now fail setup rather than silently becoming false. Other propagation and failure conditions still need testing; no general timing guarantee is claimed. Default mode never contacts Flagsmith.

## Structure

- `src/core.mjs`: strict plan schema, matrix, independent price oracle and evidence summary
- `src/flags.mjs`: isolated local fixture and experimentally verified disposable-demo Flagsmith adapter
- `src/planner.mjs`: manual plan or unverified local-model plan proposal
- `src/runner.mjs`: serial Playwright runner, evidence and cleanup
- `src/server.mjs`: loopback API and static UI
- `src/demo-browser.js`: checkout and explicitly selected SDK path
- `public/`: dashboard, styles and built demo bundle
- `test/`: automated checks and UI capture

`npm start` rebuilds the demo bundle before launching. `npm run build` rebuilds it separately. `src/history.mjs` reloads validated reports and gates unresolved live cleanup. `src/report.mjs` compares exact configurations only when both suites are complete and their contracts match, ignoring only the explicitly labelled synthetic fixture selection. Different modes, incomplete runs and failed cleanup do not produce a comparison. The UI is not claiming a code fix was deployed when the selected fixture changes.

Readable reports download as Markdown and include approval fingerprint, mode, assertions, original state and same-directory evidence links. Keep screenshots and trace ZIPs alongside the report. Atomic rename protects report snapshots from partial JSON writes, but is not a power-loss durability guarantee.

`Ctrl+C` asks the running server to cancel, wait for cleanup and close. Do not force-kill a live flag-writing run.

## Pre-event record and remaining work

This prototype was built on **17 November 2026**, before the advertised hackathon window. Preserve that provenance. No backdating or claim that this code was built during the event. Early-work eligibility and the final submission route remain to be confirmed against the organizer's current rules. This is not a hackathon submission. The source was placed in a private GitHub repository on 17 November 2026 at the owner's request; it has not been made public.

The real Flagsmith snapshot → write → browser SDK resolution → eight cases → restoration milestone is now recorded for the approved demo. Next: validate a real constrained model proposal if it adds value, and prepare a short demo that clearly distinguishes local fixtures, real flag state and manual planning. Recheck rules and prepare final repository, README and video before any authorized submission.

## Sources checked 17 November 2026

- JavaScript SDK: https://docs.flagsmith.com/clients/javascript
- Experimental flag update contract and limitations: https://docs.flagsmith.com/managing-flags/updating-flags
- Management API authentication: https://docs.flagsmith.com/integrating-with-flagsmith/flagsmith-api-overview/management-api/authentication
- Browser test parameterization: https://playwright.dev/docs/test-parameterize
- Hackathon: https://www.wemakedevs.org/hackathons/flagsmith
- Schedule: https://www.wemakedevs.org/hackathons/flagsmith/schedule
- Organizer terms: https://www.wemakedevs.org/terms

No license grant is selected for publication. `UNLICENSED` and `private: true` are intentional until the owner chooses repository and licensing terms.

## Evidence upgrade

See `IMPROVEMENTS.md` for prioritized work and a judging-demo sequence, and `VERIFICATION.md` for the final checks. Readable reports and saved comparisons are implemented; cloud deployment, CI and arbitrary-app targeting are not. Raw live traces are excluded from shared artifacts because they can contain SDK keys and network data.
