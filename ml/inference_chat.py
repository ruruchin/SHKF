#!/usr/bin/env python3
"""Local Konstancia chat inference (fine-tuned LoRA or base Qwen)."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CHAT_DIR = ROOT / "models" / "konstancia-chat"
BASE_MODEL = "Qwen/Qwen2.5-0.5B-Instruct"

_model = None
_tokenizer = None


def _resolve_model_path():
    if CHAT_DIR.exists() and (CHAT_DIR / "adapter_config.json").exists():
        return str(CHAT_DIR), str(BASE_MODEL)
    if CHAT_DIR.exists() and (CHAT_DIR / "config.json").exists():
        return str(CHAT_DIR), None
    return str(BASE_MODEL), None


def _load():
    global _model, _tokenizer
    if _model is not None:
        return _model, _tokenizer

    from peft import PeftModel
    from transformers import AutoModelForCausalLM, AutoTokenizer
    import torch

    model_path, base_path = _resolve_model_path()
    _tokenizer = AutoTokenizer.from_pretrained(model_path if base_path is None else base_path, trust_remote_code=True)
    if _tokenizer.pad_token is None:
        _tokenizer.pad_token = _tokenizer.eos_token

    if base_path:
        base = AutoModelForCausalLM.from_pretrained(base_path, trust_remote_code=True, torch_dtype="auto")
        _model = PeftModel.from_pretrained(base, model_path)
    else:
        _model = AutoModelForCausalLM.from_pretrained(model_path, trust_remote_code=True, torch_dtype="auto")

    _model.eval()
    if not torch.cuda.is_available():
        _model.to("cpu")
    return _model, _tokenizer


def chat(messages, *, max_tokens=640, temperature=0.75):
    import torch

    model, tokenizer = _load()
    prompt = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    inputs = tokenizer(prompt, return_tensors="pt", truncation=True, max_length=2048)
    inputs = {k: v.to(model.device) for k, v in inputs.items()}

    with torch.no_grad():
        out = model.generate(
            **inputs,
            max_new_tokens=max(64, min(1536, int(max_tokens))),
            do_sample=temperature > 0.05,
            temperature=max(0.05, min(1.2, float(temperature))),
            top_p=0.9,
            repetition_penalty=1.08,
            pad_token_id=tokenizer.pad_token_id,
            eos_token_id=tokenizer.eos_token_id,
        )

    gen = out[0][inputs["input_ids"].shape[1]:]
    text = tokenizer.decode(gen, skip_special_tokens=True).strip()
    model_path, base_path = _resolve_model_path()
    source = "konstancia-chat" if CHAT_DIR.exists() else "konstancia-base"
    return {
        "ok": True,
        "content": text,
        "model": source,
        "base": base_path or model_path,
    }


def embed_batch(texts):
    from sentence_transformers import SentenceTransformer

    retrieval_dir = ROOT / "models" / "konstancia-retrieval"
    model_id = str(retrieval_dir) if retrieval_dir.exists() else "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    model = SentenceTransformer(model_id)
    vecs = model.encode(list(texts), normalize_embeddings=True)
    return {"ok": True, "vectors": [v.tolist() for v in vecs], "dim": len(vecs[0]) if len(vecs) else 0}


def status():
    ready = CHAT_DIR.exists() and (
        (CHAT_DIR / "adapter_config.json").exists() or (CHAT_DIR / "config.json").exists()
    )
    meta = {}
    meta_path = CHAT_DIR / "konstancia-meta.json"
    if meta_path.exists():
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
    return {
        "ok": True,
        "ready": ready,
        "path": str(CHAT_DIR),
        "trained": ready,
        "meta": meta,
        "fallback": BASE_MODEL if not ready else None,
    }


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"ok": False, "message": "usage: inference_chat.py <status|chat|embed> [json]"}))
        sys.exit(1)

    mode = sys.argv[1]
    if mode == "status":
        print(json.dumps(status(), ensure_ascii=False))
        return

    payload = {}
    if len(sys.argv) > 2:
        payload = json.loads(sys.argv[2])
    elif not sys.stdin.isatty():
        payload = json.loads(sys.stdin.read())

    if mode == "chat":
        out = chat(
            payload.get("messages") or [],
            max_tokens=payload.get("max_tokens", 640),
            temperature=payload.get("temperature", 0.75),
        )
    elif mode == "embed":
        out = embed_batch(payload.get("texts") or [])
    else:
        out = {"ok": False, "message": f"unknown mode {mode}"}

    print(json.dumps(out, ensure_ascii=False))


if __name__ == "__main__":
    main()
