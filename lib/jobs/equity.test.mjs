import test from "node:test";
import assert from "node:assert/strict";
import { equityDetails, formatEquity, matchesEquity } from "./equity.ts";
import { validateSavedSearchCriteria, formatCriteriaSummary } from "./saved-searches.ts";

test("extracts only explicitly associated percentage ranges and retains source evidence", () => {
  const description = "<p>We offer stock options.</p><p>Equity: <strong>0.1%–0.5%</strong></p>";
  assert.deepEqual(equityDetails(description), { minPercent: 0.1, maxPercent: 0.5, evidence: "Equity: 0.1%–0.5%" });
  assert.equal(formatEquity(equityDetails(description)), "0.1–0.5% equity / ESOP");
  assert.equal(formatEquity(equityDetails("Receive 0.25% equity")), "0.25% equity / ESOP");
  assert.equal(equityDetails("ESOP range 0.2 to 0.8%").maxPercent, 0.8);
  assert.equal(equityDetails("0.2–0.8% in equity").minPercent, 0.2);
});

test("does not invent ranges from unrelated percentages, negatives or compensation mentions", () => {
  for (const text of [null, "", "No equity offered", "We do not offer stock options", "Pay equity and diversity", "Private equity analyst", "Manage stock options for clients", "Equity 0%", "Equity 10–5%", "Equity 101–110%", "<script>Equity 1–2%</script>"]) {
    assert.equal(equityDetails(text), null, String(text));
  }
  for (const text of ["Competitive equity", "Benefits include stock options and a 20% bonus", "We offer up to 1% equity", "Equity compensation: details on request"]) {
    const details = equityDetails(text);
    assert.equal(details.minPercent, null, text);
    assert.equal(details.maxPercent, null, text);
    assert.equal(matchesEquity(text, "mentioned"), true);
    assert.equal(matchesEquity(text, "range"), false);
  }
  assert.equal(matchesEquity(null, "all"), true);
  assert.equal(matchesEquity(null, "mentioned"), false);
  assert.equal(matchesEquity("Equity 0.1–0.5%", "range"), true);
});

test("saved equity filters survive validation and produce readable summaries", () => {
  for (const equity of ["all", "mentioned", "range"]) {
    assert.equal(validateSavedSearchCriteria({ equity }).criteria.equity, equity);
  }
  assert.equal(validateSavedSearchCriteria({ equity: "invented" }).criteria.equity, undefined);
  assert.equal(validateSavedSearchCriteria({ equity: ["range"] }).criteria.equity, undefined);
  assert.deepEqual(formatCriteriaSummary({ equity: "range" }), ["Equity % disclosed"]);
  assert.deepEqual(formatCriteriaSummary({ equity: "mentioned" }), ["Equity mentioned"]);
  assert.deepEqual(formatCriteriaSummary({ equity: "all" }), ["All open roles"]);
});
