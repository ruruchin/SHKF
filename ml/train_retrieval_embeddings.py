#!/usr/bin/env python3
"""
Fine-tune sentence-transformers for Konstancia Redmine retrieval.
Article ref: embeddings + semantic search (all-MiniLM / SBERT pattern).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from sentence_transformers import InputExample, SentenceTransformer, losses
from torch.utils.data import DataLoader

ROOT = Path(__file__).resolve().parent
DATA_PATH = ROOT / "data" / "konstancia-retrieval.jsonl"
OUT_DIR = ROOT / "models" / "konstancia-retrieval"
BASE_MODEL = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"


def load_pairs():
    pairs = []
    for line in DATA_PATH.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        row = json.loads(line)
        pairs.append(InputExample(texts=[row["query"], row["positive"]]))
    return pairs


def main():
    pairs = load_pairs()
    if len(pairs) < 4:
        print("Need at least 4 retrieval pairs", file=sys.stderr)
        sys.exit(1)

    model = SentenceTransformer(BASE_MODEL)
    loader = DataLoader(pairs, shuffle=True, batch_size=4)
    loss = losses.MultipleNegativesRankingLoss(model)

    print(f"Training {BASE_MODEL} on {len(pairs)} query-positive pairs")
    model.fit(
        train_objectives=[(loader, loss)],
        epochs=4,
        warmup_steps=10,
        show_progress_bar=True,
    )
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    model.save(str(OUT_DIR))
    (OUT_DIR / "konstancia-meta.json").write_text(
        json.dumps({"base_model": BASE_MODEL, "pairs": len(pairs)}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"Saved to {OUT_DIR}")


if __name__ == "__main__":
    main()
