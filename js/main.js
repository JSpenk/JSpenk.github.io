/* =========================================================
   main.js
   Global behavior: theme persistence + toggle wiring.
   Runs on every page after components.js injects the header.
   ========================================================= */

const THEME_KEY = "jspenker-portfolio-theme";

function applyStoredTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = stored || (prefersDark ? "dark" : "light");
  document.documentElement.setAttribute("data-theme", theme);
}

function wireThemeToggle() {
  const btn = document.getElementById("theme-toggle");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(THEME_KEY, next);
  });
}

/* Apply theme immediately (before paint) to avoid flash */
applyStoredTheme();

document.addEventListener("DOMContentLoaded", () => {
  // header is injected by components.js on the same event;
  // wait a tick so #theme-toggle exists.
  setTimeout(wireThemeToggle, 0);
});
