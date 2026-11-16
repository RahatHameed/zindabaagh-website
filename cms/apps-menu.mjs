// One-off change in Directus (Site): the menu entry "Learn German" becomes "Apps" (/apps), and the ExamKlar
// card leaves the services (it is on the Apps page now). Run it only AFTER /apps is live on zindabaagh.com,
// otherwise the menu points to a missing page. Saving the Site item starts the "Rebuild website" flow.
//
//   node cms/apps-menu.mjs          shows what would change
//   node cms/apps-menu.mjs --write  makes the change
//
// Reads CMS_URL and CMS_ADMIN_TOKEN from the environment or from ~/.zindabaagh-cms.env.
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const env = { ...process.env };
try {
  for (const line of (await readFile(join(homedir(), ".zindabaagh-cms.env"), "utf8")).split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !env[m[1]]) env[m[1]] = m[2].trim();
  }
} catch {}
const url = (env.CMS_URL || "https://cms.zindabaagh.com").replace(/\/+$/, "");
if (!env.CMS_ADMIN_TOKEN) { console.error("CMS_ADMIN_TOKEN is missing in ~/.zindabaagh-cms.env"); process.exit(1); }
const write = process.argv.includes("--write");

const api = async (method, path, body) => {
  const res = await fetch(url + path, { method, headers: { Authorization: `Bearer ${env.CMS_ADMIN_TOKEN}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error(`${method} ${path}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).data;
};

if (write) {
  const live = await fetch("https://zindabaagh.com/apps");
  if (!live.ok) { console.error(`https://zindabaagh.com/apps answers ${live.status}: push the website first.`); process.exit(1); }
}

const site = await api("GET", "/items/site");
const nav = site.nav.map((n) => (n.label === "Learn German" ? { label: "Apps", href: "/apps" } : n));
const services = site.services.filter((s) => s.slug !== "examklar");
console.log("menu now:   ", site.nav.map((n) => n.label).join(" | "));
console.log("menu after: ", nav.map((n) => n.label).join(" | "));
console.log("services now:   ", site.services.map((s) => s.slug).join(", "));
console.log("services after: ", services.map((s) => s.slug).join(", "));
if (JSON.stringify(nav) === JSON.stringify(site.nav) && services.length === site.services.length) { console.log("Nothing to change."); process.exit(0); }
if (!write) { console.log("\nNothing was changed. Run again with --write to save."); process.exit(0); }
await api("PATCH", "/items/site", { nav, services });
console.log("\nSaved. The website rebuilds by itself in about a minute.");
