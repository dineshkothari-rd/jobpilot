import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { chmod, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { verifyBackup } from "./verify-backup.mjs";
test("backup verification accepts intact private dumps, rejects corruption, disclosure permissions, links and hostile manifest paths", async () => {
  const root = await mkdtemp(join(tmpdir(), "jobpilot-backup-check-"));
  try {
    await chmod(root, 0o700);
    const files = ["roles.sql", "schema.sql", "data.sql"];
    const content = "-- private fixture\n";
    for (const name of files) await writeFile(join(root, name), content, { mode: 0o600 });
    const manifest = files.map(name => `${createHash("sha256").update(content).digest("hex")}  ${name}`).join("\n") + "\n";
    await writeFile(join(root, "SHA256SUMS"), manifest, { mode: 0o600 });
    assert.match(await verifyBackup(root), /passed SHA256/);
    await writeFile(join(root, "data.sql"), "tampered");
    await assert.rejects(verifyBackup(root), /checksum mismatch/);
    await writeFile(join(root, "data.sql"), content);
    await chmod(join(root, "data.sql"), 0o644);
    await assert.rejects(verifyBackup(root), /private regular files/);
    await chmod(join(root, "data.sql"), 0o600);
    await writeFile(join(root, "SHA256SUMS"), manifest.replace("data.sql", "../private.sql"));
    await assert.rejects(verifyBackup(root), /Invalid checksum/);
    await writeFile(join(root, "SHA256SUMS"), manifest);
    await rm(join(root, "data.sql"));
    await symlink(join(root, "roles.sql"), join(root, "data.sql"));
    await assert.rejects(verifyBackup(root));
    await chmod(root, 0o755);
    await assert.rejects(verifyBackup(root), /private directory/);
    await assert.rejects(verifyBackup("relative"), /absolute/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
