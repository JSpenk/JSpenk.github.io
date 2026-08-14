/* =========================================================
   components.js
   Single source of truth for the header/nav and footer.
   Edit this file once and every page updates automatically —
   this is what keeps the site "modular."
   ========================================================= */

const SITE = {
  name: "Justin Spenker",
  initials: "JS",
  email: "spenker.justin@gmail.com",
  github: "https://github.com/JSpenk",
};

const NAV_ITEMS = [
  { href: "index.html", label: "Home", page: "home" },
  { href: "projects.html", label: "Projects", page: "projects" },
  { href: "demo-fault-injection.html", label: "Demos", page: "demo", isNew: true },
  { href: "skills.html", label: "Skills", page: "skills" },
  { href: "resume.html", label: "Resume", page: "resume" },
  { href: "about.html", label: "About", page: "about", soon: true },
];

function renderHeader() {
  const mount = document.getElementById("site-header");
  if (!mount) return;
  const current = document.body.getAttribute("data-page");

  const links = NAV_ITEMS.map((item) => {
    const activeClass = item.page === current ? " active" : "";
    const soonTag = item.soon ? '<span class="tag-soon">soon</span>' : "";
    const newTag = item.isNew ? '<span class="tag-new">new</span>' : "";
    return `<a href="${item.href}" class="${activeClass.trim()}">${item.label}${soonTag}${newTag}</a>`;
  }).join("");

  mount.innerHTML = `
    <header class="site-header">
      <div class="container">
        <a href="index.html" class="brand">
          <span class="brand-mark">&lt;${SITE.initials}/&gt;</span>
          <span>${SITE.name}</span>
        </a>
        <nav class="nav-links" id="nav-links">
          ${links}
        </nav>
        <div class="header-actions">
          <button class="theme-toggle" id="theme-toggle" aria-label="Toggle color theme" type="button">
            <svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
            <svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/></svg>
          </button>
          <button class="nav-toggle" id="nav-toggle" aria-label="Toggle menu" type="button">
            <span></span><span></span><span></span>
          </button>
        </div>
      </div>
    </header>
  `;

  document.getElementById("nav-toggle").addEventListener("click", () => {
    document.getElementById("nav-links").classList.toggle("open");
  });
}

function renderFooter() {
  const mount = document.getElementById("site-footer");
  if (!mount) return;
  const year = new Date().getFullYear();
  mount.innerHTML = `
    <footer class="site-footer">
      <div class="container">
        <div class="foot-left">&copy; ${year} ${SITE.name} &mdash; Computer Engineering, UC Davis</div>
        <div class="foot-right">
          <a href="${SITE.github}" target="_blank" rel="noopener">GitHub</a>
          &nbsp;&middot;&nbsp;
          <a href="mailto:${SITE.email}">${SITE.email}</a>
        </div>
      </div>
    </footer>
  `;
}

document.addEventListener("DOMContentLoaded", () => {
  renderHeader();
  renderFooter();
});
