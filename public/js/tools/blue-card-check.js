(function () {
  const { F, $, eur, num, live } = ZB;
  const out = $("#out");

  live($("#form"), () => {
    const yearly = num($("#salary")) * Number($("#period").value);
    const qual = $("#qual").value;
    const lower = qual === "it" || $("#shortage").checked || $("#newgrad").checked;
    const threshold = lower ? F.blueCard.reduced : F.blueCard.standard;
    const gap = threshold - yearly;
    const digits = lower ? 2 : 0;

    if (qual === "none") {
      out.innerHTML = `
        <p class="kicker">Result</p>
        <span class="verdict no">Blue Card not possible</span>
        <p>The Blue Card needs a university degree, or at least three years of IT experience. Other work visas may still fit you.</p>
        <p><a href="/tools/visa-finder">Check other routes in the Visa Route Finder →</a></p>`;
      return;
    }
    const reasons = [];
    if (qual === "it") reasons.push("IT specialist without a degree");
    if ($("#shortage").checked) reasons.push("shortage occupation");
    if ($("#newgrad").checked) reasons.push("recent graduate");

    out.innerHTML = `
      <p class="kicker">Your threshold for ${F.year}</p>
      <p class="big">${eur(threshold, digits)} <small>a year</small></p>
      <p class="muted">${lower ? "Lower threshold (" + reasons.join(", ") + ")" : "Standard threshold"} · about ${eur(threshold / 12)} a month</p>
      <span class="verdict ${gap <= 0 ? "ok" : "no"}">${gap <= 0 ? "Salary is high enough" : "Salary is too low"}</span>
      <table class="lines">
        <tr><td>Your offer, per year</td><td>${eur(yearly)}</td></tr>
        <tr><td>Threshold</td><td>${eur(threshold, digits)}</td></tr>
        <tr class="total"><td>${gap <= 0 ? "Above the threshold by" : "Short by"}</td><td>${eur(Math.abs(gap), digits)}</td></tr>
      </table>
      ${gap <= 0
        ? `<p class="muted">The salary condition is met. The job must also fit your qualification and the contract must run at least six months.</p>`
        : `<p class="muted">You would need about ${eur(Math.ceil(gap / 12))} more per month. If the Blue Card is out of reach, the skilled-worker residence permit has no fixed salary threshold for most people under 45.</p>`}
      <p><a href="/tools/salary-calculator">See what this salary is after tax →</a></p>`;
  });
})();
