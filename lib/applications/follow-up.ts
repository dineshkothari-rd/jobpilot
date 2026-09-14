export type FollowUpStatus =
  | "saved"
  | "applied"
  | "screening"
  | "interview"
  | "offer"
  | "rejected"
  | "withdrawn";

const openings: Record<FollowUpStatus, string> = {
  saved: "I’m interested in the role and would welcome the opportunity to learn more about the team’s priorities.",
  applied: "I’m following up on my application and remain very interested in the opportunity.",
  screening: "Thank you for considering my application. I’m following up to ask whether there are any updates on next steps.",
  interview: "I’m following up regarding the interview process and remain excited about the opportunity.",
  offer: "Thank you for the offer. I’m following up regarding the next steps and timeline.",
  rejected: "Thank you for the update and for considering my application.",
  withdrawn: "I’m writing to confirm the update to my application and thank you for your time.",
};

export function buildFollowUpMessage({
  status,
  title,
  company,
  candidateName,
}: {
  status: FollowUpStatus;
  title: string | null;
  company: string | null;
  candidateName: string | null;
}) {
  const role = title?.trim() || "the role";
  const employer = company?.trim() || "your team";

  return {
    subject: `Following up: ${role} at ${employer}`,
    body: `Hello,

${openings[status]}

Please let me know if I can provide any additional information. I look forward to hearing from you.

Best regards,
${candidateName?.trim() || "[Your name]"}`,
  };
}
