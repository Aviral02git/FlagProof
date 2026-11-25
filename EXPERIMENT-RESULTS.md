# Track 01 experiment: checkout CTA copy

All visitor data on this page is **synthetic demo traffic**. It demonstrates Flagsmith's Experimentation pipeline end to end on real Flagsmith infrastructure. It is **not** evidence that any CTA copy performs better with real customers.

## The question

> Changing the checkout CTA copy from "Checkout" to "Buy now" will increase checkout completion by at least 10 percentage points within the simulated traffic window.

The hypothesis was fixed and hash-approved (SHA-256 `00373816...0044f`) before any traffic ran. The reading rule applied below follows Flagsmith's Experimentation docs and the hackathon's published scorecard guidance: a win probability is the model's current belief, not a verdict, and a result is callable only while the 95% credible interval on the difference clears zero.

## Design

- **Flag**: `checkout_cta_copy`, created multivariate with keyed variations before any traffic (never a boolean converted late): `control` 34%, `buy_now` 33%, `get_it_today` 33%.
- **Metric**: `checkout_completed`, occurrence aggregation ("Checkout completion rate" in Flagsmith).
- **Sample**: 450 synthetic visitors, fixed in advance, sent in one run on 23 Nov 2026 (`node scripts/run-experiment-traffic.mjs 450`). Because the sample size was fixed in advance and all 450 visitors went out in one run, no interim look at the dashboard could influence the run. Evidence: the experiment's processed enrollment view (last computed 24 Nov 2026 03:25 UTC, re-read unchanged later on 24 Nov) shows exactly one cluster, totaling 450, at the run time.
- **Identities**: stable synthetic ids (`shopper-sim-0001` to `shopper-sim-0450`), so each visitor keeps one variation. Conversion outcomes come from a deterministic SHA-256 hash draw against preset per-variation probabilities, reproducible by anyone from `src/experiment.mjs`.
- **SDK calls only**: `getExperimentFlag` for the exposure, `trackEvent` at the moment of conversion, one final flush. The Flagsmith warehouse confirmed 638 events received (450 exposures + 188 conversions).

## Results (Flagsmith analysis, verified 24 Nov 2026)

| Variation | Exposures | Occurrence rate | Delta vs control (relative) | 95% credible interval (relative) | Win probability vs control |
| --- | --- | --- | --- | --- | --- |
| Control | 158 | 32.3% | Baseline | Baseline | <1% |
| get_it_today | 145 | 47.6% | +47.4% | [5.5%, 89.3%] | 99% |
| buy_now | 147 | 46.3% | +43.3% | [2.3%, 84.3%] | 98% |

Source: Flagsmith dashboard, experiment 399, processed analysis as of 24 Nov 2026 03:25 UTC. Screenshots in `evidence/experiment-399/`.

**Reading**: both 95% credible intervals clear zero, so under Flagsmith's model both variations show a positive relative lift over control on this synthetic data. The hypothesis bar was 10 absolute points, and this record holds relative intervals only; there is no calibrated absolute-threshold posterior in the record, so the threshold status stays **unknown**: the data supports "positive lift", not "at least 10 points of lift."

The two challengers were each compared against control only. No direct challenger-vs-challenger comparison was established, and their similar point estimates (47.6% vs 46.3%) should not be read as one beating the other. Win probability is pairwise against control, not a ranking.

**What this run does and does not decide**: the visitors are synthetic fixtures with preset conversion probabilities, so no rollout recommendation and no CTA-efficacy conclusion follows. What the run demonstrates is the full pipeline working on real Flagsmith infrastructure (flag, exposures, events, Bayesian analysis) and the reading discipline a real result would demand: point estimate, interval, and the limit of what each supports. On real traffic, this is the point where a ship-or-wait decision would be made, and where the interval width would say how much more traffic that decision needs.

## Preset rates vs realized rates

Preset fixture probabilities: control 0.32, buy_now 0.46, get_it_today 0.38. Realized occurrence rates: 32.3%, 46.3%, 47.6%.

`get_it_today` realized well above its preset. This is expected behavior of a finite deterministic draw, not a bug: across all 450 identities the hash draw for that variation key converts 42.2% at a 0.38 preset, and the 145 identities Flagsmith bucketed into it happened to convert 47.6%. The 42.2% whole-pool figure reproduces exactly from the committed code. The 47.6% per-variation rate is conditional on Flagsmith's bucketing assignments for this run, and those assignments are not in the repo: the run record holds aggregate per-variation counts only, so assignment-level rates cannot be reconstructed from it. The 47.6% figure is Flagsmith's recorded analysis of the events as sent; a fresh run could bucket the same identities differently and realize a different per-variation rate. The fixture label means none of this says anything about real copy performance.

This read can be regenerated offline from the run record: `node scripts/read-experiment-result.mjs test/fixtures/run-report-399.json` (the committed fixture is a byte-identical copy of the recorded run report) prints the interval read, the threshold support check (reported **unknown** here, because only relative-delta intervals are recorded and relative bound x observed baseline is illustrative arithmetic, not a calibrated absolute-lift bound), the preset-versus-realized comparison and the validity checks below, reporting **unknown** wherever the record does not contain the evidence.

## Validity checks

The hackathon's published guidance names four wiring mistakes that quietly invalidate a result. All four were checked against this run:

1. **Stable identifier**: visitors keep one identity (`localStorage` in the browser page, fixed synthetic ids in the traffic script). No per-request reassignment.
2. **Balanced exposures**: 158 / 147 / 145 against weights 34 / 33 / 33. No one-sided exposure.
3. **Conversions firing**: 188 conversion events tracked at the moment of the CTA action, with the same identifier as the exposure. Warehouse total confirmed.
4. **Multivariate from the start**: the flag was created with keyed variations before any traffic; nothing was converted from a boolean mid-run.

Of these four, exposure balance and conversion-count consistency are machine-checkable from the run record, and the reader reports them. The stable-identifier and multivariate-from-start checks rest on the recorded design and dashboard evidence, not on a per-identity log or a flag-creation record, so the reader honestly reports them as **unknown** rather than machine-verified.

## Limitations

- **Synthetic visitors with preset probabilities.** The plumbing, events and analysis are real Flagsmith; the efficacy conclusion is a fixture, by design.
- **No guardrail metric.** Only checkout completion was tracked. A guardrail (a metric expected *not* to move, to catch collateral damage) cannot be retrofitted onto a completed run and is on the list for any follow-up experiment.
- **Single fixed run, one metric, occurrence aggregation, fixed order value, short window.** No revenue weighting, no segmentation, no repeat exposure.

## Optional next validation (not yet run)

An A/A plumbing check: a new flag with two identical variations at equal preset conversion rates, a fixed 300-visitor single run decided in advance, one analysis read, and the outcome reported whichever way it lands. Two identical variations would be expected to show no systematic difference, though a chance positive remains possible even with perfectly sound wiring: any model produces positives at its error rate, so a positive A/A result would not by itself prove a wiring fault. Whatever the outcome, it would be reported as observed and investigated, not silently rerun until it looks clean. A null outcome would be one more consistency signal about the plumbing, not proof that the plumbing is correct. It says nothing about CTA copy, and it requires creating a new flag and experiment in the Flagsmith org, so it waits for explicit approval.
