// Free evaluation form. Sends the request (and, for study, the uploaded documents) to the CMS.
// Documents go into a private folder: the browser chooses each file's ID, so it never needs to
// read the files back. If the CMS cannot be reached, the visitor's e-mail program is opened with
// the answers filled in (documents can then be attached there by hand).
(function () {
  const form = document.getElementById("lead-form"), note = document.getElementById("lead-note"), button = document.getElementById("lead-submit");
  const uploads = document.getElementById("uploads");
  const { email, leadEndpoint, filesEndpoint, uploadFolder, turnstileSiteKey } = window.ZB_SITE || {};
  const fields = ["name", "email", "whatsapp", "country", "goal", "service", "qualification", "field", "experience", "timeline", "german", "english", "message"];
  const fileFields = ["file_ielts", "file_cv", "file_degree", "file_transcript"];
  const MAX = 10 * 1024 * 1024;

  // Arriving from a service or a guide: /free-evaluation?service=cv-review&source=guide-blue-card
  const params = new URLSearchParams(location.search);
  const wanted = params.get("service");
  if (wanted && [...form.service.options].some((o) => o.value === wanted)) form.service.value = wanted;
  if (wanted && wanted.startsWith("study")) form.goal.value = "study";

  // The document upload is shown for study requests only.
  const isStudy = () => form.goal.value === "study" || form.service.value.startsWith("study");
  const toggleUploads = () => { uploads.hidden = !(isStudy() && filesEndpoint && uploadFolder); };
  form.goal.addEventListener("change", toggleUploads);
  form.service.addEventListener("change", toggleUploads);
  toggleUploads();

  const show = (kind, html) => { note.className = "form-note " + kind; note.innerHTML = html; };

  // Cloudflare Turnstile (spam protection, no puzzle for most visitors). The CMS checks the token.
  const box = document.getElementById("turnstile-box");
  let widget = null;
  if (turnstileSiteKey && leadEndpoint && box) {
    window.zbTurnstileReady = () => {
      widget = window.turnstile.render(box, { sitekey: turnstileSiteKey, action: "free-evaluation", theme: "auto", size: "flexible" });
    };
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=zbTurnstileReady";
    script.async = true;
    document.head.appendChild(script);
  }
  const captcha = () => (widget !== null && window.turnstile ? window.turnstile.getResponse(widget) || "" : "");
  const resetCaptcha = () => { if (widget !== null && window.turnstile) window.turnstile.reset(widget); };

  function mailFallback(data, hadFiles) {
    const body = fields.map((f) => `${f}: ${data[f] || "-"}`).join("\n");
    location.href = `mailto:${email}?subject=${encodeURIComponent("Free evaluation: " + data.name)}&body=${encodeURIComponent(body)}`;
    show("ok", `Your e-mail program should open with your answers filled in. ${hadFiles ? "Please attach your documents there, then " : ""}Press send. If nothing opens, write to <a href="mailto:${email}">${email}</a>.`);
  }

  async function uploadFile(file) {
    const id = crypto.randomUUID(), fd = new FormData();
    fd.append("id", id);
    fd.append("folder", uploadFolder);
    fd.append("file", file, file.name);
    const res = await fetch(filesEndpoint, { method: "POST", body: fd });
    if (!res.ok) throw new Error(`${file.name}: ${res.status}`);
    return id;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }
    if (form.website.value) return; // filled only by bots
    const data = Object.fromEntries(fields.map((f) => [f, form[f].value.trim()]));
    data.source = (params.get("source") || document.referrer || "direct").slice(0, 200);
    data.consent = true;

    const files = isStudy() ? fileFields.map((f) => [f, form[f].files[0]]).filter(([, file]) => file) : [];
    const tooBig = files.find(([, file]) => file.size > MAX);
    if (tooBig) { show("err", `“${tooBig[1].name}” is larger than 10 MB. Please upload a smaller file (a PDF or a photo usually works).`); return; }

    if (!leadEndpoint) { mailFallback(data, files.length > 0); return; }
    // The widget is on the page but not solved yet (if it could not load at all, the CMS decides).
    if (widget !== null && !captcha()) { show("err", "Please complete the security check above the button, then send again."); return; }
    button.disabled = true;
    try {
      for (let i = 0; i < files.length; i++) {
        show("ok", `Uploading your documents (${i + 1} of ${files.length})…`);
        data[files[i][0]] = await uploadFile(files[i][1]);
      }
      show("ok", "Sending your request…");
      const token = captcha(); // read after the uploads: the widget renews expired tokens by itself
      if (token) data.captcha = token;
      const res = await fetch(leadEndpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (res.status === 400 && /security check/i.test(await res.text())) {
        resetCaptcha();
        show("err", "The security check did not go through. Please complete it again and press send.");
        return;
      }
      if (!res.ok) throw new Error("HTTP " + res.status);
      form.reset();
      toggleUploads();
      resetCaptcha();
      show("ok", `<strong>Thank you, we have your request${files.length ? " and your documents" : ""}.</strong> We read every request ourselves and usually reply within two working days.`);
    } catch {
      resetCaptcha();
      mailFallback(data, files.length > 0);
    } finally {
      button.disabled = false;
    }
  });
})();
