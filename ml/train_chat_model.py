#!/usr/bin/env python3

"""

Fine-tune Konstancia chat LLM (LoRA SFT on Toucan-Qwen2.5-7B-Instruct by default).

"""

from __future__ import annotations



import json

import sys

from pathlib import Path



from hf_hub_env import configure_hf_hub



configure_hf_hub()



import torch

from datasets import Dataset

from peft import LoraConfig, get_peft_model

from transformers import AutoModelForCausalLM, AutoTokenizer, TrainingArguments, Trainer, DataCollatorForLanguageModeling



from konstancia_model_config import get_base_model_id, load_pretrained_extra, resolve_base_model_path



ROOT = Path(__file__).resolve().parent

DATA_MERGED = ROOT / "data" / "konstancia-chat.merged.jsonl"

DATA_PATH = DATA_MERGED if DATA_MERGED.exists() else ROOT / "data" / "konstancia-chat.jsonl"

OUT_DIR = ROOT / "models" / "konstancia-chat"



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





def pick_dtype():

    if torch.cuda.is_available():

        return torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16

    return torch.float16





def main():

    rows = load_rows()

    if len(rows) < 4:

        print("Need at least 4 chat rows", file=sys.stderr)

        sys.exit(1)



    base_model = resolve_base_model_path()

    extra = load_pretrained_extra()

    dtype = pick_dtype()

    use_cuda = torch.cuda.is_available()

    max_len = int(__import__("os").environ.get("KONSTANCIA_MAX_SEQ", "768"))



    print(f"Base model: {get_base_model_id()}")

    print(f"Resolved path: {base_model}" + (" (offline)" if extra.get("local_files_only") else ""))

    print(f"Device: {'cuda' if use_cuda else 'cpu'}, dtype={dtype}, dialogs={len(rows)}")



    tokenizer = AutoTokenizer.from_pretrained(base_model, trust_remote_code=True, **extra)

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

            max_length=max_len,

            padding="max_length",

        ),

        batched=True,

        remove_columns=["text"],

    )



    model = AutoModelForCausalLM.from_pretrained(

        base_model,

        trust_remote_code=True,

        torch_dtype=dtype,

        low_cpu_mem_usage=True,

        **extra,

    )

    if hasattr(model, "gradient_checkpointing_enable"):

        model.gradient_checkpointing_enable()

    model = get_peft_model(model, LORA)

    model.print_trainable_parameters()



    OUT_DIR.mkdir(parents=True, exist_ok=True)

    epochs = 4 if use_cuda else 2

    args = TrainingArguments(

        output_dir=str(OUT_DIR / "checkpoints"),

        num_train_epochs=epochs,

        per_device_train_batch_size=1,

        gradient_accumulation_steps=8 if not use_cuda else 4,

        learning_rate=1e-4 if "Toucan" in get_base_model_id() else 2e-4,

        warmup_ratio=0.05,

        logging_steps=5,

        save_strategy="epoch",

        report_to=[],

        fp16=use_cuda and dtype == torch.float16,

        bf16=use_cuda and dtype == torch.bfloat16,

        gradient_checkpointing=True,

        optim="adamw_torch",

    )



    collator = DataCollatorForLanguageModeling(tokenizer=tokenizer, mlm=False)

    trainer = Trainer(

        model=model,

        args=args,

        train_dataset=ds,

        processing_class=tokenizer,

        data_collator=collator,

    )



    print(f"Training Konstancia chat on {len(rows)} dialogs")

    trainer.train()

    model.save_pretrained(str(OUT_DIR))

    tokenizer.save_pretrained(str(OUT_DIR))



    meta = {

        "name": "Konstancia",

        "base_model": get_base_model_id(),

        "base_model_path": base_model,

        "dialogs": len(rows),

        "method": "lora-sft-toucan",

        "toucan": "Agent-Ark/Toucan-Qwen2.5-7B-Instruct-v0.1" in get_base_model_id(),

    }

    (OUT_DIR / "konstancia-meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Saved Konstancia chat model to {OUT_DIR}")





if __name__ == "__main__":

    main()

