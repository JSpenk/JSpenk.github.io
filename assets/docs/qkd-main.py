#!/usr/bin/env python3
"""
================================================================================
E91 QKD Professional Interface (v7.0) - Main Entry Point
================================================================================

Professional quantum key distribution simulator with modular architecture.

Run with: streamlit run main.py

================================================================================
"""

import streamlit as st

# Configuration imports
from config.constants import VERSION, QISKIT_AVAILABLE, QUTIP_AVAILABLE
from config.styles import PROFESSIONAL_CSS

# UI imports
from ui.components.header import render_header
from ui.tabs.experiment_tab import render_experiment_tab
from ui.tabs.sweep_tab import render_sweep_tab
from ui.tabs.message_tab import render_message_tab
from ui.tabs.history_tab import render_history_tab

# Models
from models.data_structures import MessageListener


def initialize_session_state():
    """Initialize session state variables."""
    defaults = {
        "experiment_history": [],
        "sweep_history": [],
        "message_history": [],
        "listener": MessageListener(),
    }

    for key, default in defaults.items():
        if key not in st.session_state:
            st.session_state[key] = default


def main():
    """Main Streamlit application entry point."""
    # Configure page
    st.set_page_config(
        page_title="E91 QKD Professional",
        page_icon="🔐",
        layout="wide",
        initial_sidebar_state="expanded"
    )

    # Inject professional CSS
    st.markdown(PROFESSIONAL_CSS, unsafe_allow_html=True)

    # Initialize session state
    initialize_session_state()

    # Render header
    render_header(VERSION)

    # Check for quantum backends
    if not QISKIT_AVAILABLE and not QUTIP_AVAILABLE:
        st.error("No quantum backend available. Please install Qiskit or QuTiP.")
        st.stop()

    # Create main tabs
    tab_exp, tab_sweep, tab_msg, tab_hist = st.tabs([
        "Experiment",
        "Parametric Sweep",
        "Message Test",
        "History"
    ])

    # Render tabs
    with tab_exp:
        render_experiment_tab()

    with tab_sweep:
        render_sweep_tab()

    with tab_msg:
        render_message_tab()

    with tab_hist:
        render_history_tab()


if __name__ == "__main__":
    main()