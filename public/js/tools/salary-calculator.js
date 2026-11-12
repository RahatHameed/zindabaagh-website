(function () {
  const { F, $, eur, num, live } = ZB;
  const out = $("#out");
  const S = F.social, T = F.tax;

  // Income tax tariff 2026, § 32a EStG. Update the formula constants each January together with site.json.
  function tariff(income) {
    const x = Math.floor(income);
    if (x <= T.basicAllowance) return 0;
    if (x <= 17799) { const y = (x - 12348) / 10000; return Math.floor((914.51 * y + 1400) * y); }
    if (x <= 69878) { const z = (x - 17799) / 10000; return Math.floor((173.1 * z + 2397) * z + 1034.87); }
    if (x <= 277825) return Math.floor(0.42 * x - 11135.63);
    return Math.floor(0.45 * x - 19470.38);
  }

  live($("#form"), () => {
    const gross = num($("#gross")) * Number($("#period").value);
    const married = $("#status").value === "married";
    const hasChildren = $("#children").checked;
    const addOn = Math.max(0, num($("#addon"))) / 2;

    const basePension = Math.min(gross, S.ceilingPension);
    const baseHealth = Math.min(gross, S.ceilingHealth);
    const pension = basePension * S.pensionRate / 100;
    const unemployment = basePension * S.unemploymentRate / 100;
    const health = baseHealth * (S.healthRate + addOn) / 100;
    const care = baseHealth * (S.careRate + (hasChildren ? 0 : S.careChildlessExtra)) / 100;
    const social = pension + unemployment + health + care;

    // Taxable income: gross minus the flat allowances and the deductible insurance contributions.
    // Health insurance counts without the sick-pay share (0.3 points of the employee rate).
    const deductible = pension + baseHealth * (S.healthRate - 0.3 + addOn) / 100 + care;
    const taxable = Math.max(0, gross - T.employeeAllowance - T.specialExpenses - deductible);
    const tax = married ? 2 * tariff(taxable / 2) : tariff(taxable);
    const exemption = T.soliExemption * (married ? 2 : 1);
    const soli = tax > exemption ? Math.min(tax * 0.055, (tax - exemption) * 0.119) : 0;
    const church = $("#church").checked ? tax * 0.09 : 0;
    const net = gross - social - tax - soli - church;

    const row = (label, value) => `<tr><td>${label}</td><td>${eur(value / 12)}</td><td>${eur(value)}</td></tr>`;
    out.innerHTML = `
      <p class="kicker">Estimated net pay, ${F.year}</p>
      <p class="big">${eur(net / 12)} <small>a month</small></p>
      <p class="muted">${eur(net)} a year · you keep ${gross > 0 ? Math.round((net / gross) * 100) : 0}% of your gross salary</p>
      <table class="lines">
        <tr><td></td><td class="muted">Month</td><td class="muted">Year</td></tr>
        ${row("Gross salary", gross)}
        ${row("Income tax", -tax)}
        ${soli > 0 ? row("Solidarity surcharge", -soli) : ""}
        ${church > 0 ? row("Church tax", -church) : ""}
        ${row("Pension insurance", -pension)}
        ${row("Health insurance", -health)}
        ${row("Care insurance", -care)}
        ${row("Unemployment insurance", -unemployment)}
        <tr class="total"><td>Net pay</td><td>${eur(net / 12)}</td><td>${eur(net)}</td></tr>
      </table>
      <p><a href="/tools/blue-card-check">Is this salary enough for a Blue Card? →</a></p>`;
  });
})();
