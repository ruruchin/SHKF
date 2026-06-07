#!/usr/bin/env python3

"""Local Konstancia chat inference (LoRA on Toucan / Qwen base)."""

from __future__ import annotations



import json

import sys

from pathlib import Path



from hf_hub_env import configure_hf_hub



configure_hf_hub()



import torch

from konstancia_model_config import get_base_model_id, load_pretrained_extra, resolve_base_model_path



ROOT = Path(__file__).resolve().parent

CHAT_DIR = ROOT / "models" / "konstancia-chat"



_model = None

_tokenizer = None





def _pick_dtype():

    if torch.cuda.is_available():

        return torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16

    return torch.float16





def _adapter_base_model_path() -> str | None:
    adapter_cfg_path = CHAT_DIR / "adapter_config.json"
    if not adapter_cfg_path.exists():
        return None
    try:
        cfg = json.loads(adapter_cfg_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    base = str(cfg.get("base_model_name_or_path") or "").strip()
    if base and Path(base).exists():
        return base
    return base or None


def _resolve_model_path():

    if CHAT_DIR.exists() and (CHAT_DIR / "adapter_config.json").exists():

        base = _adapter_base_model_path() or resolve_base_model_path()

        extra = {"local_files_only": True} if Path(base).exists() else load_pretrained_extra()

        return str(CHAT_DIR), base, extra

    if CHAT_DIR.exists() and (CHAT_DIR / "config.json").exists():

        return str(CHAT_DIR), None, {}

    base = resolve_base_model_path()

    return base, None, load_pretrained_extra()





def _load():

    global _model, _tokenizer

    if _model is not None:

        return _model, _tokenizer



    from peft import PeftModel

    from transformers import AutoModelForCausalLM, AutoTokenizer



    model_path, base_path, extra = _resolve_model_path()

    tok_src = model_path if base_path is None else base_path

    _tokenizer = AutoTokenizer.from_pretrained(tok_src, trust_remote_code=True, **extra)

    if _tokenizer.pad_token is None:

        _tokenizer.pad_token = _tokenizer.eos_token



    dtype = _pick_dtype()

    if base_path:

        base = AutoModelForCausalLM.from_pretrained(

            base_path,

            trust_remote_code=True,

            torch_dtype=dtype,

            low_cpu_mem_usage=True,

            **extra,

        )

        _model = PeftModel.from_pretrained(base, model_path)

    else:

        _model = AutoModelForCausalLM.from_pretrained(

            model_path,

            trust_remote_code=True,

            torch_dtype=dtype,

            low_cpu_mem_usage=True,

            **extra,

        )



    _model.eval()

    if not torch.cuda.is_available():

        _model.to("cpu")

    return _model, _tokenizer





def chat(messages, *, max_tokens=640, temperature=0.75):

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

    model_path, base_path, _ = _resolve_model_path()

    source = "konstancia-chat" if (CHAT_DIR / "adapter_config.json").exists() else "konstancia-base"

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

        "base_model": get_base_model_id(),

        "fallback": get_base_model_id() if not ready else None,

    }





def _friendly_error(err: BaseException) -> str:
    text = str(err)
    if "size mismatch" in text or "copying a param with shape" in text:
        return (
            "LoRA checkpoint does not match base model. "
            "Retrain with the same base or set base_model_name_or_path in adapter_config.json."
        )
    if len(text) > 400:
        return "Konstancia model load failed"
    return text or "Konstancia inference error"


def main():

    if len(sys.argv) < 2:

        print(json.dumps({"ok": False, "message": "usage: inference_chat.py <status|chat|embed> [json]"}))

        sys.exit(1)



    mode = sys.argv[1]

    try:

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

    except Exception as err:

        print(json.dumps({"ok": False, "message": _friendly_error(err)}, ensure_ascii=False))

        sys.exit(0)





if __name__ == "__main__":

    main()

