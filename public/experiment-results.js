// FlagProof experiment results: renders the recorded synthetic analysis from the
// saved evidence record. This page never contacts Flagsmith; every number below
// comes from /evidence-experiment-399.json, the byte-identical copy of the
// recorded run report (test/fixtures/run-report-399.json). Relative deltas and
// intervals are labeled as relative; the hypothesis threshold is absolute
// percentage points, and the record cannot confirm it — see the conclusion.
const $ = (s) => document.querySelector(s);

function cell(text) {
  const td = document.createElement("td");
  td.textContent = text;
  return td;
}

// Recorded deltas/intervals are relative percents; display them with explicit % units.
function relPct(text) {
  return text === "Baseline" ? text : `${text}%`;
}

function relInterval(text) {
  if (text === "Baseline") return text;
  const m = text.match(/^\[(.+), (.+)\]$/);
  return m ? `[${m[1]}%, ${m[2]}%]` : text;
}

function winPct(value) {
  return `${value}%`;
}

try {
  const report = await fetch("/evidence-experiment-399.json", { cache: "no-store" }).then((r) => {
    if (!r.ok) throw new Error(`Evidence record unavailable (HTTP ${r.status})`);
    return r.json();
  });
  const { experiment, analysis, label, reproducibility, trafficRun } = report;

  $("#mode").textContent = `SAVED SYNTHETIC RESULTS \u00B7 recorded ${analysis.asOf} \u00B7 not a live feed`;
  $("#exp-name").textContent = experiment.name;
  $("#intro").textContent = label;
  $("#hypothesis").textContent = experiment.hypothesis;
  $("#meta").textContent = `Flag: ${experiment.flag} \u00B7 Metric: ${experiment.metricEvent} (${experiment.metricAggregation}) \u00B7 Traffic run: ${trafficRun.executedAt} \u00B7 ${trafficRun.command}`;

  const detail = $("#detail");
  const showDetail = (v) => {
    const preset = trafficRun.presetConversionRates?.[v.key];
    const pool = reproducibility.wholePoolRealizedRates?.[v.key];
    const parts = [
      `${v.key}: ${v.exposures} exposures \u00B7 ${v.occurrenceRatePct}% occurrence rate`,
      v.deltaPct === "Baseline"
        ? "Baseline variation: pairwise comparisons are measured against it."
        : `Relative delta vs control ${v.deltaPct}% \u00B7 95% credible interval (relative) ${relInterval(v.credibleInterval95Pct)} \u00B7 win probability vs control ${winPct(v.winProbabilityPct)}`,
      preset != null && pool != null
        ? `Synthetic fixtures: preset conversion rate ${preset}, whole-pool draw ${(pool * 100).toFixed(1)}%, realized within this run's bucketed identities ${v.occurrenceRatePct}%. Realized rates are conditional on this run's recorded bucketing.`
        : null,
    ].filter(Boolean);
    detail.textContent = parts.join("\n");
    detail.hidden = false;
  };

  const tbody = $("#rows");
  for (const v of analysis.variations) {
    const tr = document.createElement("tr");
    tr.append(
      cell(v.key),
      cell(String(v.exposures)),
      cell(`${v.occurrenceRatePct}%`),
      cell(relPct(String(v.deltaPct))),
      cell(relInterval(String(v.credibleInterval95Pct))),
      cell(winPct(v.winProbabilityPct)),
    );
    tr.className = "result-row";
    tr.tabIndex = 0;
    const activate = () => showDetail(v);
    tr.addEventListener("click", activate);
    tr.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(); } });
    tbody.appendChild(tr);
  }
  $("#note").textContent = analysis.note;

  const max = Math.max(...analysis.variations.map((v) => v.occurrenceRatePct));
  const bars = $("#bars");
  for (const v of analysis.variations) {
    const row = document.createElement("div");
    row.className = "result-bar-row";
    const name = document.createElement("span");
    name.className = "result-bar-label";
    name.textContent = v.key;
    const track = document.createElement("span");
    track.className = "result-bar-track";
    const fill = document.createElement("span");
    fill.className = "result-bar-fill";
    fill.style.width = `${(v.occurrenceRatePct / max) * 100}%`;
    const val = document.createElement("span");
    val.className = "result-bar-value";
    val.textContent = `${v.occurrenceRatePct}%`;
    track.appendChild(fill);
    row.append(name, track, val);
    bars.appendChild(row);
  }

  // Grounded conclusion, mirroring scripts/read-experiment-result.mjs on this record:
  // the recorded intervals are RELATIVE; the hypothesis threshold is ABSOLUTE points.
  const baseline = analysis.variations.find((v) => v.deltaPct === "Baseline");
  const thresholdMatch = experiment.hypothesis.match(/at least (\d+(?:\.\d+)?) percentage points/);
  const threshold = thresholdMatch ? Number(thresholdMatch[1]) : null;
  const challengers = analysis.variations.filter((v) => v.deltaPct !== "Baseline");
  const conclusions = [
    `Both challengers show positive lift over control under Flagsmith's Bayesian model on this recorded data; both relative 95% credible intervals clear zero.`,
    threshold != null && baseline
      ? `The pre-registered threshold (${threshold} absolute percentage points on the observed ${baseline.occurrenceRatePct}% baseline) is not established by this record: the recorded analysis holds relative-delta intervals only, and this read has no calibrated absolute-threshold posterior. Threshold status: unknown.`
      : null,
    analysis.note,
    `No direct challenger-vs-challenger comparison is established by this record.`,
    `All visitor data is synthetic demo traffic with preset conversion probabilities: no rollout or efficacy conclusion follows.`,
  ].filter(Boolean);
  const ul = $("#conclusions");
  for (const c of conclusions) {
    const li = document.createElement("li");
    li.textContent = c;
    ul.appendChild(li);
  }

  const rates = Object.entries(reproducibility.wholePoolRealizedRates)
    .map(([k, r]) => `${k} ${(r * 100).toFixed(1)}%`)
    .join(", ");
  $("#method").textContent = `${reproducibility.explanation}\n\nWhole-pool realized rates (all ${trafficRun.identityCount} identities per variation key): ${rates}.\nPreset conversion rates: ${Object.entries(trafficRun.presetConversionRates).map(([k, r]) => `${k} ${r}`).join(", ")}.\nWarehouse confirmation: ${trafficRun.warehouseConfirmation}.`;
  $("#verified").textContent = `Source: ${analysis.source}. Verified ${analysis.verifiedAt}.`;
  window.flagproofReady = true;
} catch (error) {
  $("#mode").textContent = "Saved results unavailable";
  $("#setup-error").textContent = error.message;
  window.flagproofReady = false;
}
