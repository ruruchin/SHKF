#!/usr/bin/env python3
"""
Konstancia Cloud Inference API — разверните на GPU-сервере (RunPod, HF, Yandex Cloud).

  pip install fastapi uvicorn
  export KONSTANCIA_API_KEY=your-secret
  uvicorn serve_api:app --host 0.0.0.0 --port 8080

Endpoints:
  GET  /health
  GET  /status
  POST /v1/chat   { messages, max_tokens?, temperature? }
  POST /v1/embed  { texts: [] }
"""
from __future__ import annotations

import os
from typing import Any

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from inference_chat import chat, embed_batch, status

API_KEY = os.environ.get("KONSTANCIA_API_KEY", "").strip()

app = FastAPI(title="Konstancia API", version="1.0")


def _auth(authorization: str | None) -> None:
    if not API_KEY:
        return
    token = (authorization or "").removeprefix("Bearer ").strip()
    if token != API_KEY:
        raise HTTPException(status_code=401, detail="invalid api key")


class ChatRequest(BaseModel):
    messages: list[dict[str, Any]]
    max_tokens: int = Field(default=640, ge=64, le=2048)
    temperature: float = Field(default=0.75, ge=0.0, le=1.5)


class EmbedRequest(BaseModel):
    texts: list[str]


@app.get("/health")
def health():
    return {"ok": True, "service": "konstancia"}


@app.get("/status")
def get_status(authorization: str | None = Header(default=None)):
    _auth(authorization)
    return status()


@app.post("/v1/chat")
def post_chat(body: ChatRequest, authorization: str | None = Header(default=None)):
    _auth(authorization)
    if not body.messages:
        raise HTTPException(status_code=400, detail="messages required")
    out = chat(body.messages, max_tokens=body.max_tokens, temperature=body.temperature)
    if not out.get("ok") and not out.get("content"):
        raise HTTPException(status_code=500, detail=out.get("message", "chat failed"))
    return out


@app.post("/v1/embed")
def post_embed(body: EmbedRequest, authorization: str | None = Header(default=None)):
    _auth(authorization)
    if not body.texts:
        raise HTTPException(status_code=400, detail="texts required")
    out = embed_batch(body.texts)
    if not out.get("ok"):
        raise HTTPException(status_code=500, detail=out.get("message", "embed failed"))
    return out
