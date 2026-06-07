#!/usr/bin/env bash
# Konstancia + Toucan LoRA training — run ONLY on a cloud GPU pod (RunPod, Yandex Cloud, etc.)
set -euo pipefail
cd "$(dirname "$0")"

export PYTHONUNBUFFERED=1
export PYTHONIOENCODING=utf-8

echo "=============================================="
echo " Konstancia Toucan — cloud GPU training"
echo "=============================================="

if ! python -c "import torch; assert torch.cuda.is_available(), 'CUDA GPU required'"; then
  echo "ERROR: No CUDA GPU found. Do not run this on your desktop — use RunPod / Yandex Cloud."
  exit 1
fi

python -c "import torch; print('GPU:', torch.cuda.get_device_name(0))"

pip install -q -r requirements.txt

echo "[1/5] Import Toucan multi-turn SFT from Hugging Face..."
python import_toucan_sft.py

echo "[2/5] Merge Konstancia + Toucan datasets..."
python merge_chat_dataset.py

echo "[3/5] Download Toucan-Qwen2.5-7B base weights..."
python download_toucan_base.py

echo "[4/5] Train LoRA adapter..."
python train_chat_model.py

echo "[5/5] Done. Adapter saved to models/konstancia-chat/"

if [[ -n "${HF_UPLOAD_REPO:-}" && -n "${HF_TOKEN:-}" ]]; then
  echo "Uploading LoRA to Hugging Face: ${HF_UPLOAD_REPO}"
  python - <<PY
from huggingface_hub import HfApi
import os
api = HfApi()
repo = os.environ["HF_UPLOAD_REPO"]
api.create_repo(repo, private=True, exist_ok=True)
api.upload_folder(
    folder_path="models/konstancia-chat",
    repo_id=repo,
    repo_type="model",
)
print(f"Uploaded -> https://huggingface.co/{repo}")
PY
fi

if [[ "${KONSTANCIA_SERVE_AFTER_TRAIN:-}" == "1" ]]; then
  echo "Starting inference API on :8080 ..."
  pip install -q -r requirements-serve.txt
  exec uvicorn serve_api:app --host 0.0.0.0 --port "${PORT:-8080}"
fi

echo ""
echo "Next steps:"
echo "  • Keep pod running: KONSTANCIA_SERVE_AFTER_TRAIN=1 bash cloud_train.sh"
echo "  • Or upload: HF_UPLOAD_REPO=your-user/konstancia-chat HF_TOKEN=hf_... bash cloud_train.sh"
echo "  • In SHKF: Settings → Konstancia → Cloud URL = http://<pod-ip>:8080"
