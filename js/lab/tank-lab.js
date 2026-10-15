/* =========================================================
   tank-lab.js
   Wires the game, CRT stage and fault bus to the page:
   input, main loop, fault-injector UI, signal monitor,
   campaign replay and event log.
   ========================================================= */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const { Game, W, H } = TBGame;

  /* ---------- core objects ---------- */
  const fb = document.createElement("canvas"); fb.width = W; fb.height = H;
  const fctx = fb.getContext("2d");
  const screen = $("screen");
  const crt = new TBCRT.CRT(screen);
  const bus = new FaultBus();
  const game = new Game();
  let protection = false;   // start with the dramatic raw-CRT view; the switch reveals the measured behavior
  let frame = 0;
  let shake = 0;

  /* ---------- audio (off until the user opts in) ---------- */
  let actx = null, soundOn = false;
  function beep(freq0, freq1, dur, type, gain) {
    if (!soundOn || !actx) return;
    const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime;
    o.type = type; o.frequency.setValueAtTime(freq0, t); o.frequency.exponentialRampToValueAtTime(freq1, t + dur);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(actx.destination); o.start(t); o.stop(t + dur);
  }
  function noise(dur, gain) {
    if (!soundOn || !actx) return;
    const n = Math.floor(actx.sampleRate * dur), buf = actx.createBuffer(1, n, actx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = actx.createBufferSource(), g = actx.createGain();
    g.gain.value = gain; s.buffer = buf; s.connect(g).connect(actx.destination); s.start();
  }
  game.sfx = (k) => {
    if (k === "fire") beep(900, 300, 0.08, "square", 0.03);
    else if (k === "boom") { shake = Math.max(shake, 6); noise(0.32, 0.12); }
    else if (k === "brick") beep(180, 90, 0.05, "square", 0.04);
    else if (k === "steel") beep(1200, 900, 0.04, "triangle", 0.04);
    else if (k === "clear") { beep(520, 780, 0.25, "square", 0.04); }
  };
  $("btn-sound").addEventListener("click", () => {
    soundOn = !soundOn;
    if (soundOn && !actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { soundOn = false; } }
    $("btn-sound").setAttribute("aria-pressed", String(soundOn));
    $("btn-sound").querySelector("span").textContent = soundOn ? "Sound on" : "Sound off";
    focusStage();
  });

  /* ---------- input ---------- */
  const keys = Object.create(null);
  const MAP = { ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down", ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", Space: "fire", KeyJ: "fire" };
  const stage = $("stage");
  let startPressed = false;
  function focusStage() { try { stage.focus({ preventScroll: true }); } catch (e) { stage.focus(); } }
  stage.addEventListener("keydown", (e) => {
    const k = MAP[e.code];
    if (k) { keys[k] = 1; e.preventDefault(); }
    else if (e.code === "Enter") { startPressed = true; e.preventDefault(); }
  });
  stage.addEventListener("keyup", (e) => { const k = MAP[e.code]; if (k) { keys[k] = 0; e.preventDefault(); } });
  stage.addEventListener("blur", () => { for (const k in keys) keys[k] = 0; });
  stage.addEventListener("pointerdown", () => { focusStage(); });
  $("overlay-play").addEventListener("click", () => { startPressed = true; focusStage(); });
  $("btn-start").addEventListener("click", () => { startPressed = true; focusStage(); });
  document.querySelectorAll("[data-key]").forEach((b) => {
    const k = b.getAttribute("data-key");
    const on = (e) => { keys[k] = 1; b.classList.add("down"); e.preventDefault(); };
    const off = (e) => { keys[k] = 0; b.classList.remove("down"); e.preventDefault(); };
    b.addEventListener("pointerdown", on); b.addEventListener("pointerup", off);
    b.addEventListener("pointerleave", off); b.addEventListener("pointercancel", off);
  });

  /* faults act on the input lines before the game sees them */
  game.inputFilter = (inp) => {
    for (const k of ["up", "down", "left", "right", "fire"]) {
      const f = bus.forced(k.toUpperCase());
      if (f !== null) inp[k] = f;
    }
    return inp;
  };

  /* ---------- event log ---------- */
  const logEl = $("log");
  function log(msg, cls) {
    const li = document.createElement("div");
    li.className = "log-line" + (cls ? " " + cls : "");
    li.innerHTML = `<span class="lf">f${String(frame).padStart(5, "0")}</span> ${msg}`;
    logEl.appendChild(li);
    while (logEl.childNodes.length > 60) logEl.removeChild(logEl.firstChild);
    logEl.scrollTop = logEl.scrollHeight;
  }

  /* ---------- what each fault does ---------- */
  const MASKED = "no visible effect, masked by the MiSTer output stage (as observed)";
  function describe(target, level, prot) {
    const v = level ? "1" : "0";
    switch (target) {
      case "HSYNC":
        return prot ? MASKED : "horizontal lock lost: " + (level ? "lines scramble with snow" : "lines drift and tear");
      case "VSYNC":
        return prot ? MASKED : "vertical lock lost: picture rolls through the blanking bar";
      case "HBLANK":
        return prot ? MASKED : level ? "beam blanked every line: black screen" : "retrace not blanked: flyback streaks across picture";
      case "VBLANK":
        return prot ? "game stays playable; red fringes on lower sprite borders (as observed)" : level ? "frame blanking stuck on: black screen" : "vertical retrace not blanked: diagonal retrace traces";
      case "FIRE":
        return level ? "fire held down: tank shoots continuously" : "fire dead: tank cannot shoot";
      default:
        return level ? `${target} held: tank keeps driving ${target.toLowerCase()}` : `${target} dead: that direction is unusable`;
    }
  }

  /* ---------- fault coverage (a real test-engineering metric, used as the game's goal) ---------- */
  const COV = ["HSYNC", "VSYNC", "HBLANK", "VBLANK", "UP", "DOWN", "LEFT", "RIGHT", "FIRE", "SEU"];
  const covHit = new Set();
  const pipsEl = $("cov-pips");
  COV.forEach((n) => { const s = document.createElement("span"); s.className = "pip"; s.textContent = n; s.dataset.n = n; pipsEl.appendChild(s); });
  function markCoverage(n) {
    if (covHit.has(n)) return;
    covHit.add(n);
    pipsEl.querySelector(`[data-n="${n}"]`).classList.add("hit");
    $("cov-num").textContent = `${covHit.size} / ${COV.length}`;
    $("cov-fill").style.width = (covHit.size / COV.length * 100) + "%";
    if (covHit.size === COV.length) { $("coverage").classList.add("full"); log("<b>COVERAGE</b> 100%: every fault target exercised", "ok"); }
  }
  function zap() { const c = $("stage"); c.classList.remove("zap"); void c.offsetWidth; c.classList.add("zap"); shake = Math.max(shake, 5); }

  /* ---------- injector UI ---------- */
  let selTarget = "HSYNC", selLevel = 1;
  document.querySelectorAll("[data-target]").forEach((b) => b.addEventListener("click", () => {
    selTarget = b.getAttribute("data-target");
    document.querySelectorAll("[data-target]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    focusStage();
  }));
  document.querySelectorAll("[data-level]").forEach((b) => b.addEventListener("click", () => {
    selLevel = Number(b.getAttribute("data-level"));
    document.querySelectorAll("[data-level]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    focusStage();
  }));
  function doInject(target, level, inter) {
    bus.inject(target, level, inter);
    markCoverage(target); zap();
    log(`<b>INJECT</b> ${target} stuck-at-${level}${inter ? " (intermittent)" : ""} &rarr; ${describe(target, level, protection)}`, "inj");
  }
  $("btn-inject").addEventListener("click", () => { doInject(selTarget, selLevel, $("chk-inter").checked); focusStage(); });
  $("btn-flip").addEventListener("click", () => {
    const r = game.flipRandomCell();
    if (r) { markCoverage("SEU"); zap(); }
    if (r) log(`<b>SEU</b> tile RAM [0x${r.addr.toString(16).toUpperCase().padStart(4, "0")}] bit ${r.bit} flipped ${r.before}&rarr;${r.after} (stays until scrubbed)`, "inj");
    renderChips(); focusStage();
  });
  $("btn-clear").addEventListener("click", () => {
    const n = game.scrub();
    const had = bus.faults.length;
    bus.clearAll();
    log(`<b>CLEAR</b> ${had} fault(s) removed${n ? `, scrubbed ${n} flipped tile cell(s)` : ""}`, "ok");
    renderChips(); focusStage();
  });
  $("sw-protect").addEventListener("click", () => {
    protection = !protection;
    $("sw-protect").setAttribute("aria-checked", String(protection));
    $("protect-label").textContent = protection ? "ON: as measured on the MiSTer" : "OFF: raw CRT theory";
    log(`<b>OUTPUT PROTECTION</b> ${protection ? "enabled (reproduces the measured behavior)" : "disabled (shows the textbook CRT failure modes)"}`);
    updateStatus(); focusStage();
  });

  const chipsEl = $("chips");
  function renderChips() {
    chipsEl.innerHTML = "";
    if (!bus.faults.length && !game.flips.size) { chipsEl.innerHTML = '<span class="none">No active faults. System healthy.</span>'; return; }
    for (const f of bus.faults) {
      const c = document.createElement("button");
      c.type = "button"; c.className = "fchip";
      c.innerHTML = `${f.target} SA${f.level}${f.intermittent ? " ~" : ""} <i aria-hidden="true">&times;</i>`;
      c.title = "Remove this fault";
      c.addEventListener("click", () => { bus.clear(f.id); log(`<b>CLEAR</b> ${f.target}`, "ok"); renderChips(); focusStage(); });
      chipsEl.appendChild(c);
    }
    if (game.flips.size) {
      const c = document.createElement("span"); c.className = "fchip static";
      c.textContent = `${game.flips.size} flipped tile bit(s)`; chipsEl.appendChild(c);
    }
  }
  bus.onChange = () => { renderChips(); updateStatus(); };

  /* ---------- status line ---------- */
  const statusEl = $("status");
  function updateStatus() {
    const vis = crt.last;
    let t;
    if (!bus.faults.length) t = "Healthy: all signals nominal.";
    else if (vis === "masked") t = "Fault injected, but the output stage is hiding it, just like the real board.";
    else if (vis === "fringe") t = "Pixel data leaking past the frame boundary: red fringes on lower sprite edges.";
    else if (vis === "blank") t = "Display fully blanked by the forced signal.";
    else if (vis === "distorted") t = "Raw CRT behavior: the monitor cannot lock to the corrupted timing.";
    else t = bus.faults.map((f) => `${f.target}: ${describe(f.target, f.level, protection)}`).join(" | ");
    statusEl.textContent = t;
    const osd = $("osd");
    if (vis === "masked") {
      statusEl.appendChild(document.createTextNode(" "));
      const bt = document.createElement("button");
      bt.type = "button"; bt.className = "linkbtn"; bt.textContent = "Show the raw CRT effect";
      bt.addEventListener("click", () => { $("sw-protect").click(); });
      statusEl.appendChild(bt);
      osd.textContent = "No picture change: fault masked by output stage";
      osd.hidden = false;
    } else osd.hidden = true;
    statusEl.dataset.state = !bus.faults.length ? "ok" : vis === "masked" ? "masked" : "fault";
    $("cabinet").dataset.alert = bus.faults.length ? "1" : "0";
  }

  /* ---------- signal monitor ---------- */
  const DUTY = {
    HSYNC: TB_TIMING.hsyncPx / TB_TIMING.pxPerLine,
    HBLANK: TB_TIMING.hblankPx / TB_TIMING.pxPerLine,
    VSYNC: TB_TIMING.vsyncLines / TB_TIMING.linesPerFrame,
    VBLANK: TB_TIMING.vblankLines / TB_TIMING.linesPerFrame,
  };
  const sigEls = {};
  document.querySelectorAll("[data-sig]").forEach((el) => { sigEls[el.getAttribute("data-sig")] = el; });
  function updateSignals() {
    for (const k in sigEls) {
      const el = sigEls[k], led = el.querySelector(".led"), val = el.querySelector(".val");
      const f = bus.forced(k);
      const isIn = ["UP", "DOWN", "LEFT", "RIGHT", "FIRE"].includes(k);
      if (isIn) {
        const li = game.lastInput || {}; const on = li[k.toLowerCase()] ? 1 : 0;
        led.style.opacity = on ? 1 : 0.18;
        el.dataset.forced = f !== null ? "1" : "0";
        val.textContent = f !== null ? "SA" + f : (on ? "1" : "0");
      } else {
        led.style.opacity = f !== null ? (f ? 1 : 0.1) : Math.max(0.2, DUTY[k] * 2.4).toFixed(2);
        el.dataset.forced = f !== null ? "1" : "0";
        val.textContent = f !== null ? "SA" + f : (DUTY[k] * 100).toFixed(1) + "%";
      }
    }
  }

  /* ---------- campaign replay ---------- */
  const CAMPAIGN = [
    { id: "HSYNC", row: 0 }, { id: "VSYNC", row: 1 }, { id: "HBLANK", row: 2 },
    { id: "VBLANK", row: 3 }, { id: "UP", row: 4 },
  ];
  let campaign = null;
  const rows = () => document.querySelectorAll("#results tbody tr");
  function runCampaign() {
    if (campaign) { stopCampaign("stopped"); return; }
    bus.clearAll(); game.scrub();
    game.auto = true;
    if (game.mode !== "play") game.begin();
    $("btn-campaign").textContent = "Stop campaign";
    $("btn-campaign").setAttribute("aria-pressed", "true");
    rows().forEach((r) => { r.classList.remove("run", "done"); r.querySelector(".obs").textContent = "pending"; });
    log("<b>CAMPAIGN</b> replaying the fault-injection campaign on autopilot (stuck-at-1, 4 s each)", "ok");
    campaign = { i: -1, t: 0, phase: "gap" };
  }
  function stopCampaign(why) {
    bus.clearAll(); game.scrub(); game.auto = false; campaign = null;
    $("btn-campaign").textContent = "Replay campaign";
    $("btn-campaign").setAttribute("aria-pressed", "false");
    rows().forEach((r) => r.classList.remove("run"));
    log(`<b>CAMPAIGN</b> ${why}`, "ok");
  }
  function stepCampaign(dt) {
    if (!campaign) return;
    campaign.t -= dt;
    if (campaign.t > 0) return;
    const rs = rows();
    if (campaign.phase === "run") {
      const s = CAMPAIGN[campaign.i];
      rs[s.row].classList.remove("run"); rs[s.row].classList.add("done");
      bus.clearAll(); campaign.phase = "gap"; campaign.t = 1.2;
      return;
    }
    campaign.i++;
    if (campaign.i >= CAMPAIGN.length) { stopCampaign("complete"); return; }
    const s = CAMPAIGN[campaign.i];
    rs[s.row].classList.add("run");
    rs[s.row].querySelector(".obs").textContent = describe(s.id, 1, protection);
    doInject(s.id, 1, false);
    campaign.phase = "run"; campaign.t = 4;
  }
  $("btn-campaign").addEventListener("click", () => { runCampaign(); focusStage(); });

  /* ---------- main loop ---------- */
  const DT = TB_TIMING.frameTime;       // 16.896 ms, measured from the RTL
  let acc = 0, last = performance.now();
  let hudT = 0;
  function loop(now) {
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.1) dt = 0.1;
    acc += dt;
    let steps = 0;
    while (acc >= DT && steps < 5) {
      acc -= DT; steps++; frame++;
      const inp = { up: keys.up, down: keys.down, left: keys.left, right: keys.right, fire: keys.fire, start: startPressed ? 1 : 0 };
      startPressed = false;
      bus.step();
      game.update(inp);
    }
    stepCampaign(dt);
    if (shake > 0.3) { stage.style.setProperty("--sx", ((Math.random() - 0.5) * shake).toFixed(1) + "px"); stage.style.setProperty("--sy", ((Math.random() - 0.5) * shake).toFixed(1) + "px"); shake *= 0.86; }
    else if (shake !== 0) { shake = 0; stage.style.setProperty("--sx", "0px"); stage.style.setProperty("--sy", "0px"); }
    game.draw(fctx);
    const prev = crt.last;
    crt.render(fb, frame, bus, protection);
    if (crt.last !== prev) updateStatus();
    updateSignals();
    const showOverlay = game.mode === "title" && !game.auto;
    $("overlay-play").hidden = !showOverlay;
    if (now - hudT > 250) { hudT = now; $("hud-score").textContent = String(game.score).padStart(6, "0"); $("hud-wave").textContent = game.wave; }
    requestAnimationFrame(loop);
  }

  function fit() {
    const w = screen.getBoundingClientRect().width;
    document.documentElement.style.setProperty("--px", (w / W).toFixed(3) + "px");
  }
  window.addEventListener("resize", fit);

  renderChips(); updateStatus(); fit();
  log("Lab ready. Timing model: 6 MHz pixel clock, 384 x 264 raster, 59.19 Hz (measured from the project RTL).");
  requestAnimationFrame(loop);

  /* handle for the oscilloscope demo */
  window.TBLab = { game, bus, crt, timing: TB_TIMING, getFrame: () => frame, isProtected: () => protection };
})();
