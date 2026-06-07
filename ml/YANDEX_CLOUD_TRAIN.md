# Konstancia + Toucan на Yandex Cloud — полная инструкция

Обучение **не на твоём ПК**. На компе только `npm run ml:prepare-cloud` (секунды). Всё тяжёлое — на GPU-виртуалке в Yandex Cloud.

---

## Содержание

1. [Что понадобится](#1-что-понадобится)
2. [Регистрация и деньги](#2-регистрация-и-деньги)
3. [Квота на GPU — обязательно](#3-квота-на-gpu--обязательно)
4. [SSH-ключ на Windows](#4-ssh-ключ-на-windows)
5. [Создание GPU-виртуалки в консоли](#5-создание-gpu-виртуалки-в-консоли)
6. [Подключение по SSH](#6-подключение-по-ssh)
7. [Установка окружения на ВМ](#7-установка-окружения-на-вм)
8. [Обучение Toucan + Konstancia](#8-обучение-toucan--konstancia)
9. [Запуск API после обучения](#9-запуск-api-после-обучения)
10. [Открыть порт 8080 (группа безопасности)](#10-открыть-порт-8080-группа-безопасности)
11. [Подключить SHKF на ПК](#11-подключить-shkf-на-пк)
12. [Сохранить веса на Hugging Face](#12-сохранить-веса-на-hugging-face)
13. [Остановить ВМ и не платить лишнее](#13-остановить-вм-и-не-платить-лишнее)
14. [Повторное обучение](#14-повторное-обучение)
15. [Типичные ошибки](#15-типичные-ошибки)
16. [Создание ВМ через CLI (альтернатива)](#16-создание-вм-через-cli-альтернатива)

---

## 1. Что понадобится

| Что | Зачем |
|-----|-------|
| Аккаунт [Yandex Cloud](https://cloud.yandex.ru/) | GPU-виртуалка |
| Привязанная карта / грант | Оплата GPU (почасовая) |
| **Квота на GPU** | По умолчанию **0** — без заявки ВМ не создать |
| SSH-ключ | Вход на сервер |
| Репозиторий SHKF на GitHub | `git clone` на ВМ |
| ~1–2 часа | Скачивание 7B + обучение LoRA |

### Какой GPU выбрать для Toucan-7B

Модель **Toucan-Qwen2.5-7B** + LoRA требует **минимум ~24 GB VRAM**.

| Платформа в Yandex Cloud | VRAM | Подходит? |
|--------------------------|------|-----------|
| Tesla T4 (`standard-v3-t4`) | 16 GB | **Нет** — не хватит памяти |
| T4i (`standard-v3-t4i`) | 24 GB | **Да**, впритык |
| Tesla V100 (`gpu-standard-v1/v2`) | 32 GB | **Да**, рекомендуется |
| A100 / Gen2 (`gpu-standard-v3`, `gpu-standard-v3i`) | 80 GB | **Да**, быстрее всего |

**Рекомендация:** V100 (32 GB) или A100 — меньше головной боли. T4i — только если других нет.

**Диск:** минимум **50 GB** SSD (модель ~15 GB + кэш + датасет + чекпоинты).

---

## 2. Регистрация и деньги

1. Открой [console.cloud.yandex.ru](https://console.cloud.yandex.ru/).
2. Войди через Яндекс ID.
3. Создай **облако** (cloud), если просят.
4. Создай **каталог** (folder), например `shkf-ml`.
5. **Биллинг** → привяжи платёжный аккаунт (карта). Без этого GPU не выдадут.

На старте часто дают **пробный грант** — его хватит на несколько часов GPU.

---

## 3. Квота на GPU — обязательно

По умолчанию квота на GPU = **0**. Это главная причина, почему «не даёт создать ВМ».

1. Консоль → **Квоты** (или [прямая ссылка на квоты](https://console.cloud.yandex.ru/cloud/quotas)).
2. Найди строки вроде:
   - `Compute Cloud` → **GPUs**
   - `gpu-standard-v2`, `gpu-standard-v3`, `standard-v3-t4i` и т.д.
3. Если везде **0** → **Создать запрос на увеличение квоты** / **Обратиться в поддержку**.
4. В заявке напиши примерно:

   > Нужна 1 GPU-ВМ для обучения LLM (LoRA fine-tuning, 7B параметров). Платформа: gpu-standard-v2 (V100) или gpu-standard-v3 (A100). Каталог: shkf-ml.

5. Обычно отвечают от нескольких часов до 1–2 рабочих дней.

Пока квота 0 — дальше бессмысленно, жди одобрения.

---

## 4. SSH-ключ на Windows

На ВМ логин будет **`yc-user`**.

### PowerShell (Windows 10/11)

```powershell
ssh-keygen -t ed25519 -f $env:USERPROFILE\.ssh\yc-konstancia -N '""'
```

Публичный ключ (скопируй целиком — понадобится в консоли):

```powershell
Get-Content $env:USERPROFILE\.ssh\yc-konstancia.pub
```

Подключение потом:

```powershell
ssh -i $env:USERPROFILE\.ssh\yc-konstancia yc-user@<ПУБЛИЧНЫЙ_IP>
```

---

## 5. Создание GPU-виртуалки в консоли

1. [Консоль Yandex Cloud](https://console.cloud.yandex.ru/) → каталог **shkf-ml**.
2. **Compute Cloud** → **Виртуальные машины** → **Создать ВМ**.

### Имя и зона

| Поле | Значение |
|------|----------|
| Имя | `konstancia-train` |
| Зона | `ru-central1-a` (или другая, где есть GPU — смотри в мастере) |

### Образ (ОС)

**Важно:** бери образ **с CUDA**, не обычный Ubuntu.

- **Ubuntu 22.04 LTS GPU CUDA 12.2** (`ubuntu-2204-lts-cuda-12-2`) — для V100 / A100 / T4i  
  или  
- **Ubuntu 20.04 LTS GPU** — для старых платформ V100.

В маркетплейсе: поиск `CUDA` / `GPU`.

### Диск

| Поле | Значение |
|------|----------|
| Тип | **SSD** |
| Размер | **50–100 GB** |

### Вычислительные ресурсы

Вкладка **GPU** / **Своя конфигурация**:

| Поле | Значение |
|------|----------|
| Платформа | **gpu-standard-v2** (V100 32GB) или **gpu-standard-v3** (A100) |
| GPU | **1** |
| vCPU / RAM | подставятся автоматически (например 8 vCPU / 48 GB для v2) |

Не бери **T4 16GB** — для 7B мало.

### Сеть

| Поле | Значение |
|------|----------|
| Подсеть | default / создай новую |
| **Публичный адрес** | **Автоматически** (IPv4) — без этого с ПК не зайдёшь |

### Доступ

| Поле | Значение |
|------|----------|
| Логин | `yc-user` (по умолчанию для образов YC) |
| SSH-ключ | вставь содержимое `yc-konstancia.pub` |

### Группа безопасности

Можно оставить default на этапе создания — порт 8080 откроем в [шаге 10](#10-открыть-порт-8080-группа-безопасности).

Нажми **Создать ВМ**. Статус должен стать **Running**. Запиши **публичный IP** (например `84.201.xxx.xxx`).

---

## 6. Подключение по SSH

```powershell
ssh -i $env:USERPROFILE\.ssh\yc-konstancia yc-user@84.201.xxx.xxx
```

Первый раз спросит `yes` — соглашайся.

Проверка GPU:

```bash
nvidia-smi
```

Должна быть видеокарта (V100 / A100 / T4i) и версия драйвера. Если `command not found` — образ выбран без GPU-драйверов, пересоздай ВМ с образом `ubuntu-2204-lts-cuda-12-2`.

---

## 7. Установка окружения на ВМ

Всё ниже — **на сервере**, не на твоём ПК.

```bash
# Системные пакеты
sudo apt-get update
sudo apt-get install -y git python3-pip python3-venv

# Рабочая папка
mkdir -p ~/shkf && cd ~/shkf

# Клон репозитория (подставь свой URL, если форк)
git clone https://github.com/ruruchin/SHKF.git .
# или: git clone https://github.com/ТВОЙ_ЮЗЕР/figma-hotkeys.git .

cd ml

# Виртуальное окружение Python
python3 -m venv .venv
source .venv/bin/activate

# PyTorch с CUDA (на образе YC CUDA часто уже есть torch — проверь)
python -c "import torch; print(torch.__version__, torch.cuda.is_available())"
```

Если `torch.cuda.is_available()` = **False**:

```bash
pip install torch --index-url https://download.pytorch.org/whl/cu121
```

Зависимости проекта:

```bash
pip install -r requirements.txt
```

Проверка ещё раз:

```bash
python -c "import torch; print('GPU:', torch.cuda.get_device_name(0))"
```

---

## 8. Обучение Toucan + Konstancia

### Что делает `cloud_train.sh`

1. Импортирует **600 multi-turn** диалогов из [Toucan-1.5M](https://huggingface.co/datasets/Agent-Ark/Toucan-1.5M) (Hugging Face).
2. Склеивает с твоими диалогами Konstancia (`konstancia-chat.jsonl` и др.).
3. Скачивает базу **[Toucan-Qwen2.5-7B-Instruct](https://huggingface.co/Agent-Ark/Toucan-Qwen2.5-7B-Instruct-v0.1)** (~15 GB).
4. Обучает **LoRA** → `ml/models/konstancia-chat/`.

### Запуск (долго — 40–90 минут)

Обучение обрывается, если закроешь SSH. Используй **tmux**:

```bash
cd ~/shkf/ml
source .venv/bin/activate

sudo apt-get install -y tmux   # если нет
tmux new -s train
```

Внутри tmux:

```bash
export KONSTANCIA_API_KEY=придумай-длинный-секрет-32символа
bash cloud_train.sh
```

Увидишь лог:

```
[1/5] Import Toucan multi-turn SFT...
[2/5] Merge Konstancia + Toucan datasets...
[3/5] Download Toucan-Qwen2.5-7B...
[4/5] Train LoRA adapter...
[5/5] Done.
```

**Отсоединиться от tmux** (обучение продолжится): `Ctrl+B`, затем `D`.

**Вернуться к логу:**

```bash
tmux attach -t train
```

### На твоём ПК перед обучением (опционально)

Чтобы свежие диалоги попали в репозиторий:

```powershell
cd C:\Users\User\figma-hotkeys
npm run ml:prepare-cloud
git add ml/data
git commit -m "konstancia train data"
git push
```

На ВМ потом: `git pull` в `~/shkf` перед `bash cloud_train.sh`.

---

## 9. Запуск API после обучения

Когда обучение закончилось, на **той же ВМ** подними HTTP API (модель отвечает из GPU, ПК не нагружается).

### Вариант А — сразу после train (одной командой)

Перед `cloud_train.sh`:

```bash
export KONSTANCIA_API_KEY=твой-секрет
export KONSTANCIA_SERVE_AFTER_TRAIN=1
bash cloud_train.sh
```

Скрипт после train сам запустит `uvicorn` на порту **8080**.

### Вариант Б — API уже обучен, только поднять сервер

```bash
cd ~/shkf/ml
source .venv/bin/activate
export KONSTANCIA_API_KEY=твой-секрет

pip install -r requirements-serve.txt
tmux new -s api
uvicorn serve_api:app --host 0.0.0.0 --port 8080
```

Проверка **на сервере**:

```bash
curl http://127.0.0.1:8080/health
# {"ok":true,"service":"konstancia"}

curl -H "Authorization: Bearer твой-секрет" http://127.0.0.1:8080/status
```

---

## 10. Открыть порт 8080 (группа безопасности)

По умолчанию Yandex Cloud **блокирует входящие** на 8080. SHKF с твоего ПК не достучится, пока не откроешь порт.

1. Консоль → **Virtual Private Cloud** → **Группы безопасности**.
2. Найди группу, привязанную к ВМ `konstancia-train` (часто `default-sg-...`).
3. **Правила для входящего трафика** → **Добавить**:
   - **Диапазон портов:** `8080`
   - **Протокол:** TCP
   - **Источник:** `0.0.0.0/0` (для теста)  
     Для продакшена лучше указать **только свой IP** с [2ip.ru](https://2ip.ru).
   - **Описание:** `Konstancia API`
4. Сохранить.

Проверка **с твоего ПК** (PowerShell):

```powershell
curl http://84.201.xxx.xxx:8080/health
```

Если таймаут — снова проверь группу безопасности и что `uvicorn` запущен.

---

## 11. Подключить SHKF на ПК

1. Запусти SHKF.
2. **Настройки** → **Konstancia**.
3. Заполни:

| Поле | Значение |
|------|----------|
| Движок | **Konstancia** (не GigaChat) |
| **Cloud URL** | `http://84.201.xxx.xxx:8080` |
| **Cloud API key** | тот же `KONSTANCIA_API_KEY` |

4. Сохранить.
5. В чате Konstancia напиши `привет` — в футере должно быть **Konstancia**, ответ с сервера.

ПК **не качает 7B** — только HTTP-запросы к Yandex Cloud.

### Через `.env` (опционально)

```env
KONSTANCIA_CLOUD_URL=http://84.201.xxx.xxx:8080
KONSTANCIA_CLOUD_API_KEY=твой-секрет
```

---

## 12. Сохранить веса на Hugging Face

Чтобы не потерять LoRA при удалении ВМ:

1. Токен: [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) → **Write**.
2. На ВМ:

```bash
export HF_TOKEN=hf_xxxxxxxx
export HF_UPLOAD_REPO=твой-username/konstancia-chat
bash cloud_train.sh
```

Или только upload после уже готового train:

```bash
cd ~/shkf/ml && source .venv/bin/activate
export HF_TOKEN=hf_xxx
export HF_UPLOAD_REPO=твой-username/konstancia-chat
python - <<'PY'
from huggingface_hub import HfApi
import os
api = HfApi()
api.create_repo(os.environ["HF_UPLOAD_REPO"], private=True, exist_ok=True)
api.upload_folder("models/konstancia-chat", os.environ["HF_UPLOAD_REPO"], repo_type="model")
print("OK")
PY
```

Скачать на ПК **без обучения**:

```powershell
set HF_LORA_REPO=твой-username/konstancia-chat
set HF_TOKEN=hf_xxx
npm run ml:download-lora
```

---

## 13. Остановить ВМ и не платить лишнее

GPU тарифицируется **пока ВМ Running**, даже если train закончился.

1. Консоль → **Виртуальные машины** → `konstancia-train`.
2. **Остановить** — платишь только за диск (~копейки за ГБ).
3. Перед следующим train → **Запустить** снова.

**Удалить ВМ** — если веса уже на Hugging Face или API больше не нужен.

| Действие | Платишь за |
|----------|------------|
| Running + GPU | GPU + vCPU + RAM + диск (дорого) |
| Stopped | Только диск (дёшево) |
| Удалена | Ничего (если диск тоже удалили) |

---

## 14. Повторное обучение

```bash
ssh -i ~/.ssh/yc-konstancia yc-user@<IP>
cd ~/shkf && git pull
cd ml && source .venv/bin/activate
tmux new -s train
bash cloud_train.sh
```

После — перезапусти API (шаг 9).

---

## 15. Типичные ошибки

### «Квота GPU = 0» / не даёт создать ВМ

→ [Шаг 3](#3-квота-на-gpu--обязательно), заявка в поддержку.

### `CUDA GPU required` / `cuda.is_available() = False`

→ Образ без драйверов. Пересоздай ВМ с **Ubuntu 22.04 LTS GPU CUDA 12.2**.

### `CUDA out of memory` при train

→ GPU слишком слабый (T4 16GB). Возьми **V100** или **A100**.  
Или на ВМ: `export KONSTANCIA_MAX_SEQ=512` и снова `bash cloud_train.sh`.

### SSH `Connection timed out`

→ Нет публичного IP или неверный IP. Проверь в карточке ВМ.

### SHKF не подключается к Cloud URL

→ API не запущен (`tmux attach -t api`).  
→ Порт **8080** не открыт в [группе безопасности](#10-открыть-порт-8080-группа-безопасности).  
→ Неверный API key.

### Hugging Face SSL / timeout из РФ

На ВМ:

```bash
export HF_HUB_DISABLE_SSL_VERIFY=1
bash cloud_train.sh
```

### Обучение прервалось при закрытии терминала

→ Всегда используй **tmux** ([шаг 8](#8-обучение-toucan--konstancia)).

---

## 16. Создание ВМ через CLI (альтернатива)

Если удобнее терминал, а не консоль.

### Установка `yc` CLI на ПК

[Документация](https://cloud.yandex.ru/docs/cli/quickstart): установи CLI, выполни `yc init`.

### Создание ВМ (пример V100)

Подставь зону и семейство образа из `yc compute image list --folder-id standard-images | grep -i cuda`.

```bash
yc compute instance create \
  --name konstancia-train \
  --zone ru-central1-a \
  --platform gpu-standard-v2 \
  --cores 8 \
  --memory 48 \
  --gpus 1 \
  --create-boot-disk size=50,type=network-ssd,image-family=ubuntu-2204-lts-cuda-12-2 \
  --network-interface subnet-name=default-ru-central1-a,nat-ip-version=ipv4 \
  --ssh-key ~/.ssh/yc-konstancia.pub
```

Узнать IP:

```bash
yc compute instance get konstancia-train --format json | jq -r '.network_interfaces[0].primary_v4_address.one_to_one_nat.address'
```

Дальше — с [шага 6](#6-подключение-по-ssh).

---

## Шпаргалка одной страницей

```text
ПК:     npm run ml:prepare-cloud && git push
YC:     создать GPU ВМ (V100/A100, 50GB, CUDA образ, публичный IP, SSH)
SSH:    ssh yc-user@IP
ВМ:     git clone ... && cd ml && python3 -m venv .venv && source .venv/bin/activate
        pip install -r requirements.txt
        tmux new -s train
        export KONSTANCIA_API_KEY=секрет
        export KONSTANCIA_SERVE_AFTER_TRAIN=1
        bash cloud_train.sh
VPC:    открыть TCP 8080 в группе безопасности
SHKF:   Cloud URL = http://IP:8080, API key = секрет
Деньги: Остановить ВМ когда не нужна
```

Официальная документация Yandex: [Создание ВМ с GPU](https://cloud.yandex.ru/docs/compute/operations/vm-create/create-vm-with-gpu).
