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
  [/calico/i, '#B5651D'],
  [/tortie|tortoise/i, '#4A3426'],
  [/siamese|point/i, '#CDBFA8'],
  [/cream/i, '#E8D5B0'],
  [/brown/i, '#7A5230'],
  [/tabby/i, '#9A6B3F'],
  [/white/i, '#E9E6DE'],
  [/fluff|long/i, '#E9A23B'],
];
// Coat chips, multi-select (Beth 2026-10-03). Long-haired is a separate tick, not a colour.
export const COAT_LIST = ['Ginger', 'Black', 'Tux', 'Grey', 'Tabby', 'White', 'Calico', 'Tortie', 'Cream', 'Brown', 'Siamese/pointed'];
// The coats a cat has, reading the old single-coat field where there is no list yet ("Fluffy" became the long-haired tick).
export function coatsOf(cat) {
  if (cat && Array.isArray(cat.coats)) return cat.coats;
  const c = cat && cat.coat;
  return c && COAT_LIST.includes(c) ? [c] : [];
}
export function isLongHaired(cat) { return !!(cat && (cat.longHaired || cat.coat === 'Fluffy')); }
// ["Ginger","White"] -> "Ginger and white"; three or more -> "Black, white and ginger".
export function coatText(coats, longHaired) {
  const w = coats.map((c, i) => i === 0 ? c : c.toLowerCase());
  let t = w.length <= 1 ? (w[0] || '') : w.slice(0, -1).join(', ') + ' and ' + w[w.length - 1];
  if (longHaired) t = t ? t + ', long-haired' : 'Long-haired';
  return t;
}
// The pin takes the first colour that is not White; a white-only cat is white. White plus anything gets a white ring.
export function swatchFromCoats(coats, id, longHaired) {
  const main = coats.find(c => c !== 'White') || coats[0];
  return main ? swatchFor(main, id) : longHaired ? swatchFor('long', id) : swatchFor('', id);
}
export function whiteRing(cat) { const c = coatsOf(cat); return c.includes('White') && c.some(x => x !== 'White'); }
// A cat's home: its latest "Lives here" sighting that has a place. Latest wins.
// A cat's home: the latest of its Lives-here sightings and the homes marked on the map with no photo
// (cat.homesMarked, Beth 2026-10-05 "a cat lives here"). A marked home is NOT a sighting: it never counts in stats.
export function homeOf(summary) {
  let h = null;
  for (const s of summary.sightings) if (s.livesHere && hasPin(s) && (!h || s.at > h.at)) h = { lat: s.lat, lng: s.lng, at: s.at, sightingId: s.id };
  for (const [i, m] of (summary.cat.homesMarked || []).entries()) {
    const p = m && !m.removed ? cleanPlace(m.lat, m.lng) : null;
    if (p && (!h || (m.at || 0) > h.at)) h = { lat: p.lat, lng: p.lng, at: m.at || 0, marked: true, how: m.how || '', index: i };
  }
  return h;
}
// A home marked for a cat that has never been logged (Beth: dashed amber until it is logged or merged).
export const homeUnmatched = summary => summary.count === 0 && !!homeOf(summary);
const FALLBACK = ['#2F6B4F', '#E9A23B', '#D9641E', '#8A8F99', '#17181C', '#9A6B3F'];
export function swatchFor(coat, id = '') {
  for (const [re, hex] of SWATCH) if (re.test(coat || '')) return hex;
  let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return FALLBACK[h % FALLBACK.length];
}

// A cat with no name shows its running number ("Cat 12"); every new unnamed cat is given the next number.
export function displayName(cat) { const n = cat && cat.name && cat.name.trim(); return n || (cat && cat.num ? 'Cat ' + cat.num : 'Unnamed'); }
export function initial(cat) { const n = cat && cat.name && cat.name.trim(); return n ? n[0].toUpperCase() : (cat && cat.num ? String(cat.num) : '+'); }
export function isUnnamed(cat) { return !(cat && cat.name && cat.name.trim()); }
export function nextNum(allCats) { return allCats.reduce((m, c) => Math.max(m, Number(c.num) || 0), 0) + 1; }

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
// A pin counts only when BOTH lat and lng are real numbers (a lat-only sighting broke the cat page live, 2026-10-03).
// One clean form for a place: two real numbers in range, or null. Strings that hold numbers are accepted and converted.
export function coord(v) {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}
export function cleanPlace(lat, lng) {
  const a = coord(lat), b = coord(lng);
  return a === null || b === null || Math.abs(a) > 90 || Math.abs(b) > 180 ? null : { lat: a, lng: b };
}
export const hasPin = s => cleanPlace(s.lat, s.lng) !== null;

export function lastPosition(summary) {
  const s = summary.sightings.find(hasPin);
  return s ? { lat: s.lat, lng: s.lng } : null;
}

// Nearest cats to a point: distance is to the cat's closest pin, not its latest one.
export function nearest(summaries, pos, radius = Infinity) {
  if (!pos) return [];
  const out = [];
  for (const e of summaries) {
    let best = Infinity;
    for (const s of e.sightings) if (hasPin(s)) best = Math.min(best, metres(pos, s));
    if (Number.isFinite(best) && best <= radius) out.push({ ...e, distance: best });
  }
  return out.sort((a, b) => a.distance - b.distance);
}

// Territory spread: furthest pin from the centre of all pins, in metres.
export function territory(summary) {
  const pts = summary.sightings.filter(hasPin);
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

// Days in a row with at least one sighting by either of you, counting back from today (or from yesterday,
// so the streak is not shown as broken before anyone has been out today).
export function streak(sightings, now) {
  const days = new Set(sightings.map(s => dayKey(s.at)));
  let d = startOfDay(now);
  if (!days.has(dayKey(d))) d = startOfDay(d - DAY / 2);
  let n = 0;
  while (days.has(dayKey(d))) { n++; d = startOfDay(d - DAY / 2); }
  return n;
}

// Milestones crossed between two counts, as toast lines.
const CAT_MARKS = [10, 25, 50, 100, 250], SIGHT_MARKS = [50, 100, 250, 500, 1000];
export function milestones(before, after) {
  const out = [];
  for (const m of CAT_MARKS) if (before.cats < m && after.cats >= m) out.push(`🎉 Your ${m}th cat in The Catalogue!`);
  for (const m of SIGHT_MARKS) if (before.sightings < m && after.sightings >= m) out.push(`🎉 ${m} sightings logged!`);
  return out;
}

// FURCAST: which cat is likeliest near here at this time of day, plus the best slots from the whole log.
const minuteOfDay = t => { const d = new Date(t); return d.getHours() * 60 + d.getMinutes(); };
const circMin = (a, b) => { const x = Math.abs(a - b) % 1440; return Math.min(x, 1440 - x); };
function bestSlot(sightings, fromMin, toMin) {
  const b = new Map();
  for (const s of sightings) { const m = minuteOfDay(s.at); if (m >= fromMin && m < toMin) { const k = Math.floor(m / 30) * 30; b.set(k, (b.get(k) || 0) + 1); } }
  let best = null;
  for (const [k, n] of b) if (!best || n > best.n || (n === best.n && k < best.k)) best = { k, n };
  return best ? String(Math.floor(best.k / 60)).padStart(2, '0') + ':' + String(best.k % 60).padStart(2, '0') : null;
}
export function furcast(summaries, pos, now) {
  const all = summaries.flatMap(e => e.sightings);
  const wd = [0, 0, 0, 0, 0, 0, 0];
  for (const s of all) wd[new Date(s.at).getDay()]++;
  const top = Math.max(...wd);
  const slots = { morning: bestSlot(all, 300, 720), evening: bestSlot(all, 1020, 1380), busiest: top > 0 ? WD[wd.indexOf(top)] : null };
  const hm = t => { const d = new Date(t); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  const window = hm(now - 90 * 60000) + ' and ' + hm(now + 90 * 60000);
  if (!pos) return { slots, pick: null, window, total: all.length };
  const nowMin = minuteOfDay(now);
  let pick = null;
  for (const e of summaries) {
    const near = e.sightings.filter(s => hasPin(s) && metres(pos, s) <= 150);
    const nearAndTime = near.filter(s => circMin(minuteOfDay(s.at), nowMin) <= 90);
    // A cat whose home is within 150 m of here is the likeliest of all to turn up (Beth: "Furcast weights home").
    const home = homeOf(e);
    const homeNear = !!(home && metres(pos, home) <= 150);
    const score = nearAndTime.length * 3 + near.length + (homeNear ? 6 : 0);
    if (score > 0 && (!pick || score > pick.score)) pick = { cat: e.cat, score, near: near.length, nearAndTime: nearAndTime.length, total: e.count, homeNear };
  }
  return { slots, pick, window, total: all.length };
}

// FRIENDS (Beth 2026-10-04: "photographed together ... we can reasonably assume those cats are friends").
// Two cats are friends when they share a photo, or were logged within 10 minutes and 50 m of each other.
// A pair either cat has marked "not friends" (cat.notFriends) is left out. Returns Map catId -> Map otherId -> {why, n}.
export function friendGraph(summaries) {
  const g = new Map(), byId = new Map(summaries.map(e => [e.cat.id, e.cat]));
  const blocked = (a, b) => (byId.get(a)?.notFriends || []).includes(b) || (byId.get(b)?.notFriends || []).includes(a);
  const link = (a, b, why) => {
    if (a === b || blocked(a, b)) return;
    for (const [x, y] of [[a, b], [b, a]]) {
      if (!g.has(x)) g.set(x, new Map());
      const cur = g.get(x).get(y) || { why, n: 0 };
      cur.n++; if (why === 'same photo') cur.why = why;
      g.get(x).set(y, cur);
    }
  };
  const all = summaries.flatMap(e => e.sightings);
  const byPhoto = new Map();
  for (const s of all) if (s.photoId) { if (!byPhoto.has(s.photoId)) byPhoto.set(s.photoId, new Set()); byPhoto.get(s.photoId).add(s.catId); }
  for (const cats of byPhoto.values()) { const c = [...cats]; for (let i = 0; i < c.length; i++) for (let j = i + 1; j < c.length; j++) link(c[i], c[j], 'same photo'); }
  const pinned = all.filter(hasPin).sort((a, b) => a.at - b.at);
  for (let i = 0; i < pinned.length; i++) for (let j = i + 1; j < pinned.length && pinned[j].at - pinned[i].at <= 10 * 60000; j++) {
    const a = pinned[i], b = pinned[j];
    if (a.catId !== b.catId && !(a.photoId && a.photoId === b.photoId) && metres(a, b) <= 50) link(a.catId, b.catId, 'seen together');
  }
  return g;
}

// LOOKALIKES: other cats with the same coat (same set of colours, and both set) seen within 300 m of this one.
export function lookalikes(summaries, id) {
  const me = summaries.find(e => e.cat.id === id); if (!me) return [];
  const key = c => [...coatsOf(c)].sort().join('+');
  const k = key(me.cat); if (!k) return [];
  const mine = me.sightings.filter(hasPin);
  const out = [];
  for (const e of summaries) {
    if (e.cat.id === id || key(e.cat) !== k) continue;
    let best = Infinity;
    for (const a of mine) for (const b of e.sightings) if (hasPin(b)) best = Math.min(best, metres(a, b));
    if (best <= 300) out.push({ ...e, distance: best });
  }
  return out.sort((a, b) => a.distance - b.distance);
}

// HOUSEHOLDS: cats whose homes are within 5 m of each other share one map marker (the same building). Beth ruled
// 2026-10-05 REPLACE of the 2026-10-04 25 m: terraced houses are about 5 m apart, so next-door homes merged.
export function households(summaries, within = 5) {
  const homes = summaries.map(e => ({ e, h: homeOf(e) })).filter(x => x.h);
  const groups = [];
  for (const x of homes) {
    const g = groups.find(gr => gr.some(y => metres(y.h, x.h) <= within));
    if (g) g.push(x); else groups.push([x]);
  }
  return groups.map(gr => ({ cats: gr.map(x => x.e), lat: gr.reduce((s, x) => s + x.h.lat, 0) / gr.length, lng: gr.reduce((s, x) => s + x.h.lng, 0) / gr.length }));
}

// Pin layout per zoom (Beth's ruling 2026-10-05, REPLACES the every-zoom nudging of 2026-10-04): below the map's
// deepest zoom every pin sits EXACTLY on its true point and overlaps are allowed; only at full zoom are overlapping
// pins placed side by side (spread below), so each cat can be tapped even at one venue. `crowded` marks a pin that
// overlaps another at this zoom, so its label can be hidden. Returns {x, y, moved, crowded} per point.
export function layoutPins(points, atFullZoom, pad = 4) {
  const r = p => p.r || 23;
  const crowded = points.map((p, i) => points.some((q, j) => j !== i && Math.hypot(p.x - q.x, p.y - q.y) < r(p) + r(q) + pad));
  if (!atFullZoom) return points.map((p, i) => ({ x: p.x, y: p.y, moved: false, crowded: crowded[i] }));
  return spread(points, pad).map((o, i) => ({ ...o, crowded: crowded[i] }));
}

// Marker layout (Beth 2026-10-04 01:33): a marker sits EXACTLY on its true point unless its circle overlaps another.
// Only overlapping markers move, by the smallest nudge that clears the overlap, clustered round their shared spot;
// every other marker is a fixed obstacle and never moves. Run per zoom, so once markers stop overlapping they are
// back on their true points. Points are {x, y, r} in pixels (r = half the marker's width).
// Returns {x, y, moved} per point. Markers on the very same coordinates overlap at every zoom and stay a small cluster.
export function spread(points, pad = 4) {
  const n = points.length;
  const P = points.map(p => ({ x: p.x, y: p.y, r: p.r || 23 }));
  const need = (i, j) => P[i].r + P[j].r + pad;
  const overlaps = (i, j) => Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y) < need(i, j);
  // 1. Which markers overlap at all, and in which groups (overlap is chained: A on B on C is one group).
  const group = new Array(n).fill(-1); let g = 0;
  for (let i = 0; i < n; i++) {
    if (group[i] !== -1) continue;
    const stack = [i], members = []; let any = false;
    group[i] = g;
    while (stack.length) {
      const k = stack.pop(); members.push(k);
      for (let j = 0; j < n; j++) if (j !== k && overlaps(k, j)) { any = true; if (group[j] === -1) { group[j] = g; stack.push(j); } }
    }
    if (!any) group[i] = -2; // touches nothing: fixed at its true point
    g++;
  }
  const movable = i => group[i] >= 0;
  // 2. Overlapping markers start on their true spots; markers on the very same spot fan out a hair so they have a
  //    direction to separate in. Step 3 then pushes apart only what touches, which keeps every nudge small.
  const at = new Map();
  for (let i = 0; i < n; i++) if (movable(i)) { const k = P[i].x.toFixed(2) + ',' + P[i].y.toFixed(2); at.set(k, (at.get(k) || []).concat(i)); }
  for (const ids of at.values()) if (ids.length > 1) ids.forEach((i, m) => { const t = 2 * Math.PI * m / ids.length; P[i].x += Math.cos(t) * 0.5; P[i].y += Math.sin(t) * 0.5; });
  // 3. Clear any leftover contact. Fixed markers never move; a moved marker that touches one is pushed off it.
  for (let round = 0; round < 600; round++) {
    let moved = false;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      if (!movable(i) && !movable(j)) continue;
      let dx = P[j].x - P[i].x, dy = P[j].y - P[i].y, dist = Math.hypot(dx, dy);
      const want = need(i, j);
      if (dist >= want) continue;
      if (dist < 0.01) { dx = 1; dy = 0; dist = 1; }
      const gap = want - dist + 0.1;
      if (movable(i) && movable(j)) { P[i].x -= dx / dist * gap / 2; P[i].y -= dy / dist * gap / 2; P[j].x += dx / dist * gap / 2; P[j].y += dy / dist * gap / 2; }
      else if (movable(i)) { P[i].x -= dx / dist * gap; P[i].y -= dy / dist * gap; }
      else { P[j].x += dx / dist * gap; P[j].y += dy / dist * gap; }
      moved = true;
    }
    if (!moved) break;
  }
  return P.map((p, i) => movable(i) ? { x: p.x, y: p.y, moved: true } : { x: points[i].x, y: points[i].y, moved: false });
}

// ---------- CATWALK (Beth 2026-10-05): a loop from here back to here, in the time she picks, past as many DIFFERENT
// cats as the time allows. Scores are Furcast's: a sighting near this time of day counts more, a home counts most,
// and a "Not here" from an earlier walk (cat.misses) near this spot and time counts against.
// Planning runs on a table of walking minutes between points (point 0 is the start). With the walking router the
// table is real path times; without it, straight lines times DETOUR. Turn points (no cat) on rings round the start
// let a loop fill the time when the cats alone would make it short.
export const WALK = { mPerMin: 75, dwellMin: 1, detour: 1.3, spotM: 40, shareM: 30 };
export function walkCandidates(summaries, now) {
  const nowMin = minuteOfDay(now), out = [];
  for (const e of summaries) {
    const home = homeOf(e), pts = e.sightings.filter(hasPin).map(s => ({ lat: s.lat, lng: s.lng }));
    if (home) pts.push({ lat: home.lat, lng: home.lng, home: true });
    let best = null;
    for (const p of pts) {
      const near = e.sightings.filter(s => hasPin(s) && metres(p, s) <= WALK.spotM);
      const timely = near.filter(s => circMin(minuteOfDay(s.at), nowMin) <= 90).length;
      const atHome = !!(home && metres(p, home) <= WALK.spotM);
      const missed = (e.cat.misses || []).filter(m => cleanPlace(m.lat, m.lng) && metres(p, m) <= WALK.spotM && circMin(minuteOfDay(m.at), nowMin) <= 90).length;
      const score = near.length + timely * 2 + (atHome ? 6 : 0) - missed * 2;
      if (score > 0 && (!best || score > best.score)) {
        const mins = near.map(s => minuteOfDay(s.at)).sort((a, b) => a - b);
        best = { cat: e.cat, lat: p.lat, lng: p.lng, score, home: atHome, seen: near.length, usual: mins.length ? [mins[0], mins[mins.length - 1]] : null };
      }
    }
    if (best) out.push(best);
  }
  return out;
}
// Turn points: rings round the start, `dirs` directions each. Straight-line planning gets a fine set; the router a small one.
export function ringPoints(origin, radii, dirs) {
  const out = [], k = 111320, kl = 111320 * Math.cos(origin.lat * Math.PI / 180);
  for (const r of radii) for (let i = 0; i < dirs; i++) { const a = (i / dirs) * 2 * Math.PI + r / 997; out.push({ lat: origin.lat + (r * Math.cos(a)) / k, lng: origin.lng + (r * Math.sin(a)) / kl, turn: true }); }
  return out;
}
// Points for the table: start, then the strongest candidates that could be reached at all, then turn points.
export function walkPoints(summaries, origin, minutes, now, { maxCats = 34, radii, dirs } = {}) {
  const reach = (minutes * WALK.mPerMin) / 2;
  const cands = walkCandidates(summaries, now).filter(c => metres(origin, c) <= reach).sort((a, b) => b.score - a.score).slice(0, maxCats);
  const turns = ringPoints(origin, (radii || [100, 200, 300, 400, 550, 700, 850, 1000, 1200, 1400, 1700, 2000, 2400, 2800]).filter(r => r <= reach), dirs || 12);
  return { points: [{ lat: origin.lat, lng: origin.lng }, ...cands, ...turns], nCands: cands.length };
}
export const straightTable = points => points.map(a => points.map(b => (metres(a, b) * WALK.detour) / WALK.mPerMin));
// Loop time for an order of point indices (start excluded): legs from the table plus a minute at each cat stop.
export function loopMinutes(table, order, points) {
  const seq = [0, ...order, 0];
  let t = 0; for (let i = 1; i < seq.length; i++) t += table[seq[i - 1]][seq[i]];
  return t + order.filter(i => !points[i].turn).length * WALK.dwellMin;
}
// rng: a function returning 0..1; jitter 0 gives the best plan, a reroll passes a fresh rng and jitter > 0.
export function planOnTable(points, nCands, table, minutes, { rng = Math.random, jitter = 0 } = {}) {
  const w = points.map((p, i) => i >= 1 && i <= nCands ? p.score * (1 + jitter * (rng() - 0.5)) : 0);
  const order = [], used = new Set(), extra = new Map();   // extra: stop index -> other candidates sharing it
  for (;;) {
    let pick = null; const base = loopMinutes(table, order, points);
    for (let c = 1; c <= nCands; c++) {
      if (used.has(points[c].cat.id)) continue;
      const shared = order.find(i => metres(points[i], points[c]) <= WALK.shareM);
      if (shared !== undefined) { pick = { c, shared, ratio: Infinity }; break; }   // another cat at a stop already on the loop is free
      for (let k = 0; k <= order.length; k++) {
        const t = loopMinutes(table, [...order.slice(0, k), c, ...order.slice(k)], points);
        if (t > minutes * 1.05) continue;
        const ratio = w[c] / (t - base + 0.5);
        if (!pick || ratio > pick.ratio) pick = { c, k, ratio };
      }
    }
    if (!pick) break;
    used.add(points[pick.c].cat.id);
    if (pick.shared !== undefined) extra.set(pick.shared, [...(extra.get(pick.shared) || []), pick.c]);
    else order.splice(pick.k, 0, pick.c);
  }
  // Fill the time: up to two turn points, each placed where it brings the loop closest to the slider.
  for (let round = 0; round < 2 && loopMinutes(table, order, points) < minutes * 0.95; round++) {
    let best = null;
    for (let t = nCands + 1; t < points.length; t++) for (let k = 0; k <= order.length; k++) {
      const trial = [...order.slice(0, k), t, ...order.slice(k)], m = loopMinutes(table, trial, points);
      if (m > minutes * 1.1) continue;
      // A reroll picks at random among turns that land within 10 per cent, so the loop itself changes.
      const fit = Math.abs(m - minutes) <= minutes * 0.1, r = jitter ? rng() : 0;
      if (!best || (jitter && fit && (!best.fit || r > best.r)) || (!(jitter && best.fit) && Math.abs(m - minutes) < Math.abs(best.m - minutes))) best = { trial, m, fit, r };
    }
    if (!best || best.m <= loopMinutes(table, order, points)) break;
    order.splice(0, order.length, ...best.trial);
  }
  const stops = order.map(i => points[i].turn ? { lat: points[i].lat, lng: points[i].lng, turn: true, cats: [], idx: i }
    : { lat: points[i].lat, lng: points[i].lng, home: points[i].home, cats: [points[i], ...(extra.get(i) || []).map(j => points[j])].map(c => ({ ...c, w: w[points.indexOf(c)] })), idx: i });
  return { stops, minutes: loopMinutes(table, order, points), order };
}
// Straight-line plan, used without the router and by the tests.
export function planWalk(summaries, origin, minutes, now, opts = {}) {
  const { points, nCands } = walkPoints(summaries, origin, minutes, now);
  return planOnTable(points, nCands, straightTable(points), minutes, opts);
}
export const minHHMM = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');

// REPURRT SEARCH (Beth 2026-10-05): every live cat, by name, its number ("12" finds Cat 12), coat and markings.
// Returns the matching summaries; the caller orders them nearest first.
export function searchCats(summaries, q) {
  const t = String(q || '').trim().toLowerCase(); if (!t) return [];
  const words = t.split(/\s+/);
  return summaries.filter(e => {
    const c = e.cat, hay = [c.name, displayName(c), c.num ? String(c.num) : '', coatText(coatsOf(c), isLongHaired(c)), c.coat, c.markings, ...(c.aliases || [])].filter(Boolean).join(' ').toLowerCase();
    return words.every(w => /^\d+$/.test(w) ? String(c.num || '') === w || hay.split(/\W+/).includes(w) : hay.includes(w));
  });
}
// The phone's date-and-time picker speaks local "YYYY-MM-DDTHH:MM"; the log speaks milliseconds.
export function toLocalInput(t) { const d = new Date(t), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; }
export function fromLocalInput(s) { const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).getTime() : null; }
// MOVE A HOUSE (Beth 2026-10-05): every home in the household shifts by the same amount, so homes keep their spacing.
// Returns the writes to make: { kind: 'marked', catId, homesMarked } or { kind: 'sighting', sightingId, lat, lng, from }.
export function homeMoves(summaries, dLat, dLng, by, now) {
  const out = [];
  for (const e of summaries) {
    const h = homeOf(e); if (!h) continue;
    if (h.marked) out.push({ kind: 'marked', catId: e.cat.id, homesMarked: e.cat.homesMarked.map((m, i) => i === h.index ? { ...m, lat: m.lat + dLat, lng: m.lng + dLng, movedFrom: { lat: m.lat, lng: m.lng }, movedAt: now, movedBy: by } : m) });
    else out.push({ kind: 'sighting', sightingId: h.sightingId, lat: h.lat + dLat, lng: h.lng + dLng, from: { lat: h.lat, lng: h.lng } });
  }
  return out;
}
