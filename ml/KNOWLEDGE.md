# Konstancia — обучение на интернете и «мышление»

План основан на [обзоре ресурсов для ML на Habr](https://habr.com/ru/articles/753920/) и практике transfer learning (Hugging Face, fast.ai, PyTorch).

## Архитектура навыков

| Навык | Модель | Данные |
|-------|--------|--------|
| Маршрутизация запросов | `konstancia-intent` (ruBERT) | `ml/data/konstancia-intents.jsonl` |
| Семантический поиск | `konstancia-retrieval` (MiniLM) | Redmine + **статьи из интернета** |
| Диалог и анализ | `konstancia-chat` (Qwen + LoRA) | диалоги + reasoning + Q&A из статей |
| Актуальные факты | RAG + DuckDuckGo/Wikipedia | runtime, без переобучения |

## Фазы внедрения (по материалам Habr)

### Фаза 1 — Основы (сделано)
- [x] Transfer learning / LoRA (`train_chat_model.py`)
- [x] Intent-классификатор
- [x] Retrieval embeddings
- [x] Web search (Wikipedia, DDG)
- [x] Seed reasoning: `ml/data/konstancia-reasoning.jsonl`
- [x] Ingest статей: `npm run ml:ingest-knowledge`

### Фаза 2 — База знаний (сделано)
- [x] `config/konstancia-knowledge-sources.json` — курируемые URL
- [x] RAG в агенте (блок «База знаний Konstancia»)
- [x] Экспорт в train: `konstancia-knowledge-qa.jsonl`, `konstancia-knowledge-retrieval.jsonl`
- [ ] Расширить источники: arXiv abstracts, Habr RSS, документация библиотек

### Фаза 3 — Анализ и рассуждение (в работе)
- [x] Промпт: шаги → **Вывод**
- [x] Обучающие примеры CoT в `konstancia-reasoning.jsonl`
- [ ] Chain-of-thought distillation с teacher-модели на 200+ тем
- [ ] Оценка: чеклист 50 вопросов из CS231n / fast.ai

### Фаза 4 — Непрерывное обучение
- [ ] Авто-экспорт удачных ответов → `config/konstancia-chat-feedback.jsonl`
- [ ] Еженедельный `npm run ml:train:knowledge` на GPU
- [ ] Версионирование весов на Hugging Face (`npm run ml:upload-hf`)

## Команды

```bash
# 1. Скачать статьи и собрать train-данные
npm run ml:ingest-knowledge

# 2. Полный цикл: ingest + merge + chat + retrieval
npm run ml:train:knowledge

# 3. Только чат (диалоги + reasoning + статьи)
npm run ml:export-chat && npm run ml:train:chat
```

## Добавить источник

Отредактируйте `config/konstancia-knowledge-sources.json`:

```json
{
  "id": "my-article",
  "title": "Название",
  "url": "https://habr.com/ru/articles/...",
  "category": "ml-basics",
  "tags": ["habr", "tutorial"]
}
```

Затем: **Настройки → Индексировать статьи** или `npm run ml:ingest-knowledge`.

## Рекомендуемые ресурсы из Habr-обзора

- **Старт:** [MLU-Explain](https://mlu-explain.github.io/), 3Blue1Brown neural networks
- **Практика:** [fast.ai](https://course.fast.ai/), [Hugging Face Transformers](https://huggingface.co/docs/transformers)
- **Фреймворки:** [PyTorch tutorials](https://pytorch.org/tutorials/beginner/basics/intro.html)
- **CV:** [Stanford CS231n](https://cs231n.stanford.edu/)
- **Код:** [transformers](https://github.com/huggingface/transformers) (BERT, GPT, PEFT)

## Где обучать

GPU pod (RunPod / Yandex Cloud): `npm run ml:train:knowledge` → `npm run ml:upload-hf -- user/konstancia-chat`.

## Как модель «думает»

1. **Intent** решает: общий вопрос / Redmine / задача.
2. **RAG** подтягивает чанки статей + web search.
3. **Chat LLM** строит ответ: шаги анализа → вывод (обучено на `konstancia-reasoning.jsonl`).
4. Веса хранят локальный стиль SHKF; факты — в индексе и интернете.
