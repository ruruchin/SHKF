#!/usr/bin/env python3
"""
Fine-tune Konstancia chat LLM (LoRA SFT on Qwen2.5-0.5B-Instruct).
Hugging Face transfer learning — ваша собственная нейросеть Konstancia.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from datasets import Dataset
from peft import LoraConfig, get_peft_model
from transformers import AutoModelForCausalLM, AutoTokenizer, TrainingArguments, Trainer, DataCollatorForLanguageModeling

ROOT = Path(__file__).resolve().parent
DATA_MERGED = ROOT / "data" / "konstancia-chat.merged.jsonl"
DATA_PATH = DATA_MERGED if DATA_MERGED.exists() else ROOT / "data" / "konstancia-chat.jsonl"
OUT_DIR = ROOT / "models" / "konstancia-chat"
BASE_MODEL = "Qwen/Qwen2.5-0.5B-Instruct"

LORA = LoraConfig(
    r=16,
    lora_alpha=32,
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM",
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
)


def load_rows():
    rows = []
    for line in DATA_PATH.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        row = json.loads(line)
        if row.get("messages"):
            rows.append(row)
    return rows


def main():
    rows = load_rows()
    if len(rows) < 4:
        print("Need at least 4 chat rows", file=sys.stderr)
        sys.exit(1)

    tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    texts = []
    for row in rows:
        text = tokenizer.apply_chat_template(
            row["messages"],
            tokenize=False,
            add_generation_prompt=False,
        )
        texts.append(text + tokenizer.eos_token)

    ds = Dataset.from_dict({"text": texts})
    ds = ds.map(
        lambda batch: tokenizer(
            batch["text"],
            truncation=True,
            max_length=1024,
            padding="max_length",
        ),
        batched=True,
        remove_columns=["text"],
    )

    model = AutoModelForCausalLM.from_pretrained(
        BASE_MODEL,
        trust_remote_code=True,
        torch_dtype="auto",
    )
    model = get_peft_model(model, LORA)
    model.print_trainable_parameters()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    args = TrainingArguments(
        output_dir=str(OUT_DIR / "checkpoints"),
        num_train_epochs=6,
        per_device_train_batch_size=1,
        gradient_accumulation_steps=4,
        learning_rate=2e-4,
        warmup_ratio=0.05,
        logging_steps=5,
        save_strategy="epoch",
        report_to=[],
        fp16=False,
        bf16=False,
    )

    collator = DataCollatorForLanguageModeling(tokenizer=tokenizer, mlm=False)
    trainer = Trainer(
        model=model,
        args=args,
        train_dataset=ds,
        processing_class=tokenizer,
        data_collator=collator,
    )

    print(f"Training Konstancia chat on {len(rows)} dialogs, base={BASE_MODEL}")
    trainer.train()
    model.save_pretrained(str(OUT_DIR))
    tokenizer.save_pretrained(str(OUT_DIR))

    meta = {
        "name": "Konstancia",
        "base_model": BASE_MODEL,
        "dialogs": len(rows),
        "method": "lora-sft",
    }
    (OUT_DIR / "konstancia-meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Saved Konstancia chat model to {OUT_DIR}")


if __name__ == "__main__":
    main()
