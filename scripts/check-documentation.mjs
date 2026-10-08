// Source coverage and local link checks; not a provider or usability certification.
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";

function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)]);
}
const reference = readFileSync("docs/IMPLEMENTATION-REFERENCE.md", "utf8");
const routes = files("app").filter(path => path.endsWith("/route.ts") && (path.startsWith("app/api/") || path === "app/auth/callback/route.ts"));
for (const path of routes) {
  assert.ok(reference.includes(`../${path}`), `Missing handler: ${path}`);
  for (const method of readFileSync(path, "utf8").matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\b/g)) {
    const row = reference.split("\n").find(line => line.includes(`../${path}`));
    assert.ok(row.includes(method[1]), `Missing method: ${method[1]} ${path}`);
  }
}
const migrations = files("supabase/migrations").filter(path => path.endsWith(".sql"));
let tables = 0;
for (const path of migrations) {
  for (const match of readFileSync(path, "utf8").matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?([\w.]+)/gi)) {
    assert.ok(reference.includes(`| \`${match[1]}\` |`) && reference.includes(`../${path}`), `Missing table: ${match[1]}`);
    tables++;
  }
}
const source = [...files("app"), ...files("lib"), ...files("scripts")].filter(path => /\.(ts|tsx|mjs)$/.test(path) && !path.includes(".test.")).map(path => readFileSync(path, "utf8")).join("\n");
const settings = new Set([...source.matchAll(/(?:process\.env|env)\.([A-Z][A-Z0-9_]+)/g), ...readFileSync(".env.example", "utf8").matchAll(/^([A-Z][A-Z0-9_]+)=/gm)].map(match => match[1]));
for (const setting of settings) assert.ok(reference.includes(`\`${setting}\``), `Missing setting: ${setting}`);
const checks = [...files("lib"), ...files("scripts"), ...files("supabase/tests")].filter(path => path.endsWith(".test.mjs") || (path.startsWith("supabase/tests/") && path.endsWith(".sql")));
for (const path of checks) assert.ok(reference.includes(`../${path}`), `Missing runnable check: ${path}`);
const progress = readFileSync("docs/product/PRODUCTION-PROGRESS.md", "utf8");
for (let feature = 1; feature <= 41; feature++) assert.ok(new RegExp(`\\| ${feature} \\|`).test(progress), `Missing feature: ${feature}`);
let links = 0;
for (const path of [...files("docs").filter(path => path.endsWith(".md")), "README.md", "DEPLOYMENT.md"]) {
  for (const match of readFileSync(path, "utf8").matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1];
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    const local = target.split("#")[0];
    assert.ok(existsSync(resolve(dirname(path), local)), `Broken link: ${path} -> ${target}`);
    links++;
  }
}
console.log(`Documentation coverage PASS: ${routes.length} handlers, ${tables} table creations, ${settings.size} settings, ${checks.length} checks, 41 features, ${links} repository links.`);
