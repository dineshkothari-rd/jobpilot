export type EquityFilter = "all" | "mentioned" | "range";

export type EquityDetails = {
  minPercent: number | null;
  maxPercent: number | null;
  evidence: string;
};

export function equityDetails(description: string | null | undefined): EquityDetails | null {
  if (!description) return null;
  const text = description.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/?(?:p|div|li|br|h[1-6])\b[^>]*>/gi, "\n").replace(/<[^>]*>/g, " ").replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&(?:ndash|mdash);|&#(?:8211|8212);/gi, "–");
  let mention: EquityDetails | null = null;
  // ponytail: explicit English disclosures only; add source-specific structured fields when providers expose them.
  for (const line of text.split(/\n|[.!?]\s+/)) {
    const evidence = line.replace(/\s+/g, " ").trim();
    if (!/\b(?:equity|esops?|stock options?|rsus?|restricted stock units?)\b/i.test(evidence)) continue;
    if (/\b(?:no|not|without|zero)\b|\b(?:diversity|inclusion|pay equity|private equity|equity research)\b/i.test(evidence)) continue;
    const range = evidence.match(/\b(?:equity|esops?|stock options?|rsus?)\s*(?:of|:|grant|range)?\s*(\d+(?:\.\d+)?)\s*%?\s*(?:-|–|—|to)\s*(\d+(?:\.\d+)?)\s*%/i)
      || evidence.match(/\b(\d+(?:\.\d+)?)\s*%?\s*(?:-|–|—|to)\s*(\d+(?:\.\d+)?)\s*%\s*(?:in\s+)?(?:equity|esops?|stock options?|rsus?)\b/i);
    const single = /\b(?:up to|at least|more than|less than|maximum|minimum)\b/i.test(evidence) ? null : evidence.match(/\b(?:equity|esops?)\s*(?:of|:|grant)?\s*(\d+(?:\.\d+)?)\s*%/i)
      || evidence.match(/\b(\d+(?:\.\d+)?)\s*%\s*(?:in\s+)?(?:equity|esops?)\b/i);
    const min = range ? Number(range[1]) : single ? Number(single[1]) : null;
    const max = range ? Number(range[2]) : single ? Number(single[1]) : null;
    if (min != null && max != null && min > 0 && max >= min && max <= 100) {
      return { minPercent: min, maxPercent: max, evidence: evidence.slice(0, 500) };
    }
    if (/\b(?:competitive|generous|meaningful)\s+(?:equity|esops?)\b|\b(?:equity|esops?|stock options?|rsus?)\s*(?:compensation|package|grant|offered|included|available|plan)\b|\b(?:offer|receive|includes?|benefits)\b.{0,60}\b(?:equity|esops?|stock options?|rsus?)\b/i.test(evidence)) {
      mention ||= { minPercent: null, maxPercent: null, evidence: evidence.slice(0, 500) };
    }
  }
  return mention;
}

export function formatEquity(details: EquityDetails | null): string {
  if (!details) return "Equity not disclosed";
  if (details.minPercent == null || details.maxPercent == null) return "Equity / ESOP mentioned · range not disclosed";
  return details.minPercent === details.maxPercent
    ? `${details.minPercent}% equity / ESOP`
    : `${details.minPercent}–${details.maxPercent}% equity / ESOP`;
}

export function matchesEquity(description: string | null | undefined, filter: EquityFilter): boolean {
  if (filter === "all") return true;
  const details = equityDetails(description);
  return filter === "mentioned" ? details != null : details?.minPercent != null;
}
