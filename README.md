# FlagProof

**Feature flags interact. FlagProof proves where, with real Flagsmith writes and browser evidence you can review.**

A flag can pass every individual test and still break a checkout when combined with another flag. FlagProof connects to a real Flagsmith environment through the management API and browser SDK, exercises every on/off combination of your flags in a real browser against an independent price contract, and shows the smallest observed failing set with screenshots, Playwright traces and a JSON report. Every run requires a human to review and approve a hash-bound plan first; original flag state is recorded and restored with read-back verification.

Built for the Flagsmith Experimentation Hackathon (Toggle Wars), targeting the "AI Agents and Feature Flags" track: a tool that drives Flagsmith for you, where a human approves every change. AI assistance helped build this project; the capability table below states what is verified and what is not.

## How it uses Flagsmith

- **Management API**: writes each of the eight flag configurations to your environment, one at a time, through the official REST API.
- **Browser SDK**: the bundled demo checkout resolves flags through `flagsmith-js` against the live edge API, exactly as a real app would.
- **Human approval**: no flag changes without a reviewed, hash-bound plan. A changed environment blocks the run.
- **Restoration**: after the matrix, original flag state is written back and read back to verify.

## Run it against your Flagsmith environment

Requirements: Node.js 22 or later, npm, and a Chromium browser. Tested with Node 22.23.4 and Google Chrome on Linux.

```sh
npm ci
npx playwright install chromium
npm run setup:flagsmith   # guided check of your environment + the three boolean flags
npm start
```

`setup:flagsmith` asks for a client-side environment key and a management API key (stored only in a local, gitignored `.env`, never printed back), verifies that the environment resolves and that three plain boolean flags exist: `new_checkout`, `express_shipping`, `promo_banner`. Create them in the Flagsmith dashboard first if missing (default OFF, no variants, no overrides).

Open the printed local address. The dashboard shows **FLAGSMITH API + SDK** mode.

## Try the proof

1. Keep **Seeded interaction defect** selected. Click **Prepare reviewable plan**.
2. Inspect the target, exact actions, assertions, JSON and SHA-256 fingerprint. Preparing or rejecting a plan changes no flags.
3. Click **Approve & run 8 cases**. A fresh Chromium context runs each configuration serially against the live flag state.
4. Expect **6 passes, 2 failures** on the seeded fixture. The observed minimal failing set is `new_checkout` + `express_shipping`.
5. Open a failed screenshot. The price is **$130**, but the independent contract is **$115**: a $100 item plus $15 express shipping. The fixture deliberately charges shipping twice for this pair. The promo flag is unrelated to the observed failure.
6. Check **Original flags restored and read-back verified**. Download the report, screenshots and traces.
7. Select **Healthy checkout control**, prepare a fresh plan and approve it. Expect **8 passes, 0 failures**, verified restoration.
8. Try **Reject** or **Cancel safely**. Cancellation waits for the current browser operation and cleanup.

No actual order or charge is made.

## Offline mode

Without `.env`, the app runs against a bundled local fixture adapter (clearly labelled LOCAL FIXTURE in the UI). Useful for trying the flow without a Flagsmith account; the Flagsmith-backed mode above is the primary path.

## What is working, and what is not

| Capability | Status |
| --- | --- |
| Local checkout and three boolean flags | Working and browser-tested |
| Exact eight-configuration matrix | Working |
| Manual-template plan, strict schema, hash-bound approval and rejection | Working |
| Real Flagsmith management API writes and browser SDK resolution | **Verified in an isolated disposable demo environment**: seeded 6/8 pass + reproduction; healthy 8/8 pass; restored OFF |
| Real checkout clicks, independent assertions, console/page-error capture | Working |
| Screenshot, Playwright trace and JSON report per case | Working |
| Observed minimal set and fresh reproduction | Working for the seeded fixture |
| Restoration with read-back, cancellation and explicit failed-cleanup state | Tested locally, including injected failures |
| Durable history, interruption detection, compatible-run comparison, readable Markdown evidence reports | Working and browser-tested |
| Responsive dashboard at 320, 390, 1280 and 1440 px | Checked in Chromium |
| AI-generated plan using a local Ollama model | **Verified with qwen2.5:0.5b on 20 Nov 2026 across both bundled fixtures** (schema-checked plans, scenario guard, explicit failure, no silent fallback). Other models untested; review stays mandatory. |
| AI-authored result explanation | **Not implemented**. The summary is deterministic. |
| Production app targeting, CI, multi-user isolation, deployment | **Not implemented** |

The verified Flagsmith run covered the selected disposable environment only: plain boolean flags, no overrides, one writer. It is not proof of safety for arbitrary accounts, other flag types, concurrent writers or production use.

## Safety boundary

- The only target is the bundled local checkout. Plans cannot add outside URLs, arbitrary actions, scripts or shell commands.
- Every plan is schema-validated, reviewed and hash-bound. A changed initial state blocks execution until a fresh review.
- The loopback API checks Host, Origin and a per-process action token. It is not a remotely deployable authentication system.
- Management keys stay server-side in the gitignored `.env`; the browser only ever sees the public environment key.
- Each run records its original flag state before writes, checks management read-back, checks browser-resolved booleans, and attempts restoration in `finally`.
- A setup mismatch is **invalid**, not a passing test. A failed restoration changes the overall run to **error**.
- No code can guarantee cleanup after a power loss or forced process kill. Reports are written throughout the run.
- Test cases are browser measurements against an intentionally synthetic defect. The failure itself is seeded; screenshots and assertion outcomes are not fabricated.
- A minimal set is an observed set whose every proper subset passed in this matrix. It is not proof of root cause. A green result only covers this journey and these configurations.

## Tests

```sh
npm test
```

Fifty-one automated tests cover matrix/schema logic, subset evidence rules, API review guards, CSRF/origin checks, concurrent approvals, actual seeded/healthy browser runs, non-default-state restoration, cancellation, invalid setup and failed cleanup, the Flagsmith adapter and SDK bundle against simulated responses, the guided setup checks (flag discovery, override/variant/malformed rejection, key routing, `.env` handling and secret-leakage guards), and the AI planner against mocked model responses: valid-plan acceptance, schema-violation rejection, scenario-change rejection, explicit API failure with no silent fallback, and the manual path never calling the model.

## Provenance

Built 17-18 November 2026, before the hackathon window, as a pre-event prototype; the Flagsmith integration was verified against a disposable demo environment during those dates. Event eligibility is the organizers' call and is not claimed here. Git history is intact and unrewritten.
