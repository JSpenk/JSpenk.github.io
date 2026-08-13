/* =========================================================
   render.js
   Turns the arrays in data.js into DOM. Nothing in here
   should need editing just to add/change content — edit
   data.js instead.
   ========================================================= */

const ICONS = {
  fpga: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="7" y="7" width="10" height="10" rx="1"/><path d="M9 3v4M12 3v4M15 3v4M9 17v4M12 17v4M15 17v4M3 9h4M3 12h4M3 15h4M17 9h4M17 12h4M17 15h4"/></svg>`,
  pcb: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none"/><circle cx="16" cy="16" r="1.4" fill="currentColor" stroke="none"/><path d="M8 9.4V14a2 2 0 0 0 2 2h3.6M16 14.6V10a2 2 0 0 0-2-2H10.4"/></svg>`,
  chip: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="6" y="6" width="12" height="12" rx="1"/><path d="M9 2v4M12 2v4M15 2v4M9 18v4M12 18v4M15 18v4M2 9h4M2 12h4M2 15h4M18 9h4M18 12h4M18 15h4"/></svg>`,
  code: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="m8 9-4 3 4 3M16 9l4 3-4 3M13 6l-2 12"/></svg>`,
};

function projectCard(p) {
  return `
    <button class="card-btn-reset" data-open-project="${p.id}" type="button">
      <article class="project-card">
        <div class="thumb">${ICONS[p.icon] || ICONS.chip}</div>
        <div class="body">
          <div class="cat">${p.category}</div>
          <h3>${p.title}</h3>
          <p class="desc">${p.summary}</p>
          <div class="tag-row">${p.tags.slice(0, 4).map((t) => `<span class="tag">${t}</span>`).join("")}</div>
          <div class="card-foot">
            <span class="meta">${p.period}</span>
            <span class="view-link">Details &rarr;</span>
          </div>
        </div>
      </article>
    </button>
  `;
}

function renderFeaturedProjects() {
  const mount = document.getElementById("featured-projects");
  if (!mount) return;
  mount.innerHTML = PROJECTS.filter((p) => p.featured).map(projectCard).join("");
  wireProjectCards();
}

function renderAllProjects(filterTag) {
  const mount = document.getElementById("project-grid");
  if (!mount) return;
  const list = filterTag && filterTag !== "All"
    ? PROJECTS.filter((p) => p.tags.includes(filterTag) || p.category.includes(filterTag))
    : PROJECTS;
  mount.innerHTML = list.map(projectCard).join("") ||
    `<p style="color:var(--text-muted)">No projects match that filter yet.</p>`;
  wireProjectCards();
}

function renderProjectFilters() {
  const mount = document.getElementById("filter-row");
  if (!mount) return;
  const cats = ["All", ...new Set(PROJECTS.map((p) => p.category))];
  mount.innerHTML = cats
    .map((c, i) => `<button class="filter-btn${i === 0 ? " active" : ""}" data-filter="${c}" type="button">${c}</button>`)
    .join("");
  mount.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      mount.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderAllProjects(btn.dataset.filter);
    });
  });
}

function wireProjectCards() {
  document.querySelectorAll("[data-open-project]").forEach((btn) => {
    btn.addEventListener("click", () => openProjectModal(btn.dataset.openProject));
  });
}

function openProjectModal(id) {
  const p = PROJECTS.find((proj) => proj.id === id);
  if (!p) return;
  const overlay = document.getElementById("project-modal");
  if (!overlay) return;

  const section = (heading, content) => content ? `<div><h4>${heading}</h4>${content}</div>` : "";
  const list = (items) => items && items.length ? `<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>` : "";
  const table = p.resultsTable
    ? `<table class="result-table"><thead><tr>${p.resultsTable.headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
       <tbody>${p.resultsTable.rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`
    : "";

  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal-head">
        <div>
          <div class="cat">${p.category}</div>
          <h3>${p.title}</h3>
          <div class="meta-line">${p.role} &middot; ${p.collaborators} &middot; ${p.period}</div>
        </div>
        <button class="modal-close" id="modal-close" aria-label="Close" type="button">&times;</button>
      </div>
      <div class="modal-body">
        <div class="tag-row">${p.tags.map((t) => `<span class="tag">${t}</span>`).join("")}</div>
        ${section("Overview", `<p>${p.overview || p.summary}</p>`)}
        ${section("Architecture &amp; Design", list(p.architecture))}
        ${section("Methodology", list(p.methodology))}
        ${section("Results", table)}
        ${section("Conclusion", `<p>${p.conclusion || ""}</p>`)}
        <div class="modal-foot">
          ${(p.links || []).map((l) => `<a class="btn btn-outline btn-sm" href="${l.href}" target="_blank" rel="noopener">${l.label}</a>`).join("")}
        </div>
      </div>
    </div>
  `;

  overlay.classList.add("open");
  document.body.style.overflow = "hidden";
  document.getElementById("modal-close").addEventListener("click", closeProjectModal);
}

function closeProjectModal() {
  const overlay = document.getElementById("project-modal");
  if (!overlay) return;
  overlay.classList.remove("open");
  document.body.style.overflow = "";
}

function initModalOverlay() {
  const overlay = document.getElementById("project-modal");
  if (!overlay) return;
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeProjectModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeProjectModal();
  });
}

/* ---------- Skills page ---------- */
function renderSkillGroups() {
  const mount = document.getElementById("skill-groups");
  if (!mount) return;
  mount.innerHTML = SKILL_GROUPS.map(
    (g, i) => `
      <div class="skill-card">
        <h3><span class="idx">0${i + 1}</span> ${g.title}</h3>
        <div class="chip-row">${g.skills.map((s) => `<span class="chip">${s}</span>`).join("")}</div>
      </div>`
  ).join("");
}

function renderCoursework() {
  const mount = document.getElementById("course-groups");
  if (!mount) return;
  mount.innerHTML = COURSEWORK.map(
    (g) => `
      <div class="course-group">
        <h4>${g.group}</h4>
        <div class="course-list">
          ${g.courses.map((c) => `<div class="course-item"><span class="code mono">${c.code}</span><span class="name">${c.name}</span></div>`).join("")}
        </div>
      </div>`
  ).join("");
}
