(function () {
  const { F, $, live } = ZB;
  const out = $("#out");
  const need = F.chancenkarte.minPoints;

  live($("#form"), () => {
    const qual = $("#qual").value, german = $("#german").value, english = $("#english").value;
    const languageOk = german !== "0" || english !== "0";
    const missing = [];
    if (qual === "none") missing.push("A degree, or at least two years of vocational training that is recognised by the state where you completed it.");
    if (!languageOk) missing.push("German at A1 or English at B2.");
    if (!$("#funds").checked) missing.push("Proof that you can pay for your stay.");

    if (qual === "full" && !missing.length) {
      out.innerHTML = `
        <p class="kicker">Result</p>
        <span class="verdict ok">No points needed</span>
        <p>With a qualification that is fully recognised in Germany you count as a skilled worker. You can get the Opportunity Card without the points system, as long as you can pay for your stay.</p>
        <p class="muted">With a job offer you could apply for a work visa or Blue Card straight away.</p>
        <p><a href="/tools/blue-card-check">Check a job offer against the Blue Card →</a></p>`;
      return;
    }

    const rows = [
      ["Partial recognition in Germany", qual === "partial" ? 4 : 0],
      ["Shortage occupation", $("#shortage").checked ? 1 : 0],
      ["Work experience", Number($("#exp").value)],
      ["German level", { a2: 1, b1: 2, b2: 3 }[german] || 0],
      ["English C1 or native", english === "c1" ? 1 : 0],
      ["Age", Number($("#age").value)],
      ["Earlier stay in Germany", $("#stay").checked ? 1 : 0],
      ["Partner applying too", $("#partner").checked ? 1 : 0],
    ];
    const total = rows.reduce((s, r) => s + r[1], 0);
    const enough = total >= need;
    const ok = enough && !missing.length;

    out.innerHTML = `
      <p class="kicker">Your points</p>
      <p class="big">${total} <small>of ${need} needed</small></p>
      <div class="meter"><i style="width:${Math.min(100, (total / need) * 100)}%"></i></div>
      <span class="verdict ${ok ? "ok" : enough ? "maybe" : "no"}">${ok ? "You reach the minimum" : enough ? "Enough points, but a basic requirement is missing" : (need - total) + " more point" + (need - total === 1 ? "" : "s") + " needed"}</span>
      ${missing.length ? `<p><strong>Still missing:</strong></p><ul>${missing.map((m) => `<li>${m}</li>`).join("")}</ul>` : ""}
      <table class="lines">
        ${rows.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join("")}
        <tr class="total"><td>Total</td><td>${total}</td></tr>
      </table>
      ${!enough ? `<p class="muted">The fastest ways to add points: a higher German certificate (up to 3 points) or partial recognition of your qualification (4 points).</p>
        <p><a href="https://examklar.com" target="_blank" rel="noopener">Practise for your German exam with ExamKlar ↗</a></p>` : ""}`;
  });
})();
