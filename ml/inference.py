#!/usr/bin/env python3
"""CLI inference for trained Konstancia HF models (Habr: pipeline + fine-tune + zero-shot)."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
INTENT_DIR = ROOT / "models" / "konstancia-intent"
RETRIEVAL_DIR = ROOT / "models" / "konstancia-retrieval"
ZERO_SHOT_MODEL = "cointegrated/rubert-base-cased-nli-threeway"
FINE_TUNE_THRESHOLD = 0.45

INTENT_LABELS = [
    "general_chat",
    "task_work",
    "file_search",
    "learned_experience",
    "music_easter_egg",
    "reindex",
    "kanban_wide",
]

INTENT_HYPOTHESES = {
    "general_chat": "общий вопрос или совет",
    "task_work": "работа с выбранной задачей Redmine",
    "file_search": "поиск файла или вложения в Redmine",
    "learned_experience": "вопрос про прошлый опыт и похожие задачи",
    "music_easter_egg": "включить музыку Динь Дон Крип-а-Крип",
    "reindex": "переиндексация каталога задач Redmine",
    "kanban_wide": "сводка и анализ Kanban целиком",
}


def _normalize_hits(raw_hits):
    if not raw_hits:
        return []
    hits = raw_hits if isinstance(raw_hits, list) else [raw_hits]
    if hits and isinstance(hits[0], list):
        hits = hits[0]
    out = []
    for hit in hits:
        label = str(hit.get("label", "")).strip()
        score = float(hit.get("score", 0))
        if label:
            out.append({"label": label, "score": score})
    return out


def predict_intent_zero_shot(text: str):
    from transformers import pipeline

    clf = pipeline("zero-shot-classification", model=ZERO_SHOT_MODEL, device=-1)
    labels = list(INTENT_HYPOTHESES.keys())
    result = clf(
        text,
        candidate_labels=labels,
        hypothesis_template="Запрос пользователя относится к теме: {}.",
        multi_label=False,
    )
    hits = [
        {"label": label, "score": float(score)}
        for label, score in zip(result["labels"], result["scores"])
    ]
    return {"ok": True, "intent": hits, "source": "zero_shot"}


def predict_intent_fine_tuned(text: str):
    from transformers import pipeline

    if not INTENT_DIR.exists():
        return {"ok": False, "message": "intent model not trained"}
    clf = pipeline(
        "text-classification",
        model=str(INTENT_DIR),
        tokenizer=str(INTENT_DIR),
        top_k=min(3, len(INTENT_LABELS)),
        device=-1,
    )
    hits = _normalize_hits(clf(text))
    return {"ok": True, "intent": hits, "source": "fine_tuned"}


def predict_intent(text: str, *, threshold: float = FINE_TUNE_THRESHOLD):
    fine = predict_intent_fine_tuned(text)
    if fine.get("ok") and fine.get("intent"):
        top_score = float(fine["intent"][0].get("score", 0))
        if top_score >= threshold:
            fine["source"] = "fine_tuned"
            return fine

    zero = predict_intent_zero_shot(text)
    if zero.get("ok"):
        return zero
    return fine if fine.get("ok") else zero


def encode_query(text: str):
    from sentence_transformers import SentenceTransformer

    if not RETRIEVAL_DIR.exists():
        return {"ok": False, "message": "retrieval model not trained"}
    model = SentenceTransformer(str(RETRIEVAL_DIR))
    vec = model.encode([text], normalize_embeddings=True)[0]
    return {"ok": True, "dim": len(vec), "embedding": vec.tolist()}


def main():
    if len(sys.argv) < 3:
        print(json.dumps({"ok": False, "message": "usage: inference.py <intent|embed> <text>"}))
        sys.exit(1)

    mode = sys.argv[1]
    text = " ".join(sys.argv[2:]).strip()
    if mode == "intent":
        out = predict_intent(text)
    elif mode == "embed":
        out = encode_query(text)
    else:
        out = {"ok": False, "message": f"unknown mode {mode}"}

    print(json.dumps(out, ensure_ascii=False))


if __name__ == "__main__":
    main()
