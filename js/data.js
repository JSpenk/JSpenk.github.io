/* =========================================================
   data.js
   ALL portfolio content lives here. To add a new project,
   copy an existing object in PROJECTS and edit the fields —
   no HTML editing required. Same idea for SKILL_GROUPS and
   COURSEWORK.

   Featured-project order below is deliberate: the three
   featured projects (fault injection, PCB/vehicle, clean
   room) map directly to the target roles this site is built
   for (hardware, FPGA/digital design, hardware test &
   validation, semiconductor). The QKD simulator is strong
   software work but doesn't map to those roles, so it's
   listed but not featured on the homepage.
   ========================================================= */

/* icon = key into the ICONS map in render.js (thumb graphic) */

const PROJECTS = [
  {
    id: "fpga-fault-injection",
    featured: true,
    icon: "fpga",
    category: "Hardware Validation / FPGA / Fault Injection",
    title: "FPGA Fault Injection: Tank Battalion Hardware Emulation",
    role: "Lead Researcher — formulated the project and carried out the full experimental campaign",
    collaborators: "paper co-authored with Kyle Osborn, who contributed early FPGA/MiSTer platform bring-up",
    period: "Winter 2026 — EEC 286, Digital System Testing",
    tags: ["FPGA", "Fault Injection", "Hardware Validation", "RTL / HDL Debug", "Verilog / SystemVerilog", "MiSTer", "Failure Analysis", "Quartus Prime", "DFT"],
    summary:
      "Solo fault-injection and failure-analysis study on a DE10-Nano FPGA: reverse-engineered an arcade board's timing and CPU control logic, then ran several dozen targeted stuck-at, SEU, and simulated-component-failure experiments — producing gameplay-breaking failures in over half of tested cases.",
    overview:
      "Goal: determine whether a hardware fault and a software bug produce distinguishable symptoms on an FPGA-based system, and build a repeatable fault-injection methodology to tell them apart. Originally scoped as a 3-person team project, I took over full ownership after two teammates dropped the course — formulating the test plan and independently running the entire experimental campaign, with Kyle Osborn (paper co-author) credited for the initial FPGA/MiSTer platform bring-up. I reverse-engineered the target board's schematic, then built a controlled FPGA testbed so specific internal signals could be forced to incorrect logic values on demand, following an evidence-based workflow: observe, measure, isolate, confirm — rather than trial-and-error debugging.",
    architecture: [
      "Reverse-engineered a Tank Battalion arcade PCB schematic: traced HSYNC/HBLANK/VSYNC/VBLANK timing logic, 6502 CPU control signals, and analog sound generation paths subsystem by subsystem.",
      "Recreated the board — CPU control logic, video timing counters, sprite/tile rendering, and audio latch logic — as synthesizable Verilog/SystemVerilog (RTL) on a DE10-Nano FPGA running the MiSTer framework.",
      "Video subsystem generates HSYNC/HBLANK/VSYNC/VBLANK directly from horizontal and vertical counters — no framebuffer — matching the original hardware's timing-driven display pipeline.",
    ],
    methodology: [
      "Classified the fault space using standard test-engineering categories: permanent faults (ATPG/BIST, stuck-at logic, ATE-style continuity/parametric checks) vs. transient/soft errors (bit flips, particle/laser-induced upsets, configuration-memory scrubbing).",
      "Ran several dozen targeted fault-injection experiments — stuck-at-0/1, single-event upset (bit flip), and simulated capacitor failure — directly modifying HDL/RTL modules and recompiling via Quartus Prime for each test iteration, exploiting the MiSTer platform's lack of boot security for fast modify-reflash cycles.",
      "Targeted sprite rendering, sound amplifier, and physics/collision subsystems for observability through native CRT video and audio output; produced gameplay-breaking symptoms — wall-clipping collision failures, missing weapon audio, non-firing weapon logic — in over half of tested cases.",
      "Ran a phased sync/timing campaign on HSYNC, HBLANK, VSYNC, and VBLANK; identified that MiSTer silently auto-corrected several of these faults and that bypassing that protection risked physical CRT damage, so I narrowed further sync-line testing to protect the hardware.",
      "Used player-movement-input faults as a control case with a well-understood expected outcome, to validate the injection methodology itself before trusting results on less-understood subsystems.",
      "Authored an IEEE-format technical report documenting fault-injection methodology, observed subsystem behavior, and root-cause findings for each fault class.",
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
      "MiSTer's output-safety layer masked sync-line faults that classical CRT theory predicted would be catastrophic — an unexpected finding about how modern FPGA output pipelines add protective abstraction over raw timing signals, and a reminder that test methodology has to account for the platform, not just the design under test. Redirecting the campaign toward sprite, audio, and physics/collision logic proved more productive: those subsystems were both safely observable and fault-sensitive, breaking gameplay in over half of tested cases and showing that fault sensitivity in this system extended well beyond the video-timing chain alone.",
    interactiveDemo: "demo-fault-injection.html",
    links: [{ label: "Try the Playable Fault Lab", href: "lab.html" }],
  },
  {
    id: "autonomous-car-pcb",
    featured: true,
    icon: "pcb",
    category: "Hardware Engineering / PCB Design / Embedded Systems",
    title: "Autonomous Lane-Following Vehicle",
    role: "Software Lead & PCB Contributor",
    collaborators: "Team 9 — with Nicolas Wong-Shea, Temirlan Ryspaev, Xiang Mao",
    period: "EEC 195A/195B Senior Design, 2025–2026",
    tags: ["PCB Design", "Schematic Capture", "Altium Designer", "Motor Control", "OpenMV", "Computer Vision", "PD Control", "Embedded Systems", "Power Electronics"],
    summary:
      "Designed and hand-built the power/motor-control PCB for a 4-person autonomous vehicle team — schematic capture through DRC-clean fabrication through hardware bring-up — then led the OpenMV vision and PD control software that steered it in real time.",
    overview:
      "Goal: build a lane-following autonomous vehicle that combines a manufacturable custom PCB, embedded computer vision, and closed-loop motor control into one working system. This was a four-person senior capstone (advised by Professor Halstead and Ning Miao). I owned the power/control PCB — schematic capture through DRC-clean layout through hand-soldered bring-up — and led the OpenMV vision and PD-control software that reads the track and drives the vehicle. The board distributes power and routes control signals; the OpenMV camera perceives the track and computes steering/speed commands; the chassis and mounts turn those signals into motion.",
    architecture: [
      "Custom two-layer PCB built around a VNH5019 H-bridge motor driver, dual regulated rails (5V/6V) for logic and servo power, battery protection, and headers for the steering servo and OpenMV camera.",
      "Wide, dedicated high-current traces from battery to motor driver to motor output, routed separately from control/logic traces to limit noise coupling into the camera and logic supply.",
      "Star-ground routing added in a later board revision after the initial ground scheme showed noise sensitivity — keeps high-current motor return paths from disturbing sensitive control references.",
      "High-current B12 lug connectors (custom Altium footprint) replacing the original 2-pin terminal blocks, plus decoupling capacitors placed close to each regulator for ripple control.",
      "Camera mounting system engineered for consistent field of view across track surfaces — treated as part of the control loop, since mounting stability directly affects lane-detection accuracy.",
    ],
    software: [
      "Real-time lane-following software in MicroPython on the OpenMV camera: splits each frame into zones, runs independent linear regression per side, and combines them with a center-weighted average to define a target corridor with configurable error tolerance.",
      "Multi-mode lane estimator — full lane-center averaging when both boundaries are visible, filtered lane-width recovery when only one side is visible, and a decayed-error fallback that slows the car instead of reacting to noise when no line is detected.",
      "PD (proportional-derivative) closed-loop steering controller with dynamic speed control — motor PWM adjusts based on steering demand and curve detection, with a filtered derivative term to reject frame-to-frame jitter.",
      "Debug/validation overlay drawing ROI boxes, detected lines, lane center, steering angle, and cross-track error directly on the camera feed — used to tune camera angle, threshold, ROI placement, and controller gains.",
    ],
    methodology: [
      "Learned Altium Designer from scratch across a graded lab sequence (Labs 1–7): schematic capture, schematic-to-PCB import debugging, component/footprint creation, and iterative layout revisions.",
      "Iterated the board across revisions in response to real test issues — redid a bad ground scheme, migrated to star grounding, and swapped connector types for higher current capacity.",
      "Ran full Design Rule Verification before fabrication and reviewed the board against a contract PCB house's DFM (design-for-manufacture) capability table, catching an annular-ring tolerance mismatch before submission.",
      "Debugged OpenMV vision code independently of hardware first (frame rate, blob detection, deflection-angle regression) before integrating it with PWM motor/servo output, to isolate software bugs from hardware noise.",
      "Hand-soldered SMD and through-hole components for hardware bring-up; diagnosed and reworked a solder bridge on the motor driver using solder wick and flux, then validated every connection with continuity testing before power-on.",
    ],
    conclusion:
      "The board passed DRC clean and the full system — hardware and software — ran end-to-end on the track. At the final time trial the car didn't hit the speed/accuracy balance the team wanted: the camera mount wasn't rigid enough, causing image jitter, and the software's conservative curve-handling traded speed for stability. That's the kind of system-level debugging this project is meant to show — the lane-detection logic was correct in isolation, but mechanical and control-tuning choices elsewhere in the system determined real-world performance.",
    links: [],
  },
  {
    id: "semiconductor-fabrication-cleanroom",
    featured: true,
    icon: "chip",
    category: "Semiconductor Fabrication / Clean Room Processing",
    title: "Semiconductor Fabrication & Clean Room Study",
    role: "Research Participant",
    collaborators: "university research study",
    period: "UC Davis",
    tags: ["Clean Room Protocols", "ISO Gowning", "Wafer Processing", "Contamination Control", "Semiconductor Fabrication"],
    summary:
      "University semiconductor fabrication research study: hands-on clean room exposure covering ISO gowning procedure, contamination-control discipline, and general wafer processing steps — the physical manufacturing side of the digital hardware built elsewhere on this site.",
    overview:
      "Goal: get direct exposure to how semiconductor devices are actually manufactured, not just designed. This university research study covered proper ISO clean room gowning procedure, contamination-control discipline, and a walkthrough of general wafer processing steps. It's a small but genuine data point for semiconductor test and product engineering roles: time in a working clean room learning the protocol firsthand, not just the theory.",
    links: [],
  },
  {
    id: "e91-quantum-key-distribution",
    featured: false,
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
      "Goal: simulate qubit transmission across variable channel distances and measure protocol fidelity and key-generation success rate using Qiskit, then study how realistic noise models degrade performance relative to an idealized channel. E91 is a quantum key distribution protocol that uses entangled photon pairs and a Bell-inequality (CHSH) test to prove a channel hasn't been eavesdropped on, rather than relying only on error rates. This project simulates the full pipeline end to end: generating entangled Bell pairs, sending them through a modeled physical channel, measuring them in randomized bases, sifting a raw key, estimating the quantum bit error rate (QBER), computing the CHSH S-parameter for security verification, and running error correction plus privacy amplification to derive a finite-key secret rate. It's built with a modular backend (supports Qiskit and QuTiP) and a Streamlit interface with tabs for single experiments, parametric sweeps, live message tests, and experiment history.",
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
    interactiveDemo: "demo-fault-injection.html#qkd",
    links: [
      { label: "View Source — Entry Point (main.py)", href: "assets/docs/qkd-main.py" },
      { label: "View Source — Experiment Config (Python)", href: "assets/docs/qkd-experiment-config.py" },
      { label: "View Source — Full Simulation Engine (Python)", href: "assets/docs/qkd-e91-implementation.py" },
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
    icon: "fpga", // or "pcb" / "chip" / "code" / "quantum" — see ICONS in render.js
    category: "Category / Subcategory",
    title: "Project Title",
    role: "Your Role",
    collaborators: "solo project" ,
    period: "Term / Year",
    tags: ["Tag1", "Tag2"],
    summary: "1-2 sentence summary shown on the card — lead with the goal and a real number if you have one.",
    overview: "Longer overview shown in the modal — start with 'Goal: ...' in one sentence.",
    architecture: ["Bullet 1", "Bullet 2"],
    software: null, // optional — array of bullets, shown as a "Software & Control" section
    methodology: ["Bullet 1", "Bullet 2"],
    resultsTable: null, // or { headers: [...], rows: [[...], ...] }
    conclusion: "Wrap-up / outcome paragraph.",
    interactiveDemo: null, // optional — path to a demo page; adds a card badge + primary modal button
    links: [{ label: "Link label", href: "https://..." }],
  },
  --------------------------------------------------------- */
];

/* Skill groups mirror the categories on the resume so a
   recruiter scanning for one skill area (e.g. "FPGA design"
   or "hardware test") can find it immediately, instead of
   parsing a flat tag cloud. */
const SKILL_GROUPS = [
  {
    title: "Hardware Design",
    skills: ["PCB Layout & Routing (Altium Designer)", "Schematic Capture", "FPGA Design (Quartus Prime)", "DRC / DFM Validation", "Digital Logic Design", "Circuit Analysis", "Solid-State Devices", "Computer Architecture"],
  },
  {
    title: "Embedded Systems",
    skills: ["OpenMV (MicroPython)", "PWM / Servo Control", "Real-Time Control Loops", "Motor Driver Interfacing", "Sensor Integration"],
  },
  {
    title: "Fabrication & Lab",
    skills: ["SMD & Through-Hole Soldering", "Oscilloscope", "Multimeter", "Logic Analysis", "Clean Room Protocols (ISO Gowning)", "Semiconductor Fabrication Fundamentals", "Contamination Control"],
  },
  {
    title: "Fault Analysis & Verification",
    skills: ["Fault Injection (Stuck-at, SEU, Component Failure)", "Hardware Validation", "HDL-Level Debug (RTL)", "Subsystem Isolation / Root-Cause Analysis", "ModelSim", "IEEE Technical Reporting"],
  },
  {
    title: "Programming",
    skills: ["Python (MicroPython, Qiskit)", "HDL (RTL & Verilog / SystemVerilog)", "C / C++", "Java", "HTML / CSS / JavaScript", "Data Structures & Algorithms", "Operating Systems"],
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
