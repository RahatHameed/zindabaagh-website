(function () {
  const { $, num, live } = ZB;
  const out = $("#out"), preset = $("#preset");

  preset.addEventListener("change", () => {
    if (preset.value === "custom") return;
    const [max, min] = preset.value.split(",");
    $("#max").value = max; $("#min").value = min;
  });
  ["#max", "#min"].forEach((id) => $(id).addEventListener("input", () => { preset.value = "custom"; }));

  const label = (g) => (g <= 1.5 ? "very good (sehr gut)" : g <= 2.5 ? "good (gut)" : g <= 3.5 ? "satisfactory (befriedigend)" : "sufficient (ausreichend)");

  live($("#form"), () => {
    const max = num($("#max")), min = num($("#min")), grade = num($("#grade"));
    if (max === min) { out.innerHTML = `<p class="muted">The best grade and the lowest passing grade cannot be the same.</p>`; return; }
    // Works for both directions (higher is better, or lower is better).
    const inRange = (grade - min) * (grade - max) <= 0;
    const passed = (grade - min) * (max - min) >= 0;
    if (!$("#grade").value.trim()) { out.innerHTML = `<p class="muted">Enter your grade to see the result.</p>`; return; }
    if (!passed) {
      out.innerHTML = `<p class="kicker">Result</p><span class="verdict no">Below the pass mark</span>
        <p>This grade is under the lowest passing grade you entered, so it has no German equivalent (worse than 4.0).</p>`;
      return;
    }
    if (!inRange) { out.innerHTML = `<p class="muted">Your grade is better than the best possible grade. Check the numbers.</p>`; return; }

    const raw = 1 + (3 * (max - grade)) / (max - min);
    const german = Math.floor(raw * 10 + 1e-9) / 10;
    out.innerHTML = `
      <p class="kicker">German grade</p>
      <p class="big">${german.toFixed(1)}</p>
      <span class="verdict ${german <= 2.5 ? "ok" : "maybe"}">${label(german)}</span>
      <table class="lines">
        <tr><td>Formula</td><td>1 + 3 × (${max} − ${grade}) ÷ (${max} − ${min})</td></tr>
        <tr><td>Exact value</td><td>${raw.toFixed(3)}</td></tr>
      </table>
      <p class="muted">${german <= 2.5
        ? "This meets the common 2.5 requirement for master's programmes. Check each programme's own limit."
        : "Many master's programmes ask for 2.5 or better, but plenty accept up to 3.0 or have no fixed limit. Check each programme."}</p>`;
  });
})();
