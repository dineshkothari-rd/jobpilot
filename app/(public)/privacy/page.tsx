import type { Metadata } from "next";
import Link from "next/link";
export const metadata: Metadata = {
  title: "Privacy",
  alternates: { canonical: "/privacy" },
};
export default function Privacy() {
  return (
    <article className="max-w-3xl space-y-6">
      <h1 className="text-3xl font-bold">Privacy at Parth Careers</h1>
      <p>
        Updated 8 October 2026. Parth Careers operates this job-search and recruiting workspace.
        This page explains the current product.
      </p>
      <section>
        <h2 className="text-xl font-semibold">Information you provide</h2>
        <p className="mt-3">
          Your account email and sign-in details, profile, resumes and parsed
          resume text, preferences, saved jobs, applications, interview notes
          and support requests are stored to run your workspace. Employers
          provide company details, verification evidence, job postings, branding
          and recruiting records.
        </p>
      </section>
      <section>
        <h2 className="text-xl font-semibold">Who can see it</h2>
        <p className="mt-3">
          Your candidate workspace is private by default. Verified recruiters
          can search profiles only when you opt in. Anonymous mode hides your
          name, contact and resume. Contact details and a selected resume
          require separate choices. Explicit job applications share the
          profile/resume snapshot and cover note you reviewed with that
          employer; withdraw an application separately. Conversation
          participants can read their messages. Administrators review company
          evidence, reports, support requests and account review cases.
        </p>
        <p className="mt-3">
          Published jobs and published verified-employer branding are publicly
          readable and may be indexed by search engines. Optional
          profile-sharing changes affect future access; recipients may retain
          material already received.
        </p>
      </section>
      <section>
        <h2 className="text-xl font-semibold">Services and cookies</h2>
        <p className="mt-3">
          Supabase handles account authentication, database records and resume
          file storage. Hosting processes requests and operational errors.
          Google sign-in is optional. Essential session cookies keep you signed
          in; this release does not add advertising trackers. If enabled,
          email/push providers deliver opted-in notices and calendar providers
          receive interview details you choose to sync. Calendar authorization
          tokens stay server-side and are excluded from personal exports.
          Hosted checkout is processed by Razorpay when configured. Parth Careers stores checkout/payment references, amounts, refund/dispute state and plan access; it does not store card numbers or bank authentication credentials. Connected services have their own privacy terms.
        </p>
        <p className="mt-3">
          AI-assisted tools may send the relevant resume, profile or job text to
          the AI provider configured for that feature. Do not upload secrets or
          information you are not permitted to share.
        </p>
      </section>
      <section>
        <h2 className="text-xl font-semibold">Your controls</h2>
        <p className="mt-3">
          Profile settings let you change recruiter visibility, notification
          preferences and calendar connections, export your records as JSON and
          request permanent account deletion. Export includes resume text and
          metadata, not original PDF binaries or provider tokens. Deletion
          removes active account records and stored resumes; failed cleanup is
          reported for retry. Payment and dispute records retain their transaction details with the account owner link removed when native account deletion completes. Account deletion does not itself cancel a provider subscription; cancel renewal in Billing first. Operational logs and backups may follow the
          hosting providers’ retention rules; deletion from every provider
          backup is not promised.
        </p>
      </section>
      <section>
        <h2 className="text-xl font-semibold">Questions and requests</h2>
        <p className="mt-3">
          Use{" "}
          <Link href="/help" className="underline">
            Help & support
          </Link>{" "}
          to submit an authenticated request. For account-access or privacy
          requests, email{" "}
          <a className="underline" href="mailto:dineshkothari2021@gmail.com">
            dineshkothari2021@gmail.com
          </a>
          . Include the affected account email, but never your password,
          verification code or full resume.
        </p>
      </section>
    </article>
  );
}
