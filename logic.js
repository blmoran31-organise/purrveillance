// PURRVEILLANCE: pure logic. No DOM, no Firebase. Imported by app.js and by tests/logic.test.mjs.
// Counts are recomputed on read from the sighting log, never stored (brief, data model).

export const PEOPLE = ['beth', 'canada'];
export const PERSON_LABEL = { beth: 'Beth', canada: 'Canada', both: 'Both' };
export const DAY = 86400000;

export function other(p) { return p === 'beth' ? 'canada' : 'beth'; }
export function sawIt(seenBy, person) { return seenBy === person || seenBy === 'both'; }

// Great-circle distance in metres.
export function metres(a, b) {
  const R = 6371000, toR = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const SWATCH = [
  [/ginger|orange|marmalade/i, '#D9641E'],
  [/tux/i, '#17181C'],
  [/black/i, '#17181C'],
  [/grey|gray|blue|silver/i, '#8A8F99'],
  [/calico|tortie|tortoise/i, '#B5651D'],
  [/tabby|brown/i, '#9A6B3F'],
  [/white|cream/i, '#C9C5BA'],
  [/fluff|long/i, '#E9A23B'],
];
const FALLBACK = ['#2F6B4F', '#E9A23B', '#D9641E', '#8A8F99', '#17181C', '#9A6B3F'];
export function swatchFor(coat, id = '') {
  for (const [re, hex] of SWATCH) if (re.test(coat || '')) return hex;
  let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return FALLBACK[h % FALLBACK.length];
}

export function displayName(cat) { return (cat && cat.name && cat.name.trim()) || 'Unnamed'; }
export function initial(cat) { const n = cat && cat.name && cat.name.trim(); return n ? n[0].toUpperCase() : '+'; }

// One summary per cat, built from the whole log.
export function summarise(cats, sightings) {
  const by = new Map();
  for (const c of cats) by.set(c.id, { cat: c, sightings: [], count: 0, petted: 0, first: null, last: null, lastSighting: null, seen: { beth: 0, canada: 0 } });
  for (const s of sightings) {
    const e = by.get(s.catId); if (!e) continue;
    e.sightings.push(s); e.count++;
    if (s.petted) e.petted++;
    for (const p of PEOPLE) if (sawIt(s.seenBy, p)) e.seen[p]++;
    if (e.first === null || s.at < e.first) e.first = s.at;
    if (e.last === null || s.at > e.last) { e.last = s.at; e.lastSighting = s; }
  }
  for (const e of by.values()) e.sightings.sort((a, b) => b.at - a.at);
  return [...by.values()];
}

// Where a cat is pinned on the Meow Map: its latest sighting with a position.
export function lastPosition(summary) {
  const s = summary.sightings.find(x => typeof x.lat === 'number' && typeof x.lng === 'number');
  return s ? { lat: s.lat, lng: s.lng } : null;
}

// Nearest cats to a point: distance is to the cat's closest pin, not its latest one.
export function nearest(summaries, pos, radius = Infinity) {
  if (!pos) return [];
  const out = [];
  for (const e of summaries) {
    let best = Infinity;
    for (const s of e.sightings) if (typeof s.lat === 'number') best = Math.min(best, metres(pos, s));
    if (best <= radius) out.push({ ...e, distance: best });
  }
  return out.sort((a, b) => a.distance - b.distance);
}

// Territory spread: furthest pin from the centre of all pins, in metres.
export function territory(summary) {
  const pts = summary.sightings.filter(s => typeof s.lat === 'number');
  if (!pts.length) return { pins: 0, radius: 0, centre: null };
  const centre = { lat: pts.reduce((a, s) => a + s.lat, 0) / pts.length, lng: pts.reduce((a, s) => a + s.lng, 0) / pts.length };
  return { pins: pts.length, radius: Math.max(...pts.map(s => metres(centre, s))), centre };
}

// MEWSFLASH: cats one of you has seen and the other has not, both directions.
export function mewsflash(summaries, me) {
  const them = other(me);
  const youMissed = [], theyMissed = [];
  for (const e of summaries) {
    if (!e.count) continue;
    if (e.seen[them] > 0 && e.seen[me] === 0) youMissed.push(e);
    else if (e.seen[me] > 0 && e.seen[them] === 0) theyMissed.push(e);
  }
  const byLast = (a, b) => b.last - a.last;
  return { youMissed: youMissed.sort(byLast), theyMissed: theyMissed.sort(byLast) };
}

export function startOfDay(t) { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); }
export function dayKey(t) { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

// Period windows are rolling: Day is today, Week is the last 7 days, Month the last 30.
export const PERIOD_LABEL = { day: 'today', week: 'in the last 7 days', month: 'in the last 30 days', all: 'all time' };
export function periodStart(period, now) {
  const today = startOfDay(now);
  if (period === 'day') return today;
  if (period === 'week') return today - 6 * DAY;
  if (period === 'month') return today - 29 * DAY;
  return -Infinity;
}

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Bars for the chosen period. Day: six 4-hour blocks. Week: 7 days. Month: 30 days in 5 blocks of 6. All: last 6 months.
export function bars(sightings, period, now) {
  const today = startOfDay(now);
  let buckets;
  if (period === 'day') {
    buckets = [0, 4, 8, 12, 16, 20].map(h => ({ label: String(h).padStart(2, '0'), from: today + h * 3600000, to: today + (h + 4) * 3600000 }));
  } else if (period === 'week') {
    buckets = [6, 5, 4, 3, 2, 1, 0].map(k => { const from = today - k * DAY; return { label: WD[new Date(from).getDay()], from, to: from + DAY }; });
  } else if (period === 'month') {
    buckets = [4, 3, 2, 1, 0].map(k => { const from = today - (k * 6 + 5) * DAY; const to = today - k * 6 * DAY + DAY; const d = new Date(from); return { label: d.getDate() + ' ' + MO[d.getMonth()], from, to }; });
  } else {
    const d = new Date(now); d.setDate(1); d.setHours(0, 0, 0, 0);
    buckets = [];
    for (let k = 5; k >= 0; k--) { const a = new Date(d.getFullYear(), d.getMonth() - k, 1); const b = new Date(d.getFullYear(), d.getMonth() - k + 1, 1); buckets.push({ label: MO[a.getMonth()], from: a.getTime(), to: b.getTime() }); }
  }
  for (const b of buckets) b.n = sightings.filter(s => s.at >= b.from && s.at < b.to).length;
  return buckets;
}

export function stats(cats, sightings, period, now) {
  const from = periodStart(period, now);
  const inP = sightings.filter(s => s.at >= from && s.at <= now + 60000);
  const all = summarise(cats, sightings);
  const newCats = all.filter(e => e.first !== null && e.first >= from).length;
  const counts = new Map();
  for (const s of inP) counts.set(s.catId, (counts.get(s.catId) || 0) + 1);
  const leaderboard = all.filter(e => counts.get(e.cat.id)).map(e => ({ ...e, n: counts.get(e.cat.id) }))
    .sort((a, b) => b.n - a.n || b.last - a.last);
  // Best day on record: the day with the most different cats, across the whole log.
  const perDay = new Map();
  for (const s of sightings) { const k = dayKey(s.at); if (!perDay.has(k)) perDay.set(k, { at: startOfDay(s.at), cats: new Set() }); perDay.get(k).cats.add(s.catId); }
  let bestDay = null;
  for (const v of perDay.values()) if (!bestDay || v.cats.size > bestDay.cats || (v.cats.size === bestDay.cats && v.at > bestDay.at)) bestDay = { at: v.at, cats: v.cats.size };
  const hiss = { beth: 0, canada: 0, both: 0 };
  const purr = { beth: 0, canada: 0 };
  for (const s of inP) {
    if (hiss[s.seenBy] !== undefined) hiss[s.seenBy]++;
    if (s.petted) for (const p of PEOPLE) if (sawIt(s.seenBy, p)) purr[p]++;
  }
  return { newCats, sightings: inP.length, mostSeen: leaderboard[0] || null, bestDay, leaderboard, bars: bars(sightings, period, now), hiss, purr };
}

// "today", "yesterday", "Tue" (this week), else "Tue 30 Sep".
export function dayWord(t, now) {
  const d0 = startOfDay(now), d = startOfDay(t);
  if (d === d0) return 'today';
  if (d === d0 - DAY) return 'yesterday';
  const dt = new Date(t);
  if (d > d0 - 6 * DAY && d < d0) return WD[dt.getDay()];
  return WD[dt.getDay()] + ' ' + dt.getDate() + ' ' + MO[dt.getMonth()];
}
export function hhmm(t) { const d = new Date(t); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
export function longStamp(t) { const d = new Date(t); return WD[d.getDay()] + ' ' + d.getDate() + ' ' + MO[d.getMonth()] + ', ' + hhmm(t); }
export function shortDay(t) { const d = new Date(t); return WD[d.getDay()] + ' ' + d.getDate(); }
export function distWord(m) { return m < 1000 ? Math.round(m / 10) * 10 + ' m' : (m / 1000).toFixed(1) + ' km'; }
export function pettedWord(n) { return n === 0 ? 'never petted' : n === 1 ? 'petted once' : 'petted ' + n + ' times'; }
