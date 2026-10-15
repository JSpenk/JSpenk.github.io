/* =========================================================
   tank-game.js
   An ORIGINAL top-down tank game (own art, own code) used as
   the "device under test" for the fault-injection lab.
   Portrait 224x256 framebuffer, like the real cabinet's
   rotated monitor. Logic steps at the RTL frame rate.
   ========================================================= */
(function (global) {
  "use strict";

  const W = 224, H = 256, CELL = 8, COLS = 28, ROWS = 32, HUD = 16, TS = 16;
  const T = { EMPTY: 0, BRICK: 1, STEEL: 2, FOREST: 3 };
  const DIR = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] };
  const ANGLE = { up: 0, right: Math.PI / 2, down: Math.PI, left: Math.PI * 1.5 };
  const NAMES = ["up", "right", "down", "left"];
  const BASE = { x: 104, y: 240, w: 16, h: 16 };

  /* 14 x 15 blocks of 16 px: . empty  B brick  S steel  F forest */
  const LEVELS = [
    ["..............", ".BB.BB..BB.BB.", ".BB.BB..BB.BB.", ".BB.BBSSBB.BB.", ".BB........BB.",
     "..S..BBBB..S..", "B....B..B....B", "BB.F.B..B.F.BB", "BB.F......F.BB", "..BB..SS..BB..",
     ".BBB..BB..BBB.", ".BB........BB.", "..S.BB..BB.S..", "....BB..BB....", "....B....B...."],
    ["..............", ".SS.BB..BB.SS.", ".SS.BB..BB.SS.", "....BB..BB....", "BB..........BB",
     "BB.F..SS..F.BB", "....B.BB.B....", ".BB.B....B.BB.", ".BB...FF...BB.", "....BB..BB....",
     "S...BB..BB...S", "....B....B....", ".BB........BB.", "....B....B....", "....B....B...."],
    ["..............", "B.B.B.BB.B.B.B", "B.B.B.BB.B.B.B", "..............", ".SS..BBBB..SS.",
     "..B........B..", "BBB.FF..FF.BBB", "....F....F....", ".B.BB....BB.B.", ".B.BB.SS.BB.B.",
     "..............", "BB..B....B..BB", "BB..........BB", ".S..BB..BB..S.", "....B....B...."],
  ];

  /* tiny 3x5 bitmap font (5 rows of 3 cells each) */
  const FONT_ROWS = {
    "A": "###|#.#|###|#.#|#.#",
    "B": "##.|#.#|##.|#.#|##.",
    "C": ".##|#..|#..|#..|.##",
    "D": "##.|#.#|#.#|#.#|##.",
    "E": "###|#..|##.|#..|###",
    "F": "###|#..|##.|#..|#..",
    "G": ".##|#..|#.#|#.#|.##",
    "H": "#.#|#.#|###|#.#|#.#",
    "I": "###|.#.|.#.|.#.|###",
    "J": "..#|..#|..#|#.#|.#.",
    "K": "#.#|#.#|##.|#.#|#.#",
    "L": "#..|#..|#..|#..|###",
    "M": "#.#|###|###|#.#|#.#",
    "N": "##.|#.#|#.#|#.#|#.#",
    "O": ".#.|#.#|#.#|#.#|.#.",
    "P": "##.|#.#|##.|#..|#..",
    "Q": ".#.|#.#|#.#|###|.##",
    "R": "##.|#.#|##.|#.#|#.#",
    "S": ".##|#..|.#.|..#|##.",
    "T": "###|.#.|.#.|.#.|.#.",
    "U": "#.#|#.#|#.#|#.#|###",
    "V": "#.#|#.#|#.#|#.#|.#.",
    "W": "#.#|#.#|###|###|#.#",
    "X": "#.#|#.#|.#.|#.#|#.#",
    "Y": "#.#|#.#|.#.|.#.|.#.",
    "Z": "###|..#|.#.|#..|###",
    "0": "###|#.#|#.#|#.#|###",
    "1": ".#.|##.|.#.|.#.|###",
    "2": "##.|..#|.#.|#..|###",
    "3": "##.|..#|.#.|..#|##.",
    "4": "#.#|#.#|###|..#|..#",
    "5": "###|#..|##.|..#|##.",
    "6": ".##|#..|###|#.#|###",
    "7": "###|..#|.#.|.#.|.#.",
    "8": "###|#.#|###|#.#|###",
    "9": "###|#.#|###|..#|##.",
    " ": "...|...|...|...|...",
    "-": "...|...|###|...|...",
    ".": "...|...|...|...|.#.",
    ":": "...|.#.|...|.#.|...",
    "!": ".#.|.#.|.#.|...|.#.",
  };
  const FONT = {};
  for (const k in FONT_ROWS) FONT[k] = FONT_ROWS[k].split("|").join("");

  function text(ctx, str, x, y, scale, color) {
    ctx.fillStyle = color;
    str = String(str).toUpperCase();
    for (let i = 0; i < str.length; i++) {
      const g = FONT[str[i]] || FONT[" "];
      for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++)
        if (g[r * 3 + c] === "#") ctx.fillRect(x + (i * 4 + c) * scale, y + r * scale, scale, scale);
    }
    return str.length * 4 * scale;
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const PAL = {
    player: { hull: "#4f8cff", dark: "#1c3f91", turret: "#cfe0ff", tread: "#0d1a3d" },
    basic:  { hull: "#ff9a3c", dark: "#9a4f10", turret: "#ffe0b8", tread: "#3a1e06" },
    fast:   { hull: "#ff5d73", dark: "#8f1d31", turret: "#ffd0d8", tread: "#3a0a14" },
    armor3: { hull: "#b78cff", dark: "#5a2fa0", turret: "#e6d6ff", tread: "#1f0f3d" },
    armor2: { hull: "#ffd24a", dark: "#8a6a08", turret: "#fff0b3", tread: "#3a2c02" },
    armor1: { hull: "#ff9a3c", dark: "#9a4f10", turret: "#ffe0b8", tread: "#3a1e06" },
  };

  class Game {
    constructor() {
      this.rng = mulberry32(20260214);
      this.sfx = () => {};
      this.inputFilter = (i) => i;
      this.auto = false;
      this.frame = 0;
      this.mode = "title";
      this.flips = new Map();
      this.hiscore = 0;
      this.reset();
    }

    reset() {
      this.score = 0; this.lives = 3; this.wave = 1;
      this.startWave();
    }

    begin() {
      this.reset();
      this.mode = "play";
    }

    startWave() {
      const lv = LEVELS[(this.wave - 1) % LEVELS.length];
      this.cells = new Uint8Array(COLS * ROWS);
      this.flips.clear();
      for (let by = 0; by < 15; by++) for (let bx = 0; bx < 14; bx++) {
        const ch = (lv[by] || "")[bx] || ".";
        const v = ch === "B" ? T.BRICK : ch === "S" ? T.STEEL : ch === "F" ? T.FOREST : T.EMPTY;
        for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++)
          this.cells[(2 + by * 2 + dy) * COLS + bx * 2 + dx] = v;
      }
      // base shell
      for (let y = 28; y < 32; y++) for (let x = 11; x < 17; x++) this.cells[y * COLS + x] = T.EMPTY;
      for (let y = 28; y < 30; y++) for (let x = 12; x < 16; x++) this.cells[y * COLS + x] = T.BRICK;
      for (let y = 30; y < 32; y++) { this.cells[y * COLS + 12] = T.BRICK; this.cells[y * COLS + 15] = T.BRICK; }
      this.clearSpawn();
      this.baseAlive = true;
      this.bullets = []; this.enemies = []; this.fx = [];
      this.toSpawn = Math.min(4 + this.wave * 2, 16);
      this.spawnT = 40; this.spawnIdx = 0;
      this.player = { x: 72, y: 240, dir: "up", cool: 0, alive: true, inv: 120, tread: 0, respawn: 0, hp: 1 };
      this.clearT = 0; this.overT = 0; this.readyT = 80;
    }

    /* keep the player's start area free of walls (cols 8-11, rows 28-31) */
    clearSpawn() {
      for (let y = 28; y < 32; y++) for (let x = 8; x < 12; x++) { this.cells[y * COLS + x] = T.EMPTY; this.flips.delete(y * COLS + x); }
    }

    /* ---------- collision ---------- */
    blocked(x, y, self) {
      if (x < 0 || y < HUD || x + TS > W || y + TS > H) return true;
      const x0 = Math.floor(x / CELL), x1 = Math.floor((x + TS - 1) / CELL);
      const y0 = Math.floor(y / CELL), y1 = Math.floor((y + TS - 1) / CELL);
      for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
        const t = this.cells[cy * COLS + cx];
        if (t === T.BRICK || t === T.STEEL) return true;
      }
      if (this.baseAlive && x < BASE.x + BASE.w && x + TS > BASE.x && y < BASE.y + BASE.h && y + TS > BASE.y) return true;
      const others = [this.player, ...this.enemies];
      for (const o of others) {
        if (o === self || !o.alive || o.dying) continue;
        if (Math.abs(o.x - x) < TS && Math.abs(o.y - y) < TS) return true;
      }
      return false;
    }

    moveTank(t, dir, speed) {
      const [dx, dy] = DIR[dir];
      if (t.dir !== dir) {
        t.dir = dir;
        if (dx !== 0) { const sy = Math.round(t.y / CELL) * CELL; if (!this.blocked(t.x, sy, t)) t.y = sy; }
        else { const sx = Math.round(t.x / CELL) * CELL; if (!this.blocked(sx, t.y, t)) t.x = sx; }
      }
      const nx = t.x + dx * speed, ny = t.y + dy * speed;
      if (!this.blocked(nx, ny, t)) { t.x = nx; t.y = ny; t.tread += speed; return true; }
      return false;
    }

    fire(t, owner) {
      const [dx, dy] = DIR[t.dir];
      this.bullets.push({ x: Math.round(t.x + 8 + dx * 9), y: Math.round(t.y + 8 + dy * 9), dir: t.dir, owner, dead: false, speed: owner === "p" ? 4 : 3 });
      this.sfx("fire");
    }

    /* ---------- AI ---------- */
    pickDir(e) {
      const p = this.player;
      const w = { up: 0.6, down: 3, left: 1, right: 1 };
      if (this.baseAlive) { w[BASE.x + 8 < e.x + 8 ? "left" : "right"] += 1.4; }
      if (p.alive) { const ddx = p.x - e.x, ddy = p.y - e.y; if (Math.abs(ddx) > Math.abs(ddy)) w[ddx < 0 ? "left" : "right"] += 1.2; else w[ddy < 0 ? "up" : "down"] += 1.2; }
      let tot = 0; for (const k of NAMES) tot += w[k];
      let r = this.rng() * tot;
      for (const k of NAMES) { r -= w[k]; if (r <= 0) return k; }
      return "down";
    }

    aligned(t, tx, ty) {
      const [dx, dy] = DIR[t.dir];
      const cx = t.x + 8, cy = t.y + 8;
      if (dx !== 0) return Math.abs(cy - ty) < 10 && (tx - cx) * dx > 0;
      return Math.abs(cx - tx) < 10 && (ty - cy) * dy > 0;
    }

    autopilot() {
      const p = this.player, inp = { up: 0, down: 0, left: 0, right: 0, fire: 0, start: 0 };
      let tgt = null, best = 1e9;
      for (const e of this.enemies) { const d = Math.abs(e.x - p.x) + Math.abs(e.y - p.y); if (d < best) { best = d; tgt = e; } }
      if (this._apT === undefined || --this._apT <= 0) {
        this._apT = 14 + Math.floor(this.rng() * 18);
        if (tgt && this.rng() < 0.7) {
          const ddx = tgt.x - p.x, ddy = tgt.y - p.y;
          this._apDir = Math.abs(ddy) > Math.abs(ddx) ? (ddy < 0 ? "up" : "down") : (ddx < 0 ? "left" : "right");
          if (Math.abs(ddx) < 12) this._apDir = ddy < 0 ? "up" : "down";
          if (Math.abs(ddy) < 12) this._apDir = ddx < 0 ? "left" : "right";
        } else this._apDir = NAMES[Math.floor(this.rng() * 4)];
      }
      inp[this._apDir] = 1;
      if (tgt && this.aligned(p, tgt.x + 8, tgt.y + 8)) inp.fire = 1;
      else if (this.rng() < 0.04) inp.fire = 1;
      return inp;
    }

    /* ---------- update ---------- */
    update(rawInput) {
      this.frame++;
      let inp = this.auto && this.mode === "play" ? this.autopilot() : Object.assign({ up: 0, down: 0, left: 0, right: 0, fire: 0, start: 0 }, rawInput);
      inp = this.inputFilter(inp);
      this.lastInput = inp;

      if (this.mode === "title") { if (inp.start || (this.auto && this.frame > 5)) this.begin(); this.stepFx(); return; }
      if (this.mode === "over") { this.overT++; this.stepFx(); if (inp.start && this.overT > 60) this.begin(); return; }
      if (this.mode === "clear") {
        this.stepFx();
        if (--this.clearT <= 0) { this.wave++; this.startWave(); this.mode = "play"; }
        return;
      }

      if (this.readyT > 0) this.readyT--;
      const p = this.player;
      if (!p.alive) {
        if (--p.respawn <= 0) {
          if (this.lives < 0) { this.gameOver(); }
          else { this.clearSpawn(); p.alive = true; p.x = 72; p.y = 240; p.dir = "up"; p.inv = 120; p.dying = false; }
        }
      } else {
        if (p.inv > 0) p.inv--;
        if (p.cool > 0) p.cool--;
        let dir = null;
        for (const d of ["up", "down", "left", "right"]) if (inp[d]) { dir = d; }
        // prefer the most recently changed axis: keep current dir if still held
        if (inp[p.dir]) dir = p.dir;
        if (dir) this.moveTank(p, dir, 1.25);
        if (inp.fire && p.cool <= 0 && !this.bullets.some((b) => b.owner === "p" && !b.dead)) { this.fire(p, "p"); p.cool = 14; }
      }

      // spawn
      if (this.toSpawn > 0 && this.enemies.filter((e) => e.alive).length < 3 && --this.spawnT <= 0) {
        const xs = [0, 104, 208], x = xs[this.spawnIdx % 3];
        if (!this.blocked(x, HUD, null)) {
          const i = this.spawnIdx++, wave = this.wave;
          const type = wave >= 2 && i % 5 === 4 ? "armor" : i % 4 === 3 ? "fast" : "basic";
          this.enemies.push({ x, y: HUD, dir: "down", type, hp: type === "armor" ? 3 : 1, alive: true, cool: 40 + Math.floor(this.rng() * 40), turnT: 30, tread: 0, spawn: 30, speed: type === "fast" ? 1.0 : 0.7 });
          this.toSpawn--; this.spawnT = 90;
        } else this.spawnT = 10;
      }

      // enemies
      for (const e of this.enemies) {
        if (!e.alive) continue;
        if (e.spawn > 0) { e.spawn--; continue; }
        e.cool--; e.turnT--;
        const moved = this.moveTank(e, e.dir, e.speed);
        if (!moved || e.turnT <= 0) { e.dir = this.pickDir(e); e.turnT = 40 + Math.floor(this.rng() * 80); }
        const hasBullet = this.bullets.some((b) => b.owner === "e" && b.src === e && !b.dead);
        if (e.cool <= 0 && !hasBullet) {
          const atBase = this.baseAlive && this.aligned(e, BASE.x + 8, BASE.y + 8);
          const atPlayer = p.alive && this.aligned(e, p.x + 8, p.y + 8);
          if (atBase || atPlayer || this.rng() < 0.02) {
            this.fire(e, "e"); this.bullets[this.bullets.length - 1].src = e;
            e.cool = 45 + Math.floor(this.rng() * 70);
          }
        }
      }

      // bullets
      for (const b of this.bullets) this.stepBullet(b);
      for (let i = 0; i < this.bullets.length; i++) for (let j = i + 1; j < this.bullets.length; j++) {
        const a = this.bullets[i], c = this.bullets[j];
        if (!a.dead && !c.dead && a.owner !== c.owner && Math.abs(a.x - c.x) < 4 && Math.abs(a.y - c.y) < 4) { a.dead = c.dead = true; this.spark(a.x, a.y); }
      }
      this.bullets = this.bullets.filter((b) => !b.dead);
      this.enemies = this.enemies.filter((e) => e.alive);
      this.stepFx();

      if (this.toSpawn === 0 && this.enemies.length === 0 && this.mode === "play") {
        this.mode = "clear"; this.clearT = 150; this.sfx("clear");
      }
    }

    stepBullet(b) {
      const [dx, dy] = DIR[b.dir];
      for (let i = 0; i < b.speed && !b.dead; i++) {
        b.x += dx; b.y += dy;
        if (b.x < 0 || b.x >= W || b.y < HUD || b.y >= H) { b.dead = true; this.spark(Math.max(0, Math.min(W - 1, b.x)), Math.max(HUD, Math.min(H - 1, b.y))); return; }
        const cx = b.x >> 3, cy = b.y >> 3, idx = cy * COLS + cx, t = this.cells[idx];
        if (t === T.BRICK) {
          this.breakCell(idx);
          const partner = dx !== 0 ? (cy ^ 1) * COLS + cx : cy * COLS + (cx ^ 1);
          if (this.cells[partner] === T.BRICK) this.breakCell(partner);
          b.dead = true; this.spark(b.x, b.y); this.sfx("brick"); return;
        }
        if (t === T.STEEL) { b.dead = true; this.spark(b.x, b.y); this.sfx("steel"); return; }
        if (this.baseAlive && b.x >= BASE.x && b.x < BASE.x + BASE.w && b.y >= BASE.y && b.y < BASE.y + BASE.h) {
          this.baseAlive = false; b.dead = true; this.boom(BASE.x + 8, BASE.y + 8, true); this.sfx("boom");
          this.gameOver(); return;
        }
        if (b.owner === "p") {
          for (const e of this.enemies) if (e.alive && b.x >= e.x && b.x < e.x + TS && b.y >= e.y && b.y < e.y + TS) {
            b.dead = true; e.hp--;
            if (e.hp <= 0) { e.alive = false; this.score += e.type === "armor" ? 300 : e.type === "fast" ? 200 : 100; this.boom(e.x + 8, e.y + 8, false); this.sfx("boom"); }
            else { this.spark(b.x, b.y); this.sfx("steel"); }
            return;
          }
        } else {
          const p = this.player;
          if (p.alive && p.inv <= 0 && b.x >= p.x && b.x < p.x + TS && b.y >= p.y && b.y < p.y + TS) {
            b.dead = true; this.killPlayer(); return;
          }
        }
      }
    }

    killPlayer() {
      const p = this.player;
      p.alive = false; p.respawn = 90; this.lives--;
      this.boom(p.x + 8, p.y + 8, false); this.sfx("boom");
    }

    gameOver() {
      if (this.mode === "over") return;
      this.mode = "over"; this.overT = 0;
      this.hiscore = Math.max(this.hiscore, this.score);
    }

    breakCell(idx) {
      if (this.cells[idx] === T.BRICK) { this.cells[idx] = T.EMPTY; this.flips.delete(idx); }
    }

    spark(x, y) { this.fx.push({ x, y, age: 0, max: 8, big: false }); }
    boom(x, y, big) { this.fx.push({ x, y, age: 0, max: big ? 34 : 20, big }); }
    stepFx() { for (const f of this.fx) f.age++; this.fx = this.fx.filter((f) => f.age < f.max); }

    /* ---------- single-event upset in tile RAM ---------- */
    flipRandomCell() {
      const rand = Math.random;
      for (let tries = 0; tries < 40; tries++) {
        const idx = (2 + Math.floor(rand() * 30)) * COLS + Math.floor(rand() * COLS);
        const bx = idx % COLS, by = (idx / COLS) | 0;
        if (by >= 28 && bx >= 11 && bx <= 16) continue; // keep the base area readable
        const bit = Math.floor(rand() * 2);
        const before = this.cells[idx], after = before ^ (1 << bit);
        if (!this.flips.has(idx)) this.flips.set(idx, before);
        this.cells[idx] = after;
        return { idx, bit, before, after, addr: 0x400 + idx };
      }
      return null;
    }
    scrub() {
      let n = 0;
      for (const [idx, v] of this.flips) { this.cells[idx] = v; n++; }
      this.flips.clear();
      return n;
    }

    /* ---------- drawing ---------- */
    draw(ctx) {
      ctx.fillStyle = "#04070c"; ctx.fillRect(0, 0, W, H);
      // PCB via grid
      ctx.fillStyle = "#0b1420";
      for (let y = HUD + 8; y < H; y += 16) for (let x = 8; x < W; x += 16) ctx.fillRect(x, y, 1, 1);
      this.drawCells(ctx, false);
      this.drawBase(ctx);
      for (const e of this.enemies) if (e.alive) this.drawEnemy(ctx, e);
      const p = this.player;
      if (p.alive && !(p.inv > 0 && (this.frame >> 2) & 1)) this.drawTank(ctx, p.x, p.y, p.dir, PAL.player, p.tread);
      for (const b of this.bullets) { ctx.fillStyle = b.owner === "p" ? "#e8f1ff" : "#ffd27a"; ctx.fillRect(b.x - 1, b.y - 1, 3, 3); }
      this.drawCells(ctx, true);
      for (const f of this.fx) this.drawFx(ctx, f);
      this.drawHud(ctx);
      if (this.mode === "title") this.drawTitle(ctx);
      else if (this.mode === "clear") this.banner(ctx, "WAVE CLEAR", "#7dffb0");
      else if (this.mode === "play" && this.readyT > 0) this.banner(ctx, "WAVE " + this.wave, "#ffb86b");
      else if (this.mode === "over") this.drawOver(ctx);
    }

    drawCells(ctx, forestPass) {
      for (let cy = 2; cy < ROWS; cy++) for (let cx = 0; cx < COLS; cx++) {
        const t = this.cells[cy * COLS + cx];
        if (!t) continue;
        const x = cx * CELL, y = cy * CELL;
        if (forestPass) {
          if (t === T.FOREST) {
            ctx.fillStyle = "rgba(24,120,70,0.78)"; ctx.fillRect(x, y, 8, 8);
            ctx.fillStyle = "#3fbf8f"; ctx.fillRect(x + 1, y + 1, 2, 2); ctx.fillRect(x + 5, y + 4, 2, 2); ctx.fillRect(x + 2, y + 6, 1, 1);
          }
          continue;
        }
        if (t === T.BRICK) {
          ctx.fillStyle = "#8c4a22"; ctx.fillRect(x, y, 8, 8);
          ctx.fillStyle = "#c9773a"; ctx.fillRect(x, y, 8, 1); ctx.fillRect(x, y + 4, 8, 1);
          ctx.fillStyle = "#5b2d12"; ctx.fillRect(x, y + 3, 8, 1); ctx.fillRect(x, y + 7, 8, 1);
          ctx.fillRect(x + ((cy & 1) ? 3 : 6), y, 1, 4); ctx.fillRect(x + ((cy & 1) ? 6 : 2), y + 4, 1, 4);
        } else if (t === T.STEEL) {
          ctx.fillStyle = "#6f7d93"; ctx.fillRect(x, y, 8, 8);
          ctx.fillStyle = "#b5c2d6"; ctx.fillRect(x, y, 8, 1); ctx.fillRect(x, y, 1, 8);
          ctx.fillStyle = "#39465a"; ctx.fillRect(x, y + 7, 8, 1); ctx.fillRect(x + 7, y, 1, 8);
          ctx.fillStyle = "#dfe8f5"; ctx.fillRect(x + 3, y + 3, 2, 2);
        }
      }
    }

    drawBase(ctx) {
      const { x, y } = BASE;
      if (this.baseAlive) {
        ctx.fillStyle = "#c9a54a"; // gold pins
        for (let i = 0; i < 4; i++) { ctx.fillRect(x + 2 + i * 4, y, 2, 2); ctx.fillRect(x + 2 + i * 4, y + 14, 2, 2); ctx.fillRect(x, y + 2 + i * 4, 2, 2); ctx.fillRect(x + 14, y + 2 + i * 4, 2, 2); }
        ctx.fillStyle = "#1a2433"; ctx.fillRect(x + 2, y + 2, 12, 12);
        ctx.fillStyle = "#2f4566"; ctx.fillRect(x + 2, y + 2, 12, 1); ctx.fillRect(x + 2, y + 2, 1, 12);
        ctx.fillStyle = "#5b8bf0"; ctx.fillRect(x + 6, y + 6, 4, 4);
        ctx.fillStyle = "#cfe0ff"; ctx.fillRect(x + 7, y + 7, 2, 2);
        ctx.fillStyle = "#e7eaf0"; ctx.fillRect(x + 3, y + 3, 2, 2);
      } else {
        ctx.fillStyle = "#1a1a1a"; ctx.fillRect(x + 1, y + 6, 14, 9);
        ctx.fillStyle = "#442"; ctx.fillRect(x + 4, y + 3, 3, 4); ctx.fillRect(x + 9, y + 5, 4, 3);
      }
    }

    drawEnemy(ctx, e) {
      if (e.spawn > 0) { // spawn shimmer
        const s = (e.spawn >> 2) & 1;
        ctx.strokeStyle = s ? "#8fb4ff" : "#2f4566"; ctx.lineWidth = 1;
        ctx.strokeRect(e.x + 2.5, e.y + 2.5, 11, 11); ctx.strokeRect(e.x + 5.5, e.y + 5.5, 5, 5);
        return;
      }
      const pal = e.type === "fast" ? PAL.fast : e.type === "armor" ? (e.hp >= 3 ? PAL.armor3 : e.hp === 2 ? PAL.armor2 : PAL.armor1) : PAL.basic;
      this.drawTank(ctx, e.x, e.y, e.dir, pal, e.tread);
    }

    drawTank(ctx, x, y, dir, pal, tread) {
      ctx.save();
      ctx.translate(Math.round(x) + 8, Math.round(y) + 8);
      ctx.rotate(ANGLE[dir]);
      // treads
      ctx.fillStyle = pal.tread; ctx.fillRect(-8, -8, 4, 16); ctx.fillRect(4, -8, 4, 16);
      ctx.fillStyle = pal.dark;
      const ph = Math.floor(tread) % 4;
      for (let i = -8 + ph; i < 8; i += 4) { ctx.fillRect(-8, i, 4, 1); ctx.fillRect(4, i, 4, 1); }
      // hull
      ctx.fillStyle = pal.dark; ctx.fillRect(-5, -6, 10, 13);
      ctx.fillStyle = pal.hull; ctx.fillRect(-4, -5, 8, 11);
      // turret + barrel
      ctx.fillStyle = pal.turret; ctx.fillRect(-2, -3, 4, 5);
      ctx.fillStyle = pal.dark; ctx.fillRect(-1, -9, 2, 7);
      ctx.fillStyle = pal.turret; ctx.fillRect(-1, -9, 2, 1);
      ctx.restore();
    }

    drawFx(ctx, f) {
      const k = f.age / f.max;
      const r = Math.floor((f.big ? 18 : 9) * Math.sin(Math.min(1, k * 1.2) * Math.PI * 0.5) + 1);
      ctx.fillStyle = k < 0.5 ? "#ffe9a8" : "#ff8a3c";
      ctx.fillRect(f.x - r, f.y - 1, r * 2, 3); ctx.fillRect(f.x - 1, f.y - r, 3, r * 2);
      ctx.fillStyle = k < 0.7 ? "#ff5d3c" : "#7a2418";
      const q = Math.max(1, r - 3);
      ctx.fillRect(f.x - q, f.y - q, q * 2, q * 2);
      ctx.fillStyle = "#fff6d6"; ctx.fillRect(f.x - 1, f.y - 1, 3, 3);
    }

    drawHud(ctx) {
      ctx.fillStyle = "#070c14"; ctx.fillRect(0, 0, W, HUD);
      ctx.fillStyle = "#1c2b44"; ctx.fillRect(0, HUD - 1, W, 1);
      text(ctx, "SCORE " + String(this.score).padStart(6, "0"), 4, 5, 2, "#cfe0ff");
      text(ctx, "W" + this.wave, 116, 5, 2, "#ffb86b");
      for (let i = 0; i < Math.max(0, this.lives); i++) {
        ctx.fillStyle = "#4f8cff"; ctx.fillRect(160 + i * 12, 4, 8, 8);
        ctx.fillStyle = "#cfe0ff"; ctx.fillRect(163 + i * 12, 2, 2, 5); ctx.fillRect(162 + i * 12, 6, 4, 3);
      }
      const left = this.toSpawn + this.enemies.length;
      text(ctx, "E" + left, 196, 5, 2, "#ff7a8a");
    }

    banner(ctx, str, color) {
      const w = str.length * 4 * 3;
      ctx.fillStyle = "rgba(4,7,12,0.78)"; ctx.fillRect(0, 108, W, 36);
      ctx.fillStyle = color; ctx.fillRect(0, 108, W, 1); ctx.fillRect(0, 143, W, 1);
      text(ctx, str, Math.floor((W - w) / 2), 120, 3, color);
    }

    drawTitle(ctx) {
      ctx.fillStyle = "rgba(4,7,12,0.82)"; ctx.fillRect(0, HUD, W, H - HUD);
      const t1 = "FAULT", t2 = "LAB";
      text(ctx, t1, Math.floor((W - t1.length * 16 * 2) / 2) + 4, 70, 4, "#5b8bf0");
      text(ctx, t2, Math.floor((W - t2.length * 16 * 2) / 2) + 6, 98, 4, "#ffb86b");
      this.drawTank(ctx, 104, 142, "up", PAL.player, this.frame >> 2);
      if ((this.frame >> 5) & 1) text(ctx, "PRESS START", 60, 186, 2, "#e7eaf0");
      text(ctx, "CLICK OR PRESS ENTER", 52, 206, 1, "#9fb3d8");
      text(ctx, "ARROWS MOVE   SPACE FIRE", 36, 216, 1, "#7a8aa6");
      if (this.hiscore) text(ctx, "HI " + String(this.hiscore).padStart(6, "0"), 78, 232, 1, "#7a8aa6");
    }

    drawOver(ctx) {
      this.banner(ctx, this.baseAlive ? "GAME OVER" : "CORE LOST", "#ff7a8a");
      if ((this.frame >> 5) & 1) text(ctx, "PRESS START", 60, 156, 2, "#e7eaf0");
    }
  }

  global.TBGame = { Game, W, H, text };
})(window);
