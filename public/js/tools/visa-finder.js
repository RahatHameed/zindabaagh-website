(function () {
  const { F, $, eur, num, live } = ZB;
  const out = $("#out"), form = $("#form");
  const link = (href, text) => `<a href="${href}">${text} →</a>`;

  function route() {
    const goal = $("#goal").value, qual = $("#qual").value;

    if (goal === "study") {
      const a = $("#admission").value;
      const common = ["Proof of funding, usually a blocked account", "Health insurance", "Language certificate for the programme (German or English)"];
      if (a === "yes") return { name: "Student visa", law: "§ 16b Residence Act", why: "You have an admission from a German university.",
        steps: ["Admission letter", ...common, "Book the visa appointment early, waiting times can be long"],
        links: [link("/tools/blocked-account", "Blocked Account Calculator")] };
      if (a === "applied") return { name: "Visa to apply for a study place", law: "§ 17 Residence Act", why: "You do not have an admission yet. This visa gives you up to nine months in Germany to get one.",
        steps: ["A school or university certificate that qualifies you to study in Germany", ...common],
        links: [link("/tools/grade-converter", "German Grade Converter"), link("/tools/blocked-account", "Blocked Account Calculator")] };
      return { name: "Student visa for a preparatory course (Studienkolleg)", law: "§ 16b Residence Act", why: "Your school certificate does not give direct access to a German university, so you first attend a preparatory course and pass its final exam.",
        steps: ["A place at a Studienkolleg, or an invitation to its entrance test", "Usually German at B1 or B2", ...common.slice(0, 2)],
        links: [link("/tools/blocked-account", "Blocked Account Calculator")] };
    }

    if (goal === "training") {
      return $("#place").value === "yes"
        ? { name: "Visa for vocational training", law: "§ 16a Residence Act", why: "You have a training contract with a German company.",
            steps: ["Signed training contract", "German at B1 as a rule", "Proof that the training pay covers your living costs, or extra funds"], links: [] }
        : { name: "Visa to look for a training place", law: "§ 17 Residence Act", why: "You can come for up to nine months to find an Ausbildung.",
            steps: ["You are 35 or younger", "German at B1", "A school certificate that allows you to study in Germany or in your home country", "Proof of funding for your stay"], links: [] };
    }

    if (goal === "search") {
      if (qual === "degree" || qual === "vocational") return { name: "Opportunity Card (Chancenkarte)", law: "§ 20a Residence Act", why: "You have a qualification and want to look for work in Germany. The card gives you up to a year and allows part-time work.",
        steps: [`At least ${F.chancenkarte.minPoints} points, unless your qualification is fully recognised in Germany`, "German at A1 or English at B2", "Proof of funding for your stay"],
        links: [link("/tools/chancenkarte-points", "Count your Opportunity Card points")] };
      return { name: "No job-search visa fits yet", none: true, why: "The Opportunity Card needs a degree or at least two years of vocational training. Without one you need a job offer first, or you can come for training or study.",
        steps: ["IT specialists with 3+ years of experience can get a work visa with a job offer, without a degree", "Vocational training (Ausbildung) is open to people without a qualification"], links: [] };
    }

    // goal === "work"
    const salary = num($("#salary")), lower = $("#shortage").checked || qual === "it";
    const threshold = lower ? F.blueCard.reduced : F.blueCard.standard;
    if ((qual === "degree" || qual === "it") && salary >= threshold) return { name: "EU Blue Card", law: "§ 18g Residence Act",
      why: `Your salary reaches the ${lower ? "lower " : ""}${F.year} threshold of ${eur(threshold, lower ? 2 : 0)}. The Blue Card gives the fastest route to permanent residence and easier family reunion.`,
      steps: ["Job offer or contract for at least 6 months that fits your qualification", qual === "it" ? "Proof of 3+ years of IT experience at university level within the last 7 years" : "Degree that is recognised or comparable (check anabin)", "The employer fills in the declaration of employment"],
      links: [link("/tools/blue-card-check", "Blue Card Salary Check"), link("/tools/residence-timeline", "PR & Citizenship Timeline")] };
    if (qual === "degree") return { name: "Skilled worker visa, academic", law: "§ 18b Residence Act",
      why: `Your salary is below the Blue Card threshold of ${eur(threshold, lower ? 2 : 0)}, but with a recognised degree you can still get a work visa for a qualified job.`,
      steps: ["Job offer for qualified work", "Degree that is recognised or comparable (check anabin)", "Approval by the Federal Employment Agency, which checks pay and conditions", "If you are 45 or older: a minimum salary or proof of pension provision"],
      links: [link("/tools/blue-card-check", "See how far you are from the Blue Card")] };
    if (qual === "vocational") return { name: "Skilled worker visa, vocational", law: "§ 18a Residence Act",
      why: "With vocational training that is recognised in Germany you can work in a qualified job.",
      steps: ["Job offer for qualified work", "Recognition of your training in Germany. If it is only partial, a recognition partnership lets you finish it while working", "Approval by the Federal Employment Agency"],
      links: [] };
    if (qual === "it") return { name: "Work visa for IT specialists", law: "§ 19c Residence Act with § 6 Employment Ordinance",
      why: `IT specialists can get a work visa without a degree. Your salary is below the Blue Card threshold of ${eur(threshold, 2)}, but this route has its own, lower salary minimum.`,
      steps: ["Job offer in IT", "3+ years of IT experience within the last 7 years", "The salary minimum for this route, which changes every year"], links: [] };
    return { name: "No standard work visa fits yet", none: true, why: "German work visas need a degree, recognised vocational training, or professional experience in a few special cases.",
      steps: ["With 2+ years of state-recognised training abroad and 2+ years of experience, the route for experienced professionals may fit", "Vocational training (Ausbildung) in Germany is open to people without a qualification"], links: [] };
  }

  live(form, () => {
    const goal = $("#goal").value, citizen = $("#citizen").value;
    form.querySelectorAll("[data-for]").forEach((el) => { el.hidden = !el.dataset.for.split(" ").includes(goal); });

    if (citizen === "eu") {
      out.innerHTML = `<p class="kicker">Result</p><span class="verdict ok">No visa needed</span>
        <p>You have freedom of movement. You can live, study and work in Germany without a visa or work permit. You only register your address after moving in.</p>
        <p>${link("/tools/arrival-planner", "Plan your first weeks")}</p>`;
      return;
    }
    const r = route();
    out.innerHTML = `
      <p class="kicker">Your likely route</p>
      <p class="big" style="font-size:1.7rem">${r.name}</p>
      ${r.law ? `<p class="muted">${r.law}</p>` : ""}
      ${r.none ? "" : `<span class="verdict ok">Looks like a fit</span>`}
      <p>${r.why}</p>
      <p><strong>${r.none ? "Options to look at" : "What you will need"}</strong></p>
      <ul>${r.steps.map((s) => `<li>${s}</li>`).join("")}</ul>
      ${citizen === "privileged" && !r.none ? `<p class="muted">As a citizen of your country you may enter Germany without a visa and apply for the residence permit at the local immigration office. You may only start working once you have it.</p>` : ""}
      ${r.links.length ? `<p>${r.links.join("<br>")}</p>` : ""}`;
  });
})();
