# FlagProof: evidence-first improvement plan

Private pre-event work, started 17 November 2026. No claim of winning or event eligibility.

## Product position

A feature flag can pass every individual test and still break a checkout when combined with another flag. FlagProof reviews a bounded plan, exercises the full matrix in real browsers, shows the smallest observed failing set with its passing subsets, and preserves evidence for review. The claim is reproducible interaction evidence, not automatic proof of root cause or a production rollback guarantee.

## Implemented in this upgrade

1. **Evidence survives a restart.** Atomic report snapshots, validated saved history, exact run selection, and visible interruption status. Old work is never silently resumed. Unknown live cleanup blocks further live runs.
2. **Compare measured suites.** Eight configuration rows show regressions, improvements and unchanged outcomes. Comparison is withheld for incomplete suites, unverified restoration, different modes or different contracts. A seeded-versus-healthy fixture comparison is labelled synthetic, not described as a deployed fix.
3. **Explain the minimal set with evidence.** Expand the finding to inspect screenshots for all passing proper subsets, rather than trusting a confident sentence.
4. **Readable evidence report.** Download Markdown alongside JSON. It records mode, plan source, review fingerprint, assertions, original state and relative screenshot links.
5. **More safety and regression coverage.** Thirty-two automated tests plus actual Chromium checks for restart history, comparison in both directions, report download, subset links and mobile layout. The original seeded six-pass/two-fail and healthy eight-pass controls still work.

## Priority order before judging

| Priority | Work | Why it matters | Completion evidence |
| --- | --- | --- | --- |
| Done, isolated demo | Real Flagsmith management writes and browser SDK resolution in a disposable environment | Flagsmith must be core to the entry | Saved snapshot, real resolved flags, measured matrix, verified restoration and preserved existing flags |
| P0 | Preserve pre-event provenance and clarify eligibility | A good build is not an eligible submission by assumption | Organizer clarification or current explicit event rule; no backdating |
| P1 | One short, clear demo | The official scorecard judges the problem, build and Flagsmith's role | Show defect, review, measured failing pair, passing subsets, healthy control comparison and cleanup |
| P1 | Make setup easy for another developer | A useful tool should be repeatable | Fresh checkout, documented install, tests and reproducible evidence |
| P2 | A genuinely constrained model proposal, if useful | Optional support for a real planning task, not an AI badge | Actual model call, strict schema rejection and reviewed output; never claim template text is AI |
| Later | Arbitrary apps, many flags, CI, agents or automatic rollback | Much larger safety and testing surface | Separate scope, credentials, isolation, locking and security work |

Do not add chat, leaderboards, authentication, decorative analytics, many providers or an untested autonomous rollback just to grow the feature list. A green result covers only the declared journey and matrix.

## Suggested demo sequence

- Show the real problem: flags can fail together even when their proper subsets pass.
- Prepare the exact plan, inspect its fixed target/actions/assertions and fingerprint. Reject once to show nothing runs without approval.
- Approve the seeded checkout suite. Open the failing $130 receipt against the independent $115 price contract.
- Expand the three passing proper subsets. Show the fresh reproduction and verified restoration.
- Run the healthy control, then compare it against the seeded suite. Clearly say it is a different synthetic fixture, not a production patch.
- Restart the app. Select saved evidence and download the readable report.
- If the live integration is actually verified, identify the isolated Flagsmith environment and show SDK-resolved states and cleanup. Otherwise say it remains unverified.

## Source checks

Checked 17 November 2026:

- Official scorecard and track expectations: https://www.wemakedevs.org/hackathons/flagsmith
- Schedule and repo/README/video requirement: https://www.wemakedevs.org/hackathons/flagsmith/schedule
- Submission page did not expose a usable submission form in the fetched view: https://www.wemakedevs.org/hackathons/flagsmith/submit
- Terms forbid misrepresenting work built during the event window; they do not settle this prototype's eligibility: https://www.wemakedevs.org/terms
- Experimental boolean-update contract and its limits: https://docs.flagsmith.com/managing-flags/updating-flags
- Real JavaScript SDK: https://docs.flagsmith.com/clients/javascript
- API schemas used for read-only account discovery: https://github.com/Flagsmith/flagsmith/blob/refs/heads/main/openapi.yaml
- Trace inspection and privacy-sensitive browser evidence: https://playwright.dev/docs/trace-viewer
- Free-plan request limits and overage FAQ: https://www.flagsmith.com/pricing

The scorecard does not supply a reliable numerical probability of winning. No guarantee or claim of highest prize odds is justified.

## Real integration result, 17-18 November 2026

Approved project 53752, new environment 117118. The seeded suite completed with six passes/two failures and a fresh reproduction; healthy control completed eight/eight. Both restored the original all-OFF state. The existing flag in Development and Production was unchanged by independent management-API read-back; all three new flags remained OFF in the original environments. This proves only that disposable integration, not production readiness or an AI-generated plan.
