window.addEventListener("load", function () {
  const input = document.getElementById("syote");
  const output = document.getElementById("euro");

  input.addEventListener("input", updateValue);

  function updateValue(e) {
    let kohde_valuutta = e.target.value;
    let eurot = kohde_valuutta * 0.041; // Tässä tällä hetkellä hard-koodaus Tsekin Korunaan
    output.textContent = (Math.round(eurot * 100) / 100).toFixed(2);
  }
});
