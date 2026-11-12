// Creates the three Directus automations (flows). Safe to run again: existing flows are updated.
//
//   1. "Notify: new lead"   e-mails you every new free evaluation request.
//   1b. "Notify: new contact message"  e-mails you every message from the contact form.
//   2. "Rebuild website"    asks Coolify to redeploy zindabaagh.com when a guide, page or the
//                           site settings are created, changed or deleted.
//
// Reads from ~/.zindabaagh-cms.env (or the environment):
//   CMS_ADMIN_TOKEN          required
//   LEAD_NOTIFY_TO           inbox for lead e-mails (default zindabaagh@gmail.com)
//   COOLIFY_DEPLOY_WEBHOOK   deploy address of the zindabaagh-website app,  } flow 2 is skipped
//                            ending in force=true (else the build is skipped) }
//   COOLIFY_TOKEN            Coolify API token with "deploy" permission    } until both are set
// Secrets are sent to Directus only and never printed.
//
//   node cms/flows.mjs
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

const url = (env.CMS_URL || "https://cms.zindabaagh.com").replace(/\/+$/, "");
if (!env.CMS_ADMIN_TOKEN) { console.error("CMS_ADMIN_TOKEN is missing in ~/.zindabaagh-cms.env"); process.exit(1); }

async function api(method, path, body) {
  const res = await fetch(url + path, {
    method, headers: { Authorization: `Bearer ${env.CMS_ADMIN_TOKEN}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text).data : null;
}

// Creates or replaces a flow with a single operation.
async function flow(name, icon, triggerOptions, operation) {
  for (const old of await api("GET", `/flows?filter[name][_eq]=${encodeURIComponent(name)}&fields=id`)) await api("DELETE", `/flows/${old.id}`);
  const f = await api("POST", "/flows", { name, icon, status: "active", trigger: "event", accountability: "all", options: triggerOptions });
  const op = await api("POST", "/operations", { flow: f.id, key: operation.key, name: operation.name, type: operation.type, position_x: 19, position_y: 1, options: operation.options });
  await api("PATCH", `/flows/${f.id}`, { operation: op.id });
  console.log(`flow "${name}" active`);
}

// Sent straight to Gmail (not through the hello@ forwarding). "Reply" in Gmail answers the visitor.
const to = env.LEAD_NOTIFY_TO || "zindabaagh@gmail.com";
await flow("Notify: new lead", "person_add", { type: "action", scope: ["items.create"], collections: ["leads"] }, {
  key: "mail_lead", name: "E-mail the lead", type: "mail",
  options: {
    to: [to], replyTo: ["{{$trigger.payload.email}}"], type: "markdown",
    subject: "New free evaluation: {{$trigger.payload.name}} ({{$trigger.payload.goal}})",
    body: [
      "**{{$trigger.payload.name}}** sent a free evaluation request.", "",
      "- E-mail: {{$trigger.payload.email}}", "- WhatsApp: {{$trigger.payload.whatsapp}}", "- Country: {{$trigger.payload.country}}",
      "- Goal: {{$trigger.payload.goal}}", "- Service: {{$trigger.payload.service}}", "- Qualification: {{$trigger.payload.qualification}}",
      "- Field and grade: {{$trigger.payload.field}}", "- Experience: {{$trigger.payload.experience}} years", "- Timeline: {{$trigger.payload.timeline}}",
      "- German: {{$trigger.payload.german}}, English: {{$trigger.payload.english}}", "- Came from: {{$trigger.payload.source}}", "",
      "Message:", "", "{{$trigger.payload.message}}", "",
      `Open in the CMS: ${url}/admin/content/leads/{{$trigger.key}}`,
    ].join("\n"),
  },
});
console.log(`  lead e-mails go to ${to}`);

await flow("Notify: new contact message", "mail", { type: "action", scope: ["items.create"], collections: ["messages"] }, {
  key: "mail_message", name: "E-mail the message", type: "mail",
  options: {
    to: [to], replyTo: ["{{$trigger.payload.email}}"], type: "markdown",
    subject: "Contact form: {{$trigger.payload.name}} ({{$trigger.payload.topic}})",
    body: [
      "**{{$trigger.payload.name}}** wrote through the contact form.", "",
      "- E-mail: {{$trigger.payload.email}}", "- Topic: {{$trigger.payload.topic}}", "- Came from: {{$trigger.payload.source}}", "",
      "Message:", "", "{{$trigger.payload.message}}", "",
      "Reply to this e-mail to answer the sender.", "",
      `Open in the CMS: ${url}/admin/content/messages/{{$trigger.key}}`,
    ].join("\n"),
  },
});

if (env.COOLIFY_DEPLOY_WEBHOOK && env.COOLIFY_TOKEN) {
  await flow("Rebuild website", "rocket_launch", { type: "action", scope: ["items.create", "items.update", "items.delete"], collections: ["guides", "pages", "site"] }, {
    key: "deploy_site", name: "Ask Coolify to redeploy", type: "request",
    options: { method: "POST", url: env.COOLIFY_DEPLOY_WEBHOOK, headers: [{ header: "Authorization", value: `Bearer ${env.COOLIFY_TOKEN}` }] },
  });
} else {
  console.log('flow "Rebuild website" skipped: add COOLIFY_DEPLOY_WEBHOOK and COOLIFY_TOKEN to ~/.zindabaagh-cms.env');
}
