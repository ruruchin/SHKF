"""Konstancia chat base model — Toucan agentic checkpoint by default."""
from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent

# Official Toucan SFT checkpoints (https://github.com/TheAgentArk/Toucan)
TOUCAN_7B = "Agent-Ark/Toucan-Qwen2.5-7B-Instruct-v0.1"
TOUCAN_14B = "Agent-Ark/Toucan-Qwen2.5-14B-Instruct-v0.1"
LEGACY_05B = "Qwen/Qwen2.5-0.5B-Instruct"

DEFAULT_BASE_MODEL = TOUCAN_7B
KONSTANCIA_SYSTEM = "Ты — Konstancia, умный ассистент в desktop-приложении SHKF."


def get_base_model_id() -> str:
    return os.environ.get("KONSTANCIA_BASE_MODEL", DEFAULT_BASE_MODEL).strip() or DEFAULT_BASE_MODEL


def local_cache_dir(model_id: str | None = None) -> Path:
    mid = model_id or get_base_model_id()
    folder = mid.split("/")[-1]
    return ROOT / "models" / "hf-cache" / folder


def find_hf_hub_snapshot(model_id: str) -> str | None:
    safe = model_id.replace("/", "--")
    hub = Path.home() / ".cache" / "huggingface" / "hub" / f"models--{safe}" / "snapshots"
    if not hub.is_dir():
        return None
    snaps = sorted(hub.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True)
    for snap in snaps:
        if (snap / "config.json").exists() and (
            (snap / "model.safetensors").exists()
            or any(snap.glob("model-*.safetensors"))
        ):
            return str(snap)
    return None


def resolve_base_model_path() -> str:
    custom = os.environ.get("KONSTANCIA_BASE_MODEL_PATH", "").strip()
    if custom and Path(custom).exists():
        return custom
    local = local_cache_dir()
    if (local / "config.json").exists() and (
        (local / "model.safetensors").exists()
        or any(local.glob("model-*.safetensors"))
    ):
        return str(local)
    cached = find_hf_hub_snapshot(get_base_model_id())
    if cached:
        return cached
    return get_base_model_id()


def load_pretrained_extra() -> dict:
    offline = os.environ.get("HF_HUB_OFFLINE", "").strip().lower() in ("1", "true", "yes")
    model_id = get_base_model_id()
    local_path = resolve_base_model_path()
    use_local = offline or local_path != model_id
    return {"local_files_only": True} if use_local else {}
