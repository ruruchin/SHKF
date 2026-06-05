#!/usr/bin/env python3
"""
Fine-tune Russian BERT for Konstancia intent routing.
Based on Habr: transformers pipeline + text-classification fine-tuning.
https://habr.com/ru/articles/986782/
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from datasets import Dataset
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, f1_score
from transformers import (
    AutoModelForSequenceClassification,
    AutoTokenizer,
    Trainer,
    TrainingArguments,
)

ROOT = Path(__file__).resolve().parent
DATA_MERGED = ROOT / "data" / "konstancia-intents.merged.jsonl"
DATA_PATH = DATA_MERGED if DATA_MERGED.exists() else ROOT / "data" / "konstancia-intents.jsonl"
OUT_DIR = ROOT / "models" / "konstancia-intent"
BASE_MODEL = "cointegrated/rubert-tiny2"


def load_rows():
    rows = []
    for line in DATA_PATH.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        rows.append(json.loads(line))
    return rows


def main():
    rows = load_rows()
    if len(rows) < 8:
        print("Need at least 8 training rows", file=sys.stderr)
        sys.exit(1)

    labels = sorted({r["label"] for r in rows})
    label2id = {label: i for i, label in enumerate(labels)}
    id2label = {i: label for label, i in label2id.items()}

    texts = [r["text"] for r in rows]
    y = [label2id[r["label"]] for r in rows]

    n_classes = len(labels)
    test_count = max(n_classes, int(round(len(rows) * 0.15)))
    if test_count >= len(rows) - 2:
        test_count = max(2, len(rows) // 5)
    test_size = test_count / len(rows)
    can_stratify = len(set(y)) > 1 and len(rows) >= n_classes * 2
    train_texts, val_texts, train_y, val_y = train_test_split(
        texts, y, test_size=test_size, random_state=42, stratify=y if can_stratify else None,
    )

    tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL)
    model = AutoModelForSequenceClassification.from_pretrained(
        BASE_MODEL,
        num_labels=len(labels),
        id2label=id2label,
        label2id=label2id,
    )

    def tokenize(batch):
        return tokenizer(batch["text"], truncation=True, padding="max_length", max_length=128)

    train_ds = Dataset.from_dict({"text": train_texts, "label": train_y})
    val_ds = Dataset.from_dict({"text": val_texts, "label": val_y})
    train_ds = train_ds.map(tokenize, batched=True)
    val_ds = val_ds.map(tokenize, batched=True)

    args = TrainingArguments(
        output_dir=str(OUT_DIR / "checkpoints"),
        num_train_epochs=8,
        per_device_train_batch_size=8,
        per_device_eval_batch_size=8,
        learning_rate=2e-5,
        weight_decay=0.01,
        eval_strategy="epoch",
        save_strategy="epoch",
        load_best_model_at_end=True,
        metric_for_best_model="f1",
        logging_steps=10,
        report_to=[],
    )

    def compute_metrics(eval_pred):
        logits, labels_arr = eval_pred
        preds = np.argmax(logits, axis=1)
        return {
            "accuracy": accuracy_score(labels_arr, preds),
            "f1": f1_score(labels_arr, preds, average="weighted"),
        }

    trainer = Trainer(
        model=model,
        args=args,
        train_dataset=train_ds,
        eval_dataset=val_ds,
        processing_class=tokenizer,
        compute_metrics=compute_metrics,
    )

    print(f"Training {BASE_MODEL} on {len(train_texts)} samples, labels: {labels}")
    trainer.train()
    trainer.save_model(str(OUT_DIR))
    tokenizer.save_pretrained(str(OUT_DIR))

    meta = {"base_model": BASE_MODEL, "labels": labels, "label2id": label2id, "id2label": id2label}
    (OUT_DIR / "konstancia-meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Saved to {OUT_DIR}")


if __name__ == "__main__":
    main()
