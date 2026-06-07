#!/usr/bin/env python3
"""Import Toucan-1.5M SFT multi-turn dialogs for Konstancia LoRA training."""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from hf_hub_env import configure_hf_hub

configure_hf_hub()

from konstancia_model_config import KONSTANCIA_SYSTEM

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "data" / "konstancia-toucan-sft.jsonl"

SUBSETS = tuple(
    s.strip()
    for s in os.environ.get("TOUCAN_SFT_SUBSETS", "multi-turn,diversify").split(",")
    if s.strip()
)
LIMIT = int(os.environ.get("TOUCAN_SFT_LIMIT", "600"))
MAX_TURNS = int(os.environ.get("TOUCAN_MAX_TURNS", "8"))


def parse_messages(raw):
    if isinstance(raw, str):
        return json.loads(raw)
    return raw


def slim_messages(messages: list) -> list | None:
    slim = [{"role": "system", "content": KONSTANCIA_SYSTEM}]
    for msg in messages:
        role = msg.get("role")
        content = msg.get("content")
        if role not in ("user", "assistant"):
            continue
        text = str(content or "").strip()
        if not text:
            continue
        slim.append({"role": role, "content": text})
    if len(slim) < 3:
        return None
    # keep system + last N user/assistant turns
    body = slim[1:]
    if len(body) > MAX_TURNS:
        body = body[-MAX_TURNS:]
    return [slim[0], *body]


def main():
    from datasets import load_dataset

    OUT.parent.mkdir(parents=True, exist_ok=True)
    rows = []
    seen = set()

    print(f"Streaming Agent-Ark/Toucan-1.5M SFT, subsets={SUBSETS}, limit={LIMIT}")
    ds = load_dataset("Agent-Ark/Toucan-1.5M", "SFT", split="train", streaming=True)

    for row in ds:
        subset = row.get("subset_name") or ""
        if subset not in SUBSETS:
            continue
        try:
            messages = parse_messages(row.get("messages"))
        except (json.JSONDecodeError, TypeError):
            continue
        if not isinstance(messages, list):
            continue
        slim = slim_messages(messages)
        if not slim:
            continue
        key = json.dumps(slim, ensure_ascii=False)
        if key in seen:
            continue
        seen.add(key)
        rows.append({"messages": slim, "source": f"toucan:{subset}"})
        if len(rows) >= LIMIT:
            break

    if not rows:
        print("No Toucan rows imported", file=sys.stderr)
        sys.exit(1)

    OUT.write_text(
        "\n".join(json.dumps(r, ensure_ascii=False) for r in rows) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(rows)} Toucan dialogs -> {OUT}")


if __name__ == "__main__":
    main()
