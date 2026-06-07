# Обучение Konstancia на Toucan — только в облаке

Локальный ПК **не качает 7B-модель и не тренирует**. На компьютере — только подготовка JSONL (`npm run ml:prepare-cloud`). Всё тяжёлое — на GPU-поде.

## Что нужно

| Ресурс | Минимум |
|--------|---------|
| GPU | NVIDIA 24GB+ VRAM (A5000, A6000, RTX 4090, A100) |
| Диск на поде | ~20 GB |
| Время | 30–90 мин на Toucan-7B + LoRA |

Провайдеры: [RunPod](https://www.runpod.io/), [Yandex Cloud GPU](https://cloud.yandex.ru/docs/gpu/), Vast.ai, Lambda.

> **Yandex Cloud пошагово (от регистрации до SHKF):** [`ml/YANDEX_CLOUD_TRAIN.md`](./YANDEX_CLOUD_TRAIN.md)

## 1. На своём ПК (секунды, без нагрузки)

```bash
git add -A && git commit -m "konstancia data" && git push
npm run ml:prepare-cloud
```

Или просто `git push` — датасеты уже в репозитории.

## 2. GPU-под (RunPod)

1. **Pods → Deploy** → шаблон **PyTorch 2.x** (CUDA 12).
2. GPU: **RTX 4090 / A5000** (24GB).
3. Disk: **30 GB**.
4. Terminal на поде:

```bash
git clone https://github.com/ruruchin/SHKF.git
cd SHKF/ml
bash cloud_train.sh
```

Скрипт сам:
- импортирует 600 multi-turn диалогов из [Toucan-1.5M](https://huggingface.co/datasets/Agent-Ark/Toucan-1.5M);
- скачает [Toucan-Qwen2.5-7B](https://huggingface.co/Agent-Ark/Toucan-Qwen2.5-7B-Instruct-v0.1);
- обучит LoRA → `models/konstancia-chat/`.

### Сразу поднять API после обучения

```bash
export KONSTANCIA_API_KEY=my-secret-key
export KONSTANCIA_SERVE_AFTER_TRAIN=1
bash cloud_train.sh
```

Откройте порт **8080** в RunPod (TCP Public IP). URL: `http://<public-ip>:8080`.

### Залить веса на Hugging Face

```bash
export HF_TOKEN=hf_...
export HF_UPLOAD_REPO=your-user/konstancia-chat
bash cloud_train.sh
```

Потом на ПК (без обучения):

```bash
set HF_LORA_REPO=your-user/konstancia-chat
npm run ml:download-lora
```

## 3. SHKF — подключить облако

**Настройки → Konstancia:**

| Поле | Значение |
|------|----------|
| Движок | Konstancia (локальная) |
| Cloud URL | `http://<pod-ip>:8080` |
| Cloud API key | тот же `KONSTANCIA_API_KEY` |

При заполненном Cloud URL приложение **не грузит модель на ПК** — все ответы идут с GPU-пода.

## Docker (любой облачный GPU-хост)

```bash
cd ml
docker build -f Dockerfile.train -t konstancia-train .
docker run --gpus all \
  -e HF_TOKEN=hf_... \
  -e HF_UPLOAD_REPO=your-user/konstancia-chat \
  -e KONSTANCIA_SERVE_AFTER_TRAIN=1 \
  -e KONSTANCIA_API_KEY=my-secret \
  -p 8080:8080 \
  konstancia-train
```

## Переменные окружения

| Переменная | Где | Назначение |
|------------|-----|------------|
| `HF_TOKEN` | облако | Upload/download весов |
| `HF_UPLOAD_REPO` | облако | `user/konstancia-chat` после train |
| `HF_LORA_REPO` | ПК | Скачать готовый LoRA без train |
| `KONSTANCIA_SERVE_AFTER_TRAIN` | облако | `1` — запустить API |
| `KONSTANCIA_API_KEY` | облако + SHKF | Bearer-токен API |
| `KONSTANCIA_CLOUD_URL` | `.env` / настройки | URL GPU API |
| `TOUCAN_SFT_LIMIT` | облако | Сколько Toucan-диалогов (default 600) |

## Локальное обучение (не рекомендуется)

Только если осознанно хотите нагрузить ПК:

```bash
npm run ml:train:chat:local
```
