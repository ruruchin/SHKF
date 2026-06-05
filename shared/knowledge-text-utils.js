/** HTML → text and chunking for Konstancia knowledge ingest. */

export function cleanText(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

export function extractTextFromHtml(html, { maxLen = 120000 } = {}) {
  let text = String(html || '');
  text = text.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  text = text.replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ');
  const article = text.match(/<article[\s\S]*?<\/article>/i);
  if (article) text = article[0];
  else {
    const body = text.match(/<body[\s\S]*?<\/body>/i);
    if (body) text = body[0];
  }
  text = text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
  text = cleanText(text.replace(/\n+/g, '\n'));
  if (text.length > maxLen) text = `${text.slice(0, maxLen)}…`;
  return text;
}

export function chunkText(text, { chunkSize = 900, overlap = 120 } = {}) {
  const src = cleanText(text);
  if (!src) return [];
  if (src.length <= chunkSize) return [src];
  const chunks = [];
  let start = 0;
  while (start < src.length) {
    let end = Math.min(src.length, start + chunkSize);
    if (end < src.length) {
      const slice = src.slice(start, end);
      const lastBreak = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('\n'), slice.lastIndexOf('! '), slice.lastIndexOf('? '));
      if (lastBreak > chunkSize * 0.45) end = start + lastBreak + 1;
    }
    const piece = cleanText(src.slice(start, end));
    if (piece.length >= 80) chunks.push(piece);
    if (end >= src.length) break;
    start = Math.max(start + 1, end - overlap);
  }
  return chunks;
}

export function makeQuestionFromChunk(title, chunk) {
  const topic = cleanText(title || 'тема').replace(/[|:]/g, ' ').slice(0, 120);
  const firstSentence = cleanText(chunk).split(/[.!?]/)[0]?.slice(0, 160) || topic;
  if (/нейрон|машинн|обучен|модел|трансформ|pytorch|tensorflow/i.test(`${topic} ${firstSentence}`)) {
    return `Объясни по сути: ${topic}`;
  }
  return `Что важно знать про «${topic}»?`;
}
