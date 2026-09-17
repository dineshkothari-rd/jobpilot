import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { compile } from "@tailwindcss/node";

test("shared semantic colors generate actual Tailwind surface, action and focus utilities", async () => {
  const stylesheet = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const compiler = await compile(stylesheet, { base: fileURLToPath(new URL("..", import.meta.url)), onDependency() {} });
  const css = compiler.build(["bg-background", "bg-primary", "text-primary-foreground", "border-border", "ring-ring"]);
  for (const [utility, token] of [["bg-background", "background"], ["bg-primary", "primary"], ["text-primary-foreground", "primary-foreground"], ["border-border", "border"], ["ring-ring", "ring"]]) {
    assert.match(css, new RegExp("\\." + utility + "\\s*\\{[^}]*var\\(--" + token + "\\)"), utility + " must not be missing or transparent");
  }
});
