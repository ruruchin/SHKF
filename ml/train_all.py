#!/usr/bin/env python3
"""Train all Konstancia HF models (chat + intent + retrieval)."""
from train_chat_model import main as train_chat
from train_intent_classifier import main as train_intent
from train_retrieval_embeddings import main as train_retrieval


def main():
    print("=== Konstancia chat LLM (LoRA) ===")
    train_chat()
    print("\n=== Intent classifier ===")
    train_intent()
    print("\n=== Retrieval embeddings ===")
    train_retrieval()
    print("\nDone.")


if __name__ == "__main__":
    main()
