/* =========================================================
   about.js
   Tiny vanilla-JS carousel for the About page photo strip.
   Adjusts automatically to however many .cat-slide elements
   are present in the DOM — add or remove slides in about.html
   without touching this file.
   ========================================================= */

function initCatCarousel() {
  const track = document.getElementById("cat-track");
  const dotsWrap = document.getElementById("cat-dots");
  const prevBtn = document.getElementById("cat-prev");
  const nextBtn = document.getElementById("cat-next");
  if (!track || !dotsWrap || !prevBtn || !nextBtn) return;

  const slides = Array.from(track.children);
  if (slides.length === 0) return;

  let index = 0;

  dotsWrap.innerHTML = slides
    .map((_, i) => `<button class="carousel-dot${i === 0 ? " active" : ""}" data-idx="${i}" type="button" aria-label="Go to photo ${i + 1}"></button>`)
    .join("");
  const dots = Array.from(dotsWrap.querySelectorAll(".carousel-dot"));

  function update() {
    track.style.transform = `translateX(-${index * 100}%)`;
    dots.forEach((d, i) => d.classList.toggle("active", i === index));
  }

  function go(newIndex) {
    index = (newIndex + slides.length) % slides.length;
    update();
  }

  prevBtn.addEventListener("click", () => go(index - 1));
  nextBtn.addEventListener("click", () => go(index + 1));
  dotsWrap.addEventListener("click", (e) => {
    const btn = e.target.closest(".carousel-dot");
    if (!btn) return;
    go(Number(btn.dataset.idx));
  });

  // Basic swipe support for touch devices.
  let touchStartX = null;
  track.addEventListener("touchstart", (e) => { touchStartX = e.touches[0].clientX; }, { passive: true });
  track.addEventListener("touchend", (e) => {
    if (touchStartX === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(delta) > 40) go(delta < 0 ? index + 1 : index - 1);
    touchStartX = null;
  });

  update();
}

document.addEventListener("DOMContentLoaded", initCatCarousel);
