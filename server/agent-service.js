import https from 'https';
import { randomUUID } from 'crypto';
import { AGENT_SYSTEM_PROMPT, buildTaskContextBlock, parseAgentResponse } from '../shared/agent-prompts.js';
import {
  GIGACHAT_VISION_HINT,
  isGigaChatVisionModel,
  MAX_AGENT_IMAGE_BYTES,
  MAX_AGENT_IMAGES_PER_MESSAGE,
} from '../shared/gigachat-vision.js';
import { normalizeImageForGigaChat } from './gigachat-image.js';
import {
  konstanciaChat,
  konstanciaEmbed,
  isKonstanciaBackendReady,
  isKonstanciaLlmReady,
  isKonstanciaLlmTrained,
  isKonstanciaYandexConfigured,
} from './konstancia-llm-service.js';
import { formatKonstanciaLlmError, sanitizeKonstanciaReply } from '../shared/konstancia-llm-errors.js';
import { buildKonstanciaImageContext } from './konstancia-vision.js';

const OAUTH_URL = 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth';
const CHAT_URL = 'https://gigachat.devices.sberbank.ru/api/v1/chat/completions';
const FILES_URL = 'https://gigachat.devices.sberbank.ru/api/v1/files';
const EMBEDDINGS_URL = 'https://gigachat.devices.sberbank.ru/api/v1/embeddings';

export { isGigaChatVisionModel, GIGACHAT_VISION_HINT };

export function isGigaChatBillingError(message) {
  return /payment required|402|quota|лимит|insufficient|баланс|подписк/i.test(String(message || ''));
}

export function formatGigaChatApiError(status, rawMessage) {
  const msg = String(rawMessage || '').trim();
  if (status === 402 || /payment required/i.test(msg)) {
    return 'GigaChat: нет токенов на выбранной модели (Payment Required). Выберите GigaChat (Lite) в шапке агента — чат и макеты Mobbin по тексту; для копии скрина нужны Pro/Max.';
  }
  if (status === 401 || /unauthorized|invalid.*token/i.test(msg)) {
    return 'GigaChat: неверный или просроченный ключ. Обновите Authorization (Base64) в Настройки → Konstancia.';
  }
  if (status === 429 || /rate limit|too many/i.test(msg)) {
    return 'GigaChat: слишком много запросов. Подождите минуту и повторите.';
  }
  return msg || `GigaChat HTTP ${status || 'error'}`;
}

function httpsRequest(url, { method = 'GET', headers = {}, body = null, rejectUnauthorized = false } = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: `${parsed.pathname}${parsed.search}`,
        method,
        headers,
        rejectUnauthorized,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          let json = null;
          try {
            json = data ? JSON.parse(data) : null;
          } catch {
            json = null;
          }
          resolve({ status: res.statusCode, json, text: data });
        });
      },
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function httpsJson(url, options) {
  return httpsRequest(url, options);
}

function buildMultipartBody(boundary, fields, file) {
  const chunks = [];
  const crlf = '\r\n';
  for (const [name, value] of Object.entries(fields)) {
    chunks.push(
      Buffer.from(
        `--${boundary}${crlf}Content-Disposition: form-data; name="${name}"${crlf}${crlf}${value}${crlf}`,
        'utf8',
      ),
    );
  }
  const safeName = String(file.filename || 'image.png').replace(/"/g, '');
  chunks.push(
    Buffer.from(
      `--${boundary}${crlf}Content-Disposition: form-data; name="file"; filename="${safeName}"${crlf}Content-Type: ${file.mimeType}${crlf}${crlf}`,
      'utf8',
    ),
  );
  chunks.push(file.buffer);
  chunks.push(Buffer.from(`${crlf}--${boundary}--${crlf}`, 'utf8'));
  return Buffer.concat(chunks);
}

export async function parseAgentImagePayload(image) {
  if (!image) return null;
  if (image.buffer && image.mimeType) {
    const buffer = Buffer.isBuffer(image.buffer) ? image.buffer : Buffer.from(image.buffer);
    if (buffer.length > MAX_AGENT_IMAGE_BYTES) {
      throw new Error('Изображение больше 15 МБ — уменьшите размер файла');
    }
    return normalizeImageForGigaChat({
      buffer,
      mimeType: image.mimeType,
      filename: image.filename || 'image.png',
    });
  }
  const dataUrl = String(image.dataUrl || image.url || '').trim();
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/);
  if (!match) return null;
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > MAX_AGENT_IMAGE_BYTES) {
    throw new Error('Изображение больше 15 МБ — уменьшите размер файла');
  }
  const ext = match[1].includes('jpeg') || match[1].includes('jpg') ? 'jpg' : 'png';
  return normalizeImageForGigaChat({
    buffer,
    mimeType: match[1],
    filename: image.filename || `image.${ext}`,
  });
}

export class AgentService {
  constructor() {
    this.settings = {
      provider: 'konstancia',
      credentials: '',
      scope: 'GIGACHAT_API_PERS',
      model: 'Konstancia',
      ignoreTls: true,
    };
    this._token = null;
    this._tokenExpiresAt = 0;
  }

  configure(settings = {}) {
    this.settings = {
      ...this.settings,
      ...settings,
      credentials: (settings.credentials || '').trim(),
      scope: settings.scope || 'GIGACHAT_API_PERS',
      provider: settings.provider || 'konstancia',
      model: settings.model || 'Konstancia',
    };
    if (settings.credentials && settings.credentials !== this._lastCredentials) {
      this._token = null;
      this._tokenExpiresAt = 0;
    }
    this._lastCredentials = this.settings.credentials;
  }

  isKonstanciaProvider() {
    return (this.settings.provider || 'konstancia') === 'konstancia';
  }

  isKonstanciaCloudConfigured() {
    return !!(this.settings.konstanciaCloudUrl || process.env.KONSTANCIA_CLOUD_URL || '').trim();
  }

  isConfigured() {
    if (this.isKonstanciaProvider()) {
      return isKonstanciaBackendReady() || this.isKonstanciaCloudConfigured();
    }
    return this.settings.provider === 'gigachat' && !!this.settings.credentials;
  }

  getStatus() {
    const konstancia = this.isKonstanciaProvider();
    const remote = konstancia && (isKonstanciaYandexConfigured() || this.isKonstanciaCloudConfigured());
    return {
      configured: this.isConfigured(),
      provider: konstancia ? 'konstancia' : 'gigachat',
      model: konstancia ? 'Konstancia' : this.settings.model,
      scope: this.settings.scope,
      visionCapable: konstancia ? isKonstanciaYandexConfigured() : isGigaChatVisionModel(this.settings.model),
      konstanciaTrained: konstancia ? (isKonstanciaLlmTrained() || remote) : false,
      konstanciaLocal: konstancia && !remote,
      konstanciaCloud: false,
      konstanciaCloudUrl: '',
    };
  }

  async getAccessToken() {
    if (!this.isConfigured()) {
      throw new Error('Укажите ключ GigaChat в настройках → Konstancia');
    }
    const now = Date.now();
    if (this._token && now < this._tokenExpiresAt - 60_000) {
      return this._token;
    }

    const rejectUnauthorized = !this.settings.ignoreTls;
    const body = new URLSearchParams({ scope: this.settings.scope }).toString();
    const res = await httpsJson(OAUTH_URL, {
      method: 'POST',
      rejectUnauthorized,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        Authorization: `Basic ${this.settings.credentials}`,
        RqUID: randomUUID(),
      },
      body,
    });

    if (res.status !== 200 || !res.json?.access_token) {
      const msg = res.json?.message || res.json?.error || res.text?.slice(0, 200) || `OAuth ${res.status}`;
      throw new Error(`GigaChat: не удалось получить токен — ${msg}`);
    }

    this._token = res.json.access_token;
    const expiresIn = Number(res.json.expires_at || res.json.expires_in || 1800);
    this._tokenExpiresAt = expiresIn > 1e12 ? expiresIn : now + expiresIn * 1000;
    return this._token;
  }

  async uploadImageFile({ buffer, filename, mimeType }) {
    const token = await this.getAccessToken();
    const boundary = `----WebKitFormBoundary${randomUUID().replace(/-/g, '')}`;
    const body = buildMultipartBody(
      boundary,
      { purpose: 'general' },
      { buffer, filename, mimeType: mimeType || 'image/png' },
    );

    const res = await httpsRequest(FILES_URL, {
      method: 'POST',
      rejectUnauthorized: !this.settings.ignoreTls,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': String(body.length),
      },
      body,
    });

    if (res.status !== 200 || !res.json?.id) {
      const msg = res.json?.message || res.json?.error || res.text?.slice(0, 200) || `HTTP ${res.status}`;
      throw new Error(`GigaChat: не удалось загрузить изображение — ${msg}`);
    }

    return String(res.json.id);
  }

  async uploadImages(images = []) {
    const fileIds = [];
    for (const img of images.slice(0, MAX_AGENT_IMAGES_PER_MESSAGE)) {
      const parsed = await parseAgentImagePayload(img);
      if (!parsed) continue;
      const id = await this.uploadImageFile(parsed);
      fileIds.push(id);
    }
    return fileIds;
  }

  buildMessages({
    message,
    history = [],
    task = null,
    systemPrompt = AGENT_SYSTEM_PROMPT,
    allowFollowups = false,
    attachmentFileIds = [],
    learnedExperienceBlock = '',
  }) {
    let system = systemPrompt;
    if (!allowFollowups) {
      system = `${system}\n\n---\nНе добавляй блок FOLLOWUPS. Отвечай только на последнее сообщение пользователя, без шаблона «анализ задачи» и без оценки часов, если об этом не спросили.`;
    }
    if (task?.id) {
      system = `${system}\n\n---\nКонтекст задачи Redmine (только если пользователь явно просит разбор/оценку/промпт по задаче — иначе игнорируй):\n${buildTaskContextBlock(task)}`;
    }
    if (learnedExperienceBlock) {
      system = `${system}\n\n---\n${learnedExperienceBlock}`;
    }
    const messages = [{ role: 'system', content: system.slice(0, 28000) }];
    for (const item of history.slice(-10)) {
      if (!item?.role) continue;
      if (item.role === 'system') continue;
      const content = String(item.content || '').slice(0, 8000);
      if (!content && !item.attachments?.length) continue;
      const entry = { role: item.role, content: content || ' ' };
      if (item.role === 'user' && Array.isArray(item.attachments) && item.attachments.length) {
        entry.attachments = item.attachments.slice(0, MAX_AGENT_IMAGES_PER_MESSAGE);
      }
      messages.push(entry);
    }

    const userContent = String(message || '').trim().slice(0, 4000) || 'Опиши приложенное изображение.';
    const userMsg = { role: 'user', content: userContent };
    if (attachmentFileIds.length) {
      userMsg.attachments = attachmentFileIds.slice(0, MAX_AGENT_IMAGES_PER_MESSAGE);
    }
    messages.push(userMsg);
    return messages;
  }

  buildKonstanciaMessages({
    message,
    history = [],
    task = null,
    systemPrompt = AGENT_SYSTEM_PROMPT,
    allowFollowups = false,
    images = [],
    learnedExperienceBlock = '',
  }) {
    let system = systemPrompt;
    if (!allowFollowups) {
      system = `${system}\n\n---\nНе добавляй блок FOLLOWUPS. Отвечай только на последнее сообщение пользователя, без шаблона «анализ задачи» и без оценки часов, если об этом не спросили.`;
    }
    if (task?.id) {
      system = `${system}\n\n---\nКонтекст задачи Redmine (только если пользователь явно просит разбор/оценку/промпт по задаче — иначе игнорируй):\n${buildTaskContextBlock(task)}`;
    }
    if (learnedExperienceBlock) {
      system = `${system}\n\n---\n${learnedExperienceBlock}`;
    }

    const messages = [{ role: 'system', content: system.slice(0, 28000) }];

    for (const item of history.slice(-10)) {
      if (!item?.role || item.role === 'system') continue;
      let content = String(item.content || '').slice(0, 8000);
      const histImages = Array.isArray(item.images) ? item.images : [];
      if (!content && !histImages.length) continue;
      if (item.imageContext) {
        content = content ? `${content}\n\n---\n${item.imageContext}` : item.imageContext;
      } else if (histImages.length) {
        const names = histImages
          .map((img) => String(img?.filename || 'изображение').trim())
          .filter(Boolean)
          .join(', ');
        content = `${content || 'Сообщение с изображением'}\n[Ранее прикреплено: ${names}]`;
      }
      messages.push({ role: item.role, content: content || ' ' });
    }

    const prompt = String(message || '').trim().slice(0, 12000);
    messages.push({ role: 'user', content: prompt || ' ' });

    return messages;
  }

  async chat({
    message,
    history = [],
    task = null,
    systemPrompt,
    allowFollowups = false,
    images = [],
    maxTokens = 4096,
    temperature = 0.78,
    modelOverride = null,
    learnedExperienceBlock = '',
  }) {
    const hasImages = Array.isArray(images) && images.length > 0;
    if (!String(message || '').trim() && !hasImages) {
      return { ok: false, message: 'Пустое сообщение' };
    }
    if (this.isKonstanciaProvider()) {
      if (!isKonstanciaBackendReady() && !this.isKonstanciaCloudConfigured()) {
        return {
          ok: false,
          message: 'Konstancia сейчас недоступна. Попробуйте позже или перезапустите приложение.',
        };
      }

      let effectiveMessage = String(message || '').trim();
      let imageContext = '';

      if (hasImages) {
        if (!isKonstanciaYandexConfigured()) {
          return {
            ok: false,
            message: 'Konstancia пока не может разобрать картинку без облачного ключа. Опишите изображение словами.',
          };
        }
        imageContext = await buildKonstanciaImageContext(images);
        if (!imageContext) {
          return {
            ok: false,
            message: 'Не удалось проанализировать изображение. Попробуйте другое фото или опишите его текстом.',
          };
        }
        effectiveMessage = [
          effectiveMessage || 'Пользователь прикрепил изображение.',
          '---',
          imageContext,
        ].join('\n\n');
      }

      const messages = this.buildKonstanciaMessages({
        message: effectiveMessage,
        history,
        task,
        systemPrompt,
        allowFollowups,
        images: [],
        learnedExperienceBlock,
      });
      const result = await konstanciaChat({
        messages,
        maxTokens: maxTokens,
        temperature,
      });
      if (!result.ok) {
        return { ...result, message: formatKonstanciaLlmError(result.message) };
      }
      const { content, followups } = parseAgentResponse(result.content);
      const finalContent = sanitizeKonstanciaReply(String(content || result.content || '').trim());
      if (!finalContent) {
        return {
          ok: false,
          message: 'Konstancia вернула пустой ответ. Переформулируйте вопрос или подождите — первый ответ после запуска может занять 2–5 минут.',
        };
      }
      return {
        ok: true,
        content: finalContent,
        followups,
        model: result.model || 'konstancia',
        usage: null,
        imageContext: imageContext || undefined,
      };
    }

    if (hasImages && !isGigaChatVisionModel(this.settings.model)) {
      return { ok: false, message: GIGACHAT_VISION_HINT };
    }
    if (!this.isConfigured()) {
      return {
        ok: false,
        message: 'Подключите GigaChat: Настройки → Konstancia → ключ Authorization (Base64) с developers.sber.ru/studio',
      };
    }

    try {
      const token = await this.getAccessToken();
      let attachmentFileIds = [];
      if (hasImages) {
        attachmentFileIds = await this.uploadImages(images);
        if (!attachmentFileIds.length) {
          return { ok: false, message: 'Не удалось подготовить изображение для отправки' };
        }
      }

      const payload = JSON.stringify({
        model: modelOverride || this.settings.model,
        messages: this.buildMessages({
          message,
          history,
          task,
          systemPrompt,
          allowFollowups,
          attachmentFileIds,
          learnedExperienceBlock,
        }),
        temperature: Math.max(0, Math.min(1.5, Number(temperature) || 0.78)),
        max_tokens: Math.max(512, Math.min(8192, Number(maxTokens) || 4096)),
      });

      const res = await httpsJson(CHAT_URL, {
        method: 'POST',
        rejectUnauthorized: !this.settings.ignoreTls,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: payload,
      });

      if (res.status !== 200) {
        const raw = res.json?.message || res.json?.error?.message || res.text?.slice(0, 300) || `HTTP ${res.status}`;
        if (res.status === 401) {
          this._token = null;
          this._tokenExpiresAt = 0;
        }
        return {
          ok: false,
          message: formatGigaChatApiError(res.status, raw),
          status: res.status,
          billing: res.status === 402 || isGigaChatBillingError(raw),
        };
      }

      const raw = res.json?.choices?.[0]?.message?.content?.trim();
      const { content, followups } = parseAgentResponse(raw || '');
      const finalContent = String(content || raw || '').trim();
      if (!finalContent) {
        if (followups.length) {
          return {
            ok: true,
            content: followups.map((q, i) => `${i + 1}. ${q}`).join('\n'),
            followups,
            model: res.json?.model || this.settings.model,
            usage: res.json?.usage || null,
            attachmentFileIds,
          };
        }
        return {
          ok: false,
          message: 'GigaChat вернул пустой ответ. Повторите вопрос или выберите GigaChat (Lite) в шапке чата.',
        };
      }

      return {
        ok: true,
        content: finalContent,
        followups,
        model: res.json?.model || this.settings.model,
        usage: res.json?.usage || null,
        attachmentFileIds,
      };
    } catch (err) {
      return { ok: false, message: err.message || String(err) };
    }
  }

  /**
   * Векторные представления текстов через GigaChat Embeddings.
   * Возвращает массив векторов (number[][]) в порядке входных строк
   * либо null при ошибке (вызывающая сторона откатится на TF-IDF).
   */
  async embed(texts = []) {
    const list = (Array.isArray(texts) ? texts : [])
      .map((t) => String(t || '').slice(0, 3500))
      .filter((t) => t.trim());
    if (!list.length) return null;

    if (this.isKonstanciaProvider()) {
      return konstanciaEmbed(list);
    }
    if (!this.isConfigured()) return null;

    try {
      const token = await this.getAccessToken();
      const vectors = [];
      const CHUNK = 50; // ограничение размера запроса
      for (let i = 0; i < list.length; i += CHUNK) {
        const chunk = list.slice(i, i + CHUNK);
        const res = await httpsJson(EMBEDDINGS_URL, {
          method: 'POST',
          rejectUnauthorized: !this.settings.ignoreTls,
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ model: 'Embeddings', input: chunk }),
        });
        if (res.status === 401) {
          this._token = null;
          this._tokenExpiresAt = 0;
        }
        if (res.status !== 200 || !Array.isArray(res.json?.data)) return null;
        const sorted = [...res.json.data].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
        for (const item of sorted) {
          if (!Array.isArray(item.embedding)) return null;
          vectors.push(item.embedding);
        }
      }
      return vectors.length === list.length ? vectors : null;
    } catch {
      return null;
    }
  }

  async testConnection() {
    const result = await this.chat({
      message: 'Ответь одним словом: «готов».',
      history: [],
      task: null,
    });
    return result;
  }
}
