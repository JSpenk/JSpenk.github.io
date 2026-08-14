/* =========================================================
   qkd-demo.js
   Interactive illustration of the E91 quantum key distribution
   simulator's core idea.

   IMPORTANT — what this is and isn't:
   This is a from-scratch JavaScript reimplementation of the
   SAME correlation statistics used in the real Python/Qiskit
   simulator (prob(match) = 0.5*cos^2(angle-difference), the
   standard quantum correlation for entangled-pair measurement,
   taken directly from the real project's simulation code) —
   it is NOT Qiskit or a real quantum circuit running in the
   browser. The eavesdropper model (25% bit-flip chance on
   intercepted pairs) is also taken directly from the real
   project's Eve model. Everything else here — how pairs are
   split into "key" vs "security-check" rounds, the exact
   angle sets used, and the visualization — is a simplified,
   clearly-labeled teaching version built for this page, not
   a port of the full 60+ parameter simulator.

   The core idea being illustrated: Alice and Bob build a
   shared secret key from entangled-photon measurements, and
   any eavesdropper is detectable because listening in
   physically disturbs the quantum correlation — visible here
   as rising QBER and a falling CHSH value.
   ========================================================= */

(function () {
  // Alice/Bob measurement angles (degrees). Matching angles (0,0) are
  // reserved for key generation; the other four combinations are the
  // standard angle set that produces the maximum CHSH violation (2*sqrt(2))
  // for an ideal entangled pair.
  const ALICE_KEY_ANGLE = 0;
  const ALICE_CHSH_ANGLES = [0, 45];
  const BOB_CHSH_ANGLES = [22.5, 67.5];
  const KEY_ROUND_PROB = 0.35;

  let qCanvas, qCtx;
  let eveProb = 0;
  let particles = []; // transient animation dots
  let qFrame = 0;

  const stats = {
    pairs: 0,
    keyBitsTotal: 0,
    keyMismatches: 0,
    // running correlator sums, keyed "A_B" using angle values
    chsh: {},
  };

  function chshKey(a, b) {
    return `${a}_${b}`;
  }

  function resetStats() {
    stats.pairs = 0;
    stats.keyBitsTotal = 0;
    stats.keyMismatches = 0;
    stats.chsh = {};
    ALICE_CHSH_ANGLES.forEach((a) => {
      BOB_CHSH_ANGLES.forEach((b) => {
        stats.chsh[chshKey(a, b)] = { sum: 0, n: 0 };
      });
    });
    particles = [];
    updateStatsUI();
  }

  function correlator(angleA, angleB) {
    const deltaRad = ((angleA - angleB) * Math.PI) / 180;
    return Math.cos(2 * deltaRad); // matches the real simulator's cos^2/sin^2 formula
  }

  function simulatePair() {
    const isKeyRound = Math.random() < KEY_ROUND_PROB;
    let angleA, angleB, purpose;
    if (isKeyRound) {
      angleA = ALICE_KEY_ANGLE;
      angleB = 0;
      purpose = "key";
    } else {
      angleA = ALICE_CHSH_ANGLES[Math.random() < 0.5 ? 0 : 1];
      angleB = BOB_CHSH_ANGLES[Math.random() < 0.5 ? 0 : 1];
      purpose = "chsh";
    }

    const deltaRad = ((angleA - angleB) * Math.PI) / 180;
    const p00 = 0.5 * Math.cos(deltaRad) ** 2;
    const p01 = 0.5 * Math.sin(deltaRad) ** 2;
    const p10 = p01;
    // p11 = p00 (remainder)

    let outcomeA, outcomeB;
    const r = Math.random();
    if (r < p00) {
      outcomeA = 0; outcomeB = 0;
    } else if (r < p00 + p01) {
      outcomeA = 0; outcomeB = 1;
    } else if (r < p00 + p01 + p10) {
      outcomeA = 1; outcomeB = 0;
    } else {
      outcomeA = 1; outcomeB = 1;
    }

    // Eavesdropper: intercept-resend model taken from the real project —
    // Bob's bit is flipped with probability 0.25 on intercepted pairs.
    let intercepted = false;
    if (Math.random() < eveProb) {
      intercepted = true;
      if (Math.random() < 0.25) outcomeB = 1 - outcomeB;
    }

    return { angleA, angleB, outcomeA, outcomeB, purpose, intercepted };
  }

  function recordPair(pair) {
    stats.pairs++;
    if (pair.purpose === "key") {
      stats.keyBitsTotal++;
      if (pair.outcomeA !== pair.outcomeB) stats.keyMismatches++;
    } else {
      const k = chshKey(pair.angleA, pair.angleB);
      const entry = stats.chsh[k];
      if (entry) {
        const aPm = 2 * pair.outcomeA - 1;
        const bPm = 2 * pair.outcomeB - 1;
        entry.sum += aPm * bPm;
        entry.n += 1;
      }
    }
  }

  function computeS() {
    const e = (a, b) => {
      const entry = stats.chsh[chshKey(a, b)];
      return entry && entry.n > 0 ? entry.sum / entry.n : 0;
    };
    const [a0, a1] = ALICE_CHSH_ANGLES;
    const [b0, b1] = BOB_CHSH_ANGLES;
    return Math.abs(e(a0, b0) - e(a0, b1) + e(a1, b0) + e(a1, b1));
  }

  function sendPairs(n, animate) {
    for (let i = 0; i < n; i++) {
      const pair = simulatePair();
      recordPair(pair);
      if (animate) spawnParticle(pair);
    }
    updateStatsUI();
  }

  function spawnParticle(pair) {
    particles.push({
      t: 0,
      purpose: pair.purpose,
      intercepted: pair.intercepted,
    });
    if (particles.length > 24) particles.shift();
  }

  function updateStatsUI() {
    const qber = stats.keyBitsTotal > 0 ? (stats.keyMismatches / stats.keyBitsTotal) * 100 : 0;
    const s = computeS();

    setText("qkd-pairs", stats.pairs);
    setText("qkd-keybits", stats.keyBitsTotal);
    setText("qkd-qber", qber.toFixed(1) + "%");
    setText("qkd-chsh", s.toFixed(3));

    const fill = document.getElementById("qkd-gauge-fill");
    const marker = document.getElementById("qkd-gauge-marker");
    const verdict = document.getElementById("qkd-verdict");
    if (fill) fill.style.width = Math.min(100, (s / 2.83) * 100) + "%";
    if (marker) marker.style.left = Math.min(100, (s / 2.83) * 100) + "%";

    const enoughData = stats.keyBitsTotal >= 15 && Object.values(stats.chsh).every((e) => e.n >= 10);
    if (verdict) {
      if (!enoughData) {
        verdict.textContent = "Collecting data — send more pairs for a confident read.";
        verdict.className = "qkd-verdict";
      } else if (s > 2.0 && qber < 11) {
        verdict.textContent = `SECURE — CHSH (${s.toFixed(3)}) violates the classical bound and QBER (${qber.toFixed(1)}%) is below the 11% threshold. No eavesdropping detected.`;
        verdict.className = "qkd-verdict qkd-secure";
      } else {
        verdict.textContent = `INSECURE — CHSH has dropped to ${s.toFixed(3)} and/or QBER has risen to ${qber.toFixed(1)}%. Consistent with an eavesdropper on the channel — discard this key.`;
        verdict.className = "qkd-verdict qkd-insecure";
      }
    }
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  /* ---------- Canvas visualization ---------- */
  function drawQkd() {
    if (!qCtx) return;
    const w = qCanvas.width, h = qCanvas.height;
    qCtx.fillStyle = "#05070a";
    qCtx.fillRect(0, 0, w, h);

    const aliceX = 70, bobX = w - 70, midY = h / 2;

    // nodes
    drawNode(aliceX, midY, "ALICE", "#5b8bf0");
    drawNode(bobX, midY, "BOB", "#5b8bf0");
    drawNode(w / 2, midY, "SOURCE", "#b5652f", true);

    // static link lines
    qCtx.strokeStyle = "#1c2333";
    qCtx.lineWidth = 1;
    qCtx.beginPath();
    qCtx.moveTo(aliceX + 24, midY);
    qCtx.lineTo(w / 2 - 20, midY);
    qCtx.moveTo(w / 2 + 20, midY);
    qCtx.lineTo(bobX - 24, midY);
    qCtx.stroke();

    // animated particles
    particles.forEach((p) => {
      p.t += 0.045;
      const prog = Math.min(1, p.t);
      const leftX = w / 2 - (w / 2 - aliceX - 24) * prog;
      const rightX = w / 2 + (bobX - w / 2 - 24) * prog;
      const color = p.intercepted ? "#e0463c" : p.purpose === "key" ? "#3fbf8f" : "#7fa3f5";
      qCtx.fillStyle = color;
      qCtx.beginPath();
      qCtx.arc(leftX, midY, 4, 0, Math.PI * 2);
      qCtx.fill();
      qCtx.beginPath();
      qCtx.arc(rightX, midY, 4, 0, Math.PI * 2);
      qCtx.fill();

      if (p.intercepted && prog > 0.4 && prog < 0.9) {
        qCtx.fillStyle = "#e0463c";
        qCtx.font = "9px monospace";
        qCtx.fillText("EVE", w / 2 + (bobX - w / 2) * 0.5 - 10, midY - 26);
      }
    });
    particles = particles.filter((p) => p.t < 1);

    qCtx.fillStyle = "#6b7386";
    qCtx.font = "9px monospace";
    qCtx.fillText("green = key bit   blue = CHSH check   red = intercepted by Eve", 12, h - 12);
  }

  function drawNode(x, y, label, color, diamond) {
    qCtx.fillStyle = color;
    if (diamond) {
      qCtx.save();
      qCtx.translate(x, y);
      qCtx.rotate(Math.PI / 4);
      qCtx.fillRect(-10, -10, 20, 20);
      qCtx.restore();
    } else {
      qCtx.beginPath();
      qCtx.arc(x, y, 16, 0, Math.PI * 2);
      qCtx.fill();
    }
    qCtx.fillStyle = "#e7eaf0";
    qCtx.font = "bold 9px monospace";
    qCtx.textAlign = "center";
    qCtx.fillText(label, x, y + 32);
    qCtx.textAlign = "left";
  }

  function tick() {
    qFrame++;
    drawQkd();
    requestAnimationFrame(tick);
  }

  function initQkdDemo() {
    qCanvas = document.getElementById("qkd-canvas");
    if (!qCanvas) return;
    qCtx = qCanvas.getContext("2d");

    resetStats();

    const slider = document.getElementById("qkd-eve-slider");
    if (slider) {
      slider.addEventListener("input", () => {
        eveProb = Number(slider.value) / 100;
        setText("qkd-eve-value", slider.value);
      });
    }

    const send1 = document.getElementById("qkd-send-1");
    if (send1) send1.addEventListener("click", () => sendPairs(1, true));

    const send100 = document.getElementById("qkd-send-100");
    if (send100) send100.addEventListener("click", () => {
      sendPairs(200, false);
      for (let i = 0; i < 8; i++) spawnParticle(simulatePair());
    });

    const resetBtn = document.getElementById("qkd-reset");
    if (resetBtn) resetBtn.addEventListener("click", resetStats);

    requestAnimationFrame(tick);
  }

  document.addEventListener("DOMContentLoaded", initQkdDemo);
})();
