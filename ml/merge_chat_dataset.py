#!/usr/bin/env python3
"""Merge Konstancia chat JSONL sources (runs on cloud GPU, no Node.js needed)."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
SOURCES = [
    DATA / "konstancia-chat.jsonl",
    DATA / "konstancia-reasoning.jsonl",
    DATA / "konstancia-knowledge-seed.jsonl",
    DATA / "konstancia-knowledge-qa.jsonl",
    DATA / "konstancia-toucan-sft.jsonl",
    ROOT.parent / "config" / "konstancia-chat-feedback.jsonl",
]
OUT = DATA / "konstancia-chat.merged.jsonl"


def read_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        rows.append(json.loads(line))
    return rows


def main():
    seen = set()
    unique = []
    for src in SOURCES:
        for row in read_jsonl(src):
            messages = row.get("messages")
            if not isinstance(messages, list) or len(messages) < 2:
                continue
            key = json.dumps(
                [f"{m.get('role')}:{m.get('content')}" for m in messages],
                ensure_ascii=False,
            )
            if key in seen:
                continue
            seen.add(key)
            unique.append({"messages": messages})

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        "\n".join(json.dumps(r, ensure_ascii=False) for r in unique) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(unique)} chat dialogs -> {OUT}")


if __name__ == "__main__":
    main()
