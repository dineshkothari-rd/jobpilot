import type { Metadata } from "next";
import Link from "next/link";
export const metadata: Metadata = {
  title: "Terms of use",
  alternates: { canonical: "/terms" },
};
export default function Terms() {
  return (
    <article className="max-w-3xl space-y-6">
      <h1 className="text-3xl font-bold">Terms of use</h1>
      <p>
        Updated 7 October 2026. Business/service name: JobPilot. We are
        launching as a free job-search and recruiting workspace. No payment or
        subscription is required in this release.
      </p>
      <section>
        <h2 className="text-xl font-semibold">Using the service</h2>
        <p className="mt-3">
          Provide accurate information and use only resumes, company material
          and job listings you are authorized to share. Keep your account
          credentials private. Do not impersonate employers or candidates, post
          fraudulent jobs, scrape private profiles, send spam or attempt to
          bypass access controls and usage limits.
        </p>
      </section>
      <section>
        <h2 className="text-xl font-semibold">Applications and hiring</h2>
        <p className="mt-3">
          You review and confirm JobPilot-hosted applications before submission.
          Saving a job or accepting a sourcing interview does not submit an
          application. External listings link to their original application
          sites, whose rules apply there. Employers control hiring decisions;
          company verification confirms hiring authority and is not a guarantee
          of every employer claim. Never pay an application fee. Report
          suspicious listings through JobPilot.
        </p>
      </section>
      <section>
        <h2 className="text-xl font-semibold">Content and guidance</h2>
        <p className="mt-3">
          You retain ownership of your content and permit JobPilot to process
          and display it as needed for the sharing settings and actions you
          choose. Salary insights, match scores and AI-assisted drafts are
          guidance. Review generated material and source information before
          using it. Job availability, accuracy, interviews and employment
          outcomes are not guaranteed.
        </p>
      </section>
      <section>
        <h2 className="text-xl font-semibold">
          Availability and account controls
        </h2>
        <p className="mt-3">
          This first release may change and may have downtime or usage limits.
          Use personal export to keep a copy of your important records. You may
          stop using the service or delete your account through Profile. Future
          paid offerings will require separately disclosed terms and explicit
          purchase; this release does not activate billing.
        </p>
      </section>
      <p>
        Read the{" "}
        <Link href="/privacy" className="underline">
          privacy notice
        </Link>{" "}
        for data controls. Contact{" "}
        <Link href="/help" className="underline">
          Help & support
        </Link>{" "}
        or email{" "}
        <a href="mailto:dineshkothari2021@gmail.com" className="underline">
          dineshkothari2021@gmail.com
        </a>{" "}
        about access, content or account concerns.
      </p>
    </article>
  );
}
