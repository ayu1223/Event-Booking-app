(function () {
  function pad(n) { return String(n).padStart(2, "0"); }

  function tick(el) {
    const targetTime = new Date(el.dataset.countdownTarget).getTime();
    const now = Date.now();
    const diff = targetTime - now;

    if (diff <= 0) {
      el.textContent = "Event is live";
      const joinBtn = document.querySelector("[data-join-button]");
      if (joinBtn) joinBtn.removeAttribute("disabled");
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    const seconds = Math.floor((diff / 1000) % 60);

    let text = "Starts in ";
    if (days > 0) text += `${days}d `;
    text += `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
    el.textContent = text;
  }

  document.querySelectorAll("[data-countdown-target]").forEach((el) => {
    tick(el);
    setInterval(() => tick(el), 1000);
  });
})();
