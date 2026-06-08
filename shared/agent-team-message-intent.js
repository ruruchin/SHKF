/** Parse «напиши Олегу …» team chat send intents. */

const TEAM_MESSAGE_RE = /^(?:напиши|отправь|передай|скажи|напишите|отправьте|передайте|скажите)\s+(?:@|коллег[еу]\s+)?([a-zа-яё0-9._-]{2,32})(?:\s+(?:что|сообщени[ея]|текст|:|—|-)\s*|\s+)(.+)$/i;
const TEAM_MESSAGE_TO_RE = /^(?:напиши|отправь|передай|скажи)\s+(?:сообщени[ея]\s+)?(?:коллег[еу]\s+)?([a-zа-яё0-9._-]{2,32})\s+(?:что\s+)?(.+)$/i;

function norm(text) {
  return String(text || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

function normalizePersonQuery(query) {
  let q = norm(query).replace(/^@/, '');
  if (q.length > 3) q = q.replace(/(у|ю|е|а|и|ом|ем|ой)$/i, '');
  return q;
}

export function parseTeamMessageIntent(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  let match = raw.match(TEAM_MESSAGE_RE);
  if (!match) match = raw.match(TEAM_MESSAGE_TO_RE);
  if (!match) return null;
  const recipientQuery = String(match[1] || '').trim();
  const messageBody = String(match[2] || '').trim().replace(/^["«]|["»]$/g, '');
  if (!recipientQuery || !messageBody) return null;
  return { recipientQuery, messageBody };
}

export function profileSearchHaystack(profile = {}) {
  return [
    profile.full_name,
    profile.username,
    profile.position,
    profile.email,
    profile.role,
  ].filter(Boolean).map((v) => norm(v)).join(' ');
}

export function matchColleaguesByQuery(colleagues = [], query = '') {
  const q = normalizePersonQuery(query);
  if (!q) return [];
  const list = Array.isArray(colleagues) ? colleagues : [];
  const exact = [];
  const partial = [];
  for (const profile of list) {
    const username = norm(profile.username);
    const fullName = norm(profile.full_name);
    const firstName = fullName.split(/\s+/)[0] || '';
    if (username === q || firstName === q || fullName === q) {
      exact.push(profile);
      continue;
    }
    if (username.startsWith(q) || firstName.startsWith(q) || fullName.includes(q)) {
      partial.push(profile);
    }
  }
  return exact.length ? exact : partial;
}

export function formatColleagueSendLabel(profile = {}) {
  const name = String(profile.full_name || '').trim();
  const username = String(profile.username || '').trim();
  if (name && username) return `Отправить · ${name} (@${username})`;
  if (name) return `Отправить · ${name}`;
  if (username) return `Отправить · @${username}`;
  return 'Отправить · коллеге';
}

export function buildTeamSendFollowups(matches = [], messageBody = '') {
  return matches.slice(0, 5).map((profile) => formatColleagueSendLabel(profile));
}
