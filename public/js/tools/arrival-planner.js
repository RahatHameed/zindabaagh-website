(function () {
  const { F, $, day, parseDate, addDays, live } = ZB;
  const out = $("#out"), form = $("#form"), KEY = "zb-arrival-planner";
  const store = {
    read() { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; } },
    write(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* storage unavailable */ } },
    clear() { try { localStorage.removeItem(KEY); } catch { /* storage unavailable */ } },
  };

  let done = {};
  $("#movein").value = ZB.today();
  const saved = store.read();
  if (saved) {
    $("#movein").value = saved.movein || ""; $("#visaEnd").value = saved.visaEnd || "";
    $("#role").value = saved.role || "work"; $("#save").checked = true; done = saved.done || {};
  }

  // when(moveIn, visaEnd) returns the text for the deadline line.
  const tasks = [
    { id: "flat", roles: "all", title: "Get the landlord's confirmation (Wohnungsgeberbestätigung)", when: (m) => `By ${day(m)}`, why: "You cannot register without this signed form. Ask for it when you sign the rental contract." },
    { id: "appointment", roles: "all", title: "Book the Anmeldung appointment at the Bürgeramt", when: () => "Now, before you move in", why: "Appointments are often booked out for weeks." },
    { id: "anmeldung", roles: "all", title: "Register your address (Anmeldung)", when: (m) => `Deadline: ${day(addDays(m, F.anmeldungDays))}`, why: `Within ${F.anmeldungDays} days of moving in. Bring your passport, the landlord's confirmation and the registration form.` },
    { id: "bank", roles: "all", title: "Open a German bank account", when: (m) => `Around ${day(addDays(m, 7))}`, why: "Needed for salary, rent and insurance. Most banks ask for your registration certificate." },
    { id: "blocked", roles: "study", title: "Activate your blocked account", when: (m) => `Around ${day(addDays(m, 10))}`, why: "Send the provider your German account details and registration so the monthly payouts start." },
    { id: "health", roles: "all", title: "Sign up with a health insurer", when: (m, v, role) => (role === "study" ? "Before you enrol" : role === "work" ? "Before your first working day" : `By ${day(addDays(m, 14))}`), why: "Health insurance is compulsory. Employees and students usually join a public insurer." },
    { id: "enrol", roles: "study", title: "Enrol at your university", when: () => "By your university's enrolment deadline", why: "Bring your admission letter, health insurance confirmation and proof you paid the semester fee." },
    { id: "taxid", roles: "work search", title: "Receive your tax ID by post", when: (m) => `Expect it by about ${day(addDays(m, F.anmeldungDays + 21))}`, why: "It is sent automatically two to three weeks after the Anmeldung. Put your name on the letterbox. Give it to your employer." },
    { id: "employer", roles: "work", title: "Give your employer your tax ID, bank details and health insurer", when: () => "Before your first payroll run", why: "Without the tax ID you are taxed at the highest rate until it arrives. You get the difference back later." },
    { id: "permit", roles: "all", needsVisa: true, title: "Apply for your residence permit at the Ausländerbehörde", when: (m, v) => `Book now. Apply by ${day(addDays(v, -42))} at the latest`, why: "Your entry visa is only for the first months. Apply at least six weeks before it runs out." },
    { id: "radio", roles: "all", title: "Register for the broadcasting fee (Rundfunkbeitrag)", when: (m) => `After the Anmeldung, around ${day(addDays(m, 30))}`, why: "Every household pays it once. In a shared flat only one person pays." },
    { id: "liability", roles: "all", title: "Take out personal liability insurance (optional)", when: () => "In your first month", why: "Not compulsory, but almost everyone in Germany has it and it is cheap." },
    { id: "licence", roles: "all", title: "Check whether you must convert your driving licence", when: (m) => `Valid until ${day(addDays(m, 182))}`, why: "A non-EU licence is valid for six months after you move. After that you need a German one." },
  ];

  function render() {
    const m = parseDate($("#movein").value), v = parseDate($("#visaEnd").value), role = $("#role").value;
    if ($("#save").checked) store.write({ movein: $("#movein").value, visaEnd: $("#visaEnd").value, role, done });
    else store.clear();
    if (!m) { out.innerHTML = `<p class="muted">Enter your move-in date to get your list.</p>`; return; }

    const list = tasks.filter((t) => (t.roles === "all" || t.roles.split(" ").includes(role)) && (!t.needsVisa || v));
    const count = list.filter((t) => done[t.id]).length;
    out.innerHTML = `
      <p class="kicker">Anmeldung deadline</p>
      <p class="big" style="font-size:1.7rem">${day(addDays(m, F.anmeldungDays))}</p>
      <p class="muted">${count} of ${list.length} tasks done</p>
      <div class="meter"><i style="width:${(count / list.length) * 100}%"></i></div>
      <ul class="tasks">${list.map((t) => `
        <li><label class="check"><input type="checkbox" data-task="${t.id}"${done[t.id] ? " checked" : ""}>
          <span><strong>${t.title}</strong><span class="when">${t.when(m, v, role)}</span><span class="why">${t.why}</span></span></label></li>`).join("")}
      </ul>
      <p><button class="linkish" type="button" id="print">Print this list</button></p>`;
  }

  out.addEventListener("change", (e) => {
    const id = e.target.dataset.task;
    if (!id) return;
    done[id] = e.target.checked;
    render();
  });
  out.addEventListener("click", (e) => { if (e.target.id === "print") window.print(); });
  live(form, render);
})();
