// Directus hook "upload-guard": checks every file uploaded into the "Lead uploads" folder and
// deletes it at once unless it really is a PDF, JPG, PNG or WEBP. The browser-declared type
// and the file name are not trusted: the first bytes of the stored file are checked ("magic
// numbers"), and PDFs that contain scripts, launch actions or embedded files are rejected.
// It also checks the Cloudflare Turnstile token of every lead sent from the website and
// cleans up documents that belong to no lead.
//
// Deployed into the container as /directus/extensions/upload-guard/index.js through the Coolify
// compose file (see cms/README.md). Coolify treats a dollar sign as a variable, so this file
// must not contain one.
const RULES = {
  "application/pdf": { ext: [".pdf"], ok: (b) => b.subarray(0, 5).toString("latin1") === "%PDF-" },
  "image/jpeg": { ext: [".jpg", ".jpeg"], ok: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  "image/png": { ext: [".png"], ok: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  "image/webp": { ext: [".webp"], ok: (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP" },
};
// Active content in a PDF. Benign CVs and transcripts do not need any of it.
const PDF_DANGER = ["/JavaScript", "/JS ", "/JS(", "/JS<", "/Launch", "/EmbeddedFile", "/RichMedia", "/XFA", "/SubmitForm", "/ImportData"];
const MAX_BYTES = 10 * 1024 * 1024;
const LEAD_FILE_FIELDS = ["file_ielts", "file_cv", "file_degree", "file_transcript"];
// Cloudflare Turnstile: leads from the website must carry a valid token (field "captcha").
const TURNSTILE_VERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const SITE_HOSTS = ["zindabhaag.com", "www.zindabhaag.com", "zindabaagh.com", "www.zindabaagh.com"];

// An error Directus answers with 400 instead of 500.
function refuse(message) {
  const error = new Error(message);
  error.name = "DirectusError";
  error.status = 400;
  error.code = "INVALID_PAYLOAD";
  error.extensions = { reason: "captcha" };
  return error;
}

export default ({ action, filter, schedule }, { services, getSchema, logger, env }) => {
  const leadFolder = env.LEAD_UPLOAD_FOLDER;
  if (!leadFolder) logger.warn("upload-guard: LEAD_UPLOAD_FOLDER is not set, uploads are NOT checked");
  if (!env.TURNSTILE_SECRET) logger.warn("upload-guard: TURNSTILE_SECRET is not set, leads are accepted without the Turnstile check");

  // Public lead and contact-message submissions must pass Cloudflare Turnstile. Logged-in users and API tokens
  // (the admin panel, scripts) are not checked. The token is removed before the lead is saved.
  const checkTurnstile = async (payload, meta, context) => {
    const token = payload && payload.captcha;
    if (payload && "captcha" in payload) delete payload.captcha;
    const secret = env.TURNSTILE_SECRET;
    const who = (context && context.accountability) || null;
    if (!secret || !who || who.admin || who.user) return payload;
    if (!token) throw refuse("Security check missing. Please complete the security check and send again.");

    let result;
    try {
      const res = await fetch(TURNSTILE_VERIFY, { method: "POST", body: new URLSearchParams({ secret, response: String(token) }) });
      result = await res.json();
    } catch (error) {
      // Cloudflare unreachable: accept rather than lose a real request.
      logger.warn("upload-guard: Turnstile could not be reached, form accepted unchecked: " + error.message);
      return payload;
    }
    if (!result.success || !SITE_HOSTS.includes(result.hostname)) {
      logger.warn("upload-guard: form refused, Turnstile failed (" + ((result["error-codes"] || []).join(",") || result.hostname) + ")");
      throw refuse("Security check failed. Please complete the security check again and send.");
    }
    return payload;
  };
  filter("leads.items.create", checkTurnstile);
  filter("messages.items.create", checkTurnstile);

  // Every 30 minutes:
  // 1. An upload that is refused half-way (for example over 10 MB) leaves an empty file record
  //    with no stored file. Remove such records older than 15 minutes, as plain records because
  //    there is no stored file to delete.
  // 2. Remove documents in "Lead uploads" older than 2 hours that no lead points to: uploads
  //    whose form was never sent (bots, abandoned forms) and the documents of deleted leads.
  schedule("*/30 * * * *", async () => {
    if (!leadFolder) return;
    const schema = await getSchema();
    const records = new services.ItemsService("directus_files", { schema });
    const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const empty = await records.readByQuery({
      filter: { _and: [{ folder: { _eq: leadFolder } }, { filesize: { _null: true } }, { created_on: { _lt: cutoff } }] },
      fields: ["id"], limit: 500,
    });
    if (empty.length) {
      await records.deleteMany(empty.map((row) => row.id));
      logger.info("upload-guard: removed " + empty.length + " empty upload record(s)");
    }

    const oldCutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const stored = await records.readByQuery({
      filter: { _and: [{ folder: { _eq: leadFolder } }, { filesize: { _nnull: true } }, { created_on: { _lt: oldCutoff } }] },
      fields: ["id"], limit: 500,
    });
    if (!stored.length) return;
    const leads = new services.ItemsService("leads", { schema });
    const used = new Set();
    for (const lead of await leads.readByQuery({ fields: LEAD_FILE_FIELDS, limit: -1 })) {
      for (const field of LEAD_FILE_FIELDS) if (lead[field]) used.add(typeof lead[field] === "object" ? lead[field].id : lead[field]);
    }
    const orphans = stored.map((row) => row.id).filter((id) => !used.has(id));
    if (orphans.length) {
      await new services.FilesService({ schema }).deleteMany(orphans);
      logger.info("upload-guard: removed " + orphans.length + " document(s) that belong to no lead");
    }
  });

  action("files.upload", async (meta) => {
    const payload = meta.payload || {};
    const key = meta.key;
    if (!leadFolder || payload.folder !== leadFolder) return;

    const schema = await getSchema();
    const files = new services.FilesService({ schema });
    let reason = "";
    try {
      const rule = RULES[payload.type];
      const name = String(payload.filename_download || "").toLowerCase();
      if (!rule) reason = "type " + payload.type + " is not allowed";
      else if (!rule.ext.some((ending) => name.endsWith(ending))) reason = "file name " + name + " does not match " + payload.type;

      if (!reason) {
        const assets = new services.AssetsService({ schema });
        const asset = await assets.getAsset(key);
        const chunks = [];
        let size = 0;
        for await (const chunk of asset.stream) {
          chunks.push(chunk);
          size += chunk.length;
          if (size > MAX_BYTES) break;
        }
        const data = Buffer.concat(chunks);
        if (size > MAX_BYTES) reason = "larger than 10 MB";
        else if (!rule.ok(data)) reason = "content is not a real " + payload.type;
        else if (payload.type === "application/pdf") {
          const text = data.toString("latin1");
          const hit = PDF_DANGER.find((word) => text.includes(word));
          if (hit) reason = "PDF contains active content (" + hit.trim() + ")";
        }
      }
    } catch (error) {
      reason = "could not be checked: " + error.message;
    }

    if (reason) {
      await files.deleteOne(key);
      logger.warn("upload-guard: deleted upload " + key + " because it " + (reason.startsWith("could") ? reason : "is not allowed: " + reason));
    }
  });
};
