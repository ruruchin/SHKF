const key = process.argv[2] || process.env.KONSTANCIA_YANDEX_API_KEY || '';
const folder = process.argv[3] || process.env.KONSTANCIA_YANDEX_FOLDER_ID || '';

if (!key) {
  console.error('Usage: node scripts/probe-yandex-deepseek.mjs <api-key> [folder-id]');
  process.exit(1);
}

const models = folder
  ? [`gpt://${folder}/deepseek-v4-flash/latest`, 'deepseek-v4-flash/latest']
  : ['deepseek-v4-flash/latest'];

for (const model of models) {
  const res = await fetch('https://llm.api.cloud.yandex.net/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Api-Key ${key}`,
      ...(folder ? { 'x-folder-id': folder } : {}),
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: 'Скажи одно слово: привет' }],
      max_tokens: 32,
      temperature: 0.3,
    }),
  });
  const text = await res.text();
  console.log('model:', model);
  console.log('status:', res.status);
  console.log(text.slice(0, 600));
  console.log('---');
}
