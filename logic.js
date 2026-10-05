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

// HOUSEHOLDS: cats whose homes are within 25 m of each other share one map marker.
export function households(summaries, within = 25) {
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
