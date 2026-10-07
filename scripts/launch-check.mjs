// Read-only external smoke check; no authentication, accounts, payments or messages created.
import assert from "node:assert/strict";
const origin = process.argv[2];
assert.ok(
  origin && /^https?:\/\//.test(origin),
  "Usage: node scripts/launch-check.mjs https://your-deployment",
);
const paths = [
  "/",
  "/opportunities",
  "/privacy",
  "/terms",
  "/help",
  "/plans",
  "/robots.txt",
  "/sitemap.xml",
  "/favicon.ico",
  "/icon.png",
  "/apple-icon.png",
];
let failures = 0;
for (const path of paths) {
  try {
    const r = await fetch(new URL(path, origin), { redirect: "manual", signal: AbortSignal.timeout(15000) });
    assert.equal(r.status, 200);
    if (path === "/") {
      assert.equal(r.headers.get("x-content-type-options"), "nosniff");
      assert.equal(r.headers.get("x-frame-options"), "DENY");
    }
    if (!path.endsWith(".png") && !path.endsWith(".ico")) {
      const text = await r.text();
      assert.ok(text.length > 50);
      if (path === "/sitemap.xml")
        assert.ok(!/\/profiles\/|\/inbox|\/applications/.test(text));
    }
    console.log(`PASS ${path}`);
  } catch {
    failures++;
    console.error(`FAIL ${path}`);
  }
}
for (const path of [
  "/api/hiring-messages",
  "/api/admin/operations",
  "/api/admin/readiness",
  "/api/notifications/history",
  "/api/recruiter/candidates",
  "/api/plans/usage",
  "/api/admin/roles",
  "/api/admin/suspensions",
  "/api/admin/plans",
]) {
  try {
    const r = await fetch(new URL(path, origin), { redirect: "manual", signal: AbortSignal.timeout(15000) });
    assert.equal(r.status, 401);
    assert.equal(r.headers.get("cache-control"), "private, no-store");
    console.log(`PASS protected ${path}`);
  } catch {
    failures++;
    console.error(`FAIL protected ${path}`);
  }
}
process.exitCode = failures ? 1 : 0;
