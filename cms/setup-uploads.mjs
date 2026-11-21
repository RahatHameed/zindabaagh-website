// Lets the free evaluation form attach documents (IELTS, CV, degree, transcript) without making
// them readable by anyone but you. Safe to run again.
//
//  - Folder "Public": guide images. Visitors may read files in this folder only.
//    It becomes the default upload folder in the CMS.
//  - Folder "Lead uploads": visitors may only CREATE files here (PDF, JPG, PNG, WEBP, max 10 MB; the upload-guard extension also checks the real file content),
//    never read, list or change them. The form picks each file's ID itself, so it never needs to read.
//  - Fields file_ielts, file_cv, file_degree, file_transcript on "leads" link the uploads to the request.
//
//   node cms/setup-uploads.mjs      (reads CMS_ADMIN_TOKEN from ~/.zindabaagh-cms.env)
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const env = { ...process.env };
try {
  for (const line of (await readFile(join(homedir(), ".zindabaagh-cms.env"), "utf8")).split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m && !env[m[1]]) env[m[1]] = m[2];
  }
} catch { /* no env file */ }
const url = (env.CMS_URL || "https://cms.zindabhaag.com").replace(/\/+$/, "");
if (!env.CMS_ADMIN_TOKEN) { console.error("CMS_ADMIN_TOKEN is missing"); process.exit(1); }

async function api(method, path, body) {
  const res = await fetch(url + path, { method, headers: { Authorization: `Bearer ${env.CMS_ADMIN_TOKEN}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text).data : null;
}

// No Word files: they can carry macros. PDF and images only.
export const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
export const MAX_BYTES = 10 * 1024 * 1024;
export const FILE_FIELDS = ["file_ielts", "file_cv", "file_degree", "file_transcript"];

async function folder(name) {
  const found = await api("GET", `/folders?filter[name][_eq]=${encodeURIComponent(name)}&filter[parent][_null]=true&fields=id`);
  return found[0]?.id ?? (await api("POST", "/folders", { name })).id;
}
const publicFolder = await folder("Public");
const leadFolder = await folder("Lead uploads");
console.log("folders ok");
await api("PATCH", "/settings", { storage_default_folder: publicFolder });

const publicPolicy = (await api("GET", "/policies?filter[name][_eq]=$t:public_label&fields=id"))[0].id;
async function setPermission(collection, action, rule) {
  const found = await api("GET", `/permissions?filter[policy][_eq]=${publicPolicy}&filter[collection][_eq]=${collection}&filter[action][_eq]=${action}&fields=id`);
  if (found[0]) await api("PATCH", `/permissions/${found[0].id}`, rule);
  else await api("POST", "/permissions", { policy: publicPolicy, collection, action, ...rule });
}
// Visitors read only public files; they upload only into "Lead uploads" with allowed types and size.
await setPermission("directus_files", "read", { fields: ["*"], permissions: { folder: { _eq: publicFolder } }, validation: {}, presets: {} });
await setPermission("directus_files", "create", {
  fields: ["*"], permissions: {}, presets: { folder: leadFolder },
  validation: { _and: [{ folder: { _eq: leadFolder } }, { type: { _in: ALLOWED_TYPES } }, { filesize: { _lte: MAX_BYTES } }] },
});
console.log("file permissions ok");

const have = new Set((await api("GET", "/fields/leads")).map((f) => f.field));
const labels = { file_ielts: "IELTS / language certificate", file_cv: "CV", file_degree: "Degree", file_transcript: "Transcript" };
for (const field of FILE_FIELDS) {
  if (have.has(field)) continue;
  await api("POST", "/fields/leads", { field, type: "uuid", meta: { interface: "file", special: ["file"], width: "half", note: labels[field] }, schema: {} });
  await api("POST", "/relations", { collection: "leads", field, related_collection: "directus_files", schema: { on_delete: "SET NULL" } });
  console.log("added leads." + field);
}
const leadCreate = (await api("GET", `/permissions?filter[policy][_eq]=${publicPolicy}&filter[collection][_eq]=leads&filter[action][_eq]=create&fields=id,fields`))[0];
await api("PATCH", `/permissions/${leadCreate.id}`, { fields: [...new Set([...leadCreate.fields, ...FILE_FIELDS])] });
console.log("lead form may now attach files. Done.");
