(function () {
  // Booking form: toggle location field based on mode (admin event form)
  const modeSelect = document.getElementById("mode");
  const locationField = document.getElementById("location-field");
  if (modeSelect && locationField) {
    const sync = () => {
      locationField.style.display = modeSelect.value === "offline" ? "block" : "none";
    };
    modeSelect.addEventListener("change", sync);
    sync();
  }

  // Set min date on any date input marked with data-min-today
  document.querySelectorAll("[data-min-today]").forEach((input) => {
    input.setAttribute("min", new Date().toISOString().split("T")[0]);
  });

  // Copy-to-clipboard buttons
  document.querySelectorAll("[data-copy-target]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = document.querySelector(btn.dataset.copyTarget);
      if (!target) return;
      navigator.clipboard.writeText(target.textContent.trim()).then(() => {
        const original = btn.textContent;
        btn.textContent = "Copied!";
        setTimeout(() => (btn.textContent = original), 1500);
      });
    });
  });
})();
