/* =========================================================
   tank-crt.js
   Display stage. Takes the game framebuffer and applies what a
   video-timing fault does to the picture.

   Two modes (mirrors the project paper's Expected vs Observed):
     protection ON  -> behavior measured on the MiSTer output stage:
                       sync/HBLANK faults masked, VBLANK leaks red
                       fringes on the lower border of sprites.
     protection OFF -> classical CRT theory ("Expected Effect"
                       column): lock loss, rolling, blanking.
   The cabinet monitor is mounted on its side, so a "scan line"
   is a vertical column of this 224x256 portrait picture.
   ========================================================= */
(function (global) {
  "use strict";
  const W = 224, H = 256, LINES = 264, ACTIVE = 224;
  const BLACK = 0xff000000;

  function hash(a, b) {
    let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return (h ^ (h >>> 16)) >>> 0;
  }
  function brighten(px, add) {
    let r = (px & 255) + add, g = ((px >> 8) & 255) + add, b = ((px >> 16) & 255) + add;
    return 0xff000000 | ((b > 255 ? 255 : b) << 16) | ((g > 255 ? 255 : g) << 8) | (r > 255 ? 255 : r);
  }

  class CRT {
    constructor(outCanvas) {
      this.out = outCanvas;
      this.octx = outCanvas.getContext("2d");
      this.buf = document.createElement("canvas");
      this.buf.width = W; this.buf.height = H;
      this.bctx = this.buf.getContext("2d", { willReadFrequently: true });
      this.dst = this.octx.createImageData(W, H);
      this.dst32 = new Uint32Array(this.dst.data.buffer);
      this.last = "none";   // what the last render did (for the status line)
    }

    /** srcCanvas: game framebuffer. Returns a short tag describing the visible effect. */
    render(srcCanvas, frame, bus, protection) {
      const hs = bus.forced("HSYNC"), vs = bus.forced("VSYNC"), hb = bus.forced("HBLANK"), vb = bus.forced("VBLANK");
      const raw = !protection && (hs !== null || vs !== null || hb !== null || vb !== null);
      const fringe = protection && vb !== null;
      if (!raw && !fringe) {
        this.octx.drawImage(srcCanvas, 0, 0);
        this.last = (protection && (hs !== null || vs !== null || hb !== null)) ? "masked" : "none";
        return this.last;
      }
      this.bctx.drawImage(srcCanvas, 0, 0);
      const src = new Uint32Array(this.bctx.getImageData(0, 0, W, H).data.buffer);
      const dst = this.dst32;

      if (fringe) {
        // pixel data leaks past the frame boundary: red fringe under each sprite/tile edge
        const f = frame >> 1;
        for (let c = 0; c < W; c++) for (let r = 0; r < H; r++) {
          const i = r * W + c, px = src[i];
          let o = px;
          if (r > 0 && isDark(px) && !isDark(src[i - W]) && (hash(c * 7 + r, f) & 3) !== 0) o = 0xff2a2aff;
          dst[i] = o;
        }
        this.octx.putImageData(this.dst, 0, 0);
        this.last = "fringe";
        return this.last;
      }

      /* ---- raw CRT behavior ---- */
      const blackAll = hb === 1 || vb === 1;
      if (blackAll) {
        for (let i = 0; i < dst.length; i++) dst[i] = (hash(i, frame) & 63) === 0 ? 0xff181818 : BLACK;
        this.octx.putImageData(this.dst, 0, 0);
        this.last = "blank";
        return this.last;
      }
      const rollSA0 = (frame * 3) % LINES;
      const rollSA1 = (((frame >> 2) * 7) + (hash(frame >> 3, 1) & 15)) % LINES;
      const hatch = hb === 0, retrace = vb === 0;
      for (let c = 0; c < W; c++) {
        let L = c, off = 0, dark = false;
        if (vs !== null) {
          L = (c + (vs === 0 ? rollSA0 : rollSA1)) % LINES;
          if (L >= ACTIVE) dark = true;
        }
        if (hs !== null) {
          if (hs === 0) off = Math.floor(c * (9 + 3 * Math.sin(frame * 0.013)) + frame * 2.3) + ((hash(c, 3) & 3) - 1);
          else off = hash(c, frame >> 1) & 255;
        }
        const colDim = hs === 1 && c % 3 === 0;
        for (let r = 0; r < H; r++) {
          let px;
          if (dark) px = (L === 240 || L === 247) ? 0xff2a2a2a : BLACK;
          else {
            const sr = (r + off) & 255;
            px = src[sr * W + L];
            if (colDim) px = (px >> 1) & 0xff7f7f7f | 0xff000000;
          }
          if (hatch && ((r + c * 2 + frame) & 15) < 2) px = brighten(px, 70);
          if (retrace && (((r * 2 - c * 3 + frame * 3) % 96) + 96) % 96 < 2) px = brighten(px, 110);
          if (hs === 1 && (hash(c * 977 + r, frame) & 63) === 0) px = 0xffdddddd;
          dst[r * W + c] = px;
        }
      }
      this.octx.putImageData(this.dst, 0, 0);
      this.last = "distorted";
      return this.last;
    }
  }
  function isDark(px) { return (px & 255) + ((px >> 8) & 255) + ((px >> 16) & 255) < 90; }

  global.TBCRT = { CRT, W, H };
})(window);
