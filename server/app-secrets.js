/**
 * Server-side secrets only (main process). Never expose values to renderer or hotkeys.json.
 * Load order: project .env → bundled org-secrets.json (release) → userData/.env override.
 */

function env(name) {
  return String(process.env[name] || '').trim();
}

function legacy(settings, ...paths) {
  let cur = settings;
  for (const key of paths) {
    cur = cur?.[key];
  }
  return String(cur || '').trim();
}

export function resolveKonstanciaYandexCredentials(agentSettings = {}) {
  return {
    apiKey: env('KONSTANCIA_YANDEX_API_KEY') || legacy(agentSettings, 'konstanciaYandexApiKey'),
    folderId: env('KONSTANCIA_YANDEX_FOLDER_ID') || legacy(agentSettings, 'konstanciaYandexFolderId'),
  };
}

export function resolveKonstanciaCloudCredentials(agentSettings = {}) {
  return {
    url: env('KONSTANCIA_CLOUD_URL') || legacy(agentSettings, 'konstanciaCloudUrl'),
    apiKey: env('KONSTANCIA_CLOUD_API_KEY') || legacy(agentSettings, 'konstanciaCloudApiKey'),
  };
}

export function resolveCursorApiKey(agentSettings = {}) {
  return env('CURSOR_API_KEY') || legacy(agentSettings, 'cursorApiKey');
}

export function resolveMobbinApiKey(agentSettings = {}) {
  return env('MOBBIN_API_KEY') || legacy(agentSettings, 'mobbinApiKey');
}

export function resolveNanobananaApiKey(nanobananaSettings = {}) {
  return env('NANOBANANA_API_KEY') || legacy(nanobananaSettings, 'apiKey');
}
