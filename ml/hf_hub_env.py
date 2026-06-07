"""Hugging Face Hub network tweaks for unstable SSL (common on some RU networks)."""
from __future__ import annotations

import os
import ssl


def configure_hf_hub() -> None:
    """Call before any transformers / huggingface_hub import side-effects."""
    if os.environ.get("HF_HUB_DISABLE_SSL_VERIFY", "").strip().lower() in ("1", "true", "yes"):
        ssl._create_default_https_context = ssl._create_unverified_context
    # httpx pool bugs after SSL EOF — fewer parallel requests
    os.environ.setdefault("HF_HUB_DISABLE_PROGRESS_BARS", "0")
    os.environ.setdefault("HF_HUB_ENABLE_HF_TRANSFER", "0")
