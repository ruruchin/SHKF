/** Parse natural-language calendar / plan requests (RU). */

const CALENDAR_INTENT_RE = /(?:запиши|добавь|поставь|создай|запланируй|напомни|внеси).{0,24}(?:в\s+)?(?:календар(?:ь|е|я)|расписани[ея]|план(?:\s+на)?)|(?:календар(?:ь|е|я)|расписани[ея]).{0,12}(?:запиши|добавь|поставь|создай)/i;
const PLAN_ON_RE = /^план\s+на\s+(.+)$/i;

const RELATIVE_DAY = {
  сегодня: 0,
  завтра: 1,
  послезавтра: 2,
};

const WEEKDAY = {
  понедельник: 1,
  вторник: 2,
  среду: 3,
  среда: 3,
  четверг: 4,
  пятницу: 5,
  пятница: 5,
  субботу: 6,
  суббота: 6,
  воскресенье: 7,
  воскресенье: 7,
};

function norm(text) {
  return String(text || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function nextWeekday(from, weekday) {
  const d = startOfDay(from);
  const current = d.getDay() === 0 ? 7 : d.getDay();
  let delta = weekday - current;
  if (delta <= 0) delta += 7;
  return addDays(d, delta);
}

function parseDatePart(text, now = new Date()) {
  const raw = norm(text);
  if (!raw) return startOfDay(now);
  if (Object.prototype.hasOwnProperty.call(RELATIVE_DAY, raw)) {
    return addDays(startOfDay(now), RELATIVE_DAY[raw]);
  }
  for (const [key, weekday] of Object.entries(WEEKDAY)) {
    if (raw.includes(key)) return nextWeekday(now, weekday);
  }
  const dm = raw.match(/(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?/);
  if (dm) {
    const day = Number(dm[1]);
    const month = Number(dm[2]) - 1;
    let year = dm[3] ? Number(dm[3]) : now.getFullYear();
    if (year < 100) year += 2000;
    return new Date(year, month, day, 0, 0, 0, 0);
  }
  return startOfDay(now);
}

function parseTimePart(text, baseDate) {
  const raw = norm(text);
  const at = raw.match(/(?:в|к)\s*(\d{1,2})(?:[:.](\d{2}))?/);
  const d = new Date(baseDate);
  if (at) {
    d.setHours(Number(at[1]), Number(at[2] || 0), 0, 0);
    return d;
  }
  d.setHours(10, 0, 0, 0);
  return d;
}

function stripDateTimeWords(text) {
  return String(text || '')
    .replace(CALENDAR_INTENT_RE, '')
    .replace(/(?:на|в)\s+(?:сегодня|завтра|послезавтра)/gi, '')
    .replace(/(?:на|в)\s+(?:понедельник|вторник|сред[ау]|четверг|пятниц[ау]|суббот[ау]|воскресенье)/gi, '')
    .replace(/(?:в|к)\s*\d{1,2}(?:[:.]\d{2})?/gi, '')
    .replace(/\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?/g, '')
    .replace(/^(?:что|о|про|—|-|:)\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseCalendarIntent(text, now = new Date()) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const planMatch = raw.match(PLAN_ON_RE);
  const hasCalendarIntent = CALENDAR_INTENT_RE.test(raw) || !!planMatch;
  if (!hasCalendarIntent) return null;

  const working = planMatch ? planMatch[1] : raw;
  const datePart = Object.keys(RELATIVE_DAY).find((k) => working.toLowerCase().includes(k))
    || Object.keys(WEEKDAY).find((k) => working.toLowerCase().includes(k))
    || working.match(/\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?/)?.[0]
    || 'сегодня';

  const startAt = parseTimePart(working, parseDatePart(datePart, now));
  const endAt = new Date(startAt.getTime() + 60 * 60 * 1000);
  let title = stripDateTimeWords(working);
  if (!title || title.length < 2) title = planMatch ? `План на ${datePart}` : 'Запись в календаре';

  return {
    title: title.slice(0, 180),
    body: raw.slice(0, 2000),
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
    allDay: !/(?:в|к)\s*\d{1,2}/i.test(working),
  };
}

export function formatCalendarEventWhen(event = {}) {
  const start = event.startAt ? new Date(event.startAt) : null;
  if (!start || Number.isNaN(start.getTime())) return '';
  const date = start.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' });
  if (event.allDay) return date;
  const time = start.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return `${date}, ${time}`;
}
