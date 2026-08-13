#!/usr/bin/env python3
"""
================================================================================
E91 QKD Professional Interface (v7.0)
================================================================================

Professional quantum key distribution simulator with modern, user-friendly design.

NEW IN v7.0:
- 🎨 Professional dark theme with modern styling
- 🔧 Dynamic presets that update ALL parameter values
- 🎲 Smart randomizers that update displayed inputs
- 💡 Clean tooltips (no info dropdowns)
- ⚡ Streamlined, responsive layout
- 🌐 Enhanced two-way communication
- ✅ Fixed all deprecation warnings

Run with: streamlit run e91_professional.py

================================================================================
"""

# ============================================================================
# IMPORTS
# ============================================================================

import streamlit as st
import numpy as np
import matplotlib.pyplot as plt
import pandas as pd
import json
import time
import logging
from dataclasses import dataclass, asdict, field
from typing import Dict, List, Tuple, Optional
import io
from enum import Enum
import socket





# ============================================================================
# DATA STRUCTURES
# ============================================================================

@dataclass
class MessageTest:
    """Results from a message transmission test."""
    mode: str
    original_message: str
    encrypted_message: bytes
    decrypted_message: str
    key_used: List[int]
    key_length_bits: int
    encryption_method: str
    success: bool
    error_message: Optional[str] = None
    transmission_time: float = 0.0
    alice_key: Optional[List[int]] = None
    bob_key: Optional[List[int]] = None
    key_mismatch_positions: Optional[List[int]] = None


@dataclass
class MessageListener:
    """Simulated message listener/receiver."""
    active: bool = False
    port: int = 8765
    received_messages: List[MessageTest] = field(default_factory=list)


# ============================================================================
# NETWORKING FUNCTIONS (UDP-Based Two-Way Communication)
# ============================================================================
# These functions enable live computer-to-computer quantum-secured messaging
# using UDP for simplicity. Production systems should use TCP with proper
# authentication and error handling.
# ============================================================================

def send_udp_message(host: str, port: int, payload: bytes, timeout: float = 2.0) -> None:
    """
    Send a UDP payload to a peer (best-effort, no ACK).

    Args:
        host: Target IP address or hostname
        port: Target UDP port number
        payload: Encrypted message bytes to send
        timeout: Socket timeout in seconds
    """
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.settimeout(timeout)
            s.sendto(payload, (host, int(port)))
    except Exception as exc:
        logging.warning(f"UDP send failed to {host}:{port} - {exc}")


def receive_udp_message(port: int, timeout: float = 2.0) -> Optional[Tuple[bytes, Tuple[str, int]]]:
    """
    Receive a single UDP payload (if any) on the given port.

    Args:
        port: Local UDP port to listen on
        timeout: How long to wait for a message (seconds)

    Returns:
        Tuple of (data, sender_address) if message received, None on timeout
    """
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.bind(("", int(port)))
            s.settimeout(timeout)
            data, addr = s.recvfrom(65535)
            return data, addr
    except socket.timeout:
        return None
    except Exception as exc:
        logging.warning(f"UDP receive failed on port {port} - {exc}")
        return None


# ============================================================================
# UTILITY AND HELPER FUNCTIONS
# ============================================================================
# Mathematical utilities, data formatting, and UI helper functions
# ============================================================================

def binary_entropy(p: float) -> float:
    """
    Binary entropy function H(p) = -p*log2(p) - (1-p)*log2(1-p).
    Used in calculating secret key rates and privacy amplification.
    """
    p = np.clip(p, 1e-10, 1 - 1e-10)
    return -p * np.log2(p) - (1 - p) * np.log2(1 - p)


def normalize_probs(values: List[float]) -> List[float]:
    """Normalize a list of non-negative values to sum to 1.
    Falls back safely if the sum is ~0.
    """
    s = float(sum(values))
    if s <= 1e-12:
        n = max(len(values), 1)
        return [1.0 / n] * n
    return [max(0.0, float(v)) / s for v in values]


def format_hex(data: bytes, group: int = 2, line: int = 32) -> str:
    """Pretty-format bytes as hex with grouping and line wrapping.
    - group: number of hex chars per group (2 -> byte spacing)
    - line: number of groups per line
    """
    hex_str = data.hex()
    pairs = [hex_str[i : i + group] for i in range(0, len(hex_str), group)]
    lines = [" ".join(pairs[i : i + line]) for i in range(0, len(pairs), line)]
    return "\n".join(lines)


def history_empty_card(message: str):
    """Render a subtle empty-state card used in History sections."""
    st.markdown(
        f"""
        <div style="background:#0f2438;border-radius:10px;padding:14px;color:#cde3ff;">
        {message}
        </div>
        """,
        unsafe_allow_html=True,
    )


# --------------------------------------------------------------------------
# Centralized help text for UI widgets. Use with help=h("key").
# --------------------------------------------------------------------------

HELP_TEXT: Dict[str, str] = {
    "preset": "Preset bundles of parameters. Choose 'Custom' for full control.",
    "backend": "Quantum simulator backend. 'qiskit' uses circuit simulation; 'qutip' uses analytic probabilities.",
    "seed": "Random seed for reproducibility. Same seed + config -> identical results. Typical range: 0-9999.",
    "total_distance": "Total fiber distance in km. Split equally between Alice and Bob for loss.",
    "angle_type": "Angle input mode. 'Exact' allows any value; 'Whole Radians (pi/n)' snaps to multiples of pi/8.",
    "randomize_angles": "Randomize all measurement angles using the current angle mode.",
    "angle": "Measurement angle in radians (A0..A2, B0..B2). Relative differences set CHSH.",
    "num_pairs": "Number of entangled pairs to simulate. Larger -> better statistics, longer runtime.",
    "pA": "Alice basis probabilities for A0/A1/A2. Must sum to 1.",
    "pB": "Bob basis probabilities for B0/B1/B2. Must sum to 1.",
    "prob_randomize": "Randomize and normalize basis probabilities.",
    "prob_reset": "Reset basis probabilities to defaults: A=[0.5,0.5,0.0], B=[0.5,0.5,0.0].",
    "enable_depol": "Enable depolarizing noise (uniform random Pauli errors).",
    "depol_alpha": "Depolarizing strength alpha in [0,1]. Higher alpha raises QBER and lowers CHSH.",
    "enable_visibility": "Enable visibility reduction (imperfect interference/alignment).",
    "visibility": "Visibility V in [0.5,1]. Secret fraction degrades with (1-V).",
    "enable_intrinsic": "Enable intrinsic bit-flip errors.",
    "intrinsic_ed": "Intrinsic error e_d: probability of a flip per bit.",
    "enable_fiber": "Enable fiber attenuation and fixed losses.",
    "fiber_loss_db": "Fiber attenuation in dB per km (e.g., 0.2 dB/km).",
    "fixed_loss_a": "Fixed loss at Alice (dB).",
    "fixed_loss_b": "Fixed loss at Bob (dB).",
    "enable_detector": "Include heralding and end-detector efficiencies.",
    "herald_eff": "Heralding efficiency in [0,1].",
    "end_det_eff": "End detector efficiency in [0,1].",
    "enable_dark": "Include dark counts.",
    "use_cps": "Specify dark counts in CPS and convert to per-pulse using repetition rate.",
    "dark_cps": "Dark counts per second (CPS).",
    "dark_prob": "Dark probability per pulse when CPS mode is off.",
    "enable_jitter": "Include Gaussian timing jitter on time tags.",
    "jitter_ns": "Timing jitter standard deviation (ns).",
    "enable_deadtime": "Apply detector deadtime after a click.",
    "deadtime_ns": "Deadtime window (ns).",
    "enable_after": "Include afterpulsing events.",
    "after_prob": "Afterpulse probability per detection.",
    "after_delay": "Typical afterpulse delay (ns).",
    "enable_sat": "Apply saturation limit when repetition rate exceeds detector capability.",
    "saturation_rate": "Max sustainable event rate (Hz).",
    "enable_bg": "Include uniform background/stray counts.",
    "Y0": "Background click probability per pulse.",
    "bg_cps": "Background rate in counts per second.",
    "coinc_ns": "Coincidence window width (ns).",
    "rep_rate": "Pulse repetition rate (Hz).",
    "enable_timetag": "Record time tags for coincidence analysis and CAR.",
    "enable_multi": "Enable multi-pair SPDC emission (raises accidentals).",
    "spdc_mu": "SPDC brightness mu: mean pairs per pulse.",
    "pair_rate": "Mean pair production rate (Hz).",
    "pump_mw": "Pump laser power (mW).",
    "wavelength": "Photon wavelength (nm).",
    "filt_band": "Spectral filter bandwidth (nm).",
    "enable_satellite": "Free-space link model (geometric/pointing loss, turbulence optional).",
    "beam_div": "Transmitter beam divergence (microrad).",
    "pointing": "Pointing jitter (microrad).",
    "rx_fov": "Receiver field of view (microrad).",
    "slant_km": "Slant range (km).",
    "tx_ap": "Transmitter aperture (m).",
    "rx_ap": "Receiver aperture (m).",
    "is_day": "Daytime operation increases background.",
    "sat_bg_cps": "Satellite background rate (CPS).",
    "enable_turb": "Enable atmospheric turbulence with structure constant Cn2.",
    "cn2": "Refractive index structure constant Cn2 (m^-2/3).",
    "epsilon_sec": "Security failure probability for privacy amplification.",
    "epsilon_cor": "Correctness failure probability (post-IR).",
    "pe_fraction": "Fraction of sifted bits used for parameter estimation.",
    "ir_protocol": "Information reconciliation protocol (BBBSS or Cascade).",
    "f_EC": "Error-correction efficiency multiplier vs Shannon limit.",
    "block_length": "Block length for IR/PA (bits).",
    "code_rate": "Privacy amplification code rate (0-1).",
    "enable_routed_di": "Compute a simple routed DI witness.",
    "di_bound_type": "Device-independent bound selector (placeholder).",
    "routing_f": "Fixed routing efficiency eta_f.",
    "routing_d": "Distance-dependent routing efficiency eta_d.",
    "enable_eve": "Enable a simple intercept-resend eavesdropper.",
    "eve_model": "Eavesdropper attack model.",
    "eve_prob": "Fraction of pairs intercepted by Eve (0-1).",
    "run_experiment": "Run the simulator with current parameters.",
}

HELP_TEXT_OLD = """
    # Header
    "preset": "Preset bundles toggle realistic combinations of losses and noise. Choose 'Custom' to control every knob yourself.",
    "backend": "Quantum simulator used to generate measurement outcomes. 'qiskit' uses a circuit simulation; 'qutip' uses analytic probabilities.",
    "seed": "PRNG seed for reproducibility. Same seed + config → identical results.
Typical: 0–9999.",

    # Inputs
    "total_distance": "End‑to‑end fiber length (km). The code splits this equally between Alice and Bob unless you later override. Used to compute fiber loss: loss = distance × dB/km.",
    "angle_type": "Angle entry mode. 'Exact' lets you set any angle in [0, π]. 'Whole Radians (π/n)' constrains angles to multiples of π/8 often used in E91/CHSH.",
    "randomize_angles": "Generate a fresh set of angles according to the chosen angle entry mode. Handy for exploring CHSH surfaces.",
    "angle": "Measurement setting (radians). Alice uses A0,A1,A2; Bob uses B0,B1,B2. CHSH uses specific relative differences between these angles to maximize violation.",
    "num_pairs": "Number of entangled pairs to simulate. Affects runtime and statistical confidence. Typical: 5k–100k.",

    # Basis probabilities
    "pA": "Probability that Alice selects basis A0/A1/A2. Must sum to 1. Weight A0/B0 for key generation; other combinations support CHSH.",
    "pB": "Probability that Bob selects basis B0/B1/B2. Must sum to 1. Use 'Randomize' to sample and normalize.",
    "prob_randomize": "Randomize and normalize Alice and Bob basis probabilities.",
    "prob_reset": "Reset basis probabilities to common E91 defaults (A:[0.5,0.5,0.0], B:[0.5,0.5,0.0]).",

    # Logical noise
    "enable_depol": "Apply depolarizing noise to both qubits. Models uniform random Pauli errors.",
    "depol_alpha": "Depolarizing strength α in [0,1]. Higher α increases QBER and suppresses CHSH. Typical lab α ≈ 0.02–0.10.",
    "enable_visibility": "Reduce two‑photon interference visibility. Models imperfect indistinguishability or misalignment.",
    "visibility": "Interference visibility V in [0.5,1]. Secret fraction degrades roughly with (1–V). Typical good setups V ≥ 0.96.",
    "enable_intrinsic": "Apply independent bit‑flip errors at detectors or logic.",
    "intrinsic_ed": "Intrinsic error e_d (per‑bit flip prob). Typical 0.1%–2%.",

    # Channel loss
    "enable_fiber": "Enable fiber attenuation based on distance and fixed connector losses.",
    "fiber_loss_db": "Fiber attenuation in dB/km. SMF‑28 around 0.18–0.2 dB/km at 1550 nm; higher at 810 nm.",
    "fixed_loss_a": "Additional fixed optical loss at Alice side (dB).",
    "fixed_loss_b": "Additional fixed optical loss at Bob side (dB).",

    # Detectors
    "enable_detector": "Include finite heralding and end‑detector efficiencies.",
    "herald_eff": "Heralding efficiency (pair production and collection). 0–1.",
    "end_det_eff": "Single‑photon detector efficiency at ends. 0–1. SNSPDs 0.7–0.95, Si‑APDs ~0.5–0.75.",

    # Dark/background and timing
    "enable_dark": "Include random dark counts in each detector.",
    "use_cps": "When enabled, specify dark count rate in counts per second (CPS) and convert to per‑pulse probability using repetition rate.",
    "dark_cps": "Detector dark counts per second. Typical: 10–1000 cps (SNSPD), 100–10k cps (Si‑APD).",
    "dark_prob": "Direct probability of a dark per pulse when CPS mode is off.",
    "enable_jitter": "Apply Gaussian timing jitter to time tags.",
    "jitter_ns": "Standard deviation of timing jitter (ns).",
    "enable_deadtime": "Block detections within a time window after a click to emulate detector deadtime.",
    "deadtime_ns": "Deadtime duration (ns). Typical: 20–100 ns for APDs.",
    "enable_after": "Introduce afterpulsing events that randomly flip bits with some delay after a detection.",
    "after_prob": "Afterpulse probability per detection. Typical < 5%.",
    "after_delay": "Characteristic delay of afterpulses (ns).",
    "enable_sat": "Limit throughput if repetition rate exceeds detector saturation rate.",
    "saturation_rate": "Detector sustainable event rate (Hz). If rep‑rate > saturation, effective detection is thinned.",

    # Background and coincidence
    "enable_bg": "Add uniform background/stray counts contributing to accidentals.",
    "Y0": "Background click probability per pulse (dimensionless).",
    "bg_cps": "Background count rate in CPS when modeling continuous background.",
    "coinc_ns": "Coincidence window width (ns) used to count coincidences and estimate CAR.",
    "rep_rate": "Pulse repetition rate (Hz). Influences conversion between CPS and per‑pulse probabilities.",
    "enable_timetag": "Record simulated time tags. Enables coincidence timing analysis and CAR.",

    # Source
    "enable_multi": "Simulate multi‑pair emission from SPDC. Raises QBER via double‑pair accidentals.",
    "spdc_mu": "SPDC brightness μ (mean pairs per pulse). Typical 0.01–0.2.",
    "pair_rate": "Mean entangled pair production rate (Hz).",
    "pump_mw": "Pump laser power (mW).",
    "wavelength": "Photon wavelength (nm). 810 nm (Si‑APD) or 1550 nm (SNSPD) are common.",
    "filt_band": "Spectral filter bandwidth (nm). Narrower reduces background at the expense of rate.",

    # Satellite / Free‑space
    "enable_satellite": "Use a simple free‑space link model with geometric spreading, pointing loss, and optional turbulence.",
    "beam_div": "Transmitter beam divergence (μrad). Smaller means tighter beam and lower geometric loss.",
    "pointing": "Pointing jitter (μrad). Larger jitter increases pointing loss.",
    "rx_fov": "Receiver field of view (μrad).",
    "slant_km": "Slant range between terminals (km).",
    "tx_ap": "Transmitter aperture diameter (m).",
    "rx_ap": "Receiver aperture diameter (m).",
    "is_day": "Daytime operation increases background counts.",
    "sat_bg_cps": "Satellite background rate (CPS).",
    "enable_turb": "Enable atmospheric turbulence with structure constant Cn².",
    "cn2": "Refractive‑index structure constant Cn² (m^‑2/3). Typical LEO 1e‑15–1e‑14.",

    # Security / IR / DI / Eve
    "epsilon_sec": "Security failure probability for privacy amplification. Smaller is stricter (e.g., 1e‑9).",
    "epsilon_cor": "Correctness failure probability (post‑IR verification).",
    "pe_fraction": "Fraction of sifted bits devoted to parameter estimation (QBER bound).",
    "ir_protocol": "Information reconciliation method. BBBSS ~ ideal reference; Cascade adds ~10% overhead.",
    "f_EC": "Error‑correction efficiency multiplier relative to Shannon limit. Typical 1.05–1.25.",
    "block_length": "Block length used by IR/PA models (bits).",
    "code_rate": "Privacy amplification code rate scaling applied to final usable bits (0–1).",
    "enable_routed_di": "Compute a simple routed DI witness using routing efficiencies and detection efficiency.",
    "di_bound_type": "Device‑independent bound selector (placeholder for alternative bounds).",
    "routing_f": "Fixed routing efficiency η_f for switching/routers.",
    "routing_d": "Distance‑dependent routing efficiency η_d (e.g., additional fiber).",
    "enable_eve": "Inject a simple intercept‑resend eavesdropper that flips Bob's bit with probability ~0.25 on intercepted pairs.",
    "eve_model": "Eavesdropper attack model. Intercept‑resend approximates measurement disturbance.",
    "eve_prob": "Fraction of pairs intercepted by Eve (0–1).",

    # Actions
    "run_experiment": "Execute the simulator with current parameters. Runtime scales with number of pairs and backend.",
}


"""

def h(key: str) -> str:
    """Lookup helper for tooltip text."""
    return HELP_TEXT.get(key, "")




def compute_satellite_loss(config: ExperimentConfig) -> float:
    """Compute satellite channel loss."""
    if not config.enable_satellite:
        return 0.0
    wavelength_m = config.wavelength_nm * 1e-9
    range_m = config.slant_range_km * 1000
    divergence_rad = config.beam_divergence_urad * 1e-6
    beam_radius_m = range_m * divergence_rad
    beam_area = np.pi * beam_radius_m**2
    rx_area = np.pi * (config.receiver_aperture_m / 2)**2
    geometric_loss = min(1.0, rx_area / max(beam_area, 1e-12))
    pointing_error_rad = config.pointing_jitter_urad * 1e-6
    pointing_loss = np.exp(-2 * (pointing_error_rad / divergence_rad)**2)
    turbulence_loss = 1.0
    if config.enable_turbulence:
        k = 2 * np.pi / wavelength_m
        sigma_R2 = 1.23 * config.cn2 * k**(7/6) * range_m**(11/6)
        turbulence_loss = np.exp(-sigma_R2)
    total_efficiency = geometric_loss * pointing_loss * turbulence_loss
    return -10 * np.log10(max(total_efficiency, 1e-10))


def estimate_runtime(num_pairs: int, backend: str) -> float:
    """Estimate runtime in seconds."""
    return num_pairs * (0.0002 if backend == "qiskit" else 0.00005)


def validate_config(config: ExperimentConfig) -> List[str]:
    """Validate configuration and return warnings."""
    warnings = []
    if config.enable_fiber_loss:
        total_loss = (config.distance_km_A + config.distance_km_B) * config.fiber_loss_dB_per_km
        if total_loss > 30:
            warnings.append(f"âš ï¸ Very high fiber loss ({total_loss:.1f} dB).")
    if config.enable_depolarizing_noise and config.depolarizing_alpha > 0.15:
        warnings.append("âš ï¸ High depolarizing noise may prevent key generation.")
    if config.num_pairs < 5000:
        warnings.append("âš ï¸ Low number of pairs. Results may be unreliable.")
    if config.enable_detector_loss and config.end_detector_efficiency < 0.3:
        warnings.append("âš ï¸ Very low detector efficiency.")
    if config.enable_satellite and config.enable_fiber_loss:
        warnings.append("â„¹ï¸ Both satellite and fiber loss enabled.")
    return warnings


def create_angle_preview(alice_angles, bob_angles):
    """Create live preview of measurement angles."""
    fig, ax = plt.subplots(figsize=(4, 4), subplot_kw=dict(projection='polar'))
    for i, angle in enumerate(alice_angles):
        ax.plot([angle, angle], [0, 0.8], 'b-', linewidth=2, alpha=0.7)
        ax.plot(angle, 0.8, 'bo', markersize=8)
        ax.text(angle, 0.9, f'A{i}', ha='center', fontsize=9, color='blue', fontweight='bold')
    for i, angle in enumerate(bob_angles):
        ax.plot([angle, angle], [0, 0.6], 'r--', linewidth=2, alpha=0.7)
        ax.plot(angle, 0.6, 'rs', markersize=8)
        ax.text(angle, 0.7, f'B{i}', ha='center', fontsize=9, color='red', fontweight='bold')
    ax.set_title('Measurement Angles', fontsize=10, fontweight='bold', pad=15)
    ax.grid(True, alpha=0.3)
    return fig


def create_loss_budget_preview(config: ExperimentConfig):
    """Create preview of expected loss budget."""
    loss_components, loss_values, colors = [], [], []
    if config.enable_fiber_loss:
        total_fiber = config.distance_km_A + config.distance_km_B
        fiber_loss = total_fiber * config.fiber_loss_dB_per_km
        # Apply simple repeater compensation in the preview if enabled
        if getattr(config, "enable_repeaters", False) and getattr(config, "num_repeaters", 0) > 0:
            fiber_loss = max(0.0, fiber_loss - config.num_repeaters * config.repeater_gain_dB)
        loss_components.append('Fiber')
        loss_values.append(fiber_loss)
        colors.append('orange')
    if config.enable_insertion_loss:
        loss_components.append('Insertion')
        loss_values.append(config.insertion_loss_dB)
        colors.append('coral')
    if config.enable_detector_loss:
        det_loss = -10 * np.log10(config.end_detector_efficiency)
        loss_components.append('Detector')
        loss_values.append(det_loss)
        colors.append('red')
    if config.enable_satellite:
        sat_loss = compute_satellite_loss(config)
        loss_components.append('Satellite')
        loss_values.append(sat_loss)
        colors.append('purple')
    if not loss_components:
        return None
    fig, ax = plt.subplots(figsize=(5, 3))
    ax.barh(loss_components, loss_values, color=colors, alpha=0.7, edgecolor='black')
    ax.set_xlabel('Loss (dB)', fontsize=9, fontweight='bold')
    ax.set_title('Expected Loss Budget', fontsize=10, fontweight='bold')
    ax.grid(axis='x', alpha=0.3)
    total_loss = sum(loss_values)
    ax.text(0.95, 0.05, f'Total: {total_loss:.1f} dB', transform=ax.transAxes, ha='right', 
            fontsize=9, bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.5))
    return fig


# ============================================================================
# E91 QUANTUM KEY DISTRIBUTION PROTOCOL
# ============================================================================
# Core implementation of the E91 protocol using entangled photon pairs.
# Supports both Qiskit (circuit-based) and QuTiP (density matrix) backends.
#
# Protocol Flow:
#   1. Generate entangled Bell pairs
#   2. Alice and Bob measure with random basis choices
#   3. Apply physical losses and noise models
#   4. Sift keys by matching bases
#   5. Estimate QBER via parameter estimation
#   6. Calculate CHSH inequality for security verification
#   7. Perform privacy amplification to extract secret key
# ============================================================================

class E91Protocol:
    """
    E91 Quantum Key Distribution Protocol Implementation.

    This class handles the complete E91 protocol simulation including:
    - Bell state preparation (Phi+, Phi-, Psi+, Psi-)
    - Quantum measurements with configurable angles
    - Physical channel losses (fiber, detectors, etc.)
    - Noise models (depolarizing, visibility, etc.)
    - QBER estimation and CHSH violation calculation
    - Secret key extraction with finite-size effects
    """
    def __init__(self, config: ExperimentConfig):
        self.config = config
        self.rng = np.random.RandomState(config.seed)
        if config.backend == "qiskit" and QISKIT_AVAILABLE:
            self.simulator = AerSimulator(method='statevector')
            self.use_qiskit = True
        elif config.backend == "qutip" and QUTIP_AVAILABLE:
            self.use_qiskit = False
        else:
            raise RuntimeError(f"Backend {config.backend} not available")

    def run(self, progress_callback=None) -> ExperimentResults:
        """Run the E91 protocol."""
        start_time = time.time()
        
        # Generate measurements
        if progress_callback: progress_callback(0.1, "Generating measurements...")
        alice_bases, bob_bases, alice_results, bob_results = self._generate_measurements()
        
        
        # Eve (eavesdropper)
        if self.config.enable_eavesdropper:
            alice_results, bob_results, eve_count = self._apply_eavesdropper(alice_bases, bob_bases, alice_results, bob_results)
        else:
            eve_count = None
        
        # Time tags
        if progress_callback: progress_callback(0.3, "Generating time tags...")
        time_tags_alice, time_tags_bob = (self._generate_time_tags(len(alice_results)) 
                                          if self.config.enable_time_tagging else (None, None))
        
        # Apply losses
        if progress_callback: progress_callback(0.5, "Applying losses...")
        alice_results, bob_results, alice_bases, bob_bases, time_tags_alice, time_tags_bob = \
            self._apply_losses(alice_results, bob_results, alice_bases, bob_bases, 
                             time_tags_alice, time_tags_bob)
        
        num_detected = len(alice_results)
        detection_eff = num_detected / self.config.num_pairs
        
        # Coincidence stats
        if progress_callback: progress_callback(0.7, "Computing statistics...")
        avg_delay, car = (self._compute_coincidence_stats(time_tags_alice, time_tags_bob) 
                         if self.config.enable_time_tagging and time_tags_alice is not None 
                         else (None, None))
        
        # Sift keys
        if progress_callback: progress_callback(0.8, "Sifting keys...")
        sifted_alice, sifted_bob = self._sift_keys(alice_results, bob_results, alice_bases, bob_bases)
        num_sifted = len(sifted_alice)
        sifting_eff = num_sifted / num_detected if num_detected > 0 else 0
        
        # Parameter estimation and key generation
        if progress_callback: progress_callback(0.9, "Computing key rates...")
        # Split sifted bits into parameter-estimation sample and key block.
        if num_sifted > 1 and self.config.pe_fraction > 0:
            n_pe = max(1, int(num_sifted * self.config.pe_fraction))
            n_pe = min(n_pe, num_sifted - 1)
        else:
            n_pe = 0
        if n_pe > 0:
            pe_alice = sifted_alice[:n_pe]
            pe_bob = sifted_bob[:n_pe]
            key_alice = sifted_alice[n_pe:]
            key_bob = sifted_bob[n_pe:]
        else:
            pe_alice = np.array([], dtype=int)
            pe_bob = np.array([], dtype=int)
            key_alice = sifted_alice
            key_bob = sifted_bob
        n_key = len(key_alice)

        # QBER estimate: use parameter-estimation sample when available,
        # otherwise fall back to the key block.
        if n_pe > 0:
            pe_errors = np.sum(pe_alice != pe_bob)
            qber = pe_errors / n_pe if n_pe > 0 else 0.5
        else:
            key_errors = np.sum(key_alice != key_bob)
            qber = key_errors / n_key if n_key > 0 else 0.5

        chsh_S, correlators = self._compute_chsh(alice_results, bob_results, alice_bases, bob_bases)
        
        # Secret fractions
        h_qber = binary_entropy(qber)
        secret_frac_asymp = max(0, 1 - self.config.f_EC * h_qber)
        delta = np.sqrt(np.log(2/self.config.epsilon_sec) / (2 * n_pe)) if n_pe > 0 else 0
        qber_corrected = min(0.5, qber + delta)
        h_qber_corr = binary_entropy(qber_corrected)
        ir_efficiency = 1.0 if self.config.ir_protocol == "BBBSS" else 1.1
        ec_leakage = self.config.f_EC * n_key * h_qber_corr * ir_efficiency
        pa_consumed = ec_leakage + np.log2(1/self.config.epsilon_sec) + np.log2(1/self.config.epsilon_cor)
        final_key_bits = max(0, int((n_key - pa_consumed) * self.config.code_rate))
        secret_frac_finite = final_key_bits / num_sifted if num_sifted > 0 else 0
        
        # Key rates
        key_rate_asymp = secret_frac_asymp * sifting_eff
        key_rate_finite = secret_frac_finite * sifting_eff
        
        # Routed DI
        routed_di_witness, combined_eff = None, None
        if self.config.enable_routed_di:
            eta_routing = self.config.routing_efficiency_f * self.config.routing_efficiency_d
            combined_eff = detection_eff * eta_routing
            routed_di_witness = chsh_S / (2 * np.sqrt(2 * combined_eff))
        
        # Multi-pair
        multi_pair_events = self._count_multi_pair_events() if self.config.enable_multi_pair else None
        
        execution_time = time.time() - start_time
        if progress_callback: progress_callback(1.0, "Complete!")
        
        return ExperimentResults(
            num_pairs_generated=self.config.num_pairs, num_pairs_detected=num_detected,
            detection_efficiency=detection_eff, num_sifted=num_sifted,
            sifting_efficiency=sifting_eff, qber=qber, chsh_S=chsh_S,
            num_key_bits=final_key_bits, secret_fraction_asymptotic=secret_frac_asymp,
            secret_fraction_finite=secret_frac_finite, key_rate_asymptotic=key_rate_asymp,
            key_rate_finite=key_rate_finite, correlators=correlators,
            routed_di_witness=routed_di_witness, combined_efficiency=combined_eff,
            avg_coincidence_delay_ns=avg_delay, coincidence_accidental_ratio=car,
            multi_pair_events=multi_pair_events, alice_results=alice_results.tolist(),
            bob_results=bob_results.tolist(), sifted_alice=key_alice.tolist(),
            sifted_bob=key_bob.tolist(),
            time_tags_alice=time_tags_alice.tolist() if time_tags_alice is not None else None,
            time_tags_bob=time_tags_bob.tolist() if time_tags_bob is not None else None,
            execution_time=execution_time,
            eve_intercepted=eve_count
        )

    def _generate_measurements(self):
        """Generate Bell pair measurements."""
        n = self.config.num_pairs
        alice_bases = (self.rng.choice(3, n, p=self.config.alice_basis_probs) 
                      if self.config.alice_basis_probs else self.rng.randint(0, 3, n))
        bob_bases = (self.rng.choice(3, n, p=self.config.bob_basis_probs) 
                    if self.config.bob_basis_probs else self.rng.randint(0, 3, n))
        alice_results = np.zeros(n, dtype=int)
        bob_results = np.zeros(n, dtype=int)
        
        if self.use_qiskit:
            for ai in range(3):
                for bj in range(3):
                    mask = (alice_bases == ai) & (bob_bases == bj)
                    m = int(np.sum(mask))
                    if m == 0:
                        continue
                    angle_A, angle_B = self.config.alice_angles[ai], self.config.bob_angles[bj]
                    qc = QuantumCircuit(2, 2)
                    # Prepare |Phi+> Bell state
                    qc.h(0)
                    qc.cx(0, 1)
                    # Adjust to selected Bell state via local unitaries
                    bell = getattr(self.config, "bell_state", "phi_plus")
                    if bell == "phi_minus":
                        qc.z(1)
                    elif bell == "psi_plus":
                        qc.x(1)
                    elif bell == "psi_minus":
                        qc.x(1)
                        qc.z(1)
                    # Apply measurement rotations
                    qc.ry(-2 * angle_A, 0)
                    qc.ry(-2 * angle_B, 1)
                    qc.measure([0, 1], [0, 1])
                    result = self.simulator.run(
                        qc,
                        shots=m,
                        seed_simulator=int(self.rng.randint(0, 2**31)),
                    ).result()
                    counts = result.get_counts()
                    outcomes = []
                    for bitstr, c in counts.items():
                        outcomes.extend([bitstr] * c)
                    self.rng.shuffle(outcomes)
                    idxs = np.flatnonzero(mask)
                    for k, s in enumerate(outcomes):
                        bob_results[idxs[k]] = int(s[0])
                        alice_results[idxs[k]] = int(s[1])
        else:
            for i in range(n):
                angle_A = self.config.alice_angles[alice_bases[i]]
                angle_B = self.config.bob_angles[bob_bases[i]]
                delta = angle_A - angle_B
                prob_00 = 0.5 * np.cos(delta) ** 2
                prob_11 = prob_00
                prob_01 = 0.5 * np.sin(delta) ** 2
                prob_10 = prob_01
                outcome = self.rng.choice(4, p=[prob_00, prob_01, prob_10, prob_11])
                alice_results[i] = outcome // 2
                bob_results[i] = outcome % 2
        
        return alice_bases, bob_bases, alice_results, bob_results

    def _apply_eavesdropper(self, alice_bases, bob_bases, alice_results, bob_results):
        """Apply a simple Eve model (intercept-resend).
        With probability `eve_intercept_prob`, Bob's bit is flipped with
        probability 0.25 to approximate disturbance when Eve measures in a
        random basis and resends.
        Returns updated arrays and the number of intercepted pairs.
        """
        n = len(alice_results)
        if n == 0 or self.config.eve_intercept_prob <= 0:
            return alice_results, bob_results, 0
        mask = self.rng.random(n) < float(self.config.eve_intercept_prob)
        if self.config.eve_model == "intercept_resend":
            flip = (self.rng.random(n) < 0.25) & mask
            bob_results = np.where(flip, 1 - bob_results, bob_results)
        else:
            flip = (self.rng.random(n) < (0.1 * float(self.config.eve_intercept_prob))) & mask
            bob_results = np.where(flip, 1 - bob_results, bob_results)
        return alice_results, bob_results, int(np.sum(mask))

    def _generate_time_tags(self, n: int):
        """Generate time tags."""
        period = 1.0 / self.config.repetition_rate_Hz * 1e9
        ideal_times = np.arange(n) * period
        jitter_A = (self.rng.normal(0, self.config.jitter_ns, n) 
                   if self.config.enable_timing_jitter else np.zeros(n))
        jitter_B = (self.rng.normal(0, self.config.jitter_ns, n) 
                   if self.config.enable_timing_jitter else np.zeros(n))
        return ideal_times + jitter_A, ideal_times + jitter_B

    def _apply_losses(self, alice_results, bob_results, alice_bases, bob_bases, 
                     time_tags_A=None, time_tags_B=None):
        """Apply all loss mechanisms."""
        n = len(alice_results)
        valid = np.ones(n, dtype=bool)
        
        # Depolarizing noise
        if self.config.enable_depolarizing_noise:
            alpha = self.config.depolarizing_alpha
            flip_prob = alpha / 4
            for arr in [alice_results, bob_results]:
                flip_mask = self.rng.random(n) < flip_prob
                arr[:] = np.where(flip_mask, 1 - arr, arr)
            flip_ZZ = self.rng.random(n) < flip_prob
            alice_results = np.where(flip_ZZ, 1 - alice_results, alice_results)
            bob_results = np.where(flip_ZZ, 1 - bob_results, bob_results)
        
        # Visibility reduction
        if self.config.enable_visibility_reduction:
            noise_prob = (1 - self.config.visibility) / 2
            random_mask = self.rng.random(n) < noise_prob
            alice_results = np.where(random_mask, self.rng.randint(0, 2, n), alice_results)
            bob_results = np.where(random_mask, self.rng.randint(0, 2, n), bob_results)
        
        # Intrinsic errors
        if self.config.enable_intrinsic_error:
            for arr in [alice_results, bob_results]:
                flip_mask = self.rng.random(n) < self.config.intrinsic_error_ed
                arr[:] = np.where(flip_mask, 1 - arr, arr)
        
        # Fiber loss (optionally mitigated by repeaters)
        if self.config.enable_fiber_loss:
            loss_dB_A = self.config.distance_km_A * self.config.fiber_loss_dB_per_km + self.config.loss_dB_A
            loss_dB_B = self.config.distance_km_B * self.config.fiber_loss_dB_per_km + self.config.loss_dB_B
            # Simple repeater model: each repeater provides repeater_gain_dB of loss compensation
            if getattr(self.config, "enable_repeaters", False) and getattr(self.config, "num_repeaters", 0) > 0:
                total_gain = self.config.num_repeaters * self.config.repeater_gain_dB
                loss_dB_A = max(0.0, loss_dB_A - total_gain)
                loss_dB_B = max(0.0, loss_dB_B - total_gain)
            eta_A = 10 ** (-loss_dB_A / 10)
            eta_B = 10 ** (-loss_dB_B / 10)
            valid &= (self.rng.random(n) < eta_A) & (self.rng.random(n) < eta_B)
        
        # Satellite loss
        if self.config.enable_satellite:
            sat_loss_dB = compute_satellite_loss(self.config)
            eta_sat = 10 ** (-sat_loss_dB / 10)
            valid &= self.rng.random(n) < eta_sat
        
        # Insertion loss
        if self.config.enable_insertion_loss:
            eta_ins = 10 ** (-self.config.insertion_loss_dB / 10)
            valid &= self.rng.random(n) < eta_ins
        
        # Misalignment
        if self.config.enable_misalignment:
            drift_rad = np.deg2rad(self.config.polarization_drift_deg)
            eta_alignment = np.cos(drift_rad)**2
            valid &= self.rng.random(n) < eta_alignment
        
        # Detector efficiency
        if self.config.enable_detector_loss:
            valid &= self.rng.random(n) < self.config.heralding_efficiency
            eta_det = self.config.end_detector_efficiency
            valid &= (self.rng.random(n) < eta_det) & (self.rng.random(n) < eta_det)
        
        # Deadtime
        if self.config.enable_deadtime and time_tags_A is not None:
            deadtime_ns = self.config.deadtime_ns
            valid_A, valid_B = np.ones(n, dtype=bool), np.ones(n, dtype=bool)
            for i in range(1, n):
                if valid[i-1]:
                    if time_tags_A[i] - time_tags_A[i-1] < deadtime_ns:
                        valid_A[i] = False
                    if time_tags_B[i] - time_tags_B[i-1] < deadtime_ns:
                        valid_B[i] = False
            valid &= valid_A & valid_B
        
        # Saturation
        if self.config.enable_saturation:
            if self.config.repetition_rate_Hz > self.config.saturation_rate:
                saturation_prob = self.config.saturation_rate / self.config.repetition_rate_Hz
                valid &= self.rng.random(n) < saturation_prob
        
        # Dark counts
        if self.config.enable_dark_counts:
            dark_prob = (self.config.dark_cps / self.config.repetition_rate_Hz 
                        if self.config.use_dark_cps else self.config.dark_prob)
            dark_prob = float(np.clip(dark_prob, 0.0, 1.0))
            dark_A, dark_B = self.rng.random(n) < dark_prob, self.rng.random(n) < dark_prob
            alice_results = np.where(dark_A & valid, self.rng.randint(0, 2, n), alice_results)
            bob_results = np.where(dark_B & valid, self.rng.randint(0, 2, n), bob_results)
        
        # Afterpulsing
        if self.config.enable_afterpulsing and time_tags_A is not None:
            afterpulse_A = self.rng.random(n) < self.config.afterpulsing_prob
            afterpulse_B = self.rng.random(n) < self.config.afterpulsing_prob
            alice_results = np.where(afterpulse_A & valid, self.rng.randint(0, 2, n), alice_results)
            bob_results = np.where(afterpulse_B & valid, self.rng.randint(0, 2, n), bob_results)
        
        # Background
        if self.config.enable_background:
            bg_prob = (self.config.background_cps / self.config.repetition_rate_Hz 
                      if self.config.use_dark_cps else self.config.Y0)
            bg_prob = float(np.clip(bg_prob, 0.0, 1.0))
            bg_A, bg_B = self.rng.random(n) < bg_prob, self.rng.random(n) < bg_prob
            alice_results = np.where(bg_A & valid, self.rng.randint(0, 2, n), alice_results)
            bob_results = np.where(bg_B & valid, self.rng.randint(0, 2, n), bob_results)
        
        # Satellite background
        if self.config.enable_satellite and self.config.is_daytime:
            sat_bg_prob = self.config.satellite_background_cps / self.config.repetition_rate_Hz
            sat_bg_prob = float(np.clip(sat_bg_prob, 0.0, 1.0))
            sat_bg = self.rng.random(n) < sat_bg_prob
            alice_results = np.where(sat_bg & valid, self.rng.randint(0, 2, n), alice_results)
            bob_results = np.where(sat_bg & valid, self.rng.randint(0, 2, n), bob_results)
        
        filtered = (alice_results[valid], bob_results[valid], alice_bases[valid], bob_bases[valid])
        if time_tags_A is not None:
            return (*filtered, time_tags_A[valid], time_tags_B[valid])
        return (*filtered, None, None)

    def _sift_keys(self, alice_results, bob_results, alice_bases, bob_bases):
        """Sift for matching bases."""
        match_mask = np.zeros(len(alice_results), dtype=bool)
        for alice_idx, bob_idx, purpose in self.config.basis_mapping:
            if purpose == "key":
                match_mask |= (alice_bases == alice_idx) & (bob_bases == bob_idx)
        return alice_results[match_mask], bob_results[match_mask]

    def _compute_chsh(self, alice_results, bob_results, alice_bases, bob_bases):
        """Compute CHSH parameter."""
        correlators = {}
        for i in range(3):
            for j in range(3):
                mask = (alice_bases == i) & (bob_bases == j)
                if np.sum(mask) > 0:
                    a_pm = 2 * alice_results[mask] - 1
                    b_pm = 2 * bob_results[mask] - 1
                    correlators[f'E_{i}{j}'] = np.mean(a_pm * b_pm)
        E_00 = correlators.get('E_00', 0)
        E_02 = correlators.get('E_02', 0)
        E_20 = correlators.get('E_20', 0)
        E_22 = correlators.get('E_22', 0)
        S = abs(E_00 - E_02 + E_20 + E_22)
        return S, correlators

    def _compute_coincidence_stats(self, time_tags_A, time_tags_B):
        """Compute coincidence delay and CAR."""
        if time_tags_A is None or len(time_tags_A) < 2 or len(time_tags_B) < 2:
            return None, None
        duration_A, duration_B = time_tags_A[-1] - time_tags_A[0], time_tags_B[-1] - time_tags_B[0]
        if duration_A <= 0 or duration_B <= 0:
            return None, None
        delays = np.abs(time_tags_A - time_tags_B)
        avg_delay = np.mean(delays)
        tau_c = self.config.coincidence_window_ns
        coincidences = np.sum(delays < tau_c)
        rate_A = len(time_tags_A) / duration_A * 1e9
        rate_B = len(time_tags_B) / duration_B * 1e9
        accidentals = rate_A * rate_B * tau_c * 1e-9 * max(duration_A, duration_B) * 1e-9
        car = coincidences / max(accidentals, 1.0)
        return avg_delay, car

    def _count_multi_pair_events(self):
        """Count multi-pair events."""
        if not self.config.enable_multi_pair:
            return 0
        return sum(1 for _ in range(self.config.num_pairs) if self.rng.poisson(self.config.spdc_brightness_mu) > 1)


# ============================================================================
# PARAMETRIC SWEEP
# ============================================================================

def run_parameter_sweep(base_config, param_name, param_values, progress_callback=None):
    """Run parametric sweep."""
    import copy
    results = []
    for i, val in enumerate(param_values):
        config = copy.deepcopy(base_config)
        setattr(config, param_name, val)
        if param_name == 'distance_km_A':
            config.distance_km_B = val
        if progress_callback:
            progress_callback((i + 1) / len(param_values), 
                            f"Sweep {i+1}/{len(param_values)}: {param_name}={val:.4f}")
        protocol = E91Protocol(config)
        result = protocol.run()
        results.append((val, result))
    return results


def create_sweep_plots(sweep_results, param_name, param_label=None):
    """Create sweep plots."""
    if param_label is None:
        param_label = param_name.replace('_', ' ').title()
    param_vals = [val for val, _ in sweep_results]
    qber_vals = [r.qber for _, r in sweep_results]
    chsh_vals = [r.chsh_S for _, r in sweep_results]
    key_rate_asymp = [r.key_rate_asymptotic for _, r in sweep_results]
    key_rate_finite = [r.key_rate_finite for _, r in sweep_results]
    detection_eff = [r.detection_efficiency for _, r in sweep_results]
    
    plots = {}
    
    # Plot 1: S vs QBER
    fig1, ax1 = plt.subplots(figsize=(8, 6))
    scatter = ax1.scatter(qber_vals, chsh_vals, c=param_vals, cmap='viridis',
                         s=100, edgecolor='black', linewidth=1.5, alpha=0.8)
    ax1.axhline(y=2.0, color='red', linestyle='--', linewidth=2, label='Classical Bound')
    ax1.axhline(y=2*np.sqrt(2), color='green', linestyle='--', linewidth=2, label='Quantum Max')
    ax1.axvline(x=0.11, color='orange', linestyle='--', linewidth=2, label='QBER Threshold')
    ax1.set_xlabel('QBER', fontsize=12, fontweight='bold')
    ax1.set_ylabel('CHSH S', fontsize=12, fontweight='bold')
    ax1.set_title('CHSH S vs QBER', fontsize=14, fontweight='bold')
    ax1.grid(True, alpha=0.3)
    ax1.legend()
    plt.colorbar(scatter, ax=ax1, label=param_label)
    plt.tight_layout()
    plots['s_vs_qber'] = fig1
    
    # Plot 2: Key Rate vs QBER
    fig2, ax2 = plt.subplots(figsize=(8, 6))
    ax2.plot(qber_vals, key_rate_asymp, 'bo-', linewidth=2, label='Asymptotic', alpha=0.7)
    ax2.plot(qber_vals, key_rate_finite, 'rs-', linewidth=2, label='Finite-Key', alpha=0.7)
    ax2.axvline(x=0.11, color='orange', linestyle='--', linewidth=2, label='QBER Threshold')
    ax2.set_xlabel('QBER', fontsize=12, fontweight='bold')
    ax2.set_ylabel('Key Rate', fontsize=12, fontweight='bold')
    ax2.set_title('Key Rate vs QBER', fontsize=14, fontweight='bold')
    ax2.grid(True, alpha=0.3)
    ax2.legend()
    plt.tight_layout()
    plots['keyrate_vs_qber'] = fig2
    
    # Plot 3: Key Rate vs Parameter
    fig3, ax3 = plt.subplots(figsize=(8, 6))
    ax3.plot(param_vals, key_rate_asymp, 'bo-', linewidth=2, label='Asymptotic', alpha=0.7)
    ax3.plot(param_vals, key_rate_finite, 'rs-', linewidth=2, label='Finite-Key', alpha=0.7)
    ax3.set_xlabel(param_label, fontsize=12, fontweight='bold')
    ax3.set_ylabel('Key Rate', fontsize=12, fontweight='bold')
    ax3.set_title(f'Key Rate vs {param_label}', fontsize=14, fontweight='bold')
    ax3.grid(True, alpha=0.3)
    ax3.legend()
    plt.tight_layout()
    plots['keyrate_vs_param'] = fig3
    
    # Plot 4: CHSH vs Parameter
    fig4, ax4 = plt.subplots(figsize=(8, 6))
    ax4.plot(param_vals, chsh_vals, 'go-', linewidth=2, alpha=0.7)
    ax4.axhline(y=2.0, color='red', linestyle='--', linewidth=2, label='Classical Bound')
    ax4.set_xlabel(param_label, fontsize=12, fontweight='bold')
    ax4.set_ylabel('CHSH S', fontsize=12, fontweight='bold')
    ax4.set_title(f'CHSH S vs {param_label}', fontsize=14, fontweight='bold')
    ax4.grid(True, alpha=0.3)
    ax4.legend()
    plt.tight_layout()
    plots['chsh_vs_param'] = fig4
    
    # Plot 5: Detection Efficiency
    fig5, ax5 = plt.subplots(figsize=(8, 6))
    ax5.plot(param_vals, detection_eff, 'mo-', linewidth=2, alpha=0.7)
    ax5.set_xlabel(param_label, fontsize=12, fontweight='bold')
    ax5.set_ylabel('Detection Efficiency', fontsize=12, fontweight='bold')
    ax5.set_title(f'Detection Efficiency vs {param_label}', fontsize=14, fontweight='bold')
    ax5.grid(True, alpha=0.3)
    plt.tight_layout()
    plots['detection_vs_param'] = fig5
    
    return plots


# ============================================================================
# MESSAGE TESTING
# ============================================================================

def message_to_bits(message: str) -> List[int]:
    """Convert message to bits."""
    bits = []
    for byte in message.encode('utf-8'):
        for i in range(8):
            bits.append((byte >> (7 - i)) & 1)
    return bits


def bits_to_message(bits: List[int]) -> str:
    """Convert bits to message."""
    while len(bits) % 8 != 0:
        bits.append(0)
    byte_array = bytearray()
    for i in range(0, len(bits), 8):
        byte_val = sum((bits[i + j] << (7 - j)) for j in range(8) if i + j < len(bits))
        byte_array.append(byte_val)
    return byte_array.decode('utf-8', errors='ignore')


def xor_encrypt_decrypt(message_bits: List[int], key_bits: List[int]) -> List[int]:
    """XOR encryption/decryption."""
    if len(key_bits) < len(message_bits):
        raise ValueError(f"Key too short: need {len(message_bits)}, have {len(key_bits)}")
    return [message_bits[i] ^ key_bits[i] for i in range(len(message_bits))]


# ============================================================================
# MESSAGE ENCRYPTION/DECRYPTION FUNCTIONS
# ============================================================================
# One-Time Pad (OTP) encryption using QKD-generated keys.
# Demonstrates practical use of quantum keys for secure communication.
# ============================================================================

def test_self_message(message: str, quantum_key: List[int]) -> MessageTest:
    """
    Self-test message encryption (loopback test).
    Encrypts and decrypts with the same key to verify the OTP mechanism.

    Args:
        message: Plain text message to encrypt
        quantum_key: QKD-generated key bits

    Returns:
        MessageTest result with encryption/decryption details
    """
    start_time = time.time()
    try:
        message_bits = message_to_bits(message)
        if len(quantum_key) < len(message_bits):
            return MessageTest("self_test", message, b"", "", [], len(quantum_key), 
                             "One-Time Pad", False, 
                             f"Key too short: need {len(message_bits)}, have {len(quantum_key)}", 
                             time.time() - start_time)
        key_subset = quantum_key[:len(message_bits)]
        encrypted_bits = xor_encrypt_decrypt(message_bits, key_subset)
        encrypted_bytes = bytearray(sum((encrypted_bits[i + j] << (7 - j)) 
                                       for j in range(8)) 
                                   for i in range(0, len(encrypted_bits), 8))
        decrypted_bits = xor_encrypt_decrypt(encrypted_bits, key_subset)
        decrypted_message = bits_to_message(decrypted_bits)
        return MessageTest("self_test", message, bytes(encrypted_bytes), decrypted_message, 
                         key_subset, len(key_subset), "One-Time Pad", 
                         decrypted_message == message, None, time.time() - start_time)
    except Exception as e:
        return MessageTest("self_test", message, b"", "", [], 0, "One-Time Pad", 
                         False, str(e), time.time() - start_time)


def test_two_party_message(message: str, alice_key: List[int], bob_key: List[int]) -> MessageTest:
    """Two-party message test."""
    start_time = time.time()
    try:
        message_bits = message_to_bits(message)
        min_key_len = min(len(alice_key), len(bob_key))
        if min_key_len < len(message_bits):
            return MessageTest("two_party", message, b"", "", [], min_key_len, 
                             "One-Time Pad", False, 
                             f"Keys too short: need {len(message_bits)}, have {min_key_len}",
                             time.time() - start_time, alice_key, bob_key)
        alice_key_subset = alice_key[:len(message_bits)]
        bob_key_subset = bob_key[:len(message_bits)]
        mismatches = [i for i in range(len(message_bits)) 
                     if alice_key_subset[i] != bob_key_subset[i]]
        encrypted_bits = xor_encrypt_decrypt(message_bits, alice_key_subset)
        encrypted_bytes = bytearray(sum((encrypted_bits[i + j] << (7 - j)) 
                                       for j in range(8)) 
                                   for i in range(0, len(encrypted_bits), 8))
        decrypted_bits = xor_encrypt_decrypt(encrypted_bits, bob_key_subset)
        decrypted_message = bits_to_message(decrypted_bits)
        success = (decrypted_message == message)
        error_msg = (f"Key mismatch at {len(mismatches)} positions" 
                    if not success and len(mismatches) > 0 else None)
        return MessageTest("two_party", message, bytes(encrypted_bytes), decrypted_message,
                         alice_key_subset, len(alice_key_subset), "One-Time Pad", success,
                         error_msg, time.time() - start_time, alice_key_subset, 
                         bob_key_subset, mismatches)
    except Exception as e:
        return MessageTest("two_party", message, b"", "", [], 0, "One-Time Pad", 
                         False, str(e), time.time() - start_time, alice_key, bob_key)


def listener_receive_message(encrypted_message: bytes, bob_key: List[int]) -> MessageTest:
    """Listener receives and decrypts message."""
    start_time = time.time()
    try:
        encrypted_bits = [((byte >> (7 - i)) & 1) for byte in encrypted_message for i in range(8)]
        if len(bob_key) < len(encrypted_bits):
            return MessageTest("listener", "[Unknown]", encrypted_message, "", [], len(bob_key),
                             "One-Time Pad", False, f"Insufficient key", time.time() - start_time)
        key_subset = bob_key[:len(encrypted_bits)]
        decrypted_bits = xor_encrypt_decrypt(encrypted_bits, key_subset)
        decrypted_message = bits_to_message(decrypted_bits)
        return MessageTest("listener", "[Unknown]", encrypted_message, decrypted_message,
                         key_subset, len(key_subset), "One-Time Pad", True, None,
                         time.time() - start_time, bob_key=key_subset)
    except Exception as e:
        return MessageTest("listener", "[Unknown]", encrypted_message, "", [], 0,
                         "One-Time Pad", False, str(e), time.time() - start_time)


# ============================================================================
# VISUALIZATION
# ============================================================================

def create_results_plots(config: ExperimentConfig, results: ExperimentResults):
    """Create results visualization with clean, consistent labels and legends."""
    fig = plt.figure(figsize=(20, 14), constrained_layout=False)
    gs = fig.add_gridspec(3, 3, hspace=0.5, wspace=0.4, top=0.95, bottom=0.05, left=0.05, right=0.95)

    # CHSH Parameter
    ax1 = fig.add_subplot(gs[0, 0])
    ax1.bar(
        ['Measured', 'Classical\nBound', 'Quantum\nMax'],
        [results.chsh_S, CHSH_CLASSICAL_BOUND, CHSH_QUANTUM_MAX],
        color=['#3b82f6', '#ef4444', '#22c55e'], alpha=0.8, edgecolor='black', linewidth=1.5,
    )
    ax1.set_ylabel('CHSH S', fontsize=11, fontweight='bold')
    ax1.set_title('Bell Test Result', fontsize=12, fontweight='bold')
    ax1.grid(axis='y', alpha=0.3)
    ax1.axhline(y=CHSH_CLASSICAL_BOUND, color='red', linestyle='--', linewidth=2, label='Classical bound (2.0)')
    ax1.legend(fontsize=9, loc='upper right')

    # QBER
    ax2 = fig.add_subplot(gs[0, 1])
    qber_percent = results.qber * 100
    threshold_percent = QBER_THRESHOLD * 100
    q_color = '#10b981' if qber_percent < threshold_percent else '#f59e0b'
    ax2.bar(['QBER'], [qber_percent], color=q_color, alpha=0.8, edgecolor='black', linewidth=1.5)
    ax2.axhline(y=threshold_percent, color='red', linestyle='--', linewidth=2, label='Threshold')
    ax2.set_ylabel('QBER (%)', fontsize=11, fontweight='bold')
    ax2.set_title('Quantum Bit Error Rate', fontsize=12, fontweight='bold')
    ax2.legend(fontsize=9, loc='upper right')
    ax2.grid(axis='y', alpha=0.3)

    # Efficiency Pipeline
    ax3 = fig.add_subplot(gs[0, 2])
    stages = ['Generated', 'Detected', 'Sifted', 'Final Key']
    counts = [
        results.num_pairs_generated,
        results.num_pairs_detected,
        results.num_sifted,
        results.num_key_bits,
    ]
    colors_pipeline = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444']
    ax3.bar(stages, counts, color=colors_pipeline, alpha=0.8, edgecolor='black', linewidth=1.5)
    ax3.set_ylabel('Number of Bits', fontsize=11, fontweight='bold')
    ax3.set_title('Key Generation Pipeline', fontsize=12, fontweight='bold')
    ax3.grid(axis='y', alpha=0.3)
    ax3.tick_params(axis='x', rotation=15)
    for i, count in enumerate(counts):
        pct = (count / max(results.num_pairs_generated, 1)) * 100
        ax3.text(i, count, f'{pct:.1f}%', ha='center', va='bottom', fontsize=8, fontweight='bold')

    # Secret Fractions
    ax4 = fig.add_subplot(gs[1, 0])
    ax4.bar(
        ['Asymptotic', 'Finite-Key'],
        [results.secret_fraction_asymptotic, results.secret_fraction_finite],
        color=['#93c5fd', '#60a5fa'], alpha=0.9, edgecolor='black', linewidth=1.2,
    )
    ax4.set_ylabel('Secret Fraction', fontsize=11, fontweight='bold')
    ax4.set_title('Secret Key Fractions', fontsize=12, fontweight='bold')
    ax4.set_ylim(0, 1)
    ax4.grid(axis='y', alpha=0.3)

    # Key Rates
    ax5 = fig.add_subplot(gs[1, 1])
    ax5.bar(
        ['Asymptotic', 'Finite-Key'],
        [results.key_rate_asymptotic, results.key_rate_finite],
        color=['#fda4af', '#fb7185'], alpha=0.9, edgecolor='black', linewidth=1.2,
    )
    ax5.set_ylabel('Key Rate (bits/pair)', fontsize=11, fontweight='bold')
    ax5.set_title('Key Rates', fontsize=12, fontweight='bold')
    ax5.grid(axis='y', alpha=0.3)

    # Correlators Heatmap
    ax6 = fig.add_subplot(gs[1, 2])
    corr_matrix = np.zeros((3, 3))
    for i in range(3):
        for j in range(3):
            corr_matrix[i, j] = results.correlators.get(f'E_{i}{j}', 0)
    im = ax6.imshow(corr_matrix, cmap='RdBu', vmin=-1, vmax=1, aspect='auto')
    ax6.set_xticks([0, 1, 2])
    ax6.set_yticks([0, 1, 2])
    ax6.set_xticklabels(['Bob 0', 'Bob 1', 'Bob 2'])
    ax6.set_yticklabels(['Alice 0', 'Alice 1', 'Alice 2'])
    ax6.set_title('Measurement Correlators', fontsize=12, fontweight='bold')
    for i in range(3):
        for j in range(3):
            ax6.text(j, i, f'{corr_matrix[i, j]:.2f}', ha='center', va='center', color='black', fontsize=9, fontweight='bold')
    plt.colorbar(im, ax=ax6, label='Correlation E(a_i, b_j)', fraction=0.046)

    # Measurement Angles
    ax7 = fig.add_subplot(gs[2, 0], projection='polar')
    for angle in config.alice_angles:
        ax7.plot([angle, angle], [0, 0.8], 'b-', linewidth=3, alpha=0.8)
        ax7.plot(angle, 0.8, 'bo', markersize=10)
    for angle in config.bob_angles:
        ax7.plot([angle, angle], [0, 0.6], 'r--', linewidth=3, alpha=0.8)
        ax7.plot(angle, 0.6, 'rs', markersize=10)
    ax7.set_title('Measurement Angles', fontsize=12, fontweight='bold', pad=20)
    ax7.legend(['Alice', 'Bob'], loc='upper right', bbox_to_anchor=(1.3, 1.1), fontsize=9)

    # Summary Statistics (ASCII-only text to avoid encoding issues)
    ax8 = fig.add_subplot(gs[2, 1])
    ax8.axis('off')
    summary_text = (
        "EXPERIMENT SUMMARY\n\n"
        f"Generated: {results.num_pairs_generated:,}\n"
        f"Detected: {results.num_pairs_detected:,}\n"
        f"Detection eta: {results.detection_efficiency*100:.2f}%\n\n"
        f"Sifted: {results.num_sifted:,}\n"
        f"Sifting eta: {results.sifting_efficiency*100:.2f}%\n\n"
        f"QBER: {results.qber*100:.3f}%\n"
        f"CHSH S: {results.chsh_S:.4f}\n"
        f"Bell: {'YES' if results.chsh_S > CHSH_CLASSICAL_BOUND else 'NO'}\n\n"
        f"Final Key: {results.num_key_bits:,}\n"
        f"Rate (F): {results.key_rate_finite:.6f}\n\n"
        f"Runtime: {results.execution_time:.2f}s\n"
    )
    ax8.text(
        0.1,
        0.95,
        summary_text,
        transform=ax8.transAxes,
        fontsize=9,
        verticalalignment='top',
        fontfamily='monospace',
        bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.5),
    )

    # Security card
    ax9 = fig.add_subplot(gs[2, 2])
    ax9.axis('off')
    is_secure = (results.chsh_S > CHSH_CLASSICAL_BOUND) and (results.qber < QBER_THRESHOLD)
    status = 'SECURE' if is_secure else 'INSECURE'
    quality_text = (
        "SECURITY ASSESSMENT\n\n"
        f"Status: {status}\n\n"
        f"Bell Test: {'PASS' if results.chsh_S > CHSH_CLASSICAL_BOUND else 'FAIL'}\n"
        f"QBER Test: {'PASS' if results.qber < QBER_THRESHOLD else 'FAIL'}\n\n"
        f"Key Rate: {results.key_rate_finite:.6f}\n"
        f"Efficiency: {results.detection_efficiency*100:.1f}%\n\n"
        f"Preset: {config.preset_name}\n"
        f"Backend: {config.backend}\n"
    )
    color = 'lightgreen' if is_secure else 'lightcoral'
    ax9.text(
        0.1,
        0.95,
        quality_text,
        transform=ax9.transAxes,
        fontsize=9,
        verticalalignment='top',
        fontfamily='monospace',
        bbox=dict(boxstyle='round', facecolor=color, alpha=0.5),
    )

    plt.suptitle(
        f'E91 QKD Experiment Results - {config.preset_name}', fontsize=14, fontweight='bold', y=0.98
    )
    return fig


# ============================================================================
# PRESETS
# ============================================================================

def get_preset_config(preset_name: str, base_config: ExperimentConfig) -> ExperimentConfig:
    """Load preset configuration."""
    # Reset all losses first
    base_config.enable_depolarizing_noise = False
    base_config.enable_visibility_reduction = False
    base_config.enable_intrinsic_error = False
    base_config.enable_fiber_loss = False
    base_config.enable_detector_loss = False
    base_config.enable_dark_counts = False
    base_config.enable_timing_jitter = False
    base_config.enable_deadtime = False
    base_config.enable_afterpulsing = False
    base_config.enable_saturation = False
    base_config.enable_background = False
    base_config.enable_multi_pair = False
    base_config.enable_insertion_loss = False
    base_config.enable_misalignment = False
    base_config.enable_satellite = False
    
    if preset_name == "Low Noise (Î±=0.06)":
        base_config.enable_depolarizing_noise = True
        base_config.depolarizing_alpha = 0.06
    elif preset_name == "Moderate Fiber (10km)":
        base_config.enable_depolarizing_noise = True
        base_config.depolarizing_alpha = 0.05
        base_config.enable_fiber_loss = True
        base_config.distance_km_A = 5.0
        base_config.distance_km_B = 5.0
        base_config.fiber_loss_dB_per_km = 0.2
        base_config.enable_detector_loss = True
        base_config.heralding_efficiency = 0.9
        base_config.end_detector_efficiency = 0.85
    elif preset_name == "Long Distance (50km)":
        base_config.enable_depolarizing_noise = True
        base_config.depolarizing_alpha = 0.08
        base_config.enable_fiber_loss = True
        base_config.distance_km_A = 25.0
        base_config.distance_km_B = 25.0
        base_config.fiber_loss_dB_per_km = 0.2
        base_config.enable_detector_loss = True
        base_config.heralding_efficiency = 0.85
        base_config.end_detector_efficiency = 0.70
        base_config.enable_dark_counts = True
        base_config.dark_prob = 0.002
    elif preset_name == "Realistic Lab":
        base_config.enable_depolarizing_noise = True
        base_config.depolarizing_alpha = 0.06
        base_config.enable_visibility_reduction = True
        base_config.visibility = 0.98
        base_config.enable_fiber_loss = True
        base_config.distance_km_A = 2.5
        base_config.distance_km_B = 2.5
        base_config.enable_detector_loss = True
        base_config.heralding_efficiency = 0.9
        base_config.end_detector_efficiency = 0.85
        base_config.enable_dark_counts = True
        base_config.dark_prob = 0.001
        base_config.enable_insertion_loss = True
        base_config.insertion_loss_dB = 0.5
        base_config.enable_timing_jitter = True
        base_config.jitter_ns = 0.5
    elif preset_name == "Satellite LEO":
        base_config.enable_depolarizing_noise = True
        base_config.depolarizing_alpha = 0.04
        base_config.enable_satellite = True
        base_config.slant_range_km = 500.0
        base_config.beam_divergence_urad = 10.0
        base_config.pointing_jitter_urad = 5.0
        base_config.receiver_fov_urad = 100.0
        base_config.transmitter_aperture_m = 0.3
        base_config.receiver_aperture_m = 1.0
        base_config.is_daytime = False
        base_config.enable_detector_loss = True
        base_config.end_detector_efficiency = 0.4
        base_config.enable_background = True
        base_config.background_cps = 200.0
    
    base_config.preset_name = preset_name
    return base_config


# ============================================================================
# STREAMLIT UI - MAIN APPLICATION
# ============================================================================
# Interactive web interface for E91 QKD experiments.
# Organized into tabs: Experiment, Parametric Sweep, Message Test, History
# ============================================================================

def main():
    """Main Streamlit application entry point."""
    st.set_page_config(
        page_title="E91 QKD Professional",
        page_icon="🔐",
        layout="wide",
        initial_sidebar_state="expanded"
    )

    # Inject professional CSS
    st.markdown(PROFESSIONAL_CSS, unsafe_allow_html=True)

    for key, default in [
        ("experiment_history", []), ("sweep_history", []), ("message_history", []), ("listener", MessageListener()),
    ]:
        if key not in st.session_state: st.session_state[key] = default

    # Top-left action buttons + centered title
    # Responsive header layout
    header_col1, header_col2, header_col3 = st.columns([1, 10, 1])
    with header_col1:
        guide_clicked = st.button("📖", help="Open application guide", key="guide_btn", use_container_width=False)
    with header_col2:
        st.markdown(
            f"""
            <div style='text-align:center;'>
              <h1 style='margin-bottom:0; font-size:2.5rem;'>E91 QKD Enhanced Testbench</h1>
              <div style='color:gray; font-size:0.9rem;'>Version {VERSION}</div>
              <div style='color:gray; font-style:italic; font-size:0.85rem;'>Made by Tyler Barr</div>
            </div>
            <hr style='margin-top:10px;'/>
            """,
            unsafe_allow_html=True,
        )
    with header_col3:
        st.write("")  # Spacer for balance

    if guide_clicked:
        with st.expander("Application Guide", expanded=True):
            st.markdown(
                """
                Overview
                - Experiment tab: configure angles, probabilities, losses/noise, security, DI, and Eve. Run to produce key material and plots.
                - Parametric Sweep: vary one parameter across a range and visualize S, QBER, key rates, and detection.
                - Message Test: encrypt a message using OTP with the sifted key (self-test or two-party).
                - History: browse, clear, and download logs of experiments, sweeps, and messages.

                Graphs (Experiment)
                - Bell Test Result: bar chart of measured CHSH S vs classical (2.0) and quantum (2.828) limits.
                - Quantum Bit Error Rate: bar of QBER with 11% dashed threshold.
                - Key Generation Pipeline: generated→detected→sifted→final.
                - Secret Fractions: asymptotic and finite-key secret fraction per sifted bit.
                - Key Rates: secret bits per generated pair.
                - Correlators Heatmap: E(a_i,b_j) across bases; structure indicates CHSH geometry.
                - Angles: polar preview of Alice/Bob bases.

                Results/Terms
                - Detection eta: detected/generated fraction; dominated by loss and efficiencies.
                - Sifting eta: sifted/detected fraction; ~22% ideal for E91 with uniform bases.
                - QBER: fraction of mismatched bits in the sifted key; <11% for security.
                - Secret fraction: upper bound on extractable secret bits per sifted bit.
                - Final key bits: after IR and privacy amplification.

                Security
                - Secure if S>2 and QBER<11% (heuristic; details depend on assumptions and finite-size effects).

                Message Testing
                - One-time pad XOR using the sifted key. Two-party mode exposes mismatches due to QBER.
                """
            )

    # Manage theme panel state so it stays open until Apply

    if not QISKIT_AVAILABLE and not QUTIP_AVAILABLE:
        st.error("No quantum backend available. Please install Qiskit or QuTiP.")
        st.stop()

    # Create main tabs for different functionalities
    tab_exp, tab_sweep, tab_msg, tab_hist = st.tabs(["Experiment", "Parametric Sweep", "Message Test", "History"])

    # ==========================================================================
    # TAB 1: PARAMETRIC SWEEP
    # ==========================================================================
    # Sweep over parameter ranges to study QKD performance
    # ==========================================================================
    with tab_sweep:
        st.subheader("Parametric Sweep Analysis")
        if 'config' not in st.session_state:
            st.info("Run an experiment first to set a base configuration.")
        else:
            base_config = st.session_state.config
            c1,c2 = st.columns(2)
            with c1:
                sweep_param = st.selectbox("Parameter to Sweep",
                                          ["distance_km_A","depolarizing_alpha","visibility","end_detector_efficiency","num_pairs"],
                                          help="Select which parameter to vary across a range")
                # Set default min/max based on parameter type
                if sweep_param == "num_pairs":
                    default_min, default_max = 1000, 100000
                elif sweep_param in ["depolarizing_alpha"]:
                    default_min, default_max = 0.0, 0.3
                elif sweep_param in ["visibility", "end_detector_efficiency"]:
                    default_min, default_max = 0.5, 1.0
                else:
                    default_min, default_max = 0.0, 100.0

                sweep_min = st.number_input("Min Value", value=float(default_min),
                                           help="Minimum value for the sweep range")
                sweep_max = st.number_input("Max Value", value=float(default_max),
                                           help="Maximum value for the sweep range")
                num_points = st.slider("Number of Points", 5, 50, 20,
                                      help="Number of points to sample between min and max")

                # Generate sweep values (convert to int for num_pairs)
                if sweep_param == "num_pairs":
                    sweep_values = [int(x) for x in np.linspace(sweep_min, sweep_max, num_points)]
                else:
                    sweep_values = np.linspace(sweep_min, sweep_max, num_points).tolist()
            with c2:
                st.markdown("**Preview:**")
                st.dataframe(pd.DataFrame({"Point": range(1, min(11, len(sweep_values)+1)), "Value": sweep_values[:10]}), width='stretch')
            if st.button("Run Sweep", type="primary", help="Execute a parametric sweep varying the selected parameter across the specified range"):
                pbar = st.progress(0); status = st.empty()
                def pcb(p,m): pbar.progress(p); status.text(m)
                try:
                    sweep_results = run_parameter_sweep(base_config, sweep_param, sweep_values, progress_callback=pcb)
                    st.session_state.sweep_results = sweep_results; st.session_state.sweep_param = sweep_param
                    st.session_state.sweep_history.append({'timestamp': time.strftime("%Y-%m-%d %H:%M:%S"), 'parameter': sweep_param, 'results': sweep_results})
                    pbar.empty(); status.empty(); st.success("Sweep completed"); st.rerun()
                except Exception as e:
                    st.error(f"Sweep failed: {e}")
            if 'sweep_results' in st.session_state:
                st.markdown("---")
                sweep_results = st.session_state.sweep_results; sweep_param = st.session_state.sweep_param
                label = sweep_param.replace('_',' ').title()
                figs = create_sweep_plots(sweep_results, sweep_param, label)
                # Show all plots simultaneously in a grid
                colA, colB, colC = st.columns(3)
                with colA: st.pyplot(figs['s_vs_qber'], width='stretch')
                with colB: st.pyplot(figs['keyrate_vs_qber'], width='stretch')
                with colC: st.pyplot(figs['keyrate_vs_param'], width='stretch')
                colD, colE = st.columns(2)
                with colD: st.pyplot(figs['chsh_vs_param'], width='stretch')
                with colE: st.pyplot(figs['detection_vs_param'], width='stretch')
                with st.expander("How to read these plots", expanded=False):
                    st.markdown(
                        "- S vs QBER: tradeoff between Bell violation (S) and errors (QBER). Secure region: S>2 and QBER<11%.\n"
                        "- Key Rate vs QBER: asymptotic and finite-key rates vs error.\n"
                        f"- Key Rate vs {label}: sensitivity of secret rate to the swept parameter.\n"
                        f"- CHSH vs {label}: Bell violation vs parameter.\n"
                        f"- Detection vs {label}: throughput (loss + detector effects)."
                    )
                st.markdown("---"); st.markdown("### Sweep Summary")
                rows = [{label: val, 'CHSH S': r.chsh_S, 'QBER': r.qber, 'Key Rate (Asymp)': r.key_rate_asymptotic, 'Key Rate (Finite)': r.key_rate_finite, 'Detection Eff': r.detection_efficiency} for val, r in sweep_results]
                df_sum = pd.DataFrame(rows); st.dataframe(df_sum, width='stretch')
                buf2 = io.StringIO(); df_sum.to_csv(buf2, index=False)
                st.download_button("Download Summary (CSV)", buf2.getvalue(), "sweep_summary.csv", "text/csv")

    # ==========================================================================
    # TAB 2: EXPERIMENT (Main QKD Simulation)
    # ==========================================================================
    # Configure and run E91 QKD experiments with full parameter control
    # ==========================================================================
    with tab_exp:
        st.subheader("Experiment Configuration & Results")

        # Initialize preset state
        if 'current_preset' not in st.session_state:
            st.session_state.current_preset = "Custom"

        col_preset, col_backend, col_seed = st.columns(3)
        with col_preset:
            preset = st.selectbox(
                "Preset",
                [
                    "Custom",
                    "Ideal (No Losses)",
                    "Low Noise (alpha=0.06)",
                    "Moderate Fiber (10km)",
                    "Long Distance (50km)",
                    "Realistic Lab",
                    "Satellite LEO",
                ],
                help="Select a preset configuration. All parameters will update automatically.",
                key="preset_selector"
            )

            # If preset changed, update all parameters in session state
            if preset != st.session_state.current_preset and preset != "Custom":
                st.session_state.current_preset = preset
                # Apply preset values to session state
                if preset == "Ideal (No Losses)":
                    st.session_state.update({
                        'num_pairs': 10000,
                        'enable_depol': False,
                        'enable_vis': False,
                        'enable_intrinsic': False,
                        'enable_fiber': False,
                        'enable_detector': False,
                        'enable_dark': False
                    })
                elif preset == "Low Noise (alpha=0.06)":
                    st.session_state.update({
                        'num_pairs': 15000,
                        'enable_depol': True,
                        'depol_alpha': 0.06,
                        'enable_fiber': False,
                        'enable_detector': False
                    })
                elif preset == "Moderate Fiber (10km)":
                    st.session_state.update({
                        'num_pairs': 20000,
                        'enable_depol': True,
                        'depol_alpha': 0.06,
                        'enable_fiber': True,
                        'distance_A': 5.0,
                        'distance_B': 5.0,
                        'fiber_loss_db': 0.2,
                        'enable_detector': True,
                        'herald_eff': 0.9,
                        'end_det_eff': 0.8
                    })
                elif preset == "Long Distance (50km)":
                    st.session_state.update({
                        'num_pairs': 50000,
                        'enable_depol': True,
                        'depol_alpha': 0.08,
                        'enable_fiber': True,
                        'distance_A': 25.0,
                        'distance_B': 25.0,
                        'fiber_loss_db': 0.2,
                        'enable_detector': True,
                        'herald_eff': 0.85,
                        'end_det_eff': 0.75,
                        'enable_repeater': True,
                        'num_repeaters': 2,
                        'repeater_gain_dB': 3.0,
                        'enable_dark': True,
                        'dark_prob': 0.002
                    })
                elif preset == "Realistic Lab":
                    st.session_state.update({
                        'num_pairs': 25000,
                        'enable_depol': True,
                        'depol_alpha': 0.06,
                        'enable_vis': True,
                        'visibility': 0.98,
                        'enable_fiber': True,
                        'distance_A': 2.5,
                        'distance_B': 2.5,
                        'fiber_loss_db': 0.2,
                        'enable_detector': True,
                        'herald_eff': 0.9,
                        'end_det_eff': 0.85,
                        'enable_dark': True,
                        'use_cps': True,
                        'dark_cps': 100.0
                    })
                elif preset == "Satellite LEO":
                    st.session_state.update({
                        'num_pairs': 100000,
                        'enable_satellite': True,
                        'slant_km': 500.0,
                        'beam_div': 10.0,
                        'pointing': 5.0,
                        'rx_fov': 100.0,
                        'enable_detector': True,
                        'herald_eff': 0.85,
                        'end_det_eff': 0.75
                    })
                st.rerun()
            elif preset == "Custom":
                st.session_state.current_preset = "Custom"
        with col_backend:
            backends = []
            if QISKIT_AVAILABLE:
                backends.append("qiskit")
            if QUTIP_AVAILABLE:
                backends.append("qutip")
            backend = st.selectbox("Backend", backends, help=h("backend"))
        with col_seed:
            # Persist seed across reruns and allow randomization
            if "seed" not in st.session_state:
                st.session_state["seed"] = 42

            seed_col1, seed_col2 = st.columns([5, 1])
            with seed_col1:
                seed = st.number_input("Random Seed", 0, 9999, int(st.session_state["seed"]),
                                      help="Random seed for reproducibility")
                st.session_state["seed"] = int(seed)
            with seed_col2:
                st.markdown('<div style="margin-top: 30px;"></div>', unsafe_allow_html=True)
                if st.button("🎲", help="Randomize seed", key="randomize_seed_btn"):
                    st.session_state["seed"] = int(np.random.randint(0, 10000))
                    st.rerun()

        st.markdown("---")

        col_inputs, col_losses, col_adv, col_prev = st.columns([1,1,1,1])

        with col_inputs:
            with st.expander("INPUTS", expanded=True):
                # Distance controls with individual settings for Alice and Bob
                st.markdown("**Distances (km):**")
                dist_mode = st.radio("Distance Mode", ["Total (Split)", "Individual"], horizontal=True,
                                    help="Total mode splits distance equally; Individual allows separate Alice/Bob distances.")

                if dist_mode == "Total (Split)":
                    total_distance = st.number_input("Total Distance (km)", min_value=0.0, value=10.0, step=1.0, format="%.2f", help=h("total_distance"))
                    distance_A = distance_B = total_distance / 2.0
                    st.caption(f"📍 Alice: {distance_A:.1f} km | Bob: {distance_B:.1f} km (split equally from source)")
                else:
                    # Individual distance controls with session state
                    if 'distance_A' not in st.session_state:
                        st.session_state['distance_A'] = 5.0
                    if 'distance_B' not in st.session_state:
                        st.session_state['distance_B'] = 5.0

                    col_dist1, col_dist2, col_dist3 = st.columns([1, 1, 0.5])
                    with col_dist1:
                        distance_A = st.number_input("Alice Distance (km)", min_value=0.0, value=float(st.session_state['distance_A']),
                                                     step=1.0, format="%.2f", help="Distance from source to Alice")
                        st.session_state['distance_A'] = distance_A
                    with col_dist2:
                        distance_B = st.number_input("Bob Distance (km)", min_value=0.0, value=float(st.session_state['distance_B']),
                                                     step=1.0, format="%.2f", help="Distance from source to Bob")
                        st.session_state['distance_B'] = distance_B
                    with col_dist3:
                        if st.button("🎲", width='stretch', help="Randomize both Alice and Bob distances (0-50 km)"):
                            st.session_state['distance_A'] = float(np.random.uniform(0, 50))
                            st.session_state['distance_B'] = float(np.random.uniform(0, 50))
                            st.rerun()
                    st.caption(f"📍 Alice: {distance_A:.1f} km | Bob: {distance_B:.1f} km | Total: {distance_A + distance_B:.1f} km")

                st.markdown("**Angles (radians):**")
                angle_type = st.radio("Type", ["Exact", "Whole Radians (π/n)"], horizontal=True, help=h("angle_type"))
                if st.button("Randomize Angles", width='stretch', help=h("randomize_angles")):
                    if angle_type == "Whole Radians (π/n)":
                        for key in ["alice_0","alice_1","alice_2","bob_0","bob_1","bob_2"]:
                            st.session_state[key] = float(np.random.choice(range(9)) * np.pi / 8)
                    else:
                        for key in ["alice_0","alice_1","alice_2","bob_0","bob_1","bob_2"]:
                            st.session_state[key] = float(np.random.uniform(0, np.pi))
                    st.rerun()
                # Angle editors
                if angle_type == "Whole Radians (π/n)":
                    # Use selectboxes with symbolic π labels at π/8 increments
                    opts = [(f"{k}π/8" if k>0 else "0", k*np.pi/8.0) for k in range(0,9)]
                    label_map = {v:l for l,v in opts}
                    a1,a2,a3 = st.columns(3)
                    with a1:
                        alice_0 = st.selectbox("θ_A0", opts, index=int(round(st.session_state.get('alice_0',0.0)/(np.pi/8))), format_func=lambda x: x[0], help=h("angle"))[1]
                    with a2:
                        alice_1 = st.selectbox("θ_A1", opts, index=int(round(st.session_state.get('alice_1',np.pi/8)/(np.pi/8))), format_func=lambda x: x[0], help=h("angle"))[1]
                    with a3:
                        alice_2 = st.selectbox("θ_A2", opts, index=int(round(st.session_state.get('alice_2',np.pi/4)/(np.pi/8))), format_func=lambda x: x[0], help=h("angle"))[1]
                    b1,b2,b3 = st.columns(3)
                    with b1:
                        bob_0 = st.selectbox("θ_B0", opts, index=int(round(st.session_state.get('bob_0',np.pi/8)/(np.pi/8))), format_func=lambda x: x[0], help=h("angle"))[1]
                    with b2:
                        bob_1 = st.selectbox("θ_B1", opts, index=int(round(st.session_state.get('bob_1',np.pi/4)/(np.pi/8))), format_func=lambda x: x[0], help=h("angle"))[1]
                    with b3:
                        bob_2 = st.selectbox("θ_B2", opts, index=int(round(st.session_state.get('bob_2',3*np.pi/8)/(np.pi/8))), format_func=lambda x: x[0], help=h("angle"))[1]
                else:
                    a1,a2,a3 = st.columns(3)
                    with a1:
                        alice_0 = st.number_input("theta_A0", 0.0, float(np.pi), st.session_state.get("alice_0", 0.0), 0.05, format="%.4f", help=h("angle"))
                    with a2:
                        alice_1 = st.number_input("theta_A1", 0.0, float(np.pi), st.session_state.get("alice_1", float(np.pi/8)), 0.05, format="%.4f", help=h("angle"))
                    with a3:
                        alice_2 = st.number_input("theta_A2", 0.0, float(np.pi), st.session_state.get("alice_2", float(np.pi/4)), 0.05, format="%.4f", help=h("angle"))
                    b1,b2,b3 = st.columns(3)
                    with b1:
                        bob_0 = st.number_input("theta_B0", 0.0, float(np.pi), st.session_state.get("bob_0", float(np.pi/8)), 0.05, format="%.4f", help=h("angle"))
                    with b2:
                        bob_1 = st.number_input("theta_B1", 0.0, float(np.pi), st.session_state.get("bob_1", float(np.pi/4)), 0.05, format="%.4f", help=h("angle"))
                    with b3:
                        bob_2 = st.number_input("theta_B2", 0.0, float(np.pi), st.session_state.get("bob_2", float(3*np.pi/8)), 0.05, format="%.4f", help=h("angle"))

                st.session_state.update({'alice_0':alice_0,'alice_1':alice_1,'alice_2':alice_2,'bob_0':bob_0,'bob_1':bob_1,'bob_2':bob_2})

                # Enhanced Bell state selection with visualization
                st.markdown("---")
                st.markdown("**🔗 Bell State Selection**")
                bell_labels = {
                    "Phi+ (|00>+|11>)/√2": "phi_plus",
                    "Phi- (|00>-|11>)/√2": "phi_minus",
                    "Psi+ (|01>+|10>)/√2": "psi_plus",
                    "Psi- (|01>-|10>)/√2": "psi_minus",
                }
                bell_descriptions = {
                    "phi_plus": "Maximally entangled state (symmetric). Standard for E91 QKD.",
                    "phi_minus": "Maximally entangled with phase flip. Tests protocol robustness.",
                    "psi_plus": "Maximally entangled (antisymmetric). Alternative encoding.",
                    "psi_minus": "Singlet state. Antisymmetric with phase flip.",
                }

                bell_choice = st.selectbox(
                    "Bell State",
                    list(bell_labels.keys()),
                    index=0,
                    help="Select initial entangled state (Qiskit backend). Phi+: Standard symmetric state for E91. Phi-: Phase-flipped variant. Psi+: Antisymmetric encoding. Psi-: Singlet state.",
                )
                bell_state = bell_labels[bell_choice]
                st.caption(f"💡 {bell_descriptions[bell_state]}")

                num_pairs = st.number_input("Photon Pairs", min_value=1000, max_value=1000000, value=10000, step=1000, help=h("num_pairs"))
                est_time = estimate_runtime(num_pairs, backend)

                st.markdown("---")
                st.markdown("### Basis Probabilities")
                c1,c2 = st.columns(2)
                with c1:
                    if st.button("Randomize A & B", width='stretch', help=h("prob_randomize")):
                        st.session_state['pA'] = normalize_probs(np.random.rand(3).tolist())
                        st.session_state['pB'] = normalize_probs(np.random.rand(3).tolist())
                with c2:
                    if st.button("Reset Defaults", width='stretch', help=h("prob_reset")):
                        st.session_state['pA'] = [0.5,0.5,0.0]
                        st.session_state['pB'] = [0.5,0.5,0.0]
                pA = st.session_state.get('pA', [0.5,0.5,0.0])
                pB = st.session_state.get('pB', [0.5,0.5,0.0])
                la,lb = st.columns(2)
                with la:
                    pA0 = st.slider("p(A0)", 0.0, 1.0, float(pA[0]), 0.01, help=h("pA"))
                    pA1 = st.slider("p(A1)", 0.0, 1.0, float(pA[1]), 0.01, help=h("pA"))
                    pA2 = st.slider("p(A2)", 0.0, 1.0, float(pA[2]), 0.01, help=h("pA"))
                with lb:
                    pB0 = st.slider("p(B0)", 0.0, 1.0, float(pB[0]), 0.01, help=h("pB"))
                    pB1 = st.slider("p(B1)", 0.0, 1.0, float(pB[1]), 0.01, help=h("pB"))
                    pB2 = st.slider("p(B2)", 0.0, 1.0, float(pB[2]), 0.01, help=h("pB"))
                pA = normalize_probs([pA0,pA1,pA2])
                pB = normalize_probs([pB0,pB1,pB2])
                st.caption(f"Alice p = {np.round(pA,3).tolist()} | Bob p = {np.round(pB,3).tolist()}")

        with col_losses:
            with st.expander("LOSSES", expanded=True):
                st.markdown("**Logical Noise**")
                # Initialize session state for checkboxes if not present
                if 'enable_depol' not in st.session_state:
                    st.session_state.enable_depol = True
                if 'depol_alpha' not in st.session_state:
                    st.session_state.depol_alpha = 0.06
                if 'enable_vis' not in st.session_state:
                    st.session_state.enable_vis = False
                if 'visibility' not in st.session_state:
                    st.session_state.visibility = 0.98
                if 'enable_intrinsic' not in st.session_state:
                    st.session_state.enable_intrinsic = False
                if 'intrinsic_ed' not in st.session_state:
                    st.session_state.intrinsic_ed = 0.01
                if 'enable_fiber' not in st.session_state:
                    st.session_state.enable_fiber = False

                enable_depol = st.checkbox("Depolarizing Noise", value=st.session_state.enable_depol, help=h("enable_depol"))
                st.session_state.enable_depol = enable_depol
                depol_alpha = st.slider("alpha", 0.0, 0.3, float(st.session_state.depol_alpha), 0.01, help=h("depol_alpha")) if enable_depol else 0.06
                if enable_depol:
                    st.session_state.depol_alpha = depol_alpha

                enable_vis = st.checkbox("Visibility Reduction", value=st.session_state.enable_vis, help=h("enable_visibility"))
                st.session_state.enable_vis = enable_vis
                visibility = st.slider("V", 0.5, 1.0, float(st.session_state.visibility), 0.01, help=h("visibility")) if enable_vis else 0.98
                if enable_vis:
                    st.session_state.visibility = visibility

                enable_intrinsic = st.checkbox("Intrinsic Errors", value=st.session_state.enable_intrinsic, help=h("enable_intrinsic"))
                st.session_state.enable_intrinsic = enable_intrinsic
                intrinsic_ed = st.slider("e_d", 0.0, 0.1, float(st.session_state.intrinsic_ed), 0.001, help=h("intrinsic_ed")) if enable_intrinsic else 0.01
                if enable_intrinsic:
                    st.session_state.intrinsic_ed = intrinsic_ed

                st.markdown("**Channel Loss**")
                enable_fiber = st.checkbox("Fiber Loss", value=st.session_state.enable_fiber, help=h("enable_fiber"))
                st.session_state.enable_fiber = enable_fiber
                if enable_fiber:
                    fiber_loss_db = st.slider("Fiber Loss (dB/km)", 0.1, 2.0, 0.2, 0.1, help=h("fiber_loss_db"))
                    colfa,colfb = st.columns(2)
                    with colfa:
                        loss_a = st.number_input("Fixed Loss A (dB)", 0.0, 50.0, 0.0, 0.1, help=h("fixed_loss_a"))
                    with colfb:
                        loss_b = st.number_input("Fixed Loss B (dB)", 0.0, 50.0, 0.0, 0.1, help=h("fixed_loss_b"))

                    # Enhanced Quantum Repeater controls
                    st.markdown("---")
                    st.markdown("**🔄 Quantum Repeaters**")
                    enable_repeater = st.checkbox("Enable Quantum Repeaters", value=False,
                                                  help="Enable quantum repeaters to boost signal and enhance qubit transfer integrity over long distances. Repeaters provide effective gain to compensate fiber loss.")
                    if enable_repeater:
                        rep_col1, rep_col2 = st.columns(2)
                        with rep_col1:
                            num_repeaters = st.number_input("Number of Repeaters", min_value=0, max_value=20, value=2, step=1,
                                                           help="Number of quantum repeaters deployed along the channel. More repeaters = better signal preservation.")
                        with rep_col2:
                            repeater_gain_dB = st.number_input("Gain per Repeater (dB)", min_value=0.0, max_value=10.0, value=3.0, step=0.5, format="%.1f",
                                                               help="Signal gain provided by each repeater (dB). Typical values: 2-5 dB.")

                        # Show repeater effectiveness
                        total_fiber_loss = (distance_A + distance_B) * fiber_loss_db
                        total_repeater_gain = num_repeaters * repeater_gain_dB
                        net_loss = max(0.0, total_fiber_loss - total_repeater_gain)

                        st.caption(f"📊 Fiber Loss: {total_fiber_loss:.1f} dB | Repeater Gain: {total_repeater_gain:.1f} dB | Net Loss: {net_loss:.1f} dB")

                        # Visual indicator
                        if total_repeater_gain >= total_fiber_loss:
                            st.success("✅ Repeaters fully compensate fiber loss!")
                        elif total_repeater_gain >= total_fiber_loss * 0.5:
                            st.info("🔶 Repeaters partially compensate fiber loss")
                        else:
                            st.warning("⚠️ Fiber loss exceeds repeater gain")
                    else:
                        num_repeaters, repeater_gain_dB, enable_repeater = 0, 0.0, False
                else:
                    fiber_loss_db, loss_a, loss_b = 0.2, 0.0, 0.0
                    enable_repeater, num_repeaters, repeater_gain_dB = False, 0, 0.0

                st.markdown("**Detector Effects**")
                # Initialize detector session state
                if 'enable_detector' not in st.session_state:
                    st.session_state.enable_detector = False
                if 'herald_eff' not in st.session_state:
                    st.session_state.herald_eff = 0.9
                if 'end_det_eff' not in st.session_state:
                    st.session_state.end_det_eff = 0.8
                if 'enable_dark' not in st.session_state:
                    st.session_state.enable_dark = False

                enable_detector = st.checkbox("Detector Inefficiency", value=st.session_state.enable_detector, help=h("enable_detector"))
                st.session_state.enable_detector = enable_detector
                if enable_detector:
                    herald_eff = st.slider("Heralding eta", 0.1, 1.0, float(st.session_state.herald_eff), 0.05, help=h("herald_eff"))
                    st.session_state.herald_eff = herald_eff
                    end_det_eff = st.slider("End Detector eta", 0.1, 1.0, float(st.session_state.end_det_eff), 0.05, help=h("end_det_eff"))
                    st.session_state.end_det_eff = end_det_eff
                else:
                    herald_eff, end_det_eff = 0.9, 0.8

                enable_dark = st.checkbox("Dark Counts", value=st.session_state.enable_dark, help=h("enable_dark"))
                st.session_state.enable_dark = enable_dark
                if enable_dark:
                    use_cps = st.checkbox("Use Rate (CPS)", value=True, help=h("use_cps"))
                    if use_cps:
                        dark_cps = st.number_input("Dark CPS", 0.0, 1e9, 100.0, 1.0, format="%.2f", help=h("dark_cps"))
                        dark_prob = 0.001
                    else:
                        dark_prob = st.number_input("Dark Probability", 0.0, 0.01, 0.001, 0.0001, format="%.4f", help=h("dark_prob"))
                        dark_cps = 100.0
                else:
                    use_cps, dark_cps, dark_prob = False, 100.0, 0.001

                enable_jitter = st.checkbox("Timing Jitter", help=h("enable_jitter"))
                jitter_ns = st.slider("Jitter (ns)", 0.1, 5.0, 0.5, 0.1, help=h("jitter_ns")) if enable_jitter else 0.5

                enable_deadtime = st.checkbox("Detector Deadtime", help=h("enable_deadtime"))
                deadtime_ns = st.slider("Deadtime (ns)", 10.0, 1000.0, 50.0, 1.0, help=h("deadtime_ns")) if enable_deadtime else 50.0

                enable_after = st.checkbox("Afterpulsing", help=h("enable_after"))
                if enable_after:
                    after_prob = st.slider("Afterpulse Probability", 0.0, 0.2, 0.05, 0.005, help=h("after_prob"))
                    after_delay = st.slider("Afterpulse Delay (ns)", 10.0, 1000.0, 100.0, 5.0, help=h("after_delay"))
                else:
                    after_prob, after_delay = 0.05, 100.0

                enable_sat = st.checkbox("Saturation", help=h("enable_sat"))
                saturation_rate = st.number_input("Saturation Rate (Hz)", 1.0, 1e12, 1e6, step=1e5, format="%.0f", help=h("saturation_rate")) if enable_sat else 1e6

                st.markdown("**Background & Accidentals**")
                enable_bg = st.checkbox("Background Noise", help=h("enable_bg"))
                if enable_bg:
                    Y0 = st.number_input("Y0", 0.0, 1.0, 1e-6, format="%.2e", help=h("Y0"))
                    bg_cps = st.number_input("Background CPS", 0.0, 1e9, 500.0, 10.0, format="%.2f", help=h("bg_cps"))
                    coinc_ns = st.slider("Coincidence Window (ns)", 0.1, 10.0, 1.0, 0.1, help=h("coinc_ns"))
                    rep_rate = st.number_input("Repetition Rate (Hz)", 1.0, 1e12, 1e6, step=1e5, format="%.0f", help=h("rep_rate"))
                    enable_timetag = st.checkbox("Enable Time-Tagging", help=h("enable_timetag"))
                else:
                    Y0, bg_cps, coinc_ns, rep_rate, enable_timetag = 1e-6, 500.0, 1.0, 1e6, False

                st.markdown("**Source Effects**")
                enable_multi = st.checkbox("Multi-Pair Emissions", help=h("enable_multi"))
                if enable_multi:
                    spdc_mu = st.slider("SPDC Brightness (mu)", 0.0, 0.5, 0.1, 0.01, help=h("spdc_mu"))
                    pair_rate = st.number_input("Pair Rate (Hz)", 1.0, 1e12, 1e6, step=1e5, format="%.0f", help=h("pair_rate"))
                    pump_mw = st.slider("Pump Power (mW)", 0.0, 100.0, 10.0, 0.5, help=h("pump_mw"))
                    wavelength = st.number_input("Wavelength (nm)", 400.0, 2000.0, 810.0, 1.0, format="%.2f", help=h("wavelength"))
                    filt_band = st.slider("Filter Bandwidth (nm)", 0.1, 20.0, 3.0, 0.1, help=h("filt_band"))
                else:
                    spdc_mu, pair_rate, pump_mw, wavelength, filt_band = 0.1, 1e6, 10.0, 810.0, 3.0

                st.markdown("**Satellite / Free-Space**")
                enable_satellite = st.checkbox("Enable Satellite Model", help=h("enable_satellite"))
                if enable_satellite:
                    beam_div = st.slider("Beam Divergence (urad)", 1.0, 200.0, 10.0, 1.0, help=h("beam_div"))
                    pointing = st.slider("Pointing Jitter (urad)", 0.0, 100.0, 5.0, 0.5, help=h("pointing"))
                    rx_fov = st.slider("Receiver FOV (urad)", 1.0, 500.0, 100.0, 1.0, help=h("rx_fov"))
                    slant_km = st.slider("Slant Range (km)", 100.0, 2000.0, 500.0, 10.0, help=h("slant_km"))
                    tx_ap = st.slider("TX Aperture (m)", 0.05, 2.0, 0.3, 0.01, help=h("tx_ap"))
                    rx_ap = st.slider("RX Aperture (m)", 0.1, 5.0, 1.0, 0.01, help=h("rx_ap"))
                    is_day = st.checkbox("Daytime Operation", help=h("is_day"))
                    if is_day:
                        sat_bg_cps = st.number_input("Satellite BG CPS", 0.0, 1e9, 1000.0, 10.0, format="%.2f", help=h("sat_bg_cps"))
                    else:
                        sat_bg_cps = 1000.0
                    enable_turb = st.checkbox("Atmospheric Turbulence", help=h("enable_turb"))
                    if enable_turb:
                        cn2 = st.number_input("Cn2 (turbulence)", 1e-18, 1e-12, 1e-15, format="%.2e", help=h("cn2"))
                    else:
                        cn2 = 1e-15
                else:
                    beam_div, pointing, rx_fov, slant_km = 10.0, 5.0, 100.0, 500.0
                    tx_ap, rx_ap, is_day, sat_bg_cps = 0.3, 1.0, False, 1000.0
                    enable_turb, cn2 = False, 1e-15

        with col_adv:
            with st.expander("ADVANCED", expanded=True):
                st.markdown("**Security Parameters**")
                epsilon_sec = st.number_input("epsilon_sec", 1e-15, 1e-6, 1e-9, format="%.2e", help=h("epsilon_sec"))
                epsilon_cor = st.number_input("epsilon_cor", 1e-15, 1e-6, 1e-15, format="%.2e", help=h("epsilon_cor"))
                pe_fraction = st.slider("PE Fraction", 0.05, 0.5, 0.1, 0.05, help=h("pe_fraction"))
                st.markdown("**Information Reconciliation**")
                ir_protocol = st.selectbox("IR Protocol", ["BBBSS", "Cascade"], help=h("ir_protocol"))
                f_EC = st.slider("f_EC", 1.0, 2.0, 1.2, 0.05, help=h("f_EC"))
                block_length = st.number_input("Block Length", 64, 1000000, 1024, 64, help=h("block_length"))
                code_rate = st.slider("Code Rate (PA)", 0.0, 1.0, 0.5, 0.01, help=h("code_rate"))
                st.markdown("**Device-Independent**")
                enable_routed_di = st.checkbox("Enable Routed-DI", help=h("enable_routed_di"))
                di_bound_type = st.selectbox("DI Bound Type", ["default_di_bound"], help=h("di_bound_type"))
                routing_f = st.slider("eta_f (Fixed Routing)", 0.0, 1.0, 0.95, 0.01, help=h("routing_f"))
                routing_d = st.slider("eta_d (Distance-Dependent)", 0.0, 1.0, 0.90, 0.01, help=h("routing_d"))

                st.markdown("**Adversary (Eve)**")
                enable_eve = st.checkbox("Enable Eavesdropper (Eve)", help=h("enable_eve"))
                if enable_eve:
                    eve_model = st.selectbox("Eve Model", ["intercept_resend"], help=h("eve_model"))
                    eve_prob = st.slider("Intercept Probability", 0.0, 1.0, 0.1, 0.01,
                                         help=h("eve_prob"))
                else:
                    eve_model, eve_prob = "intercept_resend", 0.0

        with col_prev:
            with st.expander("LIVE PREVIEW", expanded=True):
                angle_fig = create_angle_preview([alice_0, alice_1, alice_2], [bob_0, bob_1, bob_2])
                st.pyplot(angle_fig, width='stretch')
                preview_cfg = ExperimentConfig(
                    enable_fiber_loss=enable_fiber,
                    distance_km_A=distance_A,
                    distance_km_B=distance_B,
                    fiber_loss_dB_per_km=fiber_loss_db,
                    loss_dB_A=loss_a,
                    loss_dB_B=loss_b,
                    enable_repeaters=enable_repeater,
                    num_repeaters=num_repeaters,
                    repeater_gain_dB=repeater_gain_dB,
                    enable_detector_loss=enable_detector,
                    end_detector_efficiency=end_det_eff,
                    enable_satellite=enable_satellite,
                    slant_range_km=slant_km,
                    transmitter_aperture_m=tx_ap,
                    receiver_aperture_m=rx_ap,
                    beam_divergence_urad=beam_div,
                    pointing_jitter_urad=pointing,
                    receiver_fov_urad=rx_fov,
                )
                lb = create_loss_budget_preview(preview_cfg)
                if lb is not None: st.pyplot(lb, width='stretch')
                # Active features summary
                st.markdown("**Active Features:**")
                active = []
                if enable_depol: active.append(f"Depolarizing (alpha={depol_alpha:.3f})")
                if enable_detector: active.append(f"Detector (eta_end={end_det_eff:.2f})")
                if enable_fiber: active.append(f"Fiber loss ({fiber_loss_db:.2f} dB/km)")
                if enable_bg: active.append(f"Background (Y0={Y0:.1e}, cps={bg_cps:.0f})")
                if enable_jitter: active.append(f"Timing jitter ({jitter_ns:.2f} ns)")
                if enable_deadtime: active.append(f"Deadtime ({deadtime_ns:.1f} ns)")
                if enable_after: active.append(f"Afterpulsing (p={after_prob:.3f})")
                if enable_satellite: active.append(f"Satellite (range={slant_km:.0f} km)")
                if enable_multi: active.append(f"SPDC multi-pair (mu={spdc_mu:.2f})")
                if enable_eve and eve_prob>0: active.append(f"Eve intercept (p={eve_prob:.2f})")
                if not active:
                    st.caption("No additional effects enabled.")
                else:
                    for item in active:
                        st.markdown(f"- {item}")

        st.markdown("---")
        run_button = st.button("Run Experiment", type="primary", help=h("run_experiment"))

        config = ExperimentConfig(
            backend=backend, seed=seed, num_pairs=int(num_pairs),
            alice_angles=[alice_0, alice_1, alice_2], bob_angles=[bob_0, bob_1, bob_2],
            bell_state=bell_state,
            alice_basis_probs=pA, bob_basis_probs=pB,
            epsilon_sec=epsilon_sec, epsilon_cor=epsilon_cor, pe_fraction=float(pe_fraction),
            ir_protocol=ir_protocol, f_EC=float(f_EC), block_length=int(block_length), code_rate=float(code_rate),
            enable_routed_di=enable_routed_di, di_bound_type=di_bound_type,
            routing_efficiency_f=float(routing_f), routing_efficiency_d=float(routing_d),
            enable_depolarizing_noise=enable_depol, depolarizing_alpha=float(depol_alpha),
            enable_visibility_reduction=enable_vis, visibility=float(visibility),
            enable_intrinsic_error=enable_intrinsic, intrinsic_error_ed=float(intrinsic_ed),
            enable_fiber_loss=enable_fiber, distance_km_A=float(distance_A), distance_km_B=float(distance_B),
            fiber_loss_dB_per_km=float(fiber_loss_db), loss_dB_A=float(loss_a), loss_dB_B=float(loss_b),
            enable_repeaters=bool(enable_repeater), num_repeaters=int(num_repeaters), repeater_gain_dB=float(repeater_gain_dB),
            enable_detector_loss=enable_detector, heralding_efficiency=float(herald_eff), end_detector_efficiency=float(end_det_eff),
            enable_dark_counts=enable_dark, use_dark_cps=bool(use_cps), dark_cps=float(dark_cps), dark_prob=float(dark_prob),
            enable_timing_jitter=enable_jitter, jitter_ns=float(jitter_ns), enable_deadtime=enable_deadtime, deadtime_ns=float(deadtime_ns),
            enable_afterpulsing=enable_after, afterpulsing_prob=float(after_prob), afterpulsing_delay_ns=float(after_delay),
            enable_saturation=enable_sat, saturation_rate=float(saturation_rate),
            enable_background=enable_bg, Y0=float(Y0), background_cps=float(bg_cps), coincidence_window_ns=float(coinc_ns), repetition_rate_Hz=float(rep_rate), enable_time_tagging=enable_timetag,
            enable_multi_pair=enable_multi, spdc_brightness_mu=float(spdc_mu), pair_rate=float(pair_rate), pump_power_mW=float(pump_mw), wavelength_nm=float(wavelength), filter_bandwidth_nm=float(filt_band),
            enable_satellite=enable_satellite, beam_divergence_urad=float(beam_div), pointing_jitter_urad=float(pointing), receiver_fov_urad=float(rx_fov), slant_range_km=float(slant_km), transmitter_aperture_m=float(tx_ap), receiver_aperture_m=float(rx_ap), is_daytime=bool(is_day), satellite_background_cps=float(sat_bg_cps), enable_turbulence=enable_turb, cn2=float(cn2),
            enable_eavesdropper=enable_eve, eve_model=eve_model, eve_intercept_prob=float(eve_prob),
            preset_name=preset,
        )

        if preset != "Custom":
            config = get_preset_config(preset, config)
        for w in validate_config(config): st.warning(w)
        if run_button:
            pbar = st.progress(0); status = st.empty()
            def pcb(p,m): pbar.progress(p); status.text(m)
            try:
                proto = E91Protocol(config)
                results = proto.run(progress_callback=pcb)
                pbar.empty(); status.empty(); st.success(f"Experiment completed in {results.execution_time:.2f}s")
                st.session_state.results = results; st.session_state.config = config
                st.session_state.experiment_history.append({'timestamp': time.strftime("%Y-%m-%d %H:%M:%S"), 'preset': config.preset_name, 'results': results, 'config': config})
                st.rerun()
            except Exception as e:
                st.error(f"Experiment failed: {e}")

        if 'results' in st.session_state:
            st.markdown("---"); st.markdown("### Results")
            res = st.session_state.results; cfg = st.session_state.config
            c1,c2,c3,c4,c5 = st.columns(5)
            with c1:
                st.metric(
                    "CHSH S",
                    f"{res.chsh_S:.4f}",
                    f"{res.chsh_S-CHSH_CLASSICAL_BOUND:+.4f}",
                    help="CHSH Bell parameter. Classical limit is 2.0; quantum max is 2.828. Values >2 indicate nonlocality."
                )
            with c2:
                st.metric(
                    "QBER",
                    f"{res.qber*100:.3f}%",
                    "Secure" if res.qber < QBER_THRESHOLD else "High",
                    help="Quantum Bit Error Rate of the sifted key. Acceptable <11%."
                )
            with c3:
                st.metric(
                    "Detection eta",
                    f"{res.detection_efficiency*100:.2f}%",
                    help="Detected/generated fraction after all losses and detector efficiencies."
                )
            with c4:
                st.metric(
                    "Sifting eta",
                    f"{res.sifting_efficiency*100:.2f}%",
                    help="Sifted/detected fraction. E91 ideal ~22.2% with uniform bases and A0B0/A2B2 as key."
                )
            with c5:
                st.metric(
                    "Final Key",
                    f"{res.num_key_bits:,}",
                    help="Usable secret bits after error correction and privacy amplification."
                )
            if getattr(res, 'eve_intercepted', None) is not None:
                st.caption(f"Eve intercepted ~{res.eve_intercepted} pairs (model: intercept_resend)")
            fig = create_results_plots(cfg, res); st.pyplot(fig)

            # Guides for plots and metrics
            with st.expander("What do these plots show?", expanded=False):
                st.markdown(
                    "- CHSH bar: measured S vs classical 2.0 and quantum 2.828. S>2 indicates nonlocality.\n"
                    "- QBER bar: error rate with a threshold at 11%.\n"
                    "- Key pipeline: generated -> detected -> sifted -> final key.\n"
                    "- Secret fractions and key rates: expected secret bits per sifted/generated bit.\n"
                    "- Correlators heatmap: E_ij across all angle combinations; structure reflects settings.\n"
                    "- Angles: polar view of Alice/Bob bases; helps confirm CHSH geometry."
                )

            with st.expander("What do these metrics mean?", expanded=False):
                s_secure = "violation (>2)" if res.chsh_S > CHSH_CLASSICAL_BOUND else "no violation"
                q_quality = ("excellent (<5%)" if res.qber < 0.05 else ("acceptable (<11%)" if res.qber < 0.11 else "too high (>=11%)"))
                st.markdown(
                    f"- CHSH S: range 0..2.828; classical bound 2.0. Your result {res.chsh_S:.4f} -> {s_secure}.\n"
                    f"- QBER: fraction of bit mismatches. Your result {res.qber*100:.3f}% -> {q_quality}.\n"
                    f"- Detection efficiency: detected/generated = {res.detection_efficiency*100:.2f}%.\n"
                    f"- Sifting efficiency: sifted/detected = {res.sifting_efficiency*100:.2f}%. Ideal ~22.2% for classic E91 mapping.\n"
                    f"- Final key bits: {res.num_key_bits:,}. Depends on secret fraction, block sizes, finite-key penalties."
                )

            # ---------------- Post-plot sections ----------------
            st.markdown("---")
            st.markdown("### Security Assessment")
            secure = (res.chsh_S > CHSH_CLASSICAL_BOUND) and (res.qber < QBER_THRESHOLD)
            if secure:
                st.success(f"SECURE: CHSH={res.chsh_S:.4f} (> {CHSH_CLASSICAL_BOUND}), QBER={res.qber*100:.2f}% (< {QBER_THRESHOLD*100:.0f}%).")
            else:
                tip = "reduce losses or improve detector efficiency" if res.detection_efficiency < 0.5 else "reduce noise (α,e_d) or adjust angles"
                st.error(f"INSECURE: CHSH={res.chsh_S:.4f}, QBER={res.qber*100:.2f}% — {tip}.")

            with st.expander("📄 Detailed Results", expanded=False):
                rows = [
                    ("Generated Pairs", f"{res.num_pairs_generated:,}"),
                    ("Detected Pairs", f"{res.num_pairs_detected:,}"),
                    ("Detection Efficiency", f"{res.detection_efficiency*100:.2f}%"),
                    ("Sifted Bits", f"{res.num_sifted:,}"),
                    ("Sifting Efficiency", f"{res.sifting_efficiency*100:.2f}%"),
                    ("QBER", f"{res.qber*100:.3f}%"),
                    ("CHSH S", f"{res.chsh_S:.4f}"),
                    ("Secret Fraction (Asymp)", f"{res.secret_fraction_asymptotic:.6f}"),
                    ("Secret Fraction (Finite)", f"{res.secret_fraction_finite:.6f}"),
                    ("Key Rate (Asymp)", f"{res.key_rate_asymptotic:.6f}"),
                    ("Key Rate (Finite)", f"{res.key_rate_finite:.6f}"),
                    ("Final Key Bits", f"{res.num_key_bits:,}"),
                    ("Execution Time", f"{res.execution_time:.2f}s"),
                ]
                df = pd.DataFrame(rows, columns=["Metric", "Value"])
                st.dataframe(df, width='stretch', hide_index=True)

            def _bits_to_str(bits: List[int], group: int = 8, max_len: int = 4096) -> str:
                if not bits:
                    return ""
                s = "".join("1" if b else "0" for b in bits[:max_len])
                if group > 0:
                    s = " ".join(s[i:i+group] for i in range(0, len(s), group))
                if len(bits) > max_len:
                    s += " …"
                return s

            with st.expander("📎 Raw Arrays (bits / time tags)", expanded=False):
                st.markdown("Key bits are shown after sifting. Groups of 8 for readability.")
                st.code(f"Alice sifted: {_bits_to_str(res.sifted_alice)}", language="text")
                st.code(f"Bob sifted:   {_bits_to_str(res.sifted_bob)}", language="text")
                if res.time_tags_alice is not None and res.time_tags_bob is not None:
                    ttA = pd.Series(res.time_tags_alice, name="t_A (ns)")
                    ttB = pd.Series(res.time_tags_bob, name="t_B (ns)")
                    st.caption(f"Time tags recorded: {len(ttA)} events")
                    cta, ctb = st.columns(2)
                    with cta:
                        st.dataframe(ttA.head(100), width='stretch')
                    with ctb:
                        st.dataframe(ttB.head(100), width='stretch')
                    buf_tt = io.StringIO(); pd.DataFrame({"t_A_ns": ttA, "t_B_ns": ttB}).to_csv(buf_tt, index=False)
                    st.download_button("Download Time Tags (CSV)", buf_tt.getvalue(), "time_tags.csv", "text/csv")
            st.markdown("---")
            e1,e2,e3 = st.columns(3)
            with e1: st.download_button("Download Config (JSON)", json.dumps(asdict(cfg), indent=2, default=str), "config.json", "application/json")
            with e2: st.download_button("Download Results (JSON)", json.dumps(asdict(res), indent=2, default=str), "results.json", "application/json")
            with e3:
                if res.sifted_alice:
                    df = pd.DataFrame({'alice': res.sifted_alice, 'bob': res.sifted_bob, 'match': [a==b for a,b in zip(res.sifted_alice, res.sifted_bob)]})
                    buf = io.StringIO(); df.to_csv(buf, index=False)
                    st.download_button("Download Sifted (CSV)", buf.getvalue(), "sifted.csv", "text/csv")

    # ==========================================================================
    # TAB 3: MESSAGE TEST (Practical QKD Application)
    # ==========================================================================
    # Test encryption/decryption with QKD keys + live two-way communication
    # ==========================================================================
    with tab_msg:
        st.subheader("Message Test")
        if 'results' not in st.session_state:
            st.info("Run an experiment to generate keys for testing.")
        else:
            res: ExperimentResults = st.session_state.results
            cfg: ExperimentConfig = st.session_state.config
            k1,k2,k3,k4 = st.columns(4)
            with k1: st.metric("Key Bits", f"{len(res.sifted_alice):,}", help="Number of sifted bits available for message testing.")
            with k2: st.metric("QBER", f"{res.qber*100:.2f}%", help="Quantum Bit Error Rate of the sifted key.")
            with k3: st.metric("CHSH S", f"{res.chsh_S:.3f}", help="Bell parameter; S>2 indicates nonlocality.")
            with k4: st.metric("Key Quality", "Good" if res.qber < 0.05 else ("Acceptable" if res.qber < 0.11 else "High"), help="Heuristic label based on QBER.")

            st.markdown("---")
            mode = st.radio("Test Mode", ["Self-Test (Loopback)", "Two-Party (Alice -> Bob)"], horizontal=True,
                           help="Self-Test: Encrypt and decrypt with same key (loopback). Two-Party: Test with Alice's and Bob's keys separately.")
            c1,c2 = st.columns([2,1])
            with c1:
                user_message = st.text_area("Enter message to encrypt", value="Hello, quantum world!", height=100,
                                           help="Your message will be encrypted using One-Time Pad (OTP) with the QKD-generated key")
            with c2:
                st.markdown("**Message Stats:**")
                st.metric("Characters", len(user_message))
                bits_needed = len(user_message.encode('utf-8'))*8
                st.metric("Bits Required", bits_needed)
                usage = bits_needed/max(1,len(res.sifted_alice))*100
                st.metric("Key Usage", f"{usage:.1f}%")

            if st.button("Encrypt & Transmit", type="primary", help="Encrypt the message using One-Time Pad (OTP) with your QKD key and test transmission"):
                if not user_message:
                    st.error("Please enter a message.")
                else:
                    try:
                        if mode.startswith("Self-Test"):
                            mt = test_self_message(user_message, res.sifted_alice)
                        else:
                            mt = test_two_party_message(user_message, res.sifted_alice, res.sifted_bob)
                            if st.session_state.listener.active:
                                lres = listener_receive_message(mt.encrypted_message, res.sifted_bob)
                                st.session_state.listener.received_messages.append(lres)
                        st.session_state.message_test = mt
                        st.session_state.message_history.append({'timestamp': time.strftime("%Y-%m-%d %H:%M:%S"), 'mode': mode, 'result': mt})
                        st.rerun()
                    except Exception as e:
                        st.error(f"Transmission failed: {e}")

            if 'message_test' in st.session_state:
                st.markdown("---")
                mt = st.session_state.message_test
                (st.success if mt.success else st.error)("MESSAGE TRANSMITTED SUCCESSFULLY!" if mt.success else f"TRANSMISSION FAILED: {mt.error_message}")
                d1,d2 = st.columns(2)
                with d1:
                    st.markdown("### Transmission Details")
                    st.write(f"Mode: {'Self Test' if mt.mode=='self_test' else 'Two-Party'}")
                    st.write("Encryption: One-Time Pad (XOR)")
                    st.write(f"Key Bits Used: {mt.key_length_bits}")
                    st.write(f"Transmission Time: {mt.transmission_time:.2f} ms")
                    with st.expander("View Encrypted Data", expanded=False):
                        st.code(format_hex(mt.encrypted_message), language='text')
                with d2:
                    st.markdown("### Comparison")
                    st.markdown("Original Message:")
                    st.code(mt.original_message)
                    st.markdown("Decrypted Message:")
                    st.code(mt.decrypted_message)

            # ============================================================================
            # ENHANCED NETWORKED TWO-WAY COMMUNICATION (Computer-to-Computer)
            # ============================================================================
            st.markdown("---")
            st.markdown("### 🌐 Live Two-Way Communication (Computer-to-Computer)")
            st.info("**Instructions**: Two users can test live quantum-secured communication between separate machines. Both users must run QKD experiments first to generate shared keys.")

            # Connection Settings
            with st.expander("🔧 Connection Settings", expanded=True):
                net_col1, net_col2 = st.columns([3, 2])
                with net_col1:
                    net_role = st.radio(
                        "Your Role",
                        ["Alice & Bob (Bidirectional)", "Alice (Sender Only)", "Bob (Receiver Only)"],
                        horizontal=True,
                        help="Bidirectional mode allows both sending and receiving on the same machine."
                    )

                    conn_col1, conn_col2 = st.columns(2)
                    with conn_col1:
                        local_port = st.number_input("Your Port", min_value=1024, max_value=65535, value=8765, step=1,
                                                     help="Port to listen on for incoming messages")
                    with conn_col2:
                        peer_port = st.number_input("Peer Port", min_value=1024, max_value=65535, value=8766, step=1,
                                                    help="Port where your peer is listening")

                    peer_host = st.text_input("Peer IP Address", value="127.0.0.1",
                                              help="IP address of the other computer (use 127.0.0.1 for same machine testing)")

                with net_col2:
                    st.markdown("**📋 Quick Setup:**")
                    st.caption("1. Both users run QKD experiments")
                    st.caption("2. Configure ports (must differ for local testing)")
                    st.caption("3. Exchange IP addresses")
                    st.caption("4. Ensure firewall allows UDP traffic")
                    st.caption("5. Start sending/receiving messages!")

            # Messaging Interface
            st.markdown("---")
            msg_col1, msg_col2 = st.columns([3, 2])

            with msg_col1:
                st.markdown("**✉️ Send Message**")
                net_msg = st.text_area("Message to Send", value="Hello from Alice!", height=80,
                                       help="Enter your message here. It will be encrypted with your QKD key.")

                send_col1, send_col2, send_col3 = st.columns([1, 1, 1])
                with send_col1:
                    can_send = "Alice" in net_role or "Bidirectional" in net_role
                    if st.button("📤 Send Message", type="primary", disabled=not can_send, width='stretch', help="Encrypt and send message to peer via UDP"):
                        if can_send:
                            try:
                                mt = test_self_message(net_msg, res.sifted_alice)
                                if not mt.success:
                                    st.error(f"❌ Encryption failed: {mt.error_message}")
                                else:
                                    send_udp_message(peer_host, int(peer_port), mt.encrypted_message)
                                    st.session_state.message_history.append({
                                        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
                                        "mode": "Network Send",
                                        "result": mt,
                                    })
                                    st.success(f"✅ Sent {len(mt.encrypted_message)} bytes to {peer_host}:{peer_port}")
                                    st.rerun()
                            except Exception as e:
                                st.error(f"❌ Send failed: {e}")

                with send_col2:
                    can_receive = "Bob" in net_role or "Bidirectional" in net_role
                    if st.button("📥 Listen for Message", disabled=not can_receive, width='stretch', help="Listen for incoming UDP message and decrypt with your key"):
                        if can_receive:
                            try:
                                recv = receive_udp_message(int(local_port), timeout=3.0)
                                if recv is None:
                                    st.warning("⏱️ No message received (timeout after 3s)")
                                else:
                                    data, addr = recv
                                    lres = listener_receive_message(data, res.sifted_bob)
                                    st.session_state.listener.received_messages.append(lres)
                                    st.session_state.message_history.append({
                                        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
                                        "mode": "Network Receive",
                                        "result": lres,
                                    })
                                    if lres.success:
                                        st.success(f"✅ Message received from {addr[0]}:{addr[1]}")
                                        st.code(lres.decrypted_message, language=None)
                                    else:
                                        st.error(f"❌ Decryption failed: {lres.error_message}")
                                    st.rerun()
                            except Exception as e:
                                st.error(f"❌ Receive failed: {e}")

                with send_col3:
                    st.metric("Messages Sent", len([m for m in st.session_state.message_history if "Send" in m.get("mode", "")]))

            with msg_col2:
                st.markdown("**📊 Communication Status**")
                total_msgs = len(st.session_state.listener.received_messages)
                st.metric("Messages Received", total_msgs)
                st.metric("Your Port", f":{local_port}")
                st.metric("Peer Address", f"{peer_host}:{peer_port}")

                # Show last received message
                if st.session_state.listener.received_messages:
                    last_msg = st.session_state.listener.received_messages[-1]
                    with st.expander("📬 Last Received", expanded=True):
                        if last_msg.success:
                            st.success("Decryption successful!")
                            st.code(last_msg.decrypted_message, language=None)
                        else:
                            st.error(f"Decryption failed: {last_msg.error_message}")

    # ==========================================================================
    # TAB 4: HISTORY (Session Data Review)
    # ==========================================================================
    # View and manage experiment, sweep, and message history
    # ==========================================================================
    with tab_hist:
        st.subheader("History")
        st.markdown("## Experiment History")
        if st.session_state.experiment_history:
            data = []
            for i,e in enumerate(st.session_state.experiment_history):
                data.append({'Run':i+1,'Timestamp':e['timestamp'],'Preset':e['preset'],'CHSH S':f"{e['results'].chsh_S:.4f}",'QBER (%)':f"{e['results'].qber*100:.3f}",'Key Bits':f"{e['results'].num_key_bits:,}",'Key Rate':f"{e['results'].key_rate_finite:.6f}"})
            st.dataframe(pd.DataFrame(data), width='stretch', hide_index=True)
            a1,a2 = st.columns(2)
            with a1:
                if st.button("Clear Experiment History", width='stretch', help="Delete all saved experiment results from history"):
                    st.session_state.experiment_history = []; st.rerun()
            with a2:
                exp_json = json.dumps([{'timestamp':e['timestamp'],'preset':e['preset'],'results':asdict(e['results'])} for e in st.session_state.experiment_history], indent=2, default=str)
                st.download_button("Download Experiment History", exp_json, "experiment_history.json", "application/json", width='stretch', help="Export experiment history as JSON file")
        else:
            history_empty_card("No experiments in history yet. Run some experiments to compare results!")
        st.markdown("---"); st.markdown("## Parametric Sweeps")
        if st.session_state.sweep_history:
            data = []
            for i,e in enumerate(st.session_state.sweep_history):
                data.append({'Sweep':i+1,'Timestamp':e['timestamp'],'Parameter':e['parameter'],'Points':len(e['results'])})
            st.dataframe(pd.DataFrame(data), width='stretch', hide_index=True)
            s1,s2 = st.columns(2)
            with s1:
                if st.button("Clear Sweep History", width='stretch', help="Delete all saved parametric sweep results from history"):
                    st.session_state.sweep_history = []; st.rerun()
            with s2:
                sweep_json = json.dumps([{'timestamp':e['timestamp'],'parameter':e['parameter'],'num_points':len(e['results'])} for e in st.session_state.sweep_history], indent=2, default=str)
                st.download_button("Download Sweep History", sweep_json, "sweep_history.json", "application/json", width='stretch', help="Export parametric sweep history as JSON file")
        else:
            history_empty_card("No sweep history yet. Run a sweep to populate.")
        st.markdown("---"); st.markdown("## Messages")
        if st.session_state.message_history:
            data = []
            for i,e in enumerate(st.session_state.message_history):
                data.append({'Message':i+1,'Timestamp':e['timestamp'],'Mode':e['mode'],'Success':bool(e['result'].success),'Bits Used':e['result'].key_length_bits})
            st.dataframe(pd.DataFrame(data), width='stretch', hide_index=True)
            m1,m2 = st.columns(2)
            with m1:
                if st.button("Clear Message History", width='stretch', help="Delete all saved message test results from history"):
                    st.session_state.message_history = []; st.rerun()
            with m2:
                msg_json = json.dumps([{'timestamp':e['timestamp'],'mode':e['mode'],'success':e['result'].success,'key_bits_used':e['result'].key_length_bits} for e in st.session_state.message_history], indent=2, default=str)
                st.download_button("Download Message History", msg_json, "message_history.json", "application/json", width='stretch', help="Export message test history as JSON file")
        else:
            history_empty_card("No messages yet. Use Message Test tab to send one.")
        st.markdown("---"); st.markdown("## Export All History")
        all_history = {
            'experiments': [{'timestamp':e['timestamp'],'preset':e['preset'],'config':asdict(e['config']),'results':asdict(e['results'])} for e in st.session_state.experiment_history],
            'sweeps': [{'timestamp':e['timestamp'],'parameter':e['parameter'],'results':[(val, asdict(res)) for val,res in e['results']]} for e in st.session_state.sweep_history],
            'messages': [{'timestamp':e['timestamp'],'mode':e['mode'],'success':e['result'].success,'key_bits_used':e['result'].key_length_bits,'transmission_time':e['result'].transmission_time} for e in st.session_state.message_history],
        }
        all_json = json.dumps(all_history, indent=2, default=str)
        st.download_button("Download All (JSON)", all_json, "complete_history.json", "application/json", help="Export complete history (experiments, sweeps, and messages) as single JSON file")


# ============================================================================
# APPLICATION ENTRY POINT
# ============================================================================

if __name__ == "__main__":
    main()
