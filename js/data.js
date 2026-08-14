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
    role: "Lead Researcher — formulated the project and carried out the full experimental campaign",
    collaborators: "paper co-authored with Kyle Osborn, who contributed early FPGA/MiSTer platform bring-up",
    period: "Winter 2026 — EEC 286, Digital System Testing",
    tags: ["FPGA", "Verilog / SystemVerilog", "Fault Injection", "MiSTer", "Hardware Debug", "Reliability", "DFT"],
    summary:
      "Reproduced the original Tank Battalion arcade board — CPU control logic, video timing, sprite rendering, and memory-mapped I/O — on a DE10-Nano FPGA, then used a phased, controlled fault-injection campaign (stuck-at faults, transient bit flips) to study how hardware faults propagate into observable symptoms like display corruption and gameplay anomalies.",
    overview:
      "Originally proposed as 'Fault Simulation for Specialized Hardware,' this course project set out to answer a practical problem: diagnosing FPGA failures is hard because hardware faults often masquerade as software bugs. Once a design is synthesized, placed, and routed, behavior depends not just on HDL logic but on timing margins, routing delay, clock stability, and configuration-memory state — so the same symptom (freeze, glitch, wrong output) can come from very different root causes. Originally scoped as a 3-person team project, I ended up formulating the methodology and carrying out the full experimental campaign myself after two teammates dropped the course partway through — Kyle Osborn, who remained on the paper as co-author, had contributed the initial FPGA/MiSTer platform bring-up before that point. I built a controlled testbed to study the software-vs-hardware fault boundary directly: a cycle-accurate recreation of a classic arcade board, instrumented so specific internal signals could be forced to incorrect logic values on demand, following an evidence-first workflow of observe &rarr; measure &rarr; isolate &rarr; confirm rather than trial-and-error guessing.",
    architecture: [
      "Recreated board architecture from published schematics: 6502-based CPU, ROM/RAM, video timing counters, sprite/tile rendering, and audio latch logic — reverse-engineered from the original PCB schematic by tracing signal flow subsystem by subsystem.",
      "Implemented on a DE10-Nano within the MiSTer FPGA framework using synthesizable Verilog/SystemVerilog.",
      "Video subsystem generates HSYNC/HBLANK/VSYNC/VBLANK directly from horizontal and vertical counters — no framebuffer — matching the original hardware's timing-driven display pipeline.",
    ],
    methodology: [
      "Framed the fault space using standard industry categories: permanent faults (ATPG/BIST, stuck-at logic, external ATE-style continuity/parametric checks) versus transient/soft errors (simulated bit flips, physical particle/laser-induced upsets, configuration-memory scrubbing).",
      "Ran a 4-phase injection campaign of increasing scope — Phase 1: HSYNC/HBLANK/horizontal counter; Phase 2: VSYNC/VBLANK/vertical counter; Phase 3: display-enable and video-address faults; Phase 4: input, audio-trigger, and intermittent faults — logging monitor lock, visible behavior, and waveform changes at each stage.",
      "Injected stuck-at faults on HSYNC, HBLANK, and VSYNC to test predicted display-unstable failure modes, and forced VBLANK to study frame-boundary handling in the rendering pipeline.",
      "Expanded beyond timing signals to several dozen targeted experiments covering stuck-at-0/1, single-event-upset/bit-flip, and simulated capacitor failure across the sprite rendering, sound amplifier, and physics/collision subsystems — chosen for observability through native CRT video and audio output.",
      "Directly modified HDL modules and recompiled via Quartus Prime for each test iteration, taking advantage of the MiSTer platform having no boot security to enable fast design-modify-reflash cycles.",
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
      "The MiSTer framework's output-safety layer masked the sync-line faults that classical CRT theory predicted would be catastrophic — an unexpected but valuable finding about how modern FPGA output pipelines add protective abstraction over raw timing signals. Recognizing that this auto-correction behavior also carried a risk of physical CRT damage if bypassed, later testing narrowed scope away from raw sync lines toward subsystems that were both safely observable and productive: sprite rendering, sound amplifier, and physics/collision logic. That broader campaign produced gameplay-breaking symptoms — including wall-clipping collision failures, missing weapon audio, and non-firing weapon logic — in over half of tested cases, showing that fault sensitivity in this system was concentrated well beyond the video-timing chain alone.",
    links: [
      { label: "Read Full Paper (PDF)", href: "assets/docs/fpga-fault-injection-tankbattalion.pdf" },
    ],
  },
  {
    id: "autonomous-car-pcb",
    featured: true,
    icon: "pcb",
    category: "Embedded Systems / Computer Vision / PCB Design",
    title: "Autonomous Lane-Following Vehicle",
    role: "Software Lead & PCB Contributor",
    collaborators: "Team 9 — with Nicolas Wong-Shea, Temirlan Ryspaev, Xiang Mao",
    period: "EEC 195A/195B Senior Design, 2025–2026",
    tags: ["Altium Designer", "PCB Design", "Power Electronics", "Motor Control", "OpenMV", "Computer Vision", "PD Control", "Embedded Systems"],
    summary:
      "Full-stack senior capstone vehicle: a custom two-layer PCB for motor drive, power regulation, and servo/camera I/O, paired with an OpenMV closed-loop vision system that detects lane markings and drives a PD steering controller in real time.",
    overview:
      "This was a four-person capstone project (advised by Professor Halstead and Ning Miao) to design, build, and race a lane-following autonomous vehicle — combining custom hardware, embedded computer vision, and real-time closed-loop motor control. My primary ownership was the power/control PCB, with hands-on contribution to the OpenMV vision and PD-control software during team debugging sessions. The board distributes power and routes control signals; the OpenMV camera perceives the track and computes steering/speed commands; the chassis and mounts turn those signals into motion.",
    architecture: [
      "Custom two-layer PCB integrating a surface-mount H-bridge motor driver, dual regulated rails (5V/6V) for logic and servo power, battery protection, and headers for the steering servo and OpenMV camera.",
      "Wide, dedicated high-current traces from battery to motor driver to motor output, routed separately from control/logic traces to limit noise coupling into the camera and logic supply.",
      "Localized/star-style grounding so high-current motor return paths don't disturb sensitive control references — added in a later board revision after the initial layout showed noise sensitivity.",
      "High-current B12 lug connectors (custom Altium footprint) replacing the original 2-pin terminal blocks, plus decoupling capacitors placed close to each regulator for ripple control.",
      "Mechanical camera mount engineered for stable, adjustable OpenMV positioning — treated as part of the control loop, since mounting angle and vibration directly affect lane-detection quality.",
    ],
    software: [
      "Real-time closed-loop lane follower running on the OpenMV camera itself: grayscale QQVGA capture, tuned for frame rate, splitting each frame into multiple zones with independent linear regression per side and a center-weighted average to define a target corridor with configurable error tolerance.",
      "Multi-mode lane estimator — full lane-center averaging when both boundaries are visible, filtered lane-width recovery when only one side is visible, and a decayed-error 'lost line' fallback that slows the car instead of reacting to noise.",
      "Proportional-derivative (PD) steering controller with a filtered derivative term to reject frame-to-frame jitter, plus curve detection that forces a minimum correction and a dynamic speed reduction on sharp turns.",
      "Debug/validation mode overlaying ROI boxes, detected lines, lane center, steering angle, and cross-track error directly on the camera feed — used to tune camera angle, threshold, ROI placement, and controller gains.",
    ],
    methodology: [
      "Learned Altium Designer from scratch across a graded lab sequence (Labs 1–7): schematic capture, schematic-to-PCB import debugging, component/footprint creation, and iterative layout revisions.",
      "Iterated the board across revisions in response to real test issues — redid a bad ground scheme, migrated to star grounding, and swapped connector types for higher current capacity.",
      "Ran full Design Rule Verification before fabrication and reviewed the board against a contract PCB house's DFM (design-for-manufacture) capability table, catching an annular-ring tolerance mismatch before submission.",
      "Debugged OpenMV vision code independently of hardware first (frame rate, blob detection, deflection-angle regression) before integrating it with PWM motor/servo output, to isolate software bugs from hardware noise.",
      "Hand-soldered SMD and through-hole components onto the fabricated board; diagnosed and reworked a solder bridge on the VNH5019 motor driver using solder wick and flux, then validated every connection with continuity testing before power-on.",
    ],
    conclusion:
      "The board passed DRC clean and the full system — hardware and software — ran end-to-end on the track. At the final time trial we didn't hit the speed/accuracy balance we wanted: the camera mount wasn't rigid enough, causing image jitter, and the software's conservative curve-handling (slowing aggressively on any detected turn) traded speed for stability. That result is exactly the kind of system-level debugging this portfolio is meant to highlight — the lane-detection logic was correct in isolation, but mechanical and control-tuning choices elsewhere in the system determined real-world performance. Future revisions would target a stiffer camera mast and less conservative speed control.",
    links: [
      { label: "Full Final Report (PDF)", href: "assets/docs/autonomous-vehicle-final-report.pdf" },
    ],
  },
  {
    id: "e91-quantum-key-distribution",
    featured: true,
    icon: "quantum",
    category: "Quantum Computing / Cryptography Software",
    title: "E91 Quantum Key Distribution Simulator",
    role: "Solo Developer",
    collaborators: "independent project",
    period: "2025 — ongoing",
    tags: ["Python", "Streamlit", "Quantum Cryptography", "Qiskit / QuTiP", "Bell-State Physics", "Systems Modeling"],
    summary:
      "A professional-grade simulator of the E91 quantum key distribution protocol — entangled photon pairs, CHSH-based security verification, realistic hardware noise (fiber loss, detector jitter, dark counts, satellite links), and an injectable eavesdropper — built as an interactive Streamlit app.",
    overview:
      "E91 is a quantum key distribution protocol that uses entangled photon pairs and a Bell-inequality (CHSH) test to prove a channel hasn't been eavesdropped on, rather than relying only on error rates. This project simulates the full pipeline end to end: generating entangled Bell pairs, sending them through a modeled physical channel, measuring them in randomized bases, sifting a raw key, estimating the quantum bit error rate (QBER), computing the CHSH S-parameter for security verification, and running error correction plus privacy amplification to derive a finite-key secret rate. It's built with a modular backend (supports Qiskit and QuTiP) and a Streamlit interface with tabs for single experiments, parametric sweeps, live message tests, and experiment history.",
    architecture: [
      "Modular Python architecture — config/constants, UI components/tabs, and data models kept separate so the physics engine can be driven from the UI or a script.",
      "Dataclass-based ExperimentConfig covering 60+ tunable parameters: security thresholds (epsilon_sec, epsilon_cor), error-correction protocol and code rate, device-independent bound type, and full channel/detector/source noise models.",
      "Streamlit tabs for a single Experiment run, a Parametric Sweep across a variable, an end-to-end Message Test, and persistent Experiment History.",
    ],
    software: [
      "Entangled Bell-pair generation (&Phi;+, &Phi;-, &Psi;+, &Psi;-) with a 3&times;3 Alice/Bob measurement-angle grid separating key-generation bases from CHSH-test bases.",
      "CHSH S-parameter computed per run as the security check, flagged against the classical bound, alongside QBER estimated from a held-out parameter-estimation sample.",
      "Realistic physical hardware modeling: per-km fiber loss, insertion loss, polarization misalignment, detector heralding/end efficiency, dark counts, timing jitter, deadtime, afterpulsing, SPDC multi-pair emission, and even a satellite free-space link model with pointing jitter and atmospheric turbulence.",
      "Injectable intercept-resend eavesdropper (Eve) to demonstrate how her presence measurably raises QBER and suppresses the CHSH violation — the core security proof of the protocol, made visible.",
      "BBBSS-style error correction and privacy amplification producing an asymptotic and finite-key secret fraction/rate under configurable security parameters.",
      "Live two-way UDP messaging demo that encrypts and decrypts a real text message using the generated quantum key, proving the derived key is actually usable end to end.",
    ],
    conclusion:
      "The simulator makes an otherwise abstract protocol — entanglement, Bell tests, information-theoretic security — concrete and interactively explorable, while staying grounded in real hardware limitations (loss, noise, detector imperfections) rather than an idealized textbook channel. It's an ongoing project; current work is on expanding the device-independent bound options and the satellite-link noise model.",
    links: [
      { label: "View Source — Entry Point (main.py)", href: "assets/docs/qkd-main.py" },
      { label: "View Source — Experiment Config (Python)", href: "assets/docs/qkd-experiment-config.py" },
      { label: "View Source — Full Simulation Engine (Python)", href: "assets/docs/qkd-e91-implementation.py" },
    ],
  },

  {
    id: "semiconductor-fabrication-cleanroom",
    featured: false,
    icon: "chip",
    category: "Semiconductor Fabrication",
    title: "Semiconductor Fabrication & Clean Room Study",
    role: "Research Participant",
    collaborators: "university research study",
    period: "UC Davis",
    tags: ["Clean Room Protocols", "ISO Gowning", "Wafer Processing", "Contamination Control"],
    summary:
      "A university semiconductor fabrication research study covering clean room protocols, contamination control, and general wafer processing steps.",
    overview:
      "Hands-on exposure to how chips actually get made: proper ISO clean room gowning procedure, contamination-control discipline, and a walkthrough of general wafer processing steps — the physical manufacturing side of the digital designs I work with elsewhere on this site.",
    links: [],
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
    software: null, // optional — array of bullets, shown as a "Software & Control" section
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
    skills: ["C / C++", "Python", "Java", "HTML / CSS / JavaScript", "Streamlit", "Data Structures & Algorithms", "Operating Systems", "Computer Vision (OpenMV)"],
  },
  {
    title: "Tools & Workflow",
    skills: ["Altium Designer", "Quartus Prime", "ModelSim", "Git / Version Control", "Linux", "Lab Instrumentation (scope, DMM, bench PSU)", "MiSTer / FPGA Dev Boards"],
  },
  {
    title: "Foundations",
    skills: ["Applied Probability", "Cryptography", "Quantum Computing (Qiskit / QuTiP)", "Electromagnetics", "Linear Algebra / Vector Analysis"],
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
