#!/usr/bin/env python3
"""Download trained Konstancia LoRA from Hugging Face (no local training)."""
from __future__ import annotations

import os
import sys
from pathlib import Path

from hf_hub_env import configure_hf_hub

configure_hf_hub()

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "models" / "konstancia-chat"


def main():
    repo = os.environ.get("HF_LORA_REPO", "").strip() or (sys.argv[1] if len(sys.argv) > 1 else "")
    if not repo or "/" not in repo:
        print("Usage: HF_LORA_REPO=user/konstancia-chat python download_lora_from_hf.py", file=sys.stderr)
        sys.exit(1)

    from huggingface_hub import snapshot_download

    OUT.mkdir(parents=True, exist_ok=True)
    print(f"Downloading LoRA {repo} -> {OUT}")
    snapshot_download(repo, local_dir=str(OUT), repo_type="model")
    print("Done. Konstancia can use cloud URL or local adapter.")


if __name__ == "__main__":
    main()
