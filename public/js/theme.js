(function () {
  const toggleBtn = document.getElementById("theme-toggle");
  if (!toggleBtn) return;

  function currentTheme() {
    return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  }

  function applyIcon() {
    toggleBtn.textContent = currentTheme() === "dark" ? "☀️" : "🌙";
  }

  toggleBtn.addEventListener("click", function () {
    const next = currentTheme() === "dark" ? "light" : "dark";
    if (next === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    localStorage.setItem("theme", next);
    applyIcon();
  });

  applyIcon();
})();
