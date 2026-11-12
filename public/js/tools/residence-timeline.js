(function () {
  const { F, $, day, parseDate, addMonths, live } = ZB;
  const out = $("#out"), S = F.settlement;
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const status = (date) => {
    if (date <= today) return `<span class="verdict ok">Waiting time already over</span>`;
    const months = Math.max(1, Math.round((date - today) / (30.44 * 864e5)));
    return `<span class="verdict maybe">In about ${months >= 24 ? (months / 12).toFixed(1).replace(".0", "") + " years" : months + " month" + (months === 1 ? "" : "s")}</span>`;
  };

  $("#permitStart").value = ZB.today();

  live($("#form"), () => {
    const permitStart = parseDate($("#permitStart").value);
    if (!permitStart) { out.innerHTML = `<p class="muted">Enter the start date of your residence permit to see your timeline.</p>`; return; }
    const arrival = parseDate($("#arrival").value) || permitStart;
    const permit = $("#permit").value, german = $("#german").value;

    let pr = "", note = "";
    if (permit === "student") {
      pr = `<p>A student permit does not lead to a settlement permit directly. After you graduate and start working as a skilled worker, the wait is ${S.germanGraduateMonths} months. Choose "Working after a German degree" once you have that permit.</p>`;
    } else {
      let months;
      if (permit === "bluecard") {
        months = german === "b1" ? S.blueCardB1Months : S.blueCardA1Months;
        note = german === "b1" ? `Blue Card with German B1: ${months} months.`
          : german === "a1" ? `Blue Card with German A1: ${months} months. With a B1 certificate it would be ${S.blueCardB1Months} months, so ${day(addMonths(permitStart, S.blueCardB1Months))}.`
          : `Blue Card: ${months} months, but you need German at A1 first.`;
      } else {
        months = permit === "skilled" ? S.skilledWorkerMonths : permit === "graduate" ? S.germanGraduateMonths : S.generalMonths;
        note = `${months} months with this permit.` + (german !== "b1" ? " You need German at B1 before you can apply." : "");
      }
      const date = addMonths(permitStart, months);
      pr = `<p class="big" style="font-size:1.6rem">${day(date)}</p>${status(date)}<p class="muted">${note}</p>`;
    }

    const citizen = addMonths(arrival, F.citizenshipYears * 12);
    out.innerHTML = `
      <p class="kicker">Settlement permit, earliest</p>
      ${pr}
      <p class="kicker" style="margin-top:22px">German citizenship, earliest</p>
      <p class="big" style="font-size:1.6rem">${day(citizen)}</p>
      ${status(citizen)}
      <p class="muted">${F.citizenshipYears} years of legal residence, counted from ${day(arrival)}.${german !== "b1" ? " You need German at B1 and the citizenship test." : " You also need the citizenship test."}</p>
      ${german !== "b1" ? `<p><a href="https://examklar.zindabaagh.com" target="_blank" rel="noopener">Prepare for the B1 exam with ExamKlar ↗</a></p>` : ""}
      <p class="muted">These are the earliest dates the waiting period ends. Long stays abroad can interrupt it, and the authority checks the other conditions too.</p>`;
  });
})();
