import assert from "node:assert/strict";
import test from "node:test";

import { getAuthCallbackUrl, getPasswordRecoveryUrl, getSiteUrl, safeInternalPath } from "./site-url.ts";

test("canonical site URL prefers NEXT_PUBLIC_SITE_URL and normalizes protocol/trailing slash", () => {
  assert.equal(
    getSiteUrl("https://preview.vercel.app", { NEXT_PUBLIC_SITE_URL: "jobpilot.example.com/" }),
    "https://jobpilot.example.com",
  );
});

test("production site URL never falls back to localhost", () => {
  assert.throws(
    () => getSiteUrl("http://localhost:3000", { NODE_ENV: "production" }),
    /NEXT_PUBLIC_SITE_URL/,
  );
});

test("safeInternalPath rejects external and protocol-relative redirects", () => {
  assert.equal(safeInternalPath("/jobs?tab=saved"), "/jobs?tab=saved");
  assert.equal(safeInternalPath("https://evil.example/jobs"), null);
  assert.equal(safeInternalPath("//evil.example/jobs"), null);
  assert.equal(safeInternalPath("javascript:alert(1)"), null);
});

test("OAuth callback URL uses canonical origin and only safe next paths", () => {
  assert.equal(
    getAuthCallbackUrl("/dashboard", "https://preview.vercel.app", { NEXT_PUBLIC_SITE_URL: "https://jobpilot.example.com" }),
    "https://jobpilot.example.com/auth/callback?next=%2Fdashboard",
  );
  assert.equal(
    getAuthCallbackUrl("https://evil.example", "https://preview.vercel.app", { NEXT_PUBLIC_SITE_URL: "https://jobpilot.example.com" }),
    "https://jobpilot.example.com/auth/callback",
  );
});

test("password recovery keeps the canonical callback and fixed update destination", () => {
  assert.equal(getPasswordRecoveryUrl("https://preview.vercel.app", { NEXT_PUBLIC_SITE_URL: "https://jobpilot.example.com" }), "https://jobpilot.example.com/auth/callback?next=%2Fauth%2Fupdate-password");
  assert.equal(getAuthCallbackUrl("/auth/update-password", "https://jobpilot.example.com", {}), "https://jobpilot.example.com/auth/callback");
});
