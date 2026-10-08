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
        Updated 8 October 2026. Business/service name: Parth Careers. Free access and optional paid candidate/recruiter plans are described on Plans and pricing.
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
          You review and confirm Parth Careers-hosted applications before submission.
          Saving a job or accepting a sourcing interview does not submit an
          application. External listings link to their original application
          sites, whose rules apply there. Employers control hiring decisions;
          company verification confirms hiring authority and is not a guarantee
          of every employer claim. Never pay an application fee. Report
          suspicious listings through Parth Careers.
        </p>
      </section>
      <section>
        <h2 className="text-xl font-semibold">Content and guidance</h2>
        <p className="mt-3">
          You retain ownership of your content and permit Parth Careers to process
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
          stop using the service or delete your account through Profile. Cancel a paid subscription renewal from Billing before deleting your account; deleting an account alone does not cancel a payment-provider mandate.
        </p>
      </section>
      <section><h2 className="text-xl font-semibold">Subscriptions, posting credits and refunds</h2><p className="mt-3">Review the product, currency and final amount on secure hosted checkout before confirming a purchase. Monthly subscriptions authorize up to 12 recurring charges. Cancel renewal in Billing; cancellation at cycle end does not request a refund of an earlier payment. Posting packages are one-time purchases. When paid posting is active, one credit is spent on first publication; pausing/resuming the same opening does not spend another credit. Closing/deleting a posting does not return a spent credit.</p><p className="mt-3">For a billing error or refund request, contact support with the payment reference. Verified refunds reverse associated access/credits; refunded credits already used become a negative balance. Unresolved payment disputes hold the associated purchased access. A purchase does not guarantee employment, candidate responses or hiring outcomes. Parth Careers payment receipts are not tax invoices; merchant/provider invoice details apply where issued. Payment setup may be unavailable while activation is pending, and test transactions never grant live access.</p></section>
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
