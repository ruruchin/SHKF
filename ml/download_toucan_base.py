#!/usr/bin/env python3
"""Download Toucan base checkpoint for Konstancia LoRA training."""
from __future__ import annotations

import sys
import time
from pathlib import Path

from hf_hub_env import configure_hf_hub
from konstancia_model_config import get_base_model_id, local_cache_dir

configure_hf_hub()

ROOT = Path(__file__).resolve().parent


def is_cached(local_dir: Path) -> bool:
    if not (local_dir / "config.json").exists():
        return False
    return (local_dir / "model.safetensors").exists() or any(local_dir.glob("model-*.safetensors"))


def main():
    from huggingface_hub import snapshot_download

    model_id = get_base_model_id()
    local_dir = local_cache_dir(model_id)
    local_dir.mkdir(parents=True, exist_ok=True)

    if is_cached(local_dir):
        print(f"Already cached: {local_dir}")
        return

    last_err = None
    for attempt in range(1, 6):
        try:
            print(f"Downloading {model_id} -> {local_dir} (attempt {attempt}/5)")
            snapshot_download(model_id, local_dir=str(local_dir))
            print("Done.")
            return
        except Exception as err:
            last_err = err
            print(f"Attempt {attempt} failed: {err}", file=sys.stderr)
            time.sleep(min(30, attempt * 3))
    print(f"Download failed after retries: {last_err}", file=sys.stderr)
    sys.exit(1)


if __name__ == "__main__":
    main()
