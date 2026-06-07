#!/usr/bin/env python3
"""Download Qwen base model locally (run once if HF SSL fails during train)."""
from __future__ import annotations

import sys
import time
from pathlib import Path

from hf_hub_env import configure_hf_hub

configure_hf_hub()

from konstancia_model_config import get_base_model_id, local_cache_dir

ROOT = Path(__file__).resolve().parent
BASE_MODEL = get_base_model_id()
LOCAL_DIR = local_cache_dir(BASE_MODEL)


def main():
    from huggingface_hub import snapshot_download

    LOCAL_DIR.mkdir(parents=True, exist_ok=True)
    if (LOCAL_DIR / "config.json").exists() and (
        (LOCAL_DIR / "model.safetensors").exists() or any(LOCAL_DIR.glob("model-*.safetensors"))
    ):
        print(f"Already cached: {LOCAL_DIR}")
        return

    last_err = None
    for attempt in range(1, 6):
        try:
            print(f"Downloading {BASE_MODEL} -> {LOCAL_DIR} (attempt {attempt}/5)")
            snapshot_download(BASE_MODEL, local_dir=str(LOCAL_DIR))
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
