// Creates or updates a guide in Directus from a local file. Used by hand and by the reel skill.
//
//   node cms/publish-guide.mjs path/to/guide.json            (creates a draft)
//   node cms/publish-guide.mjs path/to/guide.json --publish  (publishes it)
//
// guide.json: { "slug": "student-visa-checklist", "title": "...", "description": "...",
//               "body": "<p>HTML...</p>"  or  "bodyFile": "guide.html",
//               "keyword": "VISA", "relatedTool": "visa-finder",
//               "coverFile": "cover.png", "coverAlt": "..." }   (optional: guide image, 1200x630,
//               shown on the guide, its card in the guides list and in link previews)
//
// Needs CMS_URL and CMS_TOKEN (the "Guide publisher" token), from the environment or from
// the file ~/.zindabaagh-cms.env (two lines: CMS_URL=... and CMS_TOKEN=...).
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

const env = { ...process.env };
try {
  for (const line of (await readFile(join(homedir(), ".zindabaagh-cms.env"), "utf8")).split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !env[m[1]]) env[m[1]] = m[2];
  }
} catch { /* no env file: use the environment */ }

const url = (env.CMS_URL || "https://cms.zindabaagh.com").replace(/\/+$/, ""), token = env.CMS_TOKEN;
const file = process.argv[2], publish = process.argv.includes("--publish");
if (!url || !token || !file) { console.error("Usage: node cms/publish-guide.mjs guide.json [--publish]   (needs CMS_URL and CMS_TOKEN)"); process.exit(1); }

const input = JSON.parse(await readFile(file, "utf8"));
const body = input.bodyFile ? await readFile(resolve(dirname(file), input.bodyFile), "utf8") : input.body;
for (const key of ["slug", "title", "description"]) if (!input[key]) { console.error(`guide.json is missing "${key}"`); process.exit(1); }
if (!body) { console.error('guide.json needs "body" or "bodyFile"'); process.exit(1); }
if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(input.slug)) { console.error("slug must be lowercase words joined with hyphens"); process.exit(1); }

async function api(method, path, data) {
  const res = await fetch(url + path, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: data ? JSON.stringify(data) : undefined });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${json.errors?.[0]?.message ?? ""}`);
  return json.data;
}

// Guide image: uploaded into the CMS default folder ("Public", readable by visitors). On an update the
// existing file is replaced in place, so its address stays the same.
async function uploadCover(existingId) {
  const path = resolve(dirname(file), input.coverFile);
  const name = path.split(/[\/]/).pop();
  const type = name.endsWith(".png") ? "image/png" : name.endsWith(".webp") ? "image/webp" : "image/jpeg";
  const form = new FormData();
  form.append("title", input.coverAlt || input.title);
  form.append("file", new Blob([await readFile(path)], { type }), `guide-${input.slug}.${name.split(".").pop()}`);
  const res = await fetch(url + (existingId ? `/files/${existingId}` : "/files"), { method: existingId ? "PATCH" : "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`cover upload: ${res.status} ${json.errors?.[0]?.message ?? ""}`);
  return json.data.id;
}

const item = {
  slug: input.slug, title: input.title, description: input.description, body,
  keyword: input.keyword ?? null, related_tool: input.relatedTool ?? null,
  date_published: new Date().toISOString().slice(0, 10),
  ...(publish ? { status: "published" } : {}),
};
const existing = (await api("GET", `/items/guides?filter[slug][_eq]=${input.slug}&fields=id,status,cover`))[0];
if (input.coverFile) item.cover = await uploadCover(existing?.cover);
const saved = existing ? await api("PATCH", `/items/guides/${existing.id}`, item) : await api("POST", "/items/guides", { status: "draft", ...item });

console.log(`${existing ? "Updated" : "Created"} guide "${saved.title}" (${saved.status}).`);
console.log(`Edit:   ${url}/admin/content/guides/${saved.id}`);
if (saved.cover) console.log(`Image:  ${url}/assets/${saved.cover}`);
console.log(`Public: https://zindabaagh.com/guides/${saved.slug}${saved.status === "published" ? "  (after the website has rebuilt)" : "  (once published)"}`);
