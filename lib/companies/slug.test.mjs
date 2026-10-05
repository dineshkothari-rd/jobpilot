import assert from "node:assert/strict";
import test from "node:test";
import * as slugUtils from "./slug.ts";

test("companyToSlug creates URL-safe slugs", () => {
  assert.equal(slugUtils.companyToSlug("Google"), "google");
  assert.equal(slugUtils.companyToSlug("Stripe, Inc."), "stripe-inc");
  assert.equal(slugUtils.companyToSlug("Razorpay Software Pvt. Ltd."), "razorpay-software-pvt-ltd");
  assert.equal(slugUtils.companyToSlug("AT&T"), "att");
  assert.equal(slugUtils.companyToSlug("  L'Oréal  "), "loreal");
  assert.equal(slugUtils.companyToSlug(""), "unknown-company");
  assert.equal(slugUtils.companyToSlug(null), "unknown-company");
});

test("slugToSearchTerm unsluggifies safely for queries", () => {
  assert.equal(slugUtils.slugToSearchTerm("stripe-inc"), "stripe inc");
  assert.equal(slugUtils.slugToSearchTerm("razorpay-software"), "razorpay software");
  assert.equal(slugUtils.slugToSearchTerm(""), "");
});

test("extractCompanyDomain strips subdomains and filters out generic job boards", () => {
  assert.equal(slugUtils.extractCompanyDomain("https://www.stripe.com/jobs"), "stripe.com");
  assert.equal(slugUtils.extractCompanyDomain("https://careers.google.com/about"), "careers.google.com");
  assert.equal(slugUtils.extractCompanyDomain("https://himalayas.app/jobs/123"), null);
  assert.equal(slugUtils.extractCompanyDomain("https://remotive.com/job/456"), null);
  assert.equal(slugUtils.extractCompanyDomain("invalid-url"), null);
  assert.equal(slugUtils.extractCompanyDomain(""), null);
});
