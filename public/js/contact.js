// Contact form. Sends the message to the CMS (collection "messages"), protected by Cloudflare
// Turnstile. If the CMS cannot be reached, the visitor's e-mail program is opened with the
// message filled in.
(function () {
  const form = document.getElementById("contact-form"), note = document.getElementById("contact-note"), button = document.getElementById("contact-submit");
  const { email, messageEndpoint, turnstileSiteKey } = window.ZB_SITE || {};
  const fields = ["name", "email", "topic", "message"];
  const params = new URLSearchParams(location.search);
  const wanted = params.get("topic");
  if (wanted && [...form.topic.options].some((o) => o.value === wanted)) form.topic.value = wanted;

  const show = (kind, html) => { note.className = "form-note " + kind; note.innerHTML = html; };

  const box = document.getElementById("turnstile-box");
  let widget = null;
  if (turnstileSiteKey && messageEndpoint && box) {
    window.zbTurnstileReady = () => {
      widget = window.turnstile.render(box, { sitekey: turnstileSiteKey, action: "contact", theme: "auto", size: "flexible" });
    };
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=zbTurnstileReady";
    script.async = true;
    document.head.appendChild(script);
  }
  const captcha = () => (widget !== null && window.turnstile ? window.turnstile.getResponse(widget) || "" : "");
  const resetCaptcha = () => { if (widget !== null && window.turnstile) window.turnstile.reset(widget); };

  function mailFallback(data) {
    location.href = `mailto:${email}?subject=${encodeURIComponent("Contact (" + data.topic + "): " + data.name)}&body=${encodeURIComponent(data.message)}`;
    show("ok", `Your e-mail program should open with your message filled in. Press send. If nothing opens, write to <a href="mailto:${email}">${email}</a>.`);
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }
    if (form.website.value) return; // filled only by bots
    const data = Object.fromEntries(fields.map((f) => [f, form[f].value.trim()]));
    data.source = (params.get("source") || document.referrer || "direct").slice(0, 200);
    data.consent = true;

    if (!messageEndpoint) { mailFallback(data); return; }
    if (widget !== null && !captcha()) { show("err", "Please complete the security check above the button, then send again."); return; }
    button.disabled = true;
    show("ok", "Sending your message…");
    try {
      const token = captcha();
      if (token) data.captcha = token;
      const res = await fetch(messageEndpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (res.status === 400 && /security check/i.test(await res.text())) {
        resetCaptcha();
        show("err", "The security check did not go through. Please complete it again and press send.");
        return;
      }
      if (!res.ok) throw new Error("HTTP " + res.status);
      form.reset();
      resetCaptcha();
      show("ok", "<strong>Thank you, your message is with us.</strong> We usually reply within two working days.");
    } catch {
      resetCaptcha();
      mailFallback(data);
    } finally {
      button.disabled = false;
    }
  });
})();
