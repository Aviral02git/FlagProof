# FlagProof demo script (~3 minutes)

Mapped to the official scorecard: problem -> what we built -> how Flagsmith fits.
Record in FLAGSMITH API + SDK mode (after `npm run setup:flagsmith`) so every flag read/write on screen is real. Fallback: local-fixture mode, with the LOCAL FIXTURE label visible and named in voiceover.

| Time | Screen | Voiceover / caption |
| --- | --- | --- |
| 0:00-0:20 | Title card, then the three flags in the Flagsmith dashboard | "Three feature flags in a demo checkout with a deliberately seeded defect. Each flag passes its own test; together, one pair overcharges. FlagProof finds that pair with real flag writes and browser evidence. The defect is synthetic and labelled as such wherever results appear." |
| 0:20-0:45 | FlagProof dashboard, mode badge visible | "FlagProof connects to a real Flagsmith environment. Everything it does to flags goes through the official management API; the demo app resolves flags through the browser SDK, like any real app." |
| 0:45-1:15 | Prepare reviewable plan; show JSON, SHA-256 fingerprint | "Nothing runs on its own. A human reviews the exact plan, target, actions, assertions, and its fingerprint. Preparing or rejecting changes no flags. Approving starts the measured run - only then are flags written, one configuration at a time." |
| 1:15-1:50 | Approve; run progresses through 8 configurations | "Eight configurations, every on/off combination of the three flags, written to Flagsmith one at a time. A fresh browser measures each one against an independent price contract." |
| 1:50-2:20 | Results: 6 pass, 2 fail; open failing screenshot ($130 vs $115 contract) | "Two configurations fail. The smallest failing set is new_checkout plus express_shipping: the seeded defect charges express shipping twice, only when both are on. Every proper subset passed; that is what makes this set minimal, not a guess." |
| 2:20-2:40 | Restoration banner; healthy control 8/8 | "Original flag state is written back and read back to verify. The healthy control passes all eight, so the failure is the defect, not the harness." |
| 2:40-3:00 | Report JSON/Markdown, traces; closing card | "Every run leaves a reviewable trail: JSON, Markdown, screenshots, Playwright traces. FlagProof: a human approves, Flagsmith does the work, the evidence does the talking." |

## Recording checklist
- Fresh `.env` via `npm run setup:flagsmith`; dashboard shows FLAGSMITH API + SDK.
- Seeded scenario first, then healthy control in the same take if time allows.
- No secrets on screen: the management key never appears in the UI or the video.
- 1280x800 capture; Playwright `recordVideo` or any screen recorder; captions optional.
- Claims in voiceover must match the README: seeded fixture, disposable demo environment, local software.
