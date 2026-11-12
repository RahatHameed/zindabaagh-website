// Builds cms/compose.yml (the Docker Compose file of the Coolify service zindabaagh-cms) from
// compose.template.yml, the upload-guard extension and the backup script.
//   node cms/make-compose.mjs
// Then paste compose.yml into Coolify: zindabaagh-cms -> Edit Compose File -> Validate -> Save,
// and use Restart -> Force Restart.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(here, p), "utf8").replace(/\r\n/g, "\n");
const indent = (text, n) => text.replace(/\n+$/, "").split("\n").map((l) => (l ? " ".repeat(n) + l : "")).join("\n");

const pkg = read("extensions/upload-guard/package.json");
const guard = read("extensions/upload-guard/index.js");
// Coolify reads a dollar sign in the compose file as a variable.
for (const [name, text] of [["package.json", pkg], ["index.js", guard]]) {
  if (text.includes("$")) throw new Error(`extensions/upload-guard/${name} must not contain a dollar sign`);
}
const backup = Buffer.from(read("backup/backup.sh")).toString("base64");

const out = read("compose.template.yml")
  .replace("{{UPLOAD_GUARD_PACKAGE}}", indent(pkg, 10))
  .replace("{{UPLOAD_GUARD_INDEX}}", indent(guard, 10))
  .replace("{{BACKUP_SCRIPT_BASE64}}", backup);
if (out.includes("{{")) throw new Error("a placeholder was not filled");
writeFileSync(join(here, "compose.yml"), out);
console.log(`cms/compose.yml written (${out.length} characters)`);
