// Shared helpers for every page.
(function () {
  const eur = (n, digits = 0) =>
    (n < 0 ? "−€" : "€") + Math.abs(Number(n)).toLocaleString("en-IE", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const addMonths = (d, n) => {
    const x = new Date(d); const day = x.getDate();
    x.setDate(1); x.setMonth(x.getMonth() + n);
    x.setDate(Math.min(day, new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate()));
    return x;
  };
  window.ZB = {
    F: window.ZB_FACTS,
    $: (sel, root = document) => root.querySelector(sel),
    eur,
    // Reads a number from an input; a decimal comma is accepted.
    num: (el) => { const v = parseFloat(String(el.value).replace(/\s/g, "").replace(",", ".")); return isFinite(v) ? v : 0; },
    day: (d) => d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric" }),
    parseDate: (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ""); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; },
    addDays, addMonths,
    today: () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; },
    esc: (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])),
    // Runs `render` now and on every change of the form.
    live: (form, render) => { form.addEventListener("input", render); form.addEventListener("submit", (e) => e.preventDefault()); render(); },
  };

  // Mobile menu
  const toggle = document.querySelector(".nav-toggle"), nav = document.getElementById("main-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => toggle.setAttribute("aria-expanded", String(nav.classList.toggle("is-open"))));
    nav.addEventListener("click", (e) => { if (e.target.closest("a")) { nav.classList.remove("is-open"); toggle.setAttribute("aria-expanded", "false"); } });
  }

  // Share buttons on guides
  document.querySelectorAll(".share").forEach((box) => {
    const url = box.dataset.shareUrl, title = box.dataset.shareTitle, note = box.querySelector(".share-note");
    const say = (msg) => { note.textContent = msg; clearTimeout(box._t); box._t = setTimeout(() => (note.textContent = ""), 4000); };
    const copy = async (msg) => {
      try { await navigator.clipboard.writeText(url); }
      catch { const t = document.createElement("textarea"); t.value = url; document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove(); }
      say(msg);
    };
    const canShare = typeof navigator.share === "function";
    const native = box.querySelector('[data-share="native"]');
    if (canShare && native) native.hidden = false;
    box.addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-share]");
      if (!btn) return;
      const kind = btn.dataset.share;
      if (kind === "copy") return copy("Link copied");
      if (canShare) { try { await navigator.share({ title, url }); } catch { /* closed */ } return; }
      if (kind === "instagram") copy("Link copied. Paste it in your Instagram story or DM.");
    });
  });

  // Tool filter on the home page
  const chips = document.querySelectorAll(".chip[data-filter]");
  chips.forEach((chip) => chip.addEventListener("click", () => {
    chips.forEach((c) => c.classList.toggle("is-active", c === chip));
    document.querySelectorAll("#tool-grid .tool-card").forEach((card) => {
      card.hidden = chip.dataset.filter !== "all" && card.dataset.group !== chip.dataset.filter;
    });
  }));
})();
