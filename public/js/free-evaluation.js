// Free evaluation form. Sends the request to the CMS; if no CMS is configured, or it cannot be
// reached, the visitor's e-mail program is opened with the answers filled in, so no request is lost.
(function () {
  const form = document.getElementById("lead-form"), note = document.getElementById("lead-note"), button = document.getElementById("lead-submit");
  const { email, leadEndpoint } = window.ZB_SITE || {};
  const fields = ["name", "email", "whatsapp", "country", "goal", "service", "qualification", "field", "experience", "timeline", "german", "english", "message"];

  // Arriving from a service or a guide: /free-evaluation?service=cv-review&source=blue-card-guide
  const params = new URLSearchParams(location.search);
  const wanted = params.get("service");
  if (wanted && [...form.service.options].some((o) => o.value === wanted)) form.service.value = wanted;

  const show = (kind, html) => { note.className = "form-note " + kind; note.innerHTML = html; };

  function mailFallback(data) {
    const body = fields.map((f) => `${f}: ${data[f] || "-"}`).join("\n");
    location.href = `mailto:${email}?subject=${encodeURIComponent("Free evaluation: " + data.name)}&body=${encodeURIComponent(body)}`;
    show("ok", `Your e-mail program should open with your answers filled in. Press send there. If nothing opens, write to <a href="mailto:${email}">${email}</a>.`);
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }
    if (form.website.value) return; // filled only by bots
    const data = Object.fromEntries(fields.map((f) => [f, form[f].value.trim()]));
    data.source = (params.get("source") || document.referrer || "direct").slice(0, 200);
    data.consent = true;

    if (!leadEndpoint) { mailFallback(data); return; }
    button.disabled = true;
    try {
      const res = await fetch(leadEndpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error("HTTP " + res.status);
      form.reset();
      show("ok", "<strong>Thank you, we have your request.</strong> We read every form ourselves and usually reply within two working days.");
    } catch {
      mailFallback(data);
    } finally {
      button.disabled = false;
    }
  });
})();
