const q = process.argv[2] || 'крип-а-крип динь дон';
const res = await fetch(`https://music.yandex.ru/search?text=${encodeURIComponent(q)}`, {
  headers: { 'User-Agent': 'Mozilla/5.0' },
});
const html = await res.text();
const track = html.match(/album\/(\d+)\/track\/(\d+)/);
console.log('track', track?.[0]);
const titles = [...html.matchAll(/"title":"([^"]{2,80})"/g)].map((m) => m[1]).slice(0, 20);
console.log('titles', titles);
const artists = [...html.matchAll(/"name":"([^"]{2,60})"/g)].map((m) => m[1]).slice(0, 20);
console.log('names', artists);

const trackUrl = `https://music.yandex.ru/album/${track[1]}/track/${track[2]}`;
const tr = await fetch(trackUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
const th = await tr.text();
const og = th.match(/property="og:title" content="([^"]+)"/);
console.log('og:title', og?.[1]);
const og2 = th.match(/property="og:description" content="([^"]+)"/);
console.log('og:desc', og2?.[1]);
