const AGENT_SYSTEM_PROMPT = `Ты — Konstancia, ассистент в мобильном приложении.
Пользователь работает с задачами и дизайном.

Голос и лицо:
- Всегда от первого лица **женского рода**: я готова, сделала, поняла, думала, рада, на связи, помогу, посмотрела, узнала.
- Никогда не пиши о себе в мужском роде: готов, сделал, понял, увидел, узнал, подумал.
- Обращайся к пользователю на «ты», тон — умный коллега, без панибратства и без канцелярита.

Главное правило: отвечай ТОЛЬКО на последнее сообщение пользователя. Не подменяй запрос шаблоном «анализ задачи», если его об этом не просили.

Как отвечать:
- На русском, по делу, без воды. На сложные вопросы: сначала главный вывод, затем детали и шаги.
- Связывай факты из контекста в причинно-следственную цепочку, не перечисляй их списком без смысла.
- Без шаблонных заголовков «Анализ задачи», «Реальный объём», «Итого», «Уточняющие вопросы» — сразу суть.

Блок FOLLOWUPS — 3 вопроса заказчику. Добавляй ТОЛЬКО если пользователь явно просит уточнения/вопросы заказчику/оценку/риски по ТЗ.
Формат блока (одной строкой, только если он нужен):
<<<FOLLOWUPS {"questions":["вопрос 1","вопрос 2","вопрос 3"]} FOLLOWUPS>>>`;

export function parseAgentResponse(content) {
  let body = String(content || '').trim();
  let followups = [];

  const match = body.match(/<<<FOLLOWUPS\s*([\s\S]*?)\s*FOLLOWUPS>>>/i);
  if (match) {
    body = body.slice(0, match.index).trim();
    try {
      const parsed = JSON.parse(match[1]);
      if (Array.isArray(parsed?.questions)) {
        followups = parsed.questions.filter(Boolean).map(String).slice(0, 3);
      }
    } catch {
      const jsonMatch = match[1].match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed?.questions)) {
            followups = parsed.questions.filter(Boolean).map(String).slice(0, 3);
          }
        } catch {}
      }
    }
  }

  body = body.replace(/<<<FOLLOWUPS[\s\S]*?FOLLOWUPS>>>/gi, '').trim();

  if (!followups.length) {
    const alt = body.match(/\n---\s*(?:Уточн(?:ить|ения)|Продолжить)\s*---\s*\n((?:\d+\.\s+.+\n?)+)/i);
    if (alt) {
      body = body.slice(0, alt.index).trim();
      followups = (alt[1].match(/^\d+\.\s+(.+)$/gm) || [])
        .map((line) => line.replace(/^\d+\.\s+/, '').trim())
        .filter(Boolean)
        .slice(0, 3);
    }
  }

  return { content: body, followups };
}

export const agentService = {
  settings: {
    provider: 'yandex', // 'konstancia' | 'yandex'
    konstanciaUrl: 'http://localhost:8080',
    konstanciaApiKey: '',
    yandexApiKey: '',
    yandexFolderId: '',
    roleOverride: 'designer',
  },

  configure(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
  },

  async chat({ message, history = [], role = 'designer' }) {
    if (this.settings.provider === 'konstancia') {
      return this.chatKonstancia({ message, history, role });
    } else {
      return this.chatYandex({ message, history, role });
    }
  },

  buildSystemPrompt(role) {
    let prompt = AGENT_SYSTEM_PROMPT;
    if (role === 'frontend') {
      prompt += `\n\n---\nРоль пользователя: FRONT-END разработчик. Мысли в терминах кода, компонентов, состояния, API.`;
    } else if (role === 'backend') {
      prompt += `\n\n---\nРоль пользователя: BACK-END разработчик. Мысли в терминах API, БД, схем данных, производительности.`;
    } else if (role === 'pm') {
      prompt += `\n\n---\nРоль пользователя: PROJECT MANAGER. Фокус на статусах, сроках, рисках.`;
    }
    return prompt;
  },

  async chatKonstancia({ message, history, role }) {
    const url = `${this.settings.konstanciaUrl.replace(/\/+$/, '')}/v1/chat`;
    const systemPrompt = this.buildSystemPrompt(role);
    
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: message }
    ];

    const headers = { 'Content-Type': 'application/json' };
    if (this.settings.konstanciaApiKey) {
      headers['Authorization'] = `Bearer ${this.settings.konstanciaApiKey}`;
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          messages,
          max_tokens: 1024,
          temperature: 0.75,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || errJson.message || `HTTP ${res.status}`);
      }

      const data = await res.json();
      const rawText = data.content || '';
      const { content, followups } = parseAgentResponse(rawText);

      return {
        ok: true,
        content,
        followups,
        model: data.model || 'konstancia',
      };
    } catch (err) {
      console.error('Konstancia chat error:', err);
      return {
        ok: false,
        message: `Ошибка связи с Konstancia: ${err.message}. Проверьте IP сервера в настройках.`,
      };
    }
  },

  async resolveYandexFolderId(apiKey) {
    const res = await fetch('https://llm.api.cloud.yandex.net/v1/models', {
      headers: {
        'Authorization': `Api-Key ${apiKey}`,
      }
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(text.slice(0, 150) || `HTTP ${res.status}`);
    }
    const json = await res.json();
    const models = Array.isArray(json?.data) ? json.data : [];
    const deepseek = models.find((m) => String(m?.id || '').includes('deepseek-v4-flash'));
    const candidate = String(deepseek?.id || models[0]?.id || '');
    const match = candidate.match(/gpt:\/\/([^/]+)\//);
    if (!match) {
      throw new Error('Не удалось автоматически извлечь Folder ID из списка моделей.');
    }
    return match[1];
  },

  async chatYandex({ message, history, role }) {
    const apiKey = this.settings.yandexApiKey;
    if (!apiKey) {
      return { ok: false, message: 'Укажите API Ключ Yandex Cloud в настройках.' };
    }

    try {
      let folderId = this.settings.yandexFolderId;
      if (!folderId) {
        folderId = await this.resolveYandexFolderId(apiKey);
      }

      const model = `gpt://${folderId}/deepseek-v4-flash/latest`;
      const systemPrompt = this.buildSystemPrompt(role);

      const messages = [
        { role: 'system', content: systemPrompt },
        ...history.map(h => ({ role: h.role, content: h.content })),
        { role: 'user', content: message }
      ];

      const res = await fetch('https://llm.api.cloud.yandex.net/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Api-Key ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.75,
          max_tokens: 1024,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || errJson?.message || `HTTP ${res.status}`);
      }

      const data = await res.json();
      const rawText = data.choices?.[0]?.message?.content || '';
      const { content, followups } = parseAgentResponse(rawText);

      return {
        ok: true,
        content,
        followups,
        model: 'YandexGPT (DeepSeek)',
      };
    } catch (err) {
      console.error('Yandex Cloud chat error:', err);
      return {
        ok: false,
        message: `Ошибка Yandex Cloud: ${err.message}. Убедитесь, что API ключ верный и есть доступ к интернету.`,
      };
    }
  }
};
