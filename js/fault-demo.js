/* =========================================================
   fault-demo.js
   Interactive illustration of the theoretical/expected fault
   behavior from the FPGA Fault Injection (Tank Battalion)
   case study.

   IMPORTANT — what this is and isn't:
   This is a hand-built canvas illustration, not the real
   Verilog/FPGA hardware running in the browser — there is no
   HDL simulation happening here. Each fault below shows the
   EXPECTED/predicted effect based on how the underlying
   timing and control signals work (the "Expected Effect"
   column from the real results table on the Projects page),
   plus a one-line explanation of why that effect follows from
   the hardware. It's a teaching aid for the theory, not a
   log of one specific test run.
   ========================================================= */

const FAULT_DATA = [
  {
    id: "hsync",
    label: "HSYNC stuck-at-1",
    signal: "HSYNC",
    expected: "Loss of horizontal lock",
    reasoning: "HSYNC tells the display where each scanline starts. Forcing it constant removes that reference, so the display can't stay locked horizontally.",
  },
  {
    id: "vsync",
    label: "VSYNC stuck-at-1",
    signal: "VSYNC",
    expected: "Vertical roll / collapse",
    reasoning: "VSYNC marks the start of a new frame. A stuck VSYNC removes the frame boundary, so the image should roll or collapse vertically.",
  },
  {
    id: "hblank",
    label: "HBLANK stuck-at-1",
    signal: "HBLANK",
    expected: "Black screen or retrace artifacts",
    reasoning: "HBLANK hides the beam's retrace between scanlines. Stuck high, it should force continuous blanking or expose retrace timing that's normally invisible.",
  },
  {
    id: "vblank",
    label: "VBLANK stuck-at-1",
    signal: "VBLANK",
    expected: "Frame blanking failure",
    reasoning: "VBLANK gates pixel output during the vertical blanking interval. If it fails to assert correctly, pixel data can leak into the frame-boundary region.",
  },
  {
    id: "movement",
    label: "P1 Movement stuck-at",
    signal: "MOVE",
    expected: "Continuous / absent movement",
    reasoning: "A stuck input line reads as a permanently held (or permanently released) button, so control logic should drive continuous or absent movement regardless of player input.",
  },
];

const faultState = {};
FAULT_DATA.forEach((f) => (faultState[f.id] = false));

let canvas, ctx, sigCanvas, sigCtx, logEl;
let tankX = 0.5, tankY = 0.72; // 0..1 across the play field
let tankDirX = 1, tankDirY = 1;
let frame = 0;
let rollOffset = 0;

function initFaultDemo() {
  canvas = document.getElementById("demo-canvas");
  sigCanvas = document.getElementById("signal-canvas");
  logEl = document.getElementById("demo-log");
  if (!canvas || !sigCanvas) return;
  ctx = canvas.getContext("2d");
  sigCtx = sigCanvas.getContext("2d");

  renderControls();
  logLine("SYSTEM READY — nominal operation. Toggle a fault below to see the expected effect.");
  requestAnimationFrame(tick);
}

function renderControls() {
  const mount = document.getElementById("fault-controls");
  if (!mount) return;
  mount.innerHTML = FAULT_DATA.map(
    (f) => `
      <button class="fault-toggle" id="toggle-${f.id}" data-fault="${f.id}" type="button">
        <span class="ft-dot"></span>
        <span class="ft-body">
          <span class="ft-label">${f.label}</span>
          <span class="ft-expected">Expected: ${f.expected}</span>
        </span>
      </button>`
  ).join("");

  mount.querySelectorAll(".fault-toggle").forEach((btn) => {
    btn.addEventListener("click", () => toggleFault(btn.dataset.fault));
  });

  const resetBtn = document.getElementById("reset-faults");
  if (resetBtn) resetBtn.addEventListener("click", resetAllFaults);
}

function toggleFault(id) {
  const f = FAULT_DATA.find((x) => x.id === id);
  if (!f) return;
  faultState[id] = !faultState[id];
  const btn = document.getElementById(`toggle-${id}`);
  if (btn) btn.classList.toggle("active", faultState[id]);

  const time = stamp();
  if (faultState[id]) {
    logLine(`[${time}] FAULT INJECTED: ${f.label}`);
    logLine(`[${time}] EXPECTED: ${f.expected}`, "ok");
    logLine(`[${time}] WHY: ${f.reasoning}`);
  } else {
    logLine(`[${time}] FAULT CLEARED: ${f.label} — nominal behavior restored.`);
  }
}

function resetAllFaults() {
  FAULT_DATA.forEach((f) => {
    if (faultState[f.id]) toggleFault(f.id);
  });
  logLine(`[${stamp()}] All faults cleared. System nominal.`);
}

function stamp() {
  const s = frame / 60;
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(1).padStart(4, "0");
  return `${String(m).padStart(2, "0")}:${sec}`;
}

function logLine(text, cls) {
  if (!logEl) return;
  const line = document.createElement("div");
  line.className = "log-line" + (cls ? " log-" + cls : "");
  line.textContent = text;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
  while (logEl.children.length > 80) logEl.removeChild(logEl.firstChild);
}

/* ---------- Main render loop ---------- */
function tick() {
  frame++;
  drawScene();
  drawSignals();
  requestAnimationFrame(tick);
}

function drawScene() {
  const w = canvas.width;
  const h = canvas.height;

  // HBLANK stuck: expected effect is a black screen / retrace artifacts —
  // this is the most severe case, so it overrides normal rendering.
  if (faultState.hblank) {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, w, h);
    if (Math.random() < 0.5) {
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 2; i++) {
        const ly = Math.random() * h;
        ctx.beginPath();
        ctx.moveTo(0, ly);
        ctx.lineTo(w, ly);
        ctx.stroke();
      }
    }
    drawStatusRibbon(w, h);
    return;
  }

  ctx.fillStyle = "#05070a";
  ctx.fillRect(0, 0, w, h);

  // update tank position (two-axis patrol)
  updateTankPosition();

  // VSYNC stuck: expected effect is vertical roll/collapse —
  // draw the playfield twice, offset, so it appears to scroll
  // continuously with a wraparound (no blank gap at the edge).
  if (faultState.vsync) {
    rollOffset = (rollOffset + 2) % h;
    ctx.save();
    ctx.translate(0, rollOffset);
    drawPlayfieldContent(w, h);
    ctx.restore();
    ctx.save();
    ctx.translate(0, rollOffset - h);
    drawPlayfieldContent(w, h);
    ctx.restore();
  } else {
    // HSYNC stuck: expected effect is loss of horizontal lock —
    // jitter the whole playfield left/right each frame.
    const jitterX = faultState.hsync ? (Math.random() - 0.5) * 26 : 0;
    ctx.save();
    ctx.translate(jitterX, 0);
    drawPlayfieldContent(w, h);
    ctx.restore();
  }

  // VBLANK stuck: expected effect is a frame-blanking failure —
  // pixel data "leaks" into the frame-boundary region as noise.
  if (faultState.vblank) {
    ctx.save();
    for (let i = 0; i < 14; i++) {
      const rx = 12 + Math.random() * (w - 24);
      const ry = h - 26 + Math.random() * 16;
      const rw = 6 + Math.random() * 24;
      ctx.fillStyle = `rgba(224, 70, 60, ${0.35 + Math.random() * 0.4})`;
      ctx.fillRect(rx, ry, rw, 2 + Math.random() * 3);
    }
    ctx.restore();
  }

  drawStatusRibbon(w, h);
}

function drawPlayfieldContent(w, h) {
  ctx.strokeStyle = "#1c2333";
  ctx.lineWidth = 2;
  ctx.strokeRect(8, 8, w - 16, h - 16);

  // static "walls" — decorative, abstracted (not the original game's art)
  ctx.fillStyle = "#2a3350";
  ctx.fillRect(w * 0.15, h * 0.25, 18, 18);
  ctx.fillRect(w * 0.75, h * 0.25, 18, 18);
  ctx.fillRect(w * 0.45, h * 0.55, 18, 18);

  const tx = 20 + tankX * (w - 40);
  const ty = 20 + tankY * (h - 60);
  drawTank(tx, ty);
}

function updateTankPosition() {
  if (faultState.movement) {
    // stuck input: continuous drift in one direction, patrol disabled
    tankX += 0.006;
    if (tankX > 1.05) tankX = -0.05;
  } else {
    tankX += 0.004 * tankDirX;
    if (tankX > 0.9 || tankX < 0.1) tankDirX *= -1;
    tankY += 0.003 * tankDirY;
    if (tankY > 0.9 || tankY < 0.1) tankDirY *= -1;
  }
}

function drawTank(x, y) {
  ctx.fillStyle = "#5b8bf0";
  ctx.fillRect(x - 8, y - 6, 16, 12);
  ctx.fillRect(x - 3, y - 10, 6, 6);
  ctx.fillStyle = "#7fa3f5";
  ctx.fillRect(x - 8, y - 6, 16, 3);
}

function drawStatusRibbon(w, h) {
  ctx.fillStyle = "rgba(5,7,10,0.85)";
  ctx.fillRect(8, h - 22, w - 16, 14);
  ctx.fillStyle = "#8b93a1";
  ctx.font = "9px monospace";
  const activeCount = Object.values(faultState).filter(Boolean).length;
  const status = activeCount === 0 ? "NOMINAL — no faults active" : `${activeCount} FAULT(S) ACTIVE`;
  ctx.fillText(status, 14, h - 12);
}

/* ---------- Signal panel: mini waveform per sync line ---------- */
const SIGNAL_ROWS = [
  { id: "hsync", label: "HSYNC" },
  { id: "vsync", label: "VSYNC" },
  { id: "hblank", label: "HBLANK" },
  { id: "vblank", label: "VBLANK" },
];

function drawSignals() {
  const w = sigCanvas.width;
  const h = sigCanvas.height;
  sigCtx.fillStyle = "#05070a";
  sigCtx.fillRect(0, 0, w, h);

  const rowH = h / SIGNAL_ROWS.length;
  SIGNAL_ROWS.forEach((row, i) => {
    const y = i * rowH;
    const faulted = faultState[row.id];
    sigCtx.fillStyle = "#6b7386";
    sigCtx.font = "9px monospace";
    sigCtx.fillText(row.label, 4, y + rowH / 2 - 8);

    sigCtx.strokeStyle = faulted ? "#e0463c" : "#5b8bf0";
    sigCtx.lineWidth = 1.5;
    sigCtx.beginPath();
    const baseY = y + rowH - 6;
    const highY = y + rowH / 2 + 2;
    if (faulted) {
      sigCtx.moveTo(48, highY);
      sigCtx.lineTo(w - 4, highY);
    } else {
      const period = row.id === "vsync" || row.id === "vblank" ? 40 : 10;
      let x = 48;
      let state = Math.floor((frame + i * 5) / period) % 2 === 0;
      let curY = state ? highY : baseY;
      sigCtx.moveTo(x, curY);
      while (x < w - 4) {
        const next = Math.min(x + period, w - 4);
        sigCtx.lineTo(next, curY);
        state = !state;
        curY = state ? highY : baseY;
        sigCtx.lineTo(next, curY);
        x = next;
      }
    }
    sigCtx.stroke();

    if (faulted) {
      sigCtx.fillStyle = "#e0463c";
      sigCtx.font = "bold 8px monospace";
      sigCtx.fillText("STUCK", w - 40, y + rowH / 2 - 8);
    }
  });
}

document.addEventListener("DOMContentLoaded", initFaultDemo);
