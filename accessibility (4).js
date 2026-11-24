(() => {
  "use strict";

  const STORAGE_KEY = "agenda-plus-accessible-mode";
  const buttons = [...document.querySelectorAll("#a11yToggle")];
  const savedMode = window.localStorage.getItem(STORAGE_KEY) === "true";

  function showToast(text) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = text;
    toast.classList.add("is-visible");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("is-visible"), 3000);
  }

  function updateControls(active) {
    document.documentElement.classList.toggle("a11y-mode", active);
    document.body.classList.toggle("a11y-mode", active);
    buttons.forEach((button) => {
      button.setAttribute("aria-pressed", String(active));
      button.setAttribute("aria-label", active ? "Desativar modo de leitura confortável" : "Ativar modo de leitura confortável");
      const label = button.querySelector("span:last-child");
      if (label) label.textContent = active ? "Modo confortável" : "Modo acessível";
      const icon = button.querySelector(".a11y-icon");
      if (icon) icon.textContent = active ? "Aa+" : "Aa";
    });
  }

  function setMode(active, notify) {
    window.localStorage.setItem(STORAGE_KEY, String(active));
    updateControls(active);
    if (notify) showToast(active ? "Modo confortável ativado" : "Modo confortável desativado");
  }

  buttons.forEach((button) => {
    button.addEventListener("click", () => setMode(!document.body.classList.contains("a11y-mode"), true));
  });

  document.addEventListener("keydown", (event) => {
    if (event.altKey && event.shiftKey && event.key.toLowerCase() === "a") {
      event.preventDefault();
      setMode(!document.body.classList.contains("a11y-mode"), true);
    }
  });

  updateControls(savedMode);
})();
