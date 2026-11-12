(function () {
  const { F, $, eur, num, live, esc } = ZB;
  const out = $("#out");

  live($("#form"), () => {
    const factor = Number($("#purpose").value);
    const months = Math.min(24, Math.max(1, Math.round(num($("#months")) || 1)));
    const monthly = F.blockedAccount.monthly * factor;
    const deposit = monthly * months;
    const fees = Math.max(0, num($("#fees")));
    const total = deposit + fees;
    const rate = num($("#rate")), cur = esc($("#cur").value.trim().toUpperCase());
    const local = rate > 0
      ? `<tr><td>In ${cur || "your currency"}</td><td>${Math.round(total * rate).toLocaleString("en-IE")} ${cur}</td></tr>` : "";

    out.innerHTML = `
      <p class="kicker">Amount to deposit, ${F.year}</p>
      <p class="big">${eur(deposit, deposit % 1 ? 2 : 0)}</p>
      <p class="muted">${months} month${months === 1 ? "" : "s"} × ${eur(monthly, monthly % 1 ? 2 : 0)}</p>
      <table class="lines">
        <tr><td>Blocked amount</td><td>${eur(deposit, 2)}</td></tr>
        <tr><td>Provider fees</td><td>${eur(fees, 2)}</td></tr>
        <tr class="total"><td>Total to transfer</td><td>${eur(total, 2)}</td></tr>
        ${local}
      </table>
      <p class="muted">After arrival you can withdraw ${eur(monthly, monthly % 1 ? 2 : 0)} each month.</p>`;
  });
})();
