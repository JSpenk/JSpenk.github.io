/* =========================================================
   data.js
   ALL portfolio content lives here. To add a new project,
   copy an existing object in PROJECTS and edit the fields —
   no HTML editing required. Same idea for SKILL_GROUPS and
   COURSEWORK.
   ========================================================= */

/* icon = key into the ICONS map in render.js (thumb graphic) */

const PROJECTS = [
  {
    id: "fpga-fault-injection",
    featured: true,
    icon: "fpga",
    category: "Fault Engineering / FPGA",
    title: "FPGA Fault Injection: Tank Battalion Hardware Emulation",
    role: "Co-Researcher",
    collaborators: "with Kyle Osborn",
    period: "Winter 2026",
    tags: ["FPGA", "Verilog / SystemVerilog", "Fault Injection", "MiSTer", "Hardware Debug", "Reliability"],
    summary:
      "Reproduced the original Tank Battalion arcade board — CPU control logic, video timing, sprite rendering, and memory-mapped I/O — on a DE10-Nano FPGA, then used controlled fault injection (stuck-at faults, transient bit flips) to study how hardware faults propagate into observable symptoms like display corruption and gameplay anomalies.",
    overview:
      "Diagnosing FPGA failures is hard because hardware faults often masquerade as software bugs. This project built a controlled testbed to study that boundary directly: a cycle-accurate recreation of a classic arcade board, instrumented so specific internal signals could be forced to incorrect logic values on demand and the resulting behavior observed and catalogued.",
    architecture: [
      "Recreated board architecture from published schematics: 6502-based CPU, ROM/RAM, video timing counters, sprite/tile rendering, and audio latch logic.",
      "Implemented on a DE10-Nano within the MiSTer FPGA framework using synthesizable Verilog/SystemVerilog.",
      "Video subsystem generates HSYNC/HBLANK/VSYNC/VBLANK directly from horizontal and vertical counters — no framebuffer — matching the original hardware's timing-driven display pipeline.",
    ],
    methodology: [
      "Injected stuck-at faults on HSYNC, HBLANK, and VSYNC to test predicted display-unstable failure modes.",
      "Forced the VBLANK signal to study frame-boundary handling in the rendering pipeline.",
      "Applied stuck-at faults to player movement inputs as a control case with a well-understood expected outcome.",
    ],
    resultsTable: {
      headers: ["Fault Location", "Fault Type", "Expected Effect", "Observed Effect"],
      rows: [
        ["HSYNC", "Stuck-at", "Loss of horizontal lock", "No visible effect — masked by MiSTer output protection"],
        ["VSYNC", "Stuck-at", "Vertical roll / collapse", "No visible effect — masked by MiSTer output protection"],
        ["HBLANK", "Stuck-at", "Black screen / retrace artifacts", "No visible effect — masked by MiSTer output protection"],
        ["VBLANK", "Stuck-at", "Frame blanking failure", "Red pixel artifacts at lower texture borders"],
        ["Movement input", "Stuck-at", "Continuous / absent movement", "Behaved exactly as predicted"],
      ],
    },
    conclusion:
      "The MiSTer framework's output-safety layer masked the sync-line faults that classical CRT theory predicted would be catastrophic — an unexpected but valuable finding about how modern FPGA output pipelines add protective abstraction over raw timing signals. The VBLANK result showed that subtle timing-signal corruption can still leak into rendering even when catastrophic sync failure is prevented, which is exactly the kind of hard-to-diagnose symptom this project set out to characterize.",
    links: [
      { label: "Read Full Paper (PDF)", href: "assets/docs/fpga-fault-injection-tankbattalion.pdf" },
    ],
  },
  {
    id: "autonomous-car-pcb",
    featured: true,
    icon: "pcb",
    category: "PCB Design / Embedded Systems",
    title: "Autonomous Vehicle Power & Control PCB",
    role: "PCB Designer",
    collaborators: "senior design team of 4",
    period: "EEC 195A/195B, 2025–2026",
    tags: ["Altium Designer", "PCB Design", "Power Electronics", "Motor Control", "OpenMV", "Embedded Systems"],
    summary:
      "Designed a custom two-layer PCB for a senior-design autonomous car, integrating brushed-motor drive, battery protection, dual voltage regulation, servo steering control, and an OpenMV H7 machine-vision header onto a single board.",
    overview:
      "As part of a four-person senior capstone team, I owned the board layout for the vehicle's power and control electronics — the board that everything else in the car plugs into. The goal was a compact, manufacturable board that could safely deliver motor current, regulate logic-level power for the vision system, and break out clean I/O for steering and sensing.",
    architecture: [
      "Brushed DC motor drive stage with dedicated output traces (OUTA/OUTB) sized for motor current.",
      "Battery input with dedicated battery-protection circuitry ahead of two independent regulation rails (5V and 6V) for logic and servo power respectively.",
      "Servo header for steering control and a dedicated OpenMV H7 header for camera-based perception input.",
      "Passive filtering (bulk + decoupling capacitors) placed close to each regulator and load to keep switching noise off the sensing rails.",
    ],
    methodology: [
      "Captured schematic and routed the board in Altium Designer, dividing subsystem placement (motor drive, regulation, I/O headers) among the team and integrating into one board.",
      "Ran full Design Rule Verification before fabrication: 0 clearance, short-circuit, routing, and net-class violations at final signoff.",
      "Reviewed the board against a contract PCB house's DFM (design-for-manufacture) capability table — flagged an annular-ring tolerance mismatch against the standard fab tier and adjusted for the intended production run.",
    ],
    conclusion:
      "The board passed DRC clean and was fabricated for integration into the vehicle. Working through a real DFM report against actual fab-house tolerances — rather than just simulation rules — was the most transferable part of the project: it's the same review process used before any board goes to a contract manufacturer.",
    links: [
      { label: "Lab Report (PDF)", href: "assets/docs/autonomous-car-pcb-lab-report.pdf" },
    ],
  },

  /* ---------------------------------------------------------
     TEMPLATE — duplicate this object to add a new project.
     Set featured:false to keep it off the homepage but still
     listed on the Projects page.
  ---------------------------------------------------------
  {
    id: "unique-slug",
    featured: false,
    icon: "fpga", // or "pcb" / "chip" / "code" — see ICONS in render.js
    category: "Category / Subcategory",
    title: "Project Title",
    role: "Your Role",
    collaborators: "solo project" ,
    period: "Term / Year",
    tags: ["Tag1", "Tag2"],
    summary: "1-2 sentence summary shown on the card.",
    overview: "Longer overview shown in the modal.",
    architecture: ["Bullet 1", "Bullet 2"],
    methodology: ["Bullet 1", "Bullet 2"],
    resultsTable: null, // or { headers: [...], rows: [[...], ...] }
    conclusion: "Wrap-up / outcome paragraph.",
    links: [{ label: "Link label", href: "https://..." }],
  },
  --------------------------------------------------------- */
];

const SKILL_GROUPS = [
  {
    title: "Hardware & Digital Design",
    skills: ["Digital Logic Design", "FPGA (Verilog / SystemVerilog)", "PCB Design (Altium Designer)", "Circuit Analysis", "Solid-State Devices", "Fault Diagnosis / DFT", "Embedded Systems", "Computer Architecture"],
  },
  {
    title: "Programming & Software",
    skills: ["C / C++", "Python", "Java", "HTML / CSS / JavaScript", "Data Structures & Algorithms", "Operating Systems"],
  },
  {
    title: "Tools & Workflow",
    skills: ["Altium Designer", "Git / Version Control", "Linux", "Lab Instrumentation (scope, DMM, bench PSU)", "MiSTer / FPGA Dev Boards"],
  },
  {
    title: "Foundations",
    skills: ["Applied Probability", "Cryptography", "Electromagnetics", "Linear Algebra / Vector Analysis"],
  },
];

/* Coursework pulled from transcript — grades intentionally
   omitted; only course titles relevant to the target roles
   are listed here. Add new courses as they're completed. */
const COURSEWORK = [
  {
    group: "Hardware & Digital Systems",
    courses: [
      { code: "EEC 180", name: "Digital Systems II" },
      { code: "EEC 018", name: "Digital Systems I" },
      { code: "EEC 286", name: "Digital System Testing" },
      { code: "EEC 172", name: "Embedded Systems" },
      { code: "EEC 170", name: "Intro to Computer Architecture" },
      { code: "EEC 111", name: "Digital Electronic Circuits" },
      { code: "EEC 189L", name: "Solid-State Devices & Physical Electronics" },
      { code: "EEC 100", name: "Circuits II" },
      { code: "ENG 017", name: "Circuits I" },
      { code: "EEC 130A", name: "Electromagnetics I" },
      { code: "EEC 173A", name: "Computer Networks" },
    ],
  },
  {
    group: "Computer Science Foundations",
    courses: [
      { code: "ECS 150", name: "Operating Systems" },
      { code: "ECS 122A", name: "Algorithm Design & Analysis" },
      { code: "ECS 036C", name: "Data Structures" },
      { code: "ECS 036A", name: "Programming & Problem Solving" },
      { code: "ECS 127", name: "Cryptography" },
      { code: "ECS 164", name: "Human-Computer Interaction" },
    ],
  },
  {
    group: "Math & Physics Foundations",
    courses: [
      { code: "MAT 021A–D", name: "Calculus Series" },
      { code: "MAT 022A/AL", name: "Linear Algebra + Computational Lab" },
      { code: "MAT 022B", name: "Differential Equations" },
      { code: "PHY 009A–C", name: "Classical Physics Series" },
      { code: "EEC 161", name: "Applied Probability" },
    ],
  },
];
