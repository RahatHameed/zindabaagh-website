// Creates the content model in a fresh Directus: collections, fields, public permissions,
// and a "Guide publisher" user whose token lets scripts create guides.
// Safe to run again: existing collections, fields and permissions are left alone.
//
// Reads CMS_URL and CMS_ADMIN_TOKEN from the environment or from the file ~/.zindabaagh-cms.env,
// and writes the new Guide publisher token (CMS_TOKEN) into that same file. No secret is printed.
//
//   node cms/setup.mjs
import { randomBytes } from "node:crypto";
import { appendFile, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const envFile = join(homedir(), ".zindabaagh-cms.env");
const env = { ...process.env };
try {
  for (const line of (await readFile(envFile, "utf8")).split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m && !env[m[1]]) env[m[1]] = m[2];
  }
} catch { /* no env file: use the environment */ }

const url = (env.CMS_URL || "https://cms.zindabaagh.com").replace(/\/+$/, "");
const token = env.CMS_ADMIN_TOKEN;
if (!token) { console.error(`CMS_ADMIN_TOKEN is missing. Put it in ${envFile} (line: CMS_ADMIN_TOKEN=...) or in the environment.`); process.exit(1); }

async function api(method, path, body) {
  const res = await fetch(url + path, {
    method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) throw Object.assign(new Error(`${method} ${path}: ${res.status} ${json.errors?.[0]?.message ?? text}`), { status: res.status });
  return json.data;
}

// ---- field helpers ----
const text = (field, o = {}) => ({ field, type: "string", meta: { interface: "input", width: o.width ?? "half", required: !!o.required, note: o.note }, schema: { max_length: o.max ?? 255 } });
const long = (field, o = {}) => ({ field, type: "text", meta: { interface: o.interface ?? "input-multiline", width: "full", required: !!o.required, note: o.note, options: o.options }, schema: {} });
const choice = (field, choices, o = {}) => ({ field, type: "string", meta: { interface: "select-dropdown", width: o.width ?? "half", required: !!o.required, options: { choices: choices.map((c) => (typeof c === "string" ? { text: c, value: c } : c)) }, display: "labels" }, schema: { default_value: o.default ?? null, max_length: 60 } });
const status = () => choice("status", [{ text: "Draft", value: "draft" }, { text: "Published", value: "published" }], { default: "draft", required: true });
const created = () => ({ field: "date_created", type: "timestamp", meta: { special: ["date-created"], interface: "datetime", readonly: true, hidden: true, width: "half" }, schema: {} });
const updated = () => ({ field: "date_updated", type: "timestamp", meta: { special: ["date-updated"], interface: "datetime", readonly: true, hidden: true, width: "half" }, schema: {} });
const list = (field, fields, note) => ({ field, type: "json", meta: { interface: "list", special: ["cast-json"], width: "full", note, options: { fields: fields.map((f) => ({ field: f.field, name: f.name ?? f.field, type: f.type ?? "string", meta: { interface: f.interface ?? "input", width: f.width ?? "half", options: f.options } })) } }, schema: {} });
const editor = (field) => long(field, { interface: "input-rich-text-html", options: { toolbar: ["bold", "italic", "h2", "h3", "numlist", "bullist", "blockquote", "link", "customImage", "table", "removeformat", "code", "fullscreen"] } });

const collections = [
  {
    collection: "guides",
    meta: { icon: "menu_book", note: "Guides (blog posts). Published guides appear at zindabaagh.com/guides/<slug>.", sort_field: null, archive_field: "status", archive_value: "draft", unarchive_value: "published", display_template: "{{title}}" },
    fields: [
      status(),
      { field: "date_published", type: "date", meta: { interface: "datetime", width: "half", note: "Shown as 'Updated ...' on the page" }, schema: {} },
      text("title", { required: true, width: "full" }),
      text("slug", { required: true, note: "Address of the page: lowercase words joined with hyphens, e.g. student-visa-checklist" }),
      text("keyword", { note: "Instagram comment keyword this guide belongs to (optional)", max: 60 }),
      long("description", { required: true, note: "One or two sentences. Shown on the guides list, in Google and in link previews." }),
      editor("body"),
      text("related_tool", { note: "Tool to advertise under the guide, e.g. blue-card-check (optional)", max: 60 }),
      { field: "cover", type: "uuid", meta: { interface: "file-image", special: ["file"], width: "half" }, schema: {} },
      created(), updated(),
    ],
  },
  {
    collection: "pages",
    meta: { icon: "article", note: "Simple text pages. A published page appears at zindabaagh.com/<slug>.", archive_field: "status", archive_value: "draft", unarchive_value: "published", display_template: "{{title}}" },
    fields: [status(), text("title", { required: true }), text("slug", { required: true }), long("description"), editor("body"), created(), updated()],
  },
  {
    collection: "site",
    meta: { icon: "settings", singleton: true, note: "Menu, services and tagline. Empty fields fall back to the values in the website's code." },
    fields: [
      text("tagline", { width: "full" }),
      list("nav", [{ field: "label" }, { field: "href" }, { field: "external", type: "boolean", interface: "boolean" }], "Main menu, in order"),
      { field: "navCta", type: "json", meta: { interface: "input-code", special: ["cast-json"], options: { language: "json" }, width: "full", note: 'Menu button, e.g. {"label": "Free evaluation", "href": "/free-evaluation"}' }, schema: {} },
      list("services", [
        { field: "slug" }, { field: "icon", width: "half" }, { field: "badge" }, { field: "title" },
        { field: "text", interface: "input-multiline", width: "full" },
        { field: "points", type: "json", interface: "tags", width: "full" },
        { field: "href" }, { field: "cta" }, { field: "external", type: "boolean", interface: "boolean" },
      ], "Services shown on the home page and on /services, in order"),
    ],
  },
  {
    collection: "leads",
    meta: { icon: "person_add", note: "Free evaluation requests from the website.", display_template: "{{name}} ({{goal}})", sort_field: null },
    fields: [
      choice("lead_status", ["new", "answered", "client", "closed"], { default: "new" }),
      created(),
      text("name", { required: true }), text("email", { required: true }), text("whatsapp"), text("country"),
      text("goal"), text("service"), text("qualification"), text("field"), text("experience"), text("timeline"), text("german"), text("english"),
      long("message"), text("source", { width: "full" }),
      { field: "consent", type: "boolean", meta: { interface: "boolean", width: "half" }, schema: { default_value: false } },
      long("notes", { note: "Your own notes. Not visible to the visitor." }),
    ],
  },
  {
    collection: "messages",
    meta: { icon: "mail", note: "Messages from the contact form at zindabaagh.com/contact.", display_template: "{{name}} ({{topic}})", sort_field: null },
    fields: [
      choice("message_status", ["new", "answered", "closed"], { default: "new" }),
      created(),
      text("name", { required: true }), text("email", { required: true }),
      choice("topic", ["general", "client", "examklar", "partnership", "privacy", "other"]),
      long("message", { required: true }), text("source", { width: "full" }),
      { field: "consent", type: "boolean", meta: { interface: "boolean", width: "half" }, schema: { default_value: false } },
      long("notes", { note: "Your own notes. Not visible to the visitor." }),
    ],
  },
];

for (const c of collections) {
  let exists = true;
  try { await api("GET", `/collections/${c.collection}`); } catch (e) { if (e.status === 403 || e.status === 404) exists = false; else throw e; }
  if (!exists) {
    await api("POST", "/collections", { collection: c.collection, meta: c.meta, schema: {}, fields: [{ field: "id", type: "integer", meta: { hidden: true }, schema: { is_primary_key: true, has_auto_increment: true } }, ...c.fields] });
    console.log(`created collection ${c.collection}`);
  } else {
    const have = new Set((await api("GET", `/fields/${c.collection}`)).map((f) => f.field));
    for (const f of c.fields) if (!have.has(f.field)) { await api("POST", `/fields/${c.collection}`, f); console.log(`added ${c.collection}.${f.field}`); }
    console.log(`collection ${c.collection} ok`);
  }
  // A single-file field needs a relation to the file library, or the admin panel cannot show the chosen file.
  const relations = new Set((await api("GET", `/relations/${c.collection}`)).map((r) => r.field));
  for (const f of c.fields)
    if (f.type === "uuid" && f.meta?.special?.includes("file") && !relations.has(f.field)) {
      await api("POST", "/relations", { collection: c.collection, field: f.field, related_collection: "directus_files", schema: { on_delete: "SET NULL" } });
      console.log(`linked ${c.collection}.${f.field} to the file library`);
    }
}

// ---- permissions ----
async function allow(policy, collection, action, extra = {}) {
  const found = await api("GET", `/permissions?filter[policy][_eq]=${policy}&filter[collection][_eq]=${collection}&filter[action][_eq]=${action}`);
  if (found.length) return;
  await api("POST", "/permissions", { policy, collection, action, fields: ["*"], permissions: {}, validation: {}, ...extra });
  console.log(`permission: ${collection} ${action}`);
}

const publicPolicy = (await api("GET", "/policies?filter[name][_eq]=$t:public_label"))[0]?.id;
if (!publicPolicy) throw new Error("Public policy not found. Open Settings > Access Policies in Directus and check the name of the public policy.");
const isPublished = { permissions: { status: { _eq: "published" } } };
await allow(publicPolicy, "guides", "read", isPublished);
await allow(publicPolicy, "pages", "read", isPublished);
await allow(publicPolicy, "site", "read");
await allow(publicPolicy, "directus_files", "read");
// Visitors may only create a lead, never read one, and cannot set the internal fields.
await allow(publicPolicy, "leads", "create", {
  fields: ["name", "email", "whatsapp", "country", "goal", "service", "qualification", "field", "experience", "timeline", "german", "english", "message", "source", "consent"],
  validation: { _and: [{ consent: { _eq: true } }, { email: { _contains: "@" } }] },
});
// Same for the contact form.
await allow(publicPolicy, "messages", "create", {
  fields: ["name", "email", "topic", "message", "source", "consent"],
  validation: { _and: [{ consent: { _eq: true } }, { email: { _contains: "@" } }, { message: { _nempty: true } }] },
});

// ---- guide publisher (for scripts and the reel skill) ----
let policy = (await api("GET", "/policies?filter[name][_eq]=Guide publisher"))[0];
if (!policy) policy = await api("POST", "/policies", { name: "Guide publisher", icon: "edit_note", description: "Create and update guides and upload their images. Nothing else.", admin_access: false, app_access: false });
for (const action of ["create", "read", "update"]) { await allow(policy.id, "guides", action); await allow(policy.id, "directus_files", action); }

let role = (await api("GET", "/roles?filter[name][_eq]=Guide publisher"))[0];
if (!role) role = await api("POST", "/roles", { name: "Guide publisher", icon: "edit_note", policies: [{ policy: policy.id }] });

const email = "guide-publisher@zindabaagh.com";
if (!(await api("GET", `/users?filter[email][_eq]=${email}`)).length) {
  const publisherToken = randomBytes(32).toString("base64url");
  await api("POST", "/users", { first_name: "Guide", last_name: "Publisher", email, role: role.id, token: publisherToken, status: "active" });
  await appendFile(envFile, `\nCMS_URL=${url}\nCMS_TOKEN=${publisherToken}\n`);
  console.log(`Guide publisher created. Its token was saved as CMS_TOKEN in ${envFile}. Copy it to Bitwarden too.`);
} else console.log("Guide publisher user already exists (token unchanged).");

console.log("Done.");
