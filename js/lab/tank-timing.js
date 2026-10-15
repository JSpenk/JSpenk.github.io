/* =========================================================
   tank-timing.js
   Video-timing model of the Tank Battalion board.

   Every number below was MEASURED by simulating the project's
   own RTL (rtl/Tankb_fpga.v, 18 MHz master clock) in Icarus
   Verilog and timing the H_SYNC / V_SYNC / H_BLANK / V_BLANK
   outputs. Nothing here is guessed from MAME or datasheets.

   Also exposed to the oscilloscope demo (signalsAt).
   ========================================================= */
const TB_TIMING = (() => {
  const t = {
    masterClockHz: 18e6,
    pixelClockHz: 6e6,        // 18 MHz / 3  (M6Hz in the RTL)
    pxPerLine: 384,           // H counter states per line
    activePx: 256,            // H_BLANK low
    hsyncStartPx: 296,        // HSYNC high from px 296 ...
    hsyncPx: 32,              // ... for 32 px (5.33 us)
    linesPerFrame: 264,       // V counter states per frame
    activeLines: 224,         // V_BLANK low
    vsyncStartLine: 240,      // VSYNC high on lines 240..247
    vsyncLines: 8,
  };
  t.hblankPx = t.pxPerLine - t.activePx;            // 128
  t.vblankLines = t.linesPerFrame - t.activeLines;  // 40
  t.lineTime = t.pxPerLine / t.pixelClockHz;        // 64 us
  t.frameTime = t.lineTime * t.linesPerFrame;       // 16.896 ms
  t.lineHz = 1 / t.lineTime;                        // 15.625 kHz
  t.frameHz = 1 / t.frameTime;                      // 59.19 Hz

  /* Nominal (fault-free) signal levels at time tSec. All active-high. */
  t.signalsAt = function (tSec) {
    const phase = ((tSec % t.frameTime) + t.frameTime) % t.frameTime;
    const line = Math.floor(phase / t.lineTime);
    const px = Math.floor(((phase % t.lineTime) * t.pixelClockHz));
    return {
      line, px,
      hblank: px >= t.activePx ? 1 : 0,
      hsync: px >= t.hsyncStartPx && px < t.hsyncStartPx + t.hsyncPx ? 1 : 0,
      vblank: line >= t.activeLines ? 1 : 0,
      vsync: line >= t.vsyncStartLine && line < t.vsyncStartLine + t.vsyncLines ? 1 : 0,
    };
  };
  return t;
})();
