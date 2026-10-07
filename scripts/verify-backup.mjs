import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import { isAbsolute, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export async function verifyBackup(directory) {
  if (!isAbsolute(directory)) throw Error("Use an absolute private backup directory.");
  const root = await realpath(directory), repo = resolve(fileURLToPath(new URL("..", import.meta.url)));
  const stat = await lstat(directory);
  if (!stat.isDirectory() || (stat.mode & 0o077) || root === repo || root.startsWith(repo + sep)) throw Error("Use a private directory outside the repository.");
  async function privateFile(name) {
    const handle = await open(join(root, name), constants.O_RDONLY | constants.O_NOFOLLOW);
    const info = await handle.stat();
    if (!info.isFile() || info.size === 0 || (info.mode & 0o077)) { await handle.close(); throw Error("Backup files must be nonempty, private regular files."); }
    return handle;
  }
  const manifest = await privateFile("SHA256SUMS");
  let content;
  try {
    if ((await manifest.stat()).size > 1024) throw Error("Invalid checksum manifest.");
    content = await manifest.readFile("utf8");
  } finally { await manifest.close(); }
  const files = ["roles.sql", "schema.sql", "data.sql"], lines = content.trim().split(/\r?\n/);
  if (lines.length !== files.length) throw Error("Expected exactly three database checksums.");
  const checksums = new Map();
  for (const line of lines) {
    const match = /^([a-f0-9]{64})  (roles\.sql|schema\.sql|data\.sql)$/.exec(line);
    if (!match || checksums.has(match[2])) throw Error("Invalid checksum manifest.");
    checksums.set(match[2], match[1]);
  }
  for (const name of files) {
    const handle = await privateFile(name);
    try {
      const hash = createHash("sha256");
      for await (const chunk of handle.createReadStream({ autoClose: false })) hash.update(chunk);
      if (hash.digest("hex") !== checksums.get(name)) throw Error("Backup checksum mismatch. Do not restore this backup.");
    } finally { await handle.close(); }
  }
  return "Three private database dumps passed SHA256 verification. This does not verify restoration, storage binaries or off-device protection.";
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 3) throw Error("Usage: node scripts/verify-backup.mjs /absolute/private/backup-directory");
    console.log(await verifyBackup(process.argv[2]));
  } catch (cause) {
    // Never echo OS errors: they can reveal private paths; never print dump content.
    console.error(cause?.message?.startsWith("E") ? "Backup verification could not read protected files." : cause.message);
    process.exitCode = 1;
  }
}
