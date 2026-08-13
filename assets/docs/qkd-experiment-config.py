from dataclasses import dataclass, asdict, field
from typing import Dict, List, Tuple, Optional


@dataclass
class ExperimentConfig:
    """Comprehensive experiment configuration."""
    # Core
    backend: str = "qiskit"
    num_pairs: int = 10000
    seed: int = 42
    alice_angles: List[float] = field(default_factory=lambda: ALICE_ANGLES_DEFAULT.copy())
    bob_angles: List[float] = field(default_factory=lambda: BOB_ANGLES_DEFAULT.copy())
    alice_basis_probs: Optional[List[float]] = None
    bob_basis_probs: Optional[List[float]] = None
    basis_mapping: Optional[List[Tuple[int, int, str]]] = None

    # Security
    epsilon_sec: float = 1e-9
    epsilon_cor: float = 1e-15
    pe_fraction: float = 0.1
    ir_protocol: str = "BBBSS"
    f_EC: float = 1.2
    block_length: int = 1024
    code_rate: float = 0.5

    # Device-Independent
    di_bound_type: str = "default_di_bound"
    enable_routed_di: bool = False
    routing_efficiency_f: float = 0.95
    routing_efficiency_d: float = 0.90

    # Logical Noise
    enable_depolarizing_noise: bool = False
    depolarizing_alpha: float = 0.06
    enable_visibility_reduction: bool = False
    visibility: float = 0.98
    enable_intrinsic_error: bool = False
    intrinsic_error_ed: float = 0.01

    # Channel Loss
    enable_fiber_loss: bool = False
    distance_km_A: float = 5.0
    distance_km_B: float = 5.0
    loss_dB_A: float = 0.0
    loss_dB_B: float = 0.0
    fiber_loss_dB_per_km: float = 0.2
    enable_insertion_loss: bool = False
    insertion_loss_dB: float = 0.5
    enable_misalignment: bool = False
    polarization_drift_deg: float = 2.0
    # Repeaters (effective loss compensation model)
    enable_repeaters: bool = False
    num_repeaters: int = 0
    repeater_gain_dB: float = 0.0

    # Detectors
    enable_detector_loss: bool = False
    heralding_efficiency: float = 0.9
    end_detector_efficiency: float = 0.8
    enable_dark_counts: bool = False
    dark_cps: float = 100.0
    dark_prob: float = 0.001
    use_dark_cps: bool = False
    enable_timing_jitter: bool = False
    jitter_ns: float = 0.5
    enable_deadtime: bool = False
    deadtime_ns: float = 50.0
    enable_afterpulsing: bool = False
    afterpulsing_prob: float = 0.05
    afterpulsing_delay_ns: float = 100.0
    enable_saturation: bool = False
    saturation_rate: float = 1e6

    # Background
    enable_background: bool = False
    Y0: float = 1e-6
    background_cps: float = 500.0
    coincidence_window_ns: float = 1.0
    enable_time_tagging: bool = False
    repetition_rate_Hz: float = 1e6

    # Source
    enable_multi_pair: bool = False
    spdc_brightness_mu: float = 0.1
    pair_rate: float = 1e6
    pump_power_mW: float = 10.0
    wavelength_nm: float = 810.0
    filter_bandwidth_nm: float = 3.0

    # Satellite
    enable_satellite: bool = False
    beam_divergence_urad: float = 10.0
    pointing_jitter_urad: float = 5.0
    receiver_fov_urad: float = 100.0
    slant_range_km: float = 500.0
    transmitter_aperture_m: float = 0.3
    receiver_aperture_m: float = 1.0
    is_daytime: bool = False
    satellite_background_cps: float = 1000.0
    enable_turbulence: bool = False
    cn2: float = 1e-15

    # Adversary (Eve)
    enable_eavesdropper: bool = False
    eve_model: str = "intercept_resend"
    eve_intercept_prob: float = 0.0

    # Output
    output_directory: str = "./results"
    enable_plots: bool = True
    plot_format: str = "png"
    enable_structured_export: bool = False
    enable_bb84_comparison: bool = False
    enable_tomography: bool = False
    preset_name: str = "Custom"
    # State preparation
    bell_state: str = "phi_plus"

    def __post_init__(self):
        if self.basis_mapping is None:
            self.basis_mapping = []
            for i in range(3):
                for j in range(3):
                    purpose = "key" if (i == 0 and j == 0) or (i == 2 and j == 2) else "chsh"
                    self.basis_mapping.append((i, j, purpose))

@dataclass
class ExperimentResults:
    """Comprehensive experiment results."""
    num_pairs_generated: int
    num_pairs_detected: int
    detection_efficiency: float
    num_sifted: int
    sifting_efficiency: float
    qber: float
    chsh_S: float
    num_key_bits: int
    secret_fraction_asymptotic: float
    secret_fraction_finite: float
    key_rate_asymptotic: float
    key_rate_finite: float
    correlators: Dict[str, float]
    routed_di_witness: Optional[float] = None
    combined_efficiency: Optional[float] = None
    avg_coincidence_delay_ns: Optional[float] = None
    coincidence_accidental_ratio: Optional[float] = None
    multi_pair_events: Optional[int] = None
    alice_results: List[int] = field(default_factory=list)
    bob_results: List[int] = field(default_factory=list)
    sifted_alice: List[int] = field(default_factory=list)
    sifted_bob: List[int] = field(default_factory=list)
    time_tags_alice: Optional[List[float]] = None
    time_tags_bob: Optional[List[float]] = None
    execution_time: float = 0.0
    eve_intercepted: Optional[int] = None
