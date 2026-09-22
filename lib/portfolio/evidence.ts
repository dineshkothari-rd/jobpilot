export type EvidenceInput = {
  title: string;
  problem: string;
  contribution: string;
  outcome: string;
  skills: string[];
  evidence_url: string;
  source_kind: "manual" | "learning";
  source_ref: string | null;
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const evidenceId = (value: unknown): value is string => typeof value === "string" && uuid.test(value);

function text(row: Record<string, unknown>, key: string, max: number, required = false) {
  if (typeof row[key] !== "string" || row[key].length > max || (required && !row[key].trim())) throw new Error(`Check the ${key.replaceAll("_", " ")}.`);
  return row[key].trim();
}

function publicUrl(value: string) {
  if (!value) return "";
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("Use a public HTTPS evidence link."); }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || url.username || url.password || url.port || !host.includes(".") || /^\d+(?:\.\d+){3}$/.test(host) || host.includes(":") || host.endsWith(".local")) throw new Error("Use a public HTTPS evidence link without credentials or a custom port.");
  url.hash = "";
  return url.href;
}

export function parseEvidence(value: unknown): EvidenceInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Check the evidence details.");
  const row = value as Record<string, unknown>;
  const fields = ["title", "problem", "contribution", "outcome", "skills", "evidence_url", "source_kind", "source_ref"];
  if (Object.keys(row).some(key => !fields.includes(key))) throw new Error("Unsupported evidence field.");
  if (!Array.isArray(row.skills) || row.skills.length > 30) throw new Error("Use up to 30 skills.");
  const skills = row.skills.map(skill => typeof skill === "string" ? skill.trim() : "").filter(Boolean);
  if (skills.length !== row.skills.length || skills.some(skill => skill.length > 100) || new Set(skills.map(skill => skill.toLowerCase())).size !== skills.length) throw new Error("Use up to 30 unique skills, each under 100 characters.");
  if (row.source_kind !== "manual" && row.source_kind !== "learning") throw new Error("Choose a valid evidence source.");
  const sourceRef = row.source_ref === null ? null : text(row, "source_ref", 100, true);
  if ((row.source_kind === "manual" && sourceRef !== null) || (row.source_kind === "learning" && !sourceRef)) throw new Error("Check the evidence source.");
  const contribution = text(row, "contribution", 5000, true);
  if (contribution.length < 20) throw new Error("Describe your contribution in at least 20 characters.");
  return {
    title: text(row, "title", 180, true),
    problem: text(row, "problem", 2000),
    contribution,
    outcome: text(row, "outcome", 2000),
    skills,
    evidence_url: publicUrl(text(row, "evidence_url", 2000)),
    source_kind: row.source_kind,
    source_ref: sourceRef,
  };
}

export function resumeProjectEvidence(evidence: Pick<EvidenceInput, "title" | "contribution" | "outcome" | "skills" | "evidence_url">) {
  return [evidence.title, evidence.contribution, evidence.outcome && `Outcome: ${evidence.outcome}`, evidence.skills.length && `Skills: ${evidence.skills.join(", ")}`, evidence.evidence_url && `Evidence: ${evidence.evidence_url}`, "Self-reported project evidence; review every claim before using it in a resume."].filter(Boolean).join("\n");
}
