/** Lightweight web search for Konstancia general Q&A (DuckDuckGo, no API key). */

const DDG_API = 'https://api.duckduckgo.com/';
const DDG_LITE = 'https://lite.duckduckgo.com/lite/';

function cleanText(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

async function fetchDdgInstant(query) {
  const url = `${DDG_API}?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1&skip_disambig=1`;
  const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) return [];
  const data = await res.json();
  const out = [];
  const abstract = cleanText(data.AbstractText || data.Abstract);
  if (abstract) {
    out.push({
      title: cleanText(data.Heading) || query,
      snippet: abstract,
      url: data.AbstractURL || '',
      source: 'duckduckgo-instant',
    });
  }
  for (const topic of data.RelatedTopics || []) {
    if (topic.Text && topic.FirstURL) {
      out.push({
        title: cleanText(topic.Text).slice(0, 120),
        snippet: cleanText(topic.Text),
        url: topic.FirstURL,
        source: 'duckduckgo-related',
      });
    }
    for (const sub of topic.Topics || []) {
      if (sub.Text && sub.FirstURL) {
        out.push({
          title: cleanText(sub.Text).slice(0, 120),
          snippet: cleanText(sub.Text),
          url: sub.FirstURL,
          source: 'duckduckgo-related',
        });
      }
    }
  }
  return out;
}

async function fetchWikipedia(query, { limit = 3, lang = 'ru' } = {}) {
  const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=${limit}&format=json`;
  const res = await fetch(searchUrl, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) return [];
  const data = await res.json();
  const hits = data?.query?.search || [];
  const out = [];
  for (const hit of hits) {
    const title = hit.title;
    const snippet = cleanText(String(hit.snippet || '').replace(/<[^>]+>/g, ''));
    if (!title) continue;
    out.push({
      title,
      snippet: snippet || title,
      url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
      source: `wikipedia-${lang}`,
    });
  }
  return out;
}

async function fetchDdgLite(query, { limit = 5 } = {}) {
  const body = new URLSearchParams({ q: query });
  const res = await fetch(DDG_LITE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return [];
  const html = await res.text();
  const out = [];
  const rowRe = /<a[^>]+class="result-link"[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?<td[^>]*class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi;
  let m;
  while ((m = rowRe.exec(html)) && out.length < limit) {
    const url = m[1].replace(/&amp;/g, '&');
    const title = cleanText(m[2].replace(/<[^>]+>/g, ''));
    const snippet = cleanText(m[3].replace(/<[^>]+>/g, ''));
    if (title && snippet) out.push({ title, snippet, url, source: 'duckduckgo-lite' });
  }
  return out;
}

export async function searchWeb(query, { limit = 5 } = {}) {
  const q = cleanText(query);
  if (!q) return { ok: false, message: 'empty query', snippets: [] };

  try {
    const [instant, lite, wiki] = await Promise.all([
      fetchDdgInstant(q).catch(() => []),
      fetchDdgLite(q, { limit }).catch(() => []),
      fetchWikipedia(q, { limit: 3 }).catch(() => []),
    ]);
    const seen = new Set();
    const snippets = [];
    for (const hit of [...instant, ...wiki, ...lite]) {
      const key = `${hit.url}::${hit.snippet.slice(0, 80)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      snippets.push(hit);
      if (snippets.length >= limit) break;
    }
    return { ok: true, query: q, snippets };
  } catch (err) {
    return { ok: false, message: err?.message || String(err), snippets: [] };
  }
}

export function formatWebSearchBlock(result) {
  if (!result?.ok || !result.snippets?.length) return '';
  const lines = result.snippets.map((s, i) => {
    const url = s.url ? ` (${s.url})` : '';
    return `${i + 1}. **${s.title}** — ${s.snippet}${url}`;
  });
  return [
    '## Справка из интернета (поиск + Wikipedia)',
    '',
    'Используй эти факты в ответе. Если данных мало — дополни своими знаниями, но не выдумывай ссылки.',
    '',
    ...lines,
  ].join('\n');
}
