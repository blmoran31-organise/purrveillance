// PURRVEILLANCE v1, app shell and screens. Plain JS, no build step.
// Screens follow docs/mockups: Catflap, Meow Map, Pawparazzi, Repurrt, The Catalogue, Catalogue entry, Meowmentum.

import * as L from './logic.js';
import { openStore, configured, newId, newHouseCode } from './store.js';

const $app = document.getElementById('app');
const params = new URLSearchParams(location.search);
const DEMO = params.has('demo');
const LS = {
  get(k) { try { return localStorage.getItem('purrveillance-' + k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem('purrveillance-' + k, v); } catch { /* private mode */ } },
};

const S = {
  store: null, house: null, me: LS.get('me'), data: { cats: [], sightings: [] }, sums: [], byId: new Map(),
  pos: null, posAt: 0, maps: [], stream: null, draft: null, filter: 'all', period: LS.get('period') || 'week',
  renaming: null, error: null, toast: null, showAllChips: false,
};

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const PERSON = L.PERSON_LABEL;
const meName = () => PERSON[S.me] || 'You';
const themName = () => PERSON[L.other(S.me || 'beth')];

// ---------- icons (from the mockups) ----------
const I = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11l8-7 8 7v9H4z"/><path d="M10 20v-6h4v6"/></svg>',
  map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  paw: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="16" rx="4.5" ry="3.5"/><circle cx="6.5" cy="10" r="1.8"/><circle cx="17.5" cy="10" r="1.8"/><circle cx="9.5" cy="6" r="1.8"/><circle cx="14.5" cy="6" r="1.8"/></svg>',
  cat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9l-1-5 5 3h6l5-3-1 5a8 8 0 0 1-14 0z"/><path d="M5 9c0 6 3 10 7 10s7-4 7-10"/><circle cx="9.5" cy="12" r="0.8"/><circle cx="14.5" cy="12" r="0.8"/></svg>',
  stats: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 20V10M12 20V4M19 20v-7"/></svg>',
  plus: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  back: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  next: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
  gallery: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 16l5-5 4 4 3-3 6 6"/><circle cx="16" cy="9" r="1.5"/></svg>',
  flip: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10a8 8 0 0 1 14-4l2 2M20 14a8 8 0 0 1-14 4l-2-2"/><path d="M20 4v4h-4M4 20v-4h4"/></svg>',
  pen: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4l10-10-4-4L4 16z"/><path d="M12 8l4 4"/></svg>',
  camera: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h3l2-3h6l2 3h3v12H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  pencil: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4l10-10-4-4L4 16z"/><path d="M12 8l4 4"/></svg>',
  heart: on => `<svg width="22" height="22" viewBox="0 0 24 24" fill="${on ? '#D9641E' : 'none'}" stroke="${on ? '#D9641E' : '#B8BCC4'}" stroke-width="2" stroke-linejoin="round"><path d="M12 20s-7-4.6-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.4-7 10-7 10z"/></svg>`,
};

function nav(on) {
  const items = [['catflap', 'Catflap', I.home], ['map', 'Meow Map', I.map], ['catalogue', 'Catalogue', I.cat], ['stats', 'Meowmentum', I.stats]];
  return `<nav class="bar">${items.map(([r, t, i]) => `<a href="#/${r}" class="${r === on ? 'on' : ''}">${i}${t}</a>`).join('')}</nav>`;
}
function banner() {
  if (S.error) return `<div class="banner">Can't reach the shared log (${esc(S.error)}). Check signal; nothing new will save until it's back.</div>`;
  if (DEMO) return '<div class="banner">DEMO: sample cats on this phone only, not shared</div>';
  return '';
}

// ---------- data ----------
// Soft delete: nothing ever leaves the database. Deleted or merged cats, deleted sightings and hidden photos are
// filtered out HERE, once, so every screen, map, count and stat agrees. S.raw keeps everything for Recently deleted.
function setData(d) {
  const clean = s => { const p = L.cleanPlace(s.lat, s.lng); return { ...s, lat: p ? p.lat : null, lng: p ? p.lng : null }; };
  S.raw = { cats: d.cats, sightings: d.sightings.map(clean) };
  const cats = d.cats.filter(c => !c.deleted && !c.mergedInto);
  const live = new Set(cats.map(c => c.id));
  const sightings = S.raw.sightings.filter(s => !s.deleted && live.has(s.catId));
  S.hiddenPhotos = new Set(S.raw.sightings.filter(s => s.photoDeleted && s.photoId).map(s => s.photoId));
  S.nextNum = L.nextNum(d.cats);
  S.data = { cats, sightings }; S.sums = L.summarise(cats, sightings);
  S.byId = new Map(S.sums.map(e => [e.cat.id, e]));
}
function swatch(cat) { return cat.swatch || L.swatchFor(cat.coat, cat.id); }
function photoOk(id) { return !!id && !(S.hiddenPhotos && S.hiddenPhotos.has(id)); }
// The cat's chosen photo if it is still visible, else its newest visible sighting photo.
function catPhotoId(cat) {
  if (photoOk(cat.thumbPhotoId)) return cat.thumbPhotoId;
  const e = S.byId.get(cat.id); const s = e && e.sightings.find(x => photoOk(x.photoId));
  return s ? s.photoId : null;
}
function photoAttr(cat) { const id = catPhotoId(cat); return id ? ` data-photo="${esc(id)}"` : ''; }
function photoAttrId(id) { return photoOk(id) ? ` data-photo="${esc(id)}"` : ''; }
async function hydratePhotos(root = $app) {
  for (const el of root.querySelectorAll('[data-photo]')) {
    const id = el.dataset.photo; el.removeAttribute('data-photo');
    try { const p = await S.store.photo(id); if (p && p.data && !p.deleted) { el.style.backgroundImage = `url("${p.data}")`; el.classList.add('hasphoto'); const t = el.querySelector('.ini'); if (t) t.textContent = ''; } } catch (e) { console.warn('photo', id, e); }
  }
}
function counts() { return { cats: S.data.cats.length, sightings: S.data.sightings.length }; }
// After a save, a crossed milestone replaces the plain toast.
function celebrate(before, added) {
  const lines = L.milestones(before, { cats: before.cats + (added.cats || 0), sightings: before.sightings + (added.sightings || 0) });
  if (lines.length) S.toast = lines.join(' · ');
}
const stamp = () => ({ deletedAt: Date.now(), deletedBy: S.me || 'unknown' });

function getPos(maxAge = 60000) {
  if (S.pos && Date.now() - S.posAt < maxAge) return Promise.resolve(S.pos);
  return new Promise(res => {
    if (!navigator.geolocation) return res(null);
    navigator.geolocation.getCurrentPosition(p => { S.pos = { lat: p.coords.latitude, lng: p.coords.longitude }; S.posAt = Date.now(); res(S.pos); },
      () => res(S.pos), { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 });
  });
}
function lastKnownPlace() {
  let best = null;
  for (const s of S.data.sightings) if (L.hasPin(s) && (!best || s.at > best.at)) best = s;
  return best ? { lat: best.lat, lng: best.lng } : null;
}

// ---------- maps ----------
function killMaps() { for (const m of S.maps) { try { m.remove(); } catch { } } S.maps = []; }
function makeMap(el, opts = {}) {
  if (!window.L || !window.L.map) throw new Error("the map library didn't load, check signal and reload");
  const m = window.L.map(el, { zoomControl: false, attributionControl: true, ...opts });
  window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(m);
  S.maps.push(m); return m;
}
const divIcon = html => window.L.divIcon({ html, className: '', iconSize: [0, 0] });
// Run map drawing so a failure shows ON the map box and never blanks the rest of the screen.
function guardMap(el, label, fn) {
  try { return fn(); }
  catch (x) {
    console.error(label, x);
    if (el) { const n = document.createElement('div'); n.className = 'mapfail'; n.textContent = 'Map could not draw: ' + (x.message || x); el.appendChild(n); }
    return null;
  }
}

// ---------- router ----------
function route() { const h = location.hash.replace(/^#\/?/, '') || 'catflap'; const [name, arg] = h.split('/'); return { name, arg }; }
function go(h) { if (location.hash === '#/' + h) render(); else location.hash = '#/' + h; }
window.addEventListener('hashchange', () => render());

function stopCamera() { if (S.stream) { for (const t of S.stream.getTracks()) t.stop(); S.stream = null; } }

function render() {
  const r = route();
  killMaps();
  if (r.name !== 'camera') stopCamera();
  if (r.name !== 'cat') { S.renaming = null; S.rowOpen = null; S.moving = null; S.merging = null; S.confirmDel = null; S.placingSight = null; S.editing = null; S.editDraft = null; }
  const screens = { catflap: Catflap, map: MeowMap, camera: Pawparazzi, repurrt: Repurrt, meowmeries: Meowmeries, catalogue: Catalogue, cat: CatEntry, stats: Meowmentum, deleted: Deleted };
  // A screen that throws still gets its photos and its toast, and the error shows on screen (live bug 2026-10-03).
  try { (screens[r.name] || Catflap)(r.arg); }
  catch (x) { console.error('screen ' + r.name, x); showCrash((x && x.message) || String(x)); }
  finally {
    if (S.toast) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = S.toast; $app.appendChild(t); const msg = S.toast; setTimeout(() => { if (S.toast === msg) { S.toast = null; t.remove(); } }, 4000); }
    hydratePhotos();
  }
}

// ---------- 1. CATFLAP (home, as approved 2026-10-03 22:27) ----------
// Top to bottom: header with B/C, streak, three ways to log, four stats, Mewsflash, latest sightings, extras.
function Catflap() {
  const now = Date.now();
  const week = L.stats(S.data.cats, S.data.sightings, 'week', now);
  const new30 = L.stats(S.data.cats, S.data.sightings, 'month', now).newCats;
  const streak = L.streak(S.data.sightings, now);
  const numbered = S.data.cats.filter(L.isUnnamed).length;
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  let flash = '';
  if (S.me) {
    const mf = L.mewsflash(S.sums, S.me), them = themName(), other = L.other(S.me);
    const item = (e, line) => `<a class="item" href="#/cat/${esc(e.cat.id)}"><div class="thumb" style="background-color:${swatch(e.cat)}"${photoAttr(e.cat)}><span class="ini">${esc(L.initial(e.cat))}</span></div>
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px"><div class="t">${esc(L.displayName(e.cat))}</div><div class="d">${line}</div></div></a>`;
    const rows = [
      ...mf.youMissed.map(e => item(e, `${esc(them)} has seen ${esc(L.displayName(e.cat))} ${plural(e.seen[other], 'time')}, you never have`)),
      ...mf.theyMissed.map(e => item(e, `You have seen ${esc(L.displayName(e.cat))} ${plural(e.seen[S.me], 'time')}, ${esc(them)} never has`)),
    ];
    if (rows.length) flash = `<div class="flash"><div style="display:flex;justify-content:space-between;align-items:center"><div class="k">😼 MEWSFLASH</div><div class="n">${mf.youMissed.length ? mf.youMissed.length + ' you have not seen' : ''}</div></div>${rows.join('')}</div>`;
  }
  const latest = S.data.sightings.slice().sort((a, b) => b.at - a.at).slice(0, 12);
  const strip = latest.length ? `<div class="stack8"><div class="label">Latest sightings</div><div class="latest">${latest.map(s => {
    const c = S.byId.get(s.catId)?.cat; if (!c) return '';
    const pid = photoOk(s.photoId) ? s.photoId : catPhotoId(c);
    return `<a class="lcard" href="#/cat/${esc(c.id)}"><div class="lface" style="background-color:${swatch(c)}"${pid ? ` data-photo="${esc(pid)}"` : ''}><span class="ini">${esc(L.initial(c))}</span></div><b>${esc(L.displayName(c))}</b><small>${esc(L.dayWord(s.at, now))}</small></a>`;
  }).join('')}</div></div>` : '';
  const logCard = (href, icon, title, cap, fresh) => `<a class="tile logc" href="${href}"${fresh ? ' data-fresh' : ''}>${icon}<div style="display:flex;flex-direction:column;gap:2px"><b>${title}</b><small>${cap}</small></div></a>`;
  $app.innerHTML = `${banner()}<div class="screen">
    <div class="head"><div><div class="eyebrow">PURRVEILLANCE</div><div class="title">Catflap</div></div>
      <div class="who"><button class="av beth ${S.me === 'beth' ? 'me' : ''}" data-me="beth" aria-label="This is Beth's phone">B</button><button class="av ${S.me === 'canada' ? 'me' : ''}" data-me="canada" aria-label="This is Canada's phone">C</button></div></div>
    <div class="pad stack" style="padding-bottom:20px">
      ${!S.me ? '<div class="hint">Tap <b>B</b> or <b>C</b> to say whose phone this is.</div>' : ''}
      ${streak >= 2 ? `<div class="streak">🔥 ${streak}-day streak between you. Keep it going.</div>` : streak === 1 ? '<div class="streak">🐾 A cat logged today. Tomorrow starts a streak.</div>' : ''}
      <div class="logs">
        ${logCard('#/camera', I.camera, 'Pawparazzi', 'take a photo')}
        ${logCard('#/repurrt', I.pen, 'Repurrt', 'no photo', true)}
        ${logCard('#/meowmeries', I.gallery, 'Meowmeries', 'old photos')}
      </div>
      <div class="statrow">
        <div class="st"><span>😺</span><b>${S.data.cats.length}</b><small>in The Catalogue</small></div>
        <div class="st"><span>🐈</span><b>${new30}</b><small>new, 30 days</small></div>
        <div class="st"><span>👀</span><b>${week.sightings}</b><small>sightings this week</small></div>
        <div class="st"><span>😻</span><b>${week.purr.beth + week.purr.canada}</b><small>pets this week</small></div>
      </div>
      ${flash}
      ${strip}
      ${numbered ? `<a class="nudge" href="#/catalogue" id="nudge">🐈‍⬛ ${numbered === 1 ? '1 cat is' : numbered + ' cats are'} still ${numbered === 1 ? 'a number' : 'numbers'}. Name ${numbered === 1 ? 'it' : 'them'} ${I.next}</a>` : ''}
      <div class="furcast" id="furcast"><div class="fk"><span>🔮 FURCAST</span><span class="sub" id="fcwhen">${esc(L.longStamp(now).split(', ')[1])}</span></div><div id="fcbody" class="sub">Working out the odds…</div></div>
    </div></div>${nav('catflap')}`;
  for (const b of $app.querySelectorAll('[data-me]')) b.onclick = () => { S.me = b.dataset.me; LS.set('me', S.me); render(); };
  for (const a of $app.querySelectorAll('[data-fresh]')) a.onclick = () => { S.draft = null; };
  const nd = document.getElementById('nudge'); if (nd) nd.onclick = () => { S.filter = 'unnamed'; };
  const fill = pos => {
    const body = document.getElementById('fcbody'); if (!body) return;
    const fc = L.furcast(S.sums, pos, Date.now());
    if (fc.total < 3) { body.innerHTML = 'Log a few more cats and Furcast starts guessing who you might see.'; return; }
    const line = !pos ? 'Allow location to see which cat is likeliest near you right now.'
      : fc.pick ? `Good odds of <b>${esc(L.displayName(fc.pick.cat))}</b> right now: ${[fc.pick.homeNear ? 'you are near its home' : '', fc.pick.nearAndTime ? `${fc.pick.nearAndTime} of ${fc.pick.total} sightings were within 150 m of here between ${fc.window}` : fc.pick.near ? `${fc.pick.near} of ${fc.pick.total} sightings were within 150 m of here` : ''].filter(Boolean).join(', and ')}.`
      : 'No cats logged within 150 m of here yet. Somewhere new?';
    body.innerHTML = `<div class="fline">${line}</div><div class="fslots"><div><b>${fc.slots.morning || '-'}</b><small>best morning</small></div><div><b>${fc.slots.evening || '-'}</b><small>best evening</small></div><div><b>${fc.slots.busiest || '-'}</b><small>busiest day</small></div></div>`;
  };
  fill(S.pos && Date.now() - S.posAt < 300000 ? S.pos : null);
  getPos().then(p => { if (route().name === 'catflap') fill(p); });
}

// ---------- 2. MEOW MAP ----------
function MeowMap() {
  const n = S.sums.filter(e => e.count).length;
  $app.innerHTML = `${banner()}<div class="screen" style="overflow:hidden">
    <div class="head"><div><div class="title">MEOW MAP</div><div class="sub" id="mapsub">${n} cat${n === 1 ? '' : 's'} · ${S.data.sightings.length} sighting${S.data.sightings.length === 1 ? '' : 's'} · finding you…</div></div>
      <a href="#/catflap" class="av ${S.me === 'beth' ? 'beth' : ''}" style="width:44px;height:44px;border-radius:22px">${S.me ? PERSON[S.me][0] : '?'}</a></div>
    <div class="mapwrap"><div id="map" style="position:absolute;inset:0"></div>
      <a class="camfab" href="#/camera" aria-label="Spotted one: open Pawparazzi">${I.camera}</a>
      <div class="near" id="near"><div class="label">Near you</div><div class="sub">Finding your position…</div></div></div>
  </div>
  ${nav('map')}`;
  const mapEl = document.getElementById('map');
  const m = guardMap(mapEl, 'meow map', () => makeMap(mapEl));
  const pins = [];
  for (const e of S.sums) {
    const p = L.lastPosition(e); if (!p) continue;
    const unnamed = L.isUnnamed(e.cat);
    const label = `${L.displayName(e.cat)} · ${e.count}`;
    const hm = L.homeOf(e);
    if (m && hm) guardMap(null, 'home ' + e.cat.id, () => window.L.marker([hm.lat, hm.lng], { icon: divIcon(`<div class="homepin" style="background:${swatch(e.cat)}" title="${esc(L.displayName(e.cat))}'s home">🏠</div>`) }).addTo(m).on('click', () => go('cat/' + e.cat.id)));
    const html = `<div class="pin ${unnamed ? 'unnamed' : ''} ${L.whiteRing(e.cat) ? 'ring' : ''}"><i style="background:${unnamed ? 'var(--moss)' : swatch(e.cat)}">${esc(L.initial(e.cat))}</i><span>${esc(label)}</span></div>`;
    if (m) guardMap(null, 'pin ' + e.cat.id, () => { const mk = window.L.marker([p.lat, p.lng], { icon: divIcon(html) }).addTo(m); mk.on('click', () => go('cat/' + e.cat.id)); pins.push([p.lat, p.lng]); });
  }
  const fallback = lastKnownPlace();
  if (m) guardMap(mapEl, 'meow map view', () => { if (fallback) m.setView([fallback.lat, fallback.lng], 16); else m.setView([54.5, -3], 5); });
  getPos().then(pos => {
    if (!document.getElementById('map')) return;
    const sub = document.getElementById('mapsub');
    const near = document.getElementById('near');
    if (pos) {
      if (m) guardMap(null, 'you dot', () => { window.L.marker([pos.lat, pos.lng], { icon: divIcon('<div class="youdot"></div>'), interactive: false }).addTo(m); m.setView([pos.lat, pos.lng], 16); });
      sub.textContent = sub.textContent.replace('finding you…', 'centred on you');
      const list = L.nearest(S.sums.filter(e => e.count), pos).slice(0, 2);
      near.innerHTML = '<div class="label">Near you</div>' + (list.length ? list.map(e => `<a class="row" href="#/cat/${esc(e.cat.id)}"><span><span class="dot" style="background:${swatch(e.cat)}"></span>${esc(L.displayName(e.cat))}</span><span>${L.distWord(e.distance)} · last seen ${L.dayWord(e.last, Date.now())}</span></a>`).join('') : '<div class="sub">No cats logged yet.</div>');
    } else {
      sub.textContent = sub.textContent.replace(' · finding you…', fallback ? ' · centred on the last sighting' : '');
      near.innerHTML = '<div class="label">Near you</div><div class="sub">Location is off, so distances are hidden. Allow location for this site to see what is near you.</div>';
    }
  });
}

// ---------- 3. PAWPARAZZI ----------
async function makeThumb(src, sw, sh) {
  const max = 480, k = Math.min(1, max / Math.max(sw, sh));
  const c = document.createElement('canvas'); c.width = Math.round(sw * k); c.height = Math.round(sh * k);
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  return { data: c.toDataURL('image/jpeg', 0.72), w: c.width, h: c.height };
}
function loadImage(file) {
  return new Promise((res, rej) => { const url = URL.createObjectURL(file); const img = new Image(); img.onload = () => { res(img); setTimeout(() => URL.revokeObjectURL(url), 1000); }; img.onerror = () => rej(new Error('That photo could not be opened here. Try a JPEG.')); img.src = url; });
}
async function draftFromFile(file) {
  let gps = null, at = null;
  try { if (window.exifr) { gps = await window.exifr.gps(file); const t = await window.exifr.parse(file, ['DateTimeOriginal', 'CreateDate']); const d = t && (t.DateTimeOriginal || t.CreateDate); if (d instanceof Date && !isNaN(d)) at = d.getTime(); } } catch (e) { console.warn('exif', e); }
  const img = await loadImage(file);
  const photo = await makeThumb(img, img.naturalWidth, img.naturalHeight);
  // NaN is typeof 'number': Android's picker blanks GPS to 0/0, which reads as NaN (18 live sightings, 2026-10-03).
  const exifPlace = gps ? L.cleanPlace(gps.latitude, gps.longitude) : null;
  if (exifPlace) return newDraft({ photo, lat: exifPlace.lat, lng: exifPlace.lng, source: 'exif', at: at || Date.now() });
  const pos = await getPos();
  return newDraft({ photo, lat: pos?.lat, lng: pos?.lng, source: pos ? 'phone' : 'none', at: at || Date.now(), noGpsInPhoto: true });
}
function newDraft(o = {}) {
  return { photo: null, lat: undefined, lng: undefined, source: 'none', at: Date.now(), catId: null, seenBy: S.me || 'beth', inside: false, petted: false, livesHere: false, name: '', coats: [], longHaired: false, note: '', ...o };
}

function Pawparazzi() {
  const facing = S.facing || 'environment';
  $app.innerHTML = `<div class="screen dark">
    <div class="cam-head"><a class="round" href="#/catflap" aria-label="Back to the Catflap">${I.back}</a><div style="font-size:18px;font-weight:700;letter-spacing:0.5px">PAWPARAZZI</div><div style="width:44px"></div></div>
    <div class="viewfinder"><video id="vid" playsinline muted autoplay></video><div class="frame"></div><div class="hint" id="hint">point it at the cat</div>
      <div class="chip-dark" style="left:16px" id="where"><span style="width:8px;height:8px;border-radius:4px;background:var(--you);display:inline-block"></span>finding you…</div>
      <div class="chip-dark" style="right:16px" id="nearchip" hidden></div></div>
    <div class="cam-foot"><div class="cam-row">
        <label class="sq filebtn" aria-label="Pick from gallery">${I.gallery}<input id="pick" type="file" accept="image/*"></label>
        <button class="shutter" id="shoot" aria-label="Take photo"></button>
        <button class="sq" id="flip" aria-label="Flip camera">${I.flip}</button></div>
      <a class="link-amber" href="#/repurrt" id="nophoto">No photo, just Repurrt it ${I.next}</a>
      <div class="err" id="camerr" hidden></div></div></div>`;
  const vid = document.getElementById('vid'), err = document.getElementById('camerr');
  const showErr = t => { err.textContent = t; err.hidden = false; };
  document.getElementById('nophoto').onclick = () => { S.draft = null; };
  getPos().then(pos => {
    const w = document.getElementById('where'); if (!w) return;
    w.lastChild.textContent = pos ? 'pinned where you stand' : 'location off: you can place the pin next';
    const n = L.nearest(S.sums.filter(e => e.count), pos)[0];
    const c = document.getElementById('nearchip');
    if (n && n.distance < 1000) { c.textContent = `${L.displayName(n.cat)} is ${L.distWord(n.distance)} away`; c.hidden = false; }
  });
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 } }, audio: false })
      .then(st => { if (route().name !== 'camera') { st.getTracks().forEach(t => t.stop()); return; } S.stream = st; vid.srcObject = st; })
      .catch(() => { document.getElementById('hint').textContent = 'camera blocked: use the gallery button'; });
  } else document.getElementById('hint').textContent = 'no camera here: use the gallery button';
  document.getElementById('flip').onclick = () => { S.facing = facing === 'environment' ? 'user' : 'environment'; stopCamera(); render(); };
  document.getElementById('shoot').onclick = async () => {
    if (!S.stream || !vid.videoWidth) return showErr('The camera is not on. Use the gallery button, or allow the camera for this site.');
    const photo = await makeThumb(vid, vid.videoWidth, vid.videoHeight);
    const pos = await getPos();
    S.draft = newDraft({ photo, lat: pos?.lat, lng: pos?.lng, source: pos ? 'phone' : 'none' });
    go('repurrt');
  };
  document.getElementById('pick').onchange = async e => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    try { S.draft = await draftFromFile(f); go('repurrt'); } catch (x) { showErr(x.message || String(x)); }
  };
}

// ---------- 4. REPURRT ----------
function Repurrt() {
  if (!S.draft) { S.draft = newDraft(); getPos().then(p => { if (S.draft && S.draft.source === 'none' && p) { S.draft.lat = p.lat; S.draft.lng = p.lng; S.draft.source = 'phone'; if (route().name === 'repurrt') render(); } }); }
  const d = S.draft;
  const pinAt = L.cleanPlace(d.lat, d.lng) || lastKnownPlace();
  const capText = { exif: 'From the photo · drag to fix', phone: 'Where you are now · drag to fix', manual: 'Placed by hand · drag to fix', none: 'No location yet · drag the pin to where it was' }[d.source];
  const named = S.sums.filter(e => e.count || e.cat);
  const byRecent = list => list.map(e => ({ ...e, distance: Infinity })).sort((a, b) => (b.last || 0) - (a.last || 0));
  const nearPinned = pinAt ? L.nearest(named, pinAt) : [];
  const near = [...nearPinned, ...byRecent(named.filter(e => !nearPinned.some(x => x.cat.id === e.cat.id)))];
  const close = near.filter(e => e.distance <= 250);
  const shown = (S.showAllChips ? near : close).filter(e => e.cat.id !== d.excludeCat && !(d.doneCats || []).includes(e.cat.id));
  if (d.catId && d.catId !== 'new' && !shown.some(e => e.cat.id === d.catId)) { const sel = near.find(e => e.cat.id === d.catId); if (sel) shown.unshift(sel); }
  const more = near.length - shown.length;
  const chip = e => `<button class="chip ${d.catId === e.cat.id ? 'on' : ''}" data-cat="${esc(e.cat.id)}"><div class="face" style="background-color:${swatch(e.cat)}"${photoAttr(e.cat)}></div><b>${esc(L.displayName(e.cat))}</b><small>${isFinite(e.distance) ? L.distWord(e.distance) : (e.last ? L.dayWord(e.last, Date.now()) : 'no pins')}</small></button>`;
  const sel = d.catId && d.catId !== 'new' ? S.byId.get(d.catId) : null;
  const saveLabel = d.catId === 'new' ? (d.name.trim() ? `Save new cat: ${d.name.trim()}` : `Save new cat (Cat ${S.nextNum})`) : sel ? `Save sighting of ${L.displayName(sel.cat)}` : 'Pick a cat first';
  const summary = `${d.inside ? 'inside' : 'outside'}, ${d.petted ? 'petted' : 'not petted'} · ${L.longStamp(d.at)}`;
  const COATS = L.COAT_LIST;
  $app.innerHTML = `${banner()}<div class="screen">
    <div class="formhead"><button class="back" id="back">${I.back}Back</button><div style="font-size:18px;font-weight:700">REPURRT</div><div style="width:50px"></div></div>
    <div class="pad stack" style="gap:12px;padding-bottom:16px">
      ${d.photoId && !d.photo ? `<div class="addphoto has"${photoAttrId(d.photoId)}><span class="cap">Same photo · pick the other cat in it</span></div>` : `<label class="addphoto ${d.photo ? 'has' : ''}" ${d.photo ? `style="background-image:url('${d.photo.data}')"` : ''}>
        ${d.photo ? `<span class="cap">${d.noGpsInPhoto ? 'Photo had no location · tap to change' : 'Tap to change photo'}</span>` : `${I.camera}<span style="font-size:15px;font-weight:600">Add a photo</span><span class="sub" style="font-size:13px">optional</span>`}
        <input id="addphoto" type="file" accept="image/*" aria-label="Add a photo"></label>`}
      <div class="stack8"><div class="label">Where</div><div class="wheremap"><div id="wmap" style="position:absolute;inset:0"></div><div class="cap">${capText}</div></div></div>
      <div class="stack8"><div class="label">Which cat? (nearest first)</div>
        <div class="chips">${shown.map(chip).join('')}
          ${more > 0 ? `<button class="chip new" id="morechips"><div class="face">…</div><b>${more} more</b><small>further away</small></button>` : ''}
          <button class="chip new ${d.catId === 'new' ? 'on' : ''}" data-cat="new"><div class="face">+</div><b>New cat</b></button></div></div>
      <div class="stack8"><div class="label">Who saw it</div><div class="seg">${['beth', 'canada', 'both'].map(p => `<button data-who="${p}" class="${d.seenBy === p ? 'on' : ''}">${PERSON[p]}</button>`).join('')}</div></div>
      ${d.catId ? `<div class="stack8"><label class="label" for="catname">${d.catId === 'new' ? 'Name (leave blank if you don\'t know yet)' : 'Name (change it to rename)'}</label>
        <input id="catname" class="field" type="text" autocomplete="off" value="${esc(d.name)}" placeholder="${d.catId === 'new' ? 'e.g. Mittens' : ''}"></div>` : ''}
      ${d.catId === 'new' ? `<div class="stack8"><div class="label">Looks like (tick all that fit)</div><div class="coats">${COATS.map(c => `<button data-coat="${c}" class="${d.coats.includes(c) ? 'on' : ''}">${c}</button>`).join('')}<button data-long class="tick ${d.longHaired ? 'on' : ''}">${d.longHaired ? '✓ ' : ''}Long-haired</button></div>${d.coats.length || d.longHaired ? `<div class="sub">Saves as: ${esc(L.coatText(d.coats, d.longHaired))}</div>` : ''}</div>` : ''}
      <div class="stack8"><div class="label">This place is</div><div class="seg small"><button data-lives="0" class="${!d.livesHere ? 'on' : ''}">Seen here</button><button data-lives="1" class="${d.livesHere ? 'on' : ''}">🏠 Lives here</button></div></div>
      <div class="pair"><div class="stack8"><div class="label">Where was it</div><div class="seg small"><button data-in="1" class="${d.inside ? 'on' : ''}">Inside</button><button data-in="0" class="${!d.inside ? 'on' : ''}">Outside</button></div></div>
        <div class="stack8"><div class="label">Purrometer: petted?</div><div class="seg small"><button data-pet="1" class="${d.petted ? 'on warm' : ''}">Yes</button><button data-pet="0" class="${!d.petted ? 'on' : ''}">No</button></div></div></div>
      <div class="stack8"><label class="label" for="note">Note</label><textarea id="note" class="field" placeholder="optional, e.g. under the yellow van">${esc(d.note)}</textarea></div>
    </div></div>
    <div class="savebar"><button class="primary" id="save" ${d.catId ? '' : 'disabled'}>${esc(saveLabel)}</button>
      ${d.photo || d.photoId ? `<button class="second" id="saveanother" ${d.catId ? '' : 'disabled'}>📸 Save, then + Another cat in this photo</button>` : ''}<div class="note" id="savenote">Saves to both phones · ${esc(summary)}</div><div class="err" id="saveerr" hidden></div></div>`;

  document.getElementById('back').onclick = () => { S.draft = null; S.showAllChips = false; history.length > 1 ? history.back() : go('catflap'); };
  const wEl = document.getElementById('wmap');
  guardMap(wEl, 'repurrt map', () => {
    const m = makeMap(wEl, { attributionControl: false });
    const at = pinAt || { lat: 54.5, lng: -3 };
    m.setView([at.lat, at.lng], pinAt ? 17 : 5);
    const mk = window.L.marker([at.lat, at.lng], { draggable: true, icon: divIcon('<div class="dragpin"></div>') }).addTo(m);
    mk.on('dragend', () => { const p = mk.getLatLng(); d.lat = p.lat; d.lng = p.lng; d.source = 'manual'; render(); });
    m.on('click', ev => { d.lat = ev.latlng.lat; d.lng = ev.latlng.lng; d.source = 'manual'; render(); });
  });

  const keep = () => { const n = document.getElementById('catname'); if (n) d.name = n.value; const t = document.getElementById('note'); if (t) d.note = t.value; };
  for (const b of $app.querySelectorAll('[data-cat]')) b.onclick = () => { keep(); d.catId = b.dataset.cat; d.name = d.catId === 'new' ? '' : (S.byId.get(d.catId)?.cat.name || ''); render(); };
  const mc = document.getElementById('morechips'); if (mc) mc.onclick = () => { keep(); S.showAllChips = true; render(); };
  for (const b of $app.querySelectorAll('[data-who]')) b.onclick = () => { keep(); d.seenBy = b.dataset.who; render(); };
  for (const b of $app.querySelectorAll('[data-in]')) b.onclick = () => { keep(); d.inside = b.dataset.in === '1'; render(); };
  for (const b of $app.querySelectorAll('[data-pet]')) b.onclick = () => { keep(); d.petted = b.dataset.pet === '1'; render(); };
  for (const b of $app.querySelectorAll('[data-coat]')) b.onclick = () => { keep(); const k = b.dataset.coat; d.coats = d.coats.includes(k) ? d.coats.filter(x => x !== k) : [...d.coats, k]; render(); };
  for (const b of $app.querySelectorAll('[data-long]')) b.onclick = () => { keep(); d.longHaired = !d.longHaired; render(); };
  for (const b of $app.querySelectorAll('[data-lives]')) b.onclick = () => { keep(); d.livesHere = b.dataset.lives === '1'; render(); };
  const nm = document.getElementById('catname'); if (nm) nm.oninput = () => { d.name = nm.value; const s = document.getElementById('save'); if (d.catId === 'new') s.textContent = d.name.trim() ? `Save new cat: ${d.name.trim()}` : `Save new cat (Cat ${S.nextNum})`; };
  const ap = document.getElementById('addphoto'); if (ap) ap.onchange = async e => {
    const f = e.target.files && e.target.files[0]; if (!f) return; keep();
    try { const nd = await draftFromFile(f); d.photo = nd.photo; d.noGpsInPhoto = nd.noGpsInPhoto; if (nd.source === 'exif') { d.lat = nd.lat; d.lng = nd.lng; d.source = 'exif'; d.at = nd.at; } render(); }
    catch (x) { const er = document.getElementById('saveerr'); er.textContent = x.message; er.hidden = false; }
  };
  // another=true saves, then reopens Repurrt on the SAME photo, time and place, so only the next cat is picked.
  const doSave = async another => {
    keep();
    const er = document.getElementById('saveerr'); er.hidden = true;
    if (!L.cleanPlace(d.lat, d.lng)) { er.textContent = 'Drag the pin to where you saw it, then save.'; er.hidden = false; return; }
    const btn = document.getElementById(another ? 'saveanother' : 'save'); btn.disabled = true; btn.textContent = 'Saving…';
    try {
      S.toast = `Saved to both phones · ${summary}`;
      const catId = await saveDraft(d); S.showAllChips = false;
      if (another) {
        const done = (d.doneCats || []).concat(catId);
        S.draft = newDraft({ photoId: d.savedPhotoId, lat: d.lat, lng: d.lng, source: d.source, at: d.at, seenBy: d.seenBy, inside: d.inside, excludeCat: catId, doneCats: done });
        const savedName = S.byId.get(catId) ? L.displayName(S.byId.get(catId).cat) : (d.name.trim() || 'the new cat');
        S.toast = `Saved ${savedName} · now pick the next cat in the same photo`;
        render();
      } else { S.draft = null; go('cat/' + catId); }
    }
    catch (x) { console.error(x); S.toast = null; btn.disabled = false; btn.textContent = another ? '📸 Save, then + Another cat in this photo' : saveLabel; er.textContent = 'Not saved: ' + (x.code || x.message || x) + '. Check signal and try again.'; er.hidden = false; }
  };
  document.getElementById('save').onclick = () => doSave(false);
  const sa = document.getElementById('saveanother'); if (sa) sa.onclick = () => doSave(true);
}

async function saveDraft(d) {
  const now = Date.now();
  const before = counts();
  let catId = d.catId, newCat = false;
  const name = d.name.trim();
  if (catId === 'new') {
    catId = newId(); newCat = true;
    await S.store.put('cats', catId, newCatDoc(catId, name, d.coats, d.longHaired));
  } else {
    const cat = S.byId.get(catId)?.cat;
    if (cat && name && name !== (cat.name || '')) await S.store.patch('cats', catId, { name });
  }
  // A shared photo (another cat in the same photo) is pointed at, never stored twice.
  let photoId = d.photoId || null;
  if (!photoId && d.photo) {
    photoId = newId();
    await S.store.put('photos', photoId, { data: d.photo.data, w: d.photo.w, h: d.photo.h, catId, at: d.at, createdAt: now });
  }
  if (photoId && (d.photo || !photoOk(S.byId.get(catId)?.cat.thumbPhotoId))) await S.store.patch('cats', catId, { thumbPhotoId: photoId });
  const place = L.cleanPlace(d.lat, d.lng);
  if (!place) throw new Error('no location to save');
  await S.store.put('sightings', newId(), { catId, at: d.at, lat: place.lat, lng: place.lng, locationSource: d.source === 'none' ? 'manual' : d.source, seenBy: d.seenBy, insideOutside: d.inside ? 'inside' : 'outside', petted: !!d.petted, livesHere: !!d.livesHere, note: d.note.trim(), photoId, createdAt: now, createdBy: S.me || d.seenBy });
  d.savedPhotoId = photoId;
  if (d.livesHere) fillHome(catId, place);
  celebrate(before, { cats: newCat ? 1 : 0, sightings: 1 });
  return catId;
}

// ---------- MEOWMERIES (Job 6): old photos, each a sighting at its own time and place ----------
// Every photo DEFAULTS to its own new numbered cat (Beth, 2026-10-03: "the default should be give it a fresh number
// unless i specify otherwise"), so 100 photos need no taps. Pick an existing cat to override; "+ another cat" puts
// a second cat in the same photo (both sightings share one stored photo). A photo already logged is skipped.
async function readOldPhoto(file) {
  let gps = null, at = null;
  try { if (window.exifr) { gps = await window.exifr.gps(file); const t = await window.exifr.parse(file, ['DateTimeOriginal', 'CreateDate']); const d = t && (t.DateTimeOriginal || t.CreateDate); if (d instanceof Date && !isNaN(d)) at = d.getTime(); } } catch (e) { console.warn('exif', e); }
  let img;
  try { img = await loadImage(file); }
  catch (x) {
    // HEIC will not decode in Chrome; most phones embed a small JPEG preview, which is enough for a thumbnail.
    const th = window.exifr && await window.exifr.thumbnail(file).catch(() => null);
    if (!th) throw x;
    img = await loadImage(new Blob([th], { type: 'image/jpeg' }));
  }
  const photo = await makeThumb(img, img.naturalWidth, img.naturalHeight);
  const place = gps ? L.cleanPlace(gps.latitude, gps.longitude) : null;
  // blanked: the GPS tag is there but its numbers were removed (Android's Photos picker does this).
  const gpsState = place ? 'kept' : gps && ('latitude' in gps || 'longitude' in gps) ? 'blanked' : 'none';
  const when = at || file.lastModified || Date.now();
  return { key: [file.name, file.size, when].join('|'), name: file.name, photo, at: when, atSource: at ? 'exif' : 'file', lat: place ? place.lat : undefined, lng: place ? place.lng : undefined, source: place ? 'exif' : null, gpsState, cats: [], include: true };
}

function Meowmeries() {
  if (!S.mem) S.mem = { items: [], who: S.me || 'beth', newCats: {}, placing: null, busy: null, nextNew: 1 };
  const M = S.mem, now = Date.now();
  const logged = new Set(S.data.sightings.map(s => s.sourceKey).filter(Boolean));
  for (const it of M.items) it.dup = logged.has(it.key);
  const live = M.items.filter(it => it.include && !it.dup);
  const ready = live.filter(it => it.cats.length && it.cats.every(Boolean) && L.cleanPlace(it.lat, it.lng));
  const waiting = live.length - ready.length;
  // New cats in this batch get their numbers in photo order, continuing from the house's highest number.
  const order = []; for (const it of live) for (const c of it.cats) if (c && c.startsWith('new:') && !order.includes(c)) order.push(c);
  const numFor = id => S.nextNum + order.indexOf(id);
  const newLabel = id => M.newCats[id].name.trim() || 'Cat ' + numFor(id);
  const newMade = () => { const id = 'new:' + M.nextNew++; M.newCats[id] = { name: '' }; return id; };
  const options = (it, val) => {
    const place = L.cleanPlace(it.lat, it.lng);
    const near = place ? L.nearest(S.sums, place) : [];
    const rest = S.sums.filter(e => !near.some(x => x.cat.id === e.cat.id)).sort((a, b) => (b.last || 0) - (a.last || 0));
    return `${!val ? '<option value="">Which cat?</option>' : ''}
      ${Object.keys(M.newCats).filter(id => order.includes(id) || id === val).map(id => `<option value="${id}" ${val === id ? 'selected' : ''}>New: ${esc(newLabel(id))}</option>`).join('')}
      <option value="+new">+ A different new cat</option>
      ${[...near, ...rest].map(e => `<option value="${esc(e.cat.id)}" ${val === e.cat.id ? 'selected' : ''}>${esc(L.displayName(e.cat))}${e.distance !== undefined ? ' · ' + L.distWord(e.distance) : ''}</option>`).join('')}`;
  };
  const card = (it, i) => {
    const placed = !!L.cleanPlace(it.lat, it.lng);
    const status = it.dup ? 'Already logged, skipped' : !it.include ? 'Skipped' : placed ? (it.source === 'exif' ? '📍 Placed from the photo' : 'Placed by hand') : it.gpsState === 'blanked' ? 'Location removed by the picker: place it' : 'No location in this photo';
    const newInputs = it.cats.filter(c => c && c.startsWith('new:'));
    return `<div class="memcard ${!it.include || it.dup ? 'off' : ''}">
      <div class="memtop"><div class="memthumb" style="background-image:url('${it.photo.data}')"></div>
        <div class="memtxt"><b>${esc(L.longStamp(it.at))}</b><small>${it.atSource === 'exif' ? 'time from the photo' : 'no time in the photo: file date used'}</small>
          <small class="${placed || it.dup || !it.include ? '' : 'warnline'}">${status}</small></div></div>
      ${it.dup ? '' : it.include ? `
        ${it.cats.map((v, k) => `<div class="memrow"><select class="field memsel" data-i="${i}" data-k="${k}" aria-label="Cat ${k + 1} in photo ${i + 1}">${options(it, v)}</select>
          ${k === 0 ? `<button class="ghost" data-place="${i}">${placed ? 'Move pin' : 'Place it'}</button>` : `<button class="ghost" data-dropcat="${i}:${k}" aria-label="Remove this cat">✕</button>`}</div>`).join('')}
        ${newInputs.map(id => `<input class="field" data-newname="${esc(id)}" value="${esc(M.newCats[id].name)}" placeholder="Name ${esc('Cat ' + numFor(id))} (optional)" aria-label="Name for ${esc('Cat ' + numFor(id))}">`).join('')}
        ${M.placing === i ? `<div class="wheremap"><div id="pmap" style="position:absolute;inset:0"></div><div class="cap">Tap or drag to where it was</div></div><button class="ghost" data-placedone="${i}">Done</button>` : ''}
        <button class="second" data-addcat="${i}">📸 + Another cat in this photo</button>
        <div class="memfoot"><button class="linkbtn" data-skip="${i}">Skip this photo</button></div>` : `<button class="linkbtn" data-skip="${i}">Include it again</button>`}
    </div>`;
  };
  const newCount = order.length;
  $app.innerHTML = `${banner()}<div class="screen">
    <div class="formhead"><button class="back" id="back">${I.back}Back</button><div style="font-size:18px;font-weight:700">MEOWMERIES</div><div style="width:50px"></div></div>
    <div class="pad stack" style="gap:12px;padding-bottom:16px">
      <div class="picks2">
        <label class="addphoto">${I.gallery}<span class="pk"><b>Pick from Files (keeps location)</b><small>open DCIM, then Camera · jpg and heic</small></span>
          <input id="memfiles" type="file" multiple aria-label="Pick from Files"></label>
        <label class="addphoto">${I.gallery}<span class="pk"><b>${M.items.length ? 'Add more from Photos' : 'Pick from Photos'}</b><small>Android removes the location here</small></span>
          <input id="mempick" type="file" accept="image/*" multiple aria-label="Pick from Photos"></label>
      </div>
      ${M.busy ? `<div class="note">${esc(M.busy)}</div>` : ''}
      ${M.items.length ? `<div class="stack8"><div class="label">Who saw these</div><div class="seg">${['beth', 'canada', 'both'].map(p => `<button data-mwho="${p}" class="${M.who === p ? 'on' : ''}">${PERSON[p]}</button>`).join('')}</div></div>
        <div class="sub">Each photo starts as its own new numbered cat. Change any that are a cat you already know; merge duplicates later from a cat's page.</div>`
        : `<div class="empty">Each photo becomes a sighting at the time and place it was taken.<br>Photos with no location get a pin you place by hand.</div>`}
      ${M.items.map(card).join('')}
    </div></div>
    ${M.items.length ? `<div class="savebar"><button class="primary" id="memsave" ${ready.length && !waiting && !M.busy ? '' : 'disabled'}>${ready.length ? `Log ${ready.length} photo${ready.length === 1 ? '' : 's'}` : 'Nothing ready to log'}</button>
      <div class="note">${waiting ? `${waiting} photo${waiting === 1 ? '' : 's'} still need${waiting === 1 ? 's' : ''} a place or a cat, or skip ${waiting === 1 ? 'it' : 'them'}` : `Saves to both phones${newCount ? ` · ${newCount} new cat${newCount === 1 ? '' : 's'}` : ''}`}</div></div>` : ''}`;

  document.getElementById('back').onclick = () => { if (!M.busy) S.mem = null; go('catflap'); };
  // Files gives back anything, so it is narrowed to photos here, after picking.
  const isPhoto = f => /^image\/(jpe?g|heic|heif)$/i.test(f.type) || /\.(jpe?g|heic|heif)$/i.test(f.name);
  const take = async (e, narrow) => {
    const picked = [...(e.target.files || [])]; e.target.value = '';
    const files = narrow ? picked.filter(isPhoto) : picked;
    const notPhotos = picked.length - files.length;
    if (!files.length) { M.busy = notPhotos ? `None of those were jpg or heic photos (${notPhotos} other file${notPhotos === 1 ? '' : 's'} left out).` : null; render(); M.busy = null; return; }
    let k = 0, failed = 0;
    for (const f of files) {
      M.busy = `Reading ${++k} of ${files.length}…`; render();
      try { const it = await readOldPhoto(f); if (!M.items.some(x => x.key === it.key)) { it.cats = [newMade()]; M.items.push(it); } } catch { failed++; }
    }
    M.items.sort((a, b) => a.at - b.at);
    const kept = M.items.filter(it => files.some(f => it.name === f.name) && it.gpsState === 'kept').length;
    const notes = [];
    if (failed) notes.push(`${failed} photo${failed === 1 ? '' : 's'} could not be opened here and ${failed === 1 ? 'was' : 'were'} left out`);
    if (notPhotos) notes.push(`${notPhotos} file${notPhotos === 1 ? ' that was' : 's that were'} not a jpg or heic left out`);
    notes.push(`${kept} of ${files.length - failed} came with their location`);
    M.busy = notes.join(' · ') + '.';
    render(); M.busy = null;
  };
  document.getElementById('memfiles').onchange = e => take(e, true);
  document.getElementById('mempick').onchange = e => take(e, false);
  for (const b of $app.querySelectorAll('[data-mwho]')) b.onclick = () => { M.who = b.dataset.mwho; render(); };
  for (const s of $app.querySelectorAll('.memsel')) s.onchange = () => {
    const it = M.items[+s.dataset.i], k = +s.dataset.k;
    it.cats[k] = s.value === '+new' ? newMade() : s.value;
    render();
  };
  for (const n of $app.querySelectorAll('[data-newname]')) n.onchange = () => { M.newCats[n.dataset.newname].name = n.value; render(); };
  for (const b of $app.querySelectorAll('[data-addcat]')) b.onclick = () => { M.items[+b.dataset.addcat].cats.push(''); render(); };
  for (const b of $app.querySelectorAll('[data-dropcat]')) b.onclick = () => { const [i, k] = b.dataset.dropcat.split(':').map(Number); M.items[i].cats.splice(k, 1); render(); };
  for (const b of $app.querySelectorAll('[data-skip]')) b.onclick = () => { const it = M.items[+b.dataset.skip]; it.include = !it.include; if (M.placing === +b.dataset.skip) M.placing = null; render(); };
  for (const b of $app.querySelectorAll('[data-place]')) b.onclick = () => { M.placing = +b.dataset.place; render(); };
  for (const b of $app.querySelectorAll('[data-placedone]')) b.onclick = () => { M.placing = null; render(); };
  if (M.placing !== null && document.getElementById('pmap')) {
    const it = M.items[M.placing];
    const start = L.cleanPlace(it.lat, it.lng) || S.pos || lastKnownPlace();
    const pEl = document.getElementById('pmap');
    guardMap(pEl, 'meowmeries map', () => {
      const m = makeMap(pEl, { attributionControl: false });
      m.setView(start ? [start.lat, start.lng] : [54.5, -3], start ? 17 : 5);
      const mk = window.L.marker(start ? [start.lat, start.lng] : [54.5, -3], { draggable: true, icon: divIcon('<div class="dragpin"></div>') }).addTo(m);
      const set = ll => { it.lat = ll.lat; it.lng = ll.lng; it.source = 'manual'; mk.setLatLng(ll); };
      mk.on('dragend', () => set(mk.getLatLng()));
      m.on('click', ev => set(ev.latlng));
      if (!start) getPos().then(p => { if (p && M.placing !== null) m.setView([p.lat, p.lng], 17); });
    });
  }
  const sv = document.getElementById('memsave');
  if (sv) sv.onclick = async () => {
    sv.disabled = true;
    const before = counts();
    const made = {}; let n = 0, sightings = 0;
    try {
      for (const it of ready) {
        sv.textContent = `Saving ${++n} of ${ready.length}…`;
        const photoId = newId();
        let photoSaved = false;
        for (const raw of [...new Set(it.cats)]) {
          let catId = raw;
          if (raw.startsWith('new:')) {
            if (!made[raw]) { made[raw] = newId(); const doc = newCatDoc(made[raw], M.newCats[raw].name, [], false); await S.store.put('cats', made[raw], doc); }
            catId = made[raw];
          }
          if (!photoSaved) { await S.store.put('photos', photoId, { data: it.photo.data, w: it.photo.w, h: it.photo.h, catId, at: it.at, createdAt: Date.now() }); photoSaved = true; }
          const cat = S.byId.get(catId);
          if (!cat || !photoOk(cat.cat.thumbPhotoId) || (cat.last !== null && it.at >= cat.last)) await S.store.patch('cats', catId, { thumbPhotoId: photoId });
          const place = L.cleanPlace(it.lat, it.lng);
          await S.store.put('sightings', newId(), { catId, at: it.at, lat: place.lat, lng: place.lng, locationSource: it.source, seenBy: M.who, insideOutside: 'outside', petted: false, note: '', photoId, sourceKey: it.key, createdAt: Date.now(), createdBy: S.me || M.who });
          sightings++;
        }
        it.include = false; it.saved = true;
      }
      S.mem = null;
      S.toast = `Logged ${ready.length} old photo${ready.length === 1 ? '' : 's'} · ${sightings} sighting${sightings === 1 ? '' : 's'} · saved to both phones`;
      celebrate(before, { cats: Object.keys(made).length, sightings });
      go('catalogue');
    } catch (x) {
      console.error(x);
      M.items = M.items.filter(it => !it.saved);
      M.busy = `Stopped after ${n - 1} of ${ready.length}: ${x.code || x.message || x}. The saved ones are off this list; check signal and log the rest.`;
      render(); M.busy = null;
    }
  };
}

// ---------- 5. THE CATALOGUE (two-column grid, Beth's ask 2026-10-03 22:08) ----------
function Catalogue() {
  const now = Date.now();
  const f = S.filter;
  let list = S.sums.slice();
  if (f === 'fav') list = list.filter(e => e.cat.favourite);
  if (f === 'pet') list = list.filter(e => e.petted > 0);
  if (f === 'unnamed') list = list.filter(e => L.isUnnamed(e.cat));
  list.sort((a, b) => (b.last || b.cat.createdAt || 0) - (a.last || a.cat.createdAt || 0));
  const card = e => {
    const c = e.cat, unnamed = L.isUnnamed(c);
    const meta = `${e.count} sighting${e.count === 1 ? '' : 's'}${e.last ? ' · ' + (unnamed ? 'seen ' : 'last seen ') + L.dayWord(e.last, now) : ''}`;
    return `<a class="gcard" href="#/cat/${esc(c.id)}"><div class="gimg" style="background-color:${swatch(c)}"${photoAttr(c)}>
      <span class="ini">${esc(L.initial(c))}</span>${unnamed ? '<span class="newtag">NEW</span>' : ''}<span class="gheart">${I.heart(c.favourite)}</span></div>
      <div class="gname ${unnamed ? 'grey' : ''}">${esc(L.displayName(c))}</div><div class="gmeta">${esc(meta)}</div></a>`;
  };
  const binned = S.raw ? S.raw.cats.filter(c => c.deleted || c.mergedInto).length + S.raw.sightings.filter(s => s.deleted || s.photoDeleted).length : 0;
  const F = [['all', 'All'], ['fav', I.heart(true).replace('width="22" height="22"', 'width="14" height="14"') + 'Favourites'], ['pet', 'Petted'], ['unnamed', 'Unnamed']];
  $app.innerHTML = `${banner()}<div class="screen">
    <div class="head" style="flex-direction:column;align-items:stretch"><div style="display:flex;justify-content:space-between;align-items:flex-end"><div class="title">CATALOGUE</div><div class="sub">${S.sums.length} cat${S.sums.length === 1 ? '' : 's'}</div></div>
      <div class="filters">${F.map(([k, t]) => `<button data-f="${k}" class="${f === k ? 'on' : ''}">${t}</button>`).join('')}</div></div>
    <div class="pad">${list.length ? `<div class="grid">${list.map(card).join('')}</div>` : `<div class="empty">${S.sums.length ? 'No cats in this list yet.' : 'No cats yet.<br>Tap Pawparazzi on the Catflap to log the first one.'}</div>`}
      <a class="binlink" href="#/deleted">🗑️ Recently deleted${binned ? ` (${binned})` : ''}</a></div>
  </div>${nav('catalogue')}`;
  for (const b of $app.querySelectorAll('[data-f]')) b.onclick = () => { S.filter = b.dataset.f; render(); };
}

// ---------- 6. CATALOGUE ENTRY ----------
// Each sighting row opens its actions: another cat in this photo, wrong cat, delete the sighting, delete its photo.
// At the foot: Concatenate (this is the same cat as another) and delete this cat. Every delete is soft and restorable.
function CatEntry(id) {
  const e = S.byId.get(id);
  if (!e) { $app.innerHTML = `${banner()}<div class="screen"><div class="setup"><div class="title">Cat not found</div><p>It may still be loading, or it was deleted or merged. Recently deleted has it if so.</p><a class="primary" style="display:flex;align-items:center;justify-content:center" href="#/catalogue">Back to the Catalogue</a></div></div>${nav('catalogue')}`; return; }
  const c = e.cat, now = Date.now();
  const days = e.first !== null ? Math.max(0, Math.floor((L.startOfDay(now) - L.startOfDay(e.first)) / L.DAY)) : 0;
  const terr = L.territory(e);
  const home = L.homeOf(e);
  const desc = [L.coatText(L.coatsOf(c), L.isLongHaired(c)) || c.coat, c.markings, c.collar ? (c.collarColour ? c.collarColour + ' collar' : 'collar') : '', c.friendliness, home ? '' : c.homeNote].filter(Boolean).join(' · ');
  const nameBlock = S.renaming === id
    ? `<form class="rename" id="rn"><input id="rnin" class="field" value="${esc(c.name || '')}" placeholder="Name this cat" aria-label="New name"><button type="submit">Save</button></form>`
    : `<div class="nameline"><div class="nm">${esc(L.displayName(c))}</div><button class="pencil" id="pencil" aria-label="Rename this cat">${I.pencil}</button></div>
       <div class="desc">${esc(desc || (c.name ? 'tap the pencil to rename' : 'tap the pencil to name'))}</div>
       <button class="editbtn" id="editdetails">Edit details</button>`;
  const COATS = L.COAT_LIST;
  const FRIENDLY = ['runs off', 'watches', 'comes over', 'lap cat'];
  const ed = S.editing === id ? (S.editDraft || (S.editDraft = { coats: [...L.coatsOf(c)], longHaired: L.isLongHaired(c), markings: c.markings || '', collar: !!c.collar, collarColour: c.collarColour || '', friendliness: c.friendliness || '', homeNote: c.homeNote || '', notes: c.notes || '' })) : null;
  const editForm = ed ? `<div class="pad stack" style="gap:12px;padding-top:16px"><div class="label">Edit details</div>
      <div class="stack8"><div class="label">Coat (tick all that fit)</div><div class="coats">${COATS.map(k => `<button data-ecoat="${k}" class="${ed.coats.includes(k) ? 'on' : ''}">${k}</button>`).join('')}<button data-elong class="tick ${ed.longHaired ? 'on' : ''}">${ed.longHaired ? '✓ ' : ''}Long-haired</button></div>${ed.coats.length || ed.longHaired ? `<div class="sub">Saves as: ${esc(L.coatText(ed.coats, ed.longHaired))}</div>` : ''}</div>
      <div class="stack8"><label class="label" for="emark">Markings</label><input id="emark" class="field" value="${esc(ed.markings)}" placeholder="e.g. white bib, one white sock"></div>
      <div class="stack8"><div class="label">Collar</div><div class="seg small"><button data-ecollar="0" class="${!ed.collar ? 'on' : ''}">None</button><button data-ecollar="1" class="${ed.collar ? 'on' : ''}">Yes</button></div>
        ${ed.collar ? `<input id="ecolour" class="field" value="${esc(ed.collarColour)}" placeholder="Colour, e.g. red with a bell">` : ''}</div>
      <div class="stack8"><div class="label">Friendliness</div><div class="seg small wrap4">${FRIENDLY.map(k => `<button data-efriend="${k}" class="${ed.friendliness === k ? 'on' : ''}">${k}</button>`).join('')}</div></div>
      <div class="stack8"><label class="label" for="ehome">Home</label>${home ? `<div class="sub">🏠 Home pin set from the ${esc(L.longStamp(home.at))} sighting</div>` : ''}<input id="ehome" class="field" value="${esc(ed.homeNote)}" placeholder="e.g. number 27, goes in the catflap"></div>
      <div class="stack8"><label class="label" for="enotes">Notes</label><textarea id="enotes" class="field" placeholder="anything else">${esc(ed.notes)}</textarea></div>
      <button class="primary" id="esave">Save details</button><button class="ghost" id="ecancel">Cancel</button></div>` : '';
  const others = S.sums.filter(x => x.cat.id !== id).sort((a, b) => (b.last || 0) - (a.last || 0));
  const pickList = (attr) => `<div class="picklist">${others.map(x => `<button data-${attr}="${esc(x.cat.id)}"><span class="dot" style="background:${swatch(x.cat)}"${photoAttr(x.cat)}></span>${esc(L.displayName(x.cat))}<small>${x.count} sighting${x.count === 1 ? '' : 's'}</small></button>`).join('')}${attr === 'moveto' ? `<button data-moveto="new"><span class="dot newdot">+</span>New cat (Cat ${S.nextNum})</button>` : ''}</div>`;
  const row = s => {
    const open = S.rowOpen === s.id;
    const hasPhoto = photoOk(s.photoId);
    return `<div class="srow2"><button class="srowbtn" data-row="${esc(s.id)}" aria-expanded="${open}">
        ${hasPhoto ? `<span class="sthumb" data-photo="${esc(s.photoId)}"></span>` : ''}
        <span style="display:flex;flex-direction:column;gap:2px;min-width:0;flex:1;text-align:left"><span class="t">${esc(L.dayWord(s.at, now).replace(/^./, x => x.toUpperCase()))}, ${L.hhmm(s.at)}</span>
        <span class="d">${L.hasPin(s) ? '' : '📍 no place yet · '}${esc(s.note || 'no note')}${s.petted ? ' · petted' : ''}${s.insideOutside === 'inside' ? ' · inside' : ''}${s.livesHere ? ' · 🏠 lives here' : ''}${s.mergedFrom ? ' · merged in' : ''}</span></span>
        <span class="tag ${esc(s.seenBy)}">${esc(PERSON[s.seenBy] || s.seenBy)}</span><span class="more" aria-hidden="true">⋯</span></button>
      ${open ? (S.moving === s.id ? `<div class="acts"><div class="label">Move this sighting to</div>${pickList('moveto')}<button class="ghost" data-cancel>Cancel</button></div>`
        : S.placingSight === s.id ? `<div class="acts"><div class="wheremap"><div id="smap" style="position:absolute;inset:0"></div><div class="cap">Tap or drag to where it was</div></div><button class="primary" id="saveplace">Save this place</button><button class="ghost" data-cancel>Cancel</button></div>`
        : `<div class="acts">
          ${!L.hasPin(s) ? `<button class="ghost" data-placesight="${esc(s.id)}">📍 Place it on the map</button>` : ''}
          ${hasPhoto ? `<button class="ghost" data-another="${esc(s.id)}">+ Another cat in this photo</button>` : ''}
          <button class="ghost" data-lives="${esc(s.id)}">${s.livesHere ? '🏠 Not its home: mark as Seen here' : '🏠 Lives here: set as its home'}</button>
          <button class="ghost" data-wrong="${esc(s.id)}">Wrong cat: move it</button>
          <button class="ghost danger" data-delsight="${esc(s.id)}">Delete this sighting</button>
          ${hasPhoto ? `<button class="ghost danger" data-delphoto="${esc(s.id)}">Delete just the photo</button>` : ''}</div>`) : ''}</div>`;
  };
  const foot = S.merging === id
    ? `<div class="acts"><div class="label">Which cat is really ${esc(L.displayName(c))}? Its sightings move here.</div>${others.length ? pickList('mergein') : '<div class="sub">No other cats to merge.</div>'}<button class="ghost" data-cancel>Cancel</button></div>`
    : S.confirmDel === id
      ? `<div class="acts"><div class="label">Delete ${esc(L.displayName(c))} and ${e.count === 1 ? 'its sighting' : 'its ' + e.count + ' sightings'}?</div><div class="sub">It goes to Recently deleted in The Catalogue, where Restore brings it all back.</div><button class="ghost danger" id="delcatyes">Yes, delete ${esc(L.displayName(c))}</button><button class="ghost" data-cancel>Keep it</button></div>`
      : `<div class="footacts"><button class="ghost" id="merge">🐱 Same cat as another? Merge</button><button class="ghost danger" id="delcat">Delete this cat</button></div>`;
  $app.innerHTML = `${banner()}<div class="screen">
    <div class="hero" style="background-color:${swatch(c)}"${photoAttr(c)}>
      <a class="round lt" style="left:20px" href="#/catalogue" aria-label="Back to Catalogue">${I.back}</a>
      <button class="round lt" style="right:20px" id="fav" aria-label="${c.favourite ? 'Remove from favourites' : 'Add to favourites'}">${I.heart(c.favourite).replace('#B8BCC4', '#17181C')}</button>
      ${nameBlock}</div>
    ${editForm}${!ed && home ? `<div class="pad"><div class="homeline">🏠 Home: ${esc(c.homeNote || 'pinned on the map')}</div></div>` : ''}${!ed && c.notes ? `<div class="pad"><div class="aboutnote">${esc(c.notes)}</div></div>` : ''}
    <div class="tiles3"><div class="stat"><b>${e.count}</b><small>sighting${e.count === 1 ? '' : 's'}</small></div><div class="stat"><b>${days}d</b><small>since first</small></div><div class="stat"><b>${e.petted}</b><small>Purrometer</small></div></div>
    <div class="pad stack8" style="padding-top:16px"><div class="label">Territory</div>
      <div class="terr"><div id="tmap" style="position:absolute;inset:0"></div><div class="cap">${terr.pins ? `${terr.pins} pin${terr.pins === 1 ? '' : 's'}${terr.pins > 1 ? `, all within ${L.distWord(terr.radius)}` : ''}` : 'No pins yet'}</div></div></div>
    <div class="pad stack8" style="padding-top:16px"><div class="label">Sightings · tap ⋯ for options</div><div>
      ${e.sightings.map(row).join('') || '<div class="empty">No sightings yet.</div>'}</div></div>
    <div class="pad" style="padding-top:12px;padding-bottom:20px">${foot}</div></div>${nav('catalogue')}`;

  // Buttons are wired FIRST, so nothing the territory map does can leave them dead (live bug 2026-10-03).
  document.getElementById('fav').onclick = () => saveCat(id, { favourite: !c.favourite }, c.favourite ? 'Removed from favourites' : 'Added to favourites');
  const p = document.getElementById('pencil'); if (p) p.onclick = () => { S.renaming = id; render(); const i = document.getElementById('rnin'); i.focus(); i.select(); };
  const eb = document.getElementById('editdetails'); if (eb) eb.onclick = () => { S.editing = id; S.editDraft = null; render(); };
  if (ed) {
    const keepEd = () => { for (const [f, k] of [['emark', 'markings'], ['ecolour', 'collarColour'], ['ehome', 'homeNote'], ['enotes', 'notes']]) { const el = document.getElementById(f); if (el) ed[k] = el.value; } };
    for (const b of $app.querySelectorAll('[data-ecoat]')) b.onclick = () => { keepEd(); const k = b.dataset.ecoat; ed.coats = ed.coats.includes(k) ? ed.coats.filter(x => x !== k) : [...ed.coats, k]; render(); };
    for (const b of $app.querySelectorAll('[data-elong]')) b.onclick = () => { keepEd(); ed.longHaired = !ed.longHaired; render(); };
    for (const b of $app.querySelectorAll('[data-ecollar]')) b.onclick = () => { keepEd(); ed.collar = b.dataset.ecollar === '1'; render(); };
    for (const b of $app.querySelectorAll('[data-efriend]')) b.onclick = () => { keepEd(); ed.friendliness = ed.friendliness === b.dataset.efriend ? '' : b.dataset.efriend; render(); };
    document.getElementById('ecancel').onclick = () => { S.editing = null; S.editDraft = null; render(); };
    document.getElementById('esave').onclick = () => { keepEd(); const d = S.editDraft; S.editing = null; S.editDraft = null;
      saveCat(id, { coats: d.coats, longHaired: d.longHaired, coat: L.coatText(d.coats, d.longHaired), swatch: L.swatchFromCoats(d.coats, id, d.longHaired), markings: d.markings.trim(), collar: d.collar, collarColour: d.collar ? d.collarColour.trim() : '', friendliness: d.friendliness, homeNote: d.homeNote.trim(), notes: d.notes.trim() }, 'Details saved'); };
  }
  const rn = document.getElementById('rn');
  if (rn) rn.onsubmit = ev => { ev.preventDefault(); const v = document.getElementById('rnin').value.trim(); S.renaming = null; if (v !== (c.name || '')) saveCat(id, { name: v }, v ? `Renamed to ${v}` : `Name cleared, back to Cat ${c.num || ''}`.trim()); else render(); };
  const sOf = sid => e.sightings.find(x => x.id === sid);
  for (const b of $app.querySelectorAll('[data-row]')) b.onclick = () => { S.rowOpen = S.rowOpen === b.dataset.row ? null : b.dataset.row; S.moving = null; S.placingSight = null; render(); };
  for (const b of $app.querySelectorAll('[data-cancel]')) b.onclick = () => { S.moving = null; S.merging = null; S.confirmDel = null; S.rowOpen = null; S.placingSight = null; render(); };
  for (const b of $app.querySelectorAll('[data-another]')) b.onclick = () => {
    const s = sOf(b.dataset.another);
    S.draft = newDraft({ photoId: s.photoId, lat: s.lat, lng: s.lng, source: s.locationSource || 'manual', at: s.at, seenBy: s.seenBy, inside: s.insideOutside === 'inside', excludeCat: id });
    S.rowOpen = null; go('repurrt');
  };
  for (const b of $app.querySelectorAll('[data-wrong]')) b.onclick = () => { S.moving = b.dataset.wrong; render(); };
  for (const b of $app.querySelectorAll('[data-lives]')) b.onclick = () => act(async () => {
    const s = sOf(b.dataset.lives), on = !s.livesHere;
    if (on && !L.hasPin(s)) return 'Place it on the map first, then mark it as home';
    await S.store.patch('sightings', s.id, { livesHere: on });
    if (on) fillHome(id, s);
    S.rowOpen = null; return on ? 'Set as home 🏠' : 'Marked as Seen here';
  });
  for (const b of $app.querySelectorAll('[data-placesight]')) b.onclick = () => { S.placingSight = b.dataset.placesight; S.placeAt = null; render(); };
  const smap = document.getElementById('smap');
  if (smap) guardMap(smap, 'place sighting map', () => {
    const start = S.placeAt || (e.sightings.find(L.hasPin)) || S.pos || lastKnownPlace();
    const m = makeMap(smap, { attributionControl: false });
    m.setView(start ? [start.lat, start.lng] : [54.5, -3], start ? 17 : 5);
    const mk = window.L.marker(start ? [start.lat, start.lng] : [54.5, -3], { draggable: true, icon: divIcon('<div class="dragpin"></div>') }).addTo(m);
    const set = ll => { S.placeAt = { lat: ll.lat, lng: ll.lng }; mk.setLatLng(ll); };
    mk.on('dragend', () => set(mk.getLatLng())); m.on('click', ev => set(ev.latlng));
    if (!start) getPos().then(p => { if (p) m.setView([p.lat, p.lng], 17); });
  });
  const sp = document.getElementById('saveplace');
  if (sp) sp.onclick = () => act(async () => {
    const place = S.placeAt && L.cleanPlace(S.placeAt.lat, S.placeAt.lng);
    if (!place) return 'Tap or drag the pin to where it was first';
    await S.store.patch('sightings', S.placingSight, { lat: place.lat, lng: place.lng, locationSource: 'manual', placedAt: Date.now() });
    S.placingSight = null; S.placeAt = null; S.rowOpen = null;
    return 'Placed on the map';
  });
  for (const b of $app.querySelectorAll('[data-moveto]')) b.onclick = () => act(async () => {
    let to = b.dataset.moveto;
    if (to === 'new') { to = newId(); await S.store.put('cats', to, newCatDoc(to, '', [], false)); }
    const s = sOf(S.moving);
    await S.store.patch('sightings', s.id, { catId: to, movedFrom: id, movedAt: Date.now() });
    if (s.photoId && (S.byId.get(to)?.cat.thumbPhotoId == null)) await S.store.patch('cats', to, { thumbPhotoId: s.photoId });
    S.moving = null; S.rowOpen = null;
    return `Moved to ${to === b.dataset.moveto ? L.displayName(S.byId.get(to)?.cat) : 'a new cat'}`;
  });
  for (const b of $app.querySelectorAll('[data-delsight]')) b.onclick = () => act(async () => { await S.store.patch('sightings', b.dataset.delsight, { deleted: true, ...stamp() }); S.rowOpen = null; return 'Sighting deleted · Restore it from Recently deleted'; });
  for (const b of $app.querySelectorAll('[data-delphoto]')) b.onclick = () => act(async () => {
    const s = sOf(b.dataset.delphoto);
    await S.store.patch('sightings', s.id, { photoDeleted: true, photoDeletedAt: Date.now(), photoDeletedBy: S.me || 'unknown' });
    await S.store.patch('photos', s.photoId, { deleted: true, ...stamp() }).catch(() => {});
    S.rowOpen = null; return 'Photo deleted · Restore it from Recently deleted';
  });
  const mg = document.getElementById('merge'); if (mg) mg.onclick = () => { S.merging = id; render(); };
  for (const b of $app.querySelectorAll('[data-mergein]')) b.onclick = () => act(async () => { const msg = await mergeCats(id, b.dataset.mergein); S.merging = null; return msg; });
  const dc = document.getElementById('delcat'); if (dc) dc.onclick = () => { S.confirmDel = id; render(); };
  const dy = document.getElementById('delcatyes'); if (dy) dy.onclick = () => act(async () => { await S.store.patch('cats', id, { deleted: true, ...stamp() }); S.confirmDel = null; go('catalogue'); return `${L.displayName(c)} deleted · Restore it from Recently deleted`; });

  // Territory map: only clean pins, and a failure shows on the map box instead of breaking the page.
  const pts = e.sightings.filter(L.hasPin).map(s => [s.lat, s.lng]);
  const tmap = document.getElementById('tmap');
  if (!pts.length) { tmap.remove(); return; }
  guardMap(tmap, 'territory map', () => {
    const m = makeMap(tmap, { dragging: false, scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false, boxZoom: false, keyboard: false, attributionControl: false });
    if (pts.length > 1) m.fitBounds(pts, { padding: [24, 24], maxZoom: 18 }); else m.setView(pts[0], 17);
    for (const q of pts) window.L.marker(q, { icon: divIcon(`<div class="minipin" style="background:${swatch(c)}"></div>`), interactive: false }).addTo(m);
    if (home) window.L.marker([home.lat, home.lng], { icon: divIcon(`<div class="homepin" style="background:${swatch(c)}">🏠</div>`), interactive: false }).addTo(m);
    if (pts.length > 1 && terr.centre) window.L.circle([terr.centre.lat, terr.centre.lng], { radius: Math.max(terr.radius, 15), stroke: false, fillColor: swatch(c), fillOpacity: 0.18 }).addTo(m);
  });
}

// Lives here: when the cat's Home is still empty, fill it with the street from OpenStreetMap's free address lookup.
// Sends only the home pin's coordinates; any failure leaves Home empty and the cat page says "pinned on the map".
async function fillHome(catId, place) {
  try {
    const c = S.byId.get(catId)?.cat; if (c && c.homeNote) return;
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&lat=${place.lat}&lon=${place.lng}`, { headers: { 'Accept-Language': 'en-GB' } });
    const a = (await r.json()).address || {};
    const t = [a.house_number, a.road].filter(Boolean).join(' ') || a.suburb || '';
    if (t) await S.store.patch('cats', catId, { homeNote: t });
  } catch (x) { console.warn('fillHome', x); }
}

function newCatDoc(id, name, coats, longHaired) {
  const n = name.trim();
  coats = coats || [];
  const doc = { name: n, coats, longHaired: !!longHaired, coat: L.coatText(coats, longHaired), swatch: L.swatchFromCoats(coats, id, longHaired), markings: '', homeNote: '', favourite: false, createdAt: Date.now(), createdBy: S.me || 'unknown', thumbPhotoId: null };
  if (!n) { doc.num = S.nextNum; S.nextNum++; }
  return doc;
}

// Run a change, then say what happened, including a refusal, instead of failing silently.
async function act(fn) {
  try { S.toast = await fn(); }
  catch (x) { console.error('act', x); S.toast = 'Not saved: ' + (x.code || x.message || x) + '. Check signal and try again.'; }
  render();
}
async function saveCat(id, patch, okMsg) { return act(async () => { await S.store.patch('cats', id, patch); return okMsg; }); }

// CONCATENATE (Job 9): fold `loserId` into `keepId`. Sightings are re-pointed with mergedFrom so it can be undone;
// the loser is kept as an alias (mergedInto), never deleted. Undo lives in Recently deleted.
async function mergeCats(keepId, loserId) {
  const keep = S.byId.get(keepId), lose = S.byId.get(loserId);
  for (const s of lose.sightings) await S.store.patch('sightings', s.id, { catId: keepId, mergedFrom: loserId });
  const patch = {};
  if (L.isUnnamed(keep.cat) && !L.isUnnamed(lose.cat)) patch.name = lose.cat.name;
  if (!photoOk(keep.cat.thumbPhotoId) && catPhotoId(lose.cat)) patch.thumbPhotoId = catPhotoId(lose.cat);
  if (!keep.cat.favourite && lose.cat.favourite) patch.favourite = true;
  patch.aliases = [...(keep.cat.aliases || []), L.displayName(lose.cat)];
  await S.store.patch('cats', keepId, patch);
  await S.store.patch('cats', loserId, { mergedInto: keepId, mergedAt: Date.now(), mergedBy: S.me || 'unknown' });
  return `Merged ${L.displayName(lose.cat)} into ${patch.name || L.displayName(keep.cat)} · Undo it from Recently deleted`;
}
async function unmerge(loserId) {
  const lose = S.raw.cats.find(c => c.id === loserId);
  for (const s of S.raw.sightings.filter(s => s.mergedFrom === loserId && s.catId === lose.mergedInto)) await S.store.patch('sightings', s.id, { catId: loserId, mergedFrom: null });
  await S.store.patch('cats', loserId, { mergedInto: null, unmergedAt: Date.now() });
  return `${L.displayName(lose)} is its own cat again`;
}

// ---------- RECENTLY DELETED: everything soft-deleted or merged, newest first, each with Restore ----------
function Deleted() {
  const R = S.raw || { cats: [], sightings: [] };
  const catName = id => { const c = R.cats.find(x => x.id === id); return c ? L.displayName(c) : 'a cat'; };
  const items = [
    ...R.cats.filter(c => c.deleted).map(c => ({ at: c.deletedAt || 0, kind: 'cat', id: c.id, title: L.displayName(c), line: `Cat deleted ${L.dayWord(c.deletedAt || 0, Date.now())}${c.deletedBy ? ' by ' + (PERSON[c.deletedBy] || c.deletedBy) : ''}, with its sightings`, btn: 'Restore', photo: photoOk(c.thumbPhotoId) ? c.thumbPhotoId : null, sw: swatch(c) })),
    ...R.cats.filter(c => c.mergedInto && !c.deleted).map(c => ({ at: c.mergedAt || 0, kind: 'merge', id: c.id, title: L.displayName(c), line: `Merged into ${catName(c.mergedInto)} ${L.dayWord(c.mergedAt || 0, Date.now())}`, btn: 'Undo merge', photo: null, sw: swatch(c) })),
    ...R.sightings.filter(s => s.deleted).map(s => ({ at: s.deletedAt || 0, kind: 'sighting', id: s.id, title: catName(s.catId), line: `Sighting of ${L.longStamp(s.at)} deleted`, btn: 'Restore', photo: s.photoId && !s.photoDeleted ? s.photoId : null, sw: '#8A8F99' })),
    ...R.sightings.filter(s => s.photoDeleted).map(s => ({ at: s.photoDeletedAt || 0, kind: 'photo', id: s.id, pid: s.photoId, title: catName(s.catId), line: `Photo from ${L.longStamp(s.at)} deleted`, btn: 'Restore photo', photo: null, sw: '#C9C5BA' })),
  ].sort((a, b) => b.at - a.at);
  $app.innerHTML = `${banner()}<div class="screen">
    <div class="formhead"><a class="back" href="#/catalogue">${I.back}Catalogue</a><div style="font-size:18px;font-weight:700">RECENTLY DELETED</div><div style="width:50px"></div></div>
    <div class="pad stack8" style="padding-bottom:20px">
      <div class="sub">Nothing here is gone. Restore puts it back for both phones.</div>
      ${items.map((it, i) => `<div class="drow"><div class="dthumb" style="background-color:${it.sw}"${it.photo ? ` data-photo="${esc(it.photo)}"` : ''}></div>
        <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px"><b>${esc(it.title)}</b><small>${esc(it.line)}</small></div>
        <button class="ghost" data-restore="${i}">${it.btn}</button></div>`).join('') || '<div class="empty">Nothing deleted.</div>'}
    </div></div>${nav('catalogue')}`;
  for (const b of $app.querySelectorAll('[data-restore]')) b.onclick = () => act(async () => {
    const it = items[+b.dataset.restore];
    if (it.kind === 'cat') { await S.store.patch('cats', it.id, { deleted: false, restoredAt: Date.now() }); return `${it.title} restored`; }
    if (it.kind === 'merge') return unmerge(it.id);
    if (it.kind === 'sighting') { await S.store.patch('sightings', it.id, { deleted: false, restoredAt: Date.now() }); return 'Sighting restored'; }
    await S.store.patch('sightings', it.id, { photoDeleted: false, restoredAt: Date.now() });
    if (it.pid) await S.store.patch('photos', it.pid, { deleted: false }).catch(() => {});
    return 'Photo restored';
  });
}

// ---------- 7. MEOWMENTUM ----------
function Meowmentum() {
  const now = Date.now(), p = S.period;
  const st = L.stats(S.data.cats, S.data.sightings, p, now);
  const lbl = L.PERIOD_LABEL[p];
  const top = st.leaderboard.slice(0, 5), maxN = top[0]?.n || 1;
  const maxB = Math.max(1, ...st.bars.map(b => b.n));
  const topIdx = st.bars.findIndex(b => b.n === maxB && b.n > 0);
  $app.innerHTML = `${banner()}<div class="screen">
    <div class="head" style="flex-direction:column;align-items:stretch;gap:12px"><div class="title">MEOWMENTUM</div>
      <div class="seg small">${[['day', 'Day'], ['week', 'Week'], ['month', 'Month'], ['all', 'All']].map(([k, t]) => `<button data-p="${k}" class="${p === k ? 'on' : ''}">${t}</button>`).join('')}</div></div>
    <div class="pad stack" style="gap:16px;padding-bottom:20px">
      <div class="big2">
        <div class="kpi go"><b>${st.newCats}</b><small>new cat${st.newCats === 1 ? '' : 's'} ${lbl}</small></div>
        <div class="kpi"><b>${st.sightings}</b><small>sighting${st.sightings === 1 ? '' : 's'} ${lbl}</small></div>
        <div class="kpi"><b class="s">${st.mostSeen ? `<span class="dot" style="width:18px;height:18px;background:${swatch(st.mostSeen.cat)}"></span>${esc(L.displayName(st.mostSeen.cat))}` : 'Nobody yet'}</b><small>${st.mostSeen ? `most seen, ${st.mostSeen.n} time${st.mostSeen.n === 1 ? '' : 's'}` : 'most seen'}</small></div>
        <div class="kpi"><b class="s">${st.bestDay ? `${st.bestDay.cats} cat${st.bestDay.cats === 1 ? '' : 's'} · ${L.shortDay(st.bestDay.at)}` : 'Not yet'}</b><small>best day on record</small></div>
      </div>
      <div class="stack8" style="gap:10px"><div class="label">Leaderboard</div>
        ${top.map(e => `<div class="lb"><div class="n">${esc(L.displayName(e.cat))}</div><div class="track"><div class="fill" style="width:${Math.round(e.n / maxN * 100)}%;background:${swatch(e.cat)}"></div></div><div class="c">${e.n}</div></div>`).join('') || `<div class="sub">No sightings ${lbl}.</div>`}</div>
      <div class="stack8" style="gap:10px"><div class="label">Sightings by ${p === 'day' ? 'time of day' : p === 'all' ? 'month' : 'day'}</div>
        <div class="bars">${st.bars.map((b, i) => `<div><div class="v">${b.n || ''}</div><div class="b ${i === topIdx ? 'top' : ''}" style="height:${Math.round(b.n / maxB * 70)}%"></div><div class="x">${esc(b.label)}</div></div>`).join('')}</div></div>
      <div class="strip"><div class="l">Hiss and Hers</div><div class="r"><span><b>Beth</b> ${st.hiss.beth}</span><span><b>Canada</b> ${st.hiss.canada}</span><span><b>Both</b> ${st.hiss.both}</span></div></div>
      <div class="strip"><div class="l">Purrometer</div><div class="r"><span><b>Beth</b> ${st.purr.beth} pet${st.purr.beth === 1 ? '' : 's'}</span><span><b>Canada</b> ${st.purr.canada} pet${st.purr.canada === 1 ? '' : 's'}</span></div></div>
    </div></div>${nav('stats')}`;
  for (const b of $app.querySelectorAll('[data-p]')) b.onclick = () => { S.period = b.dataset.p; LS.set('period', S.period); render(); };
}

// ---------- setup and boot ----------
function Setup(kind) {
  if (kind === 'noconfig') {
    $app.innerHTML = `<div class="setup"><div class="eyebrow">PURRVEILLANCE</div><div class="title">Not connected yet</div>
      <p>The shared cat log has not been switched on. Claudia's setup steps put the Firebase details into <code>config.js</code>; once that is done this page opens the Catflap.</p>
      <p class="sub">To look around with sample cats on this phone only, add <code>?demo=1</code> to the address.</p></div>`;
    return;
  }
  $app.innerHTML = `<div class="setup"><div class="eyebrow">PURRVEILLANCE</div><div class="title">Open your house link</div>
    <p>Both phones share one log through a private house link. Open the link Beth sent you, or start a new house here (do this once, on one phone).</p>
    <button class="primary" id="newhouse">Start a new house</button></div>`;
  document.getElementById('newhouse').onclick = () => {
    const code = newHouseCode();
    const u = new URL(location.href); u.searchParams.set('house', code); history.replaceState(null, '', u);
    LS.set('house', code);
    $app.innerHTML = `<div class="setup"><div class="eyebrow">PURRVEILLANCE</div><div class="title">Your house link</div>
      <p>Bookmark this page, then send this exact link to Canada. Anyone with it can see and add to the log, so keep it between you.</p>
      <div class="box" id="houselink">${esc(u.href)}</div>
      <button class="primary" id="copy">Copy link</button><div class="note" id="copied"></div>
      <a class="primary" style="display:flex;align-items:center;justify-content:center;background:var(--ink)" href="${esc(u.pathname + u.search)}#/catflap">Open the Catflap</a></div>`;
    document.getElementById('copy').onclick = () => navigator.clipboard.writeText(u.href).then(() => { document.getElementById('copied').textContent = 'Copied.'; }, () => { document.getElementById('copied').textContent = 'Copy blocked: press and hold the link above to copy it.'; });
  };
}

function seedDemo(store) {
  const now = Date.now(), base = { lat: 55.8601, lng: -4.1302 };
  const mk = (dx, dy) => ({ lat: base.lat + dy * 0.00009, lng: base.lng + dx * 0.00016 });
  const cats = { m: ['Mittens', 'Ginger', true], t: ['Tux at 86', 'Tux', true], g: ['Grey one', 'Grey', false], f: ['Fluffy', 'Fluffy', false], u: ['', '', false] };
  const data = { cats: {}, sightings: {}, photos: {} };
  for (const [id, [name, coat, fav]] of Object.entries(cats)) data.cats['demo-' + id] = { name, coat, swatch: L.swatchFor(coat, id), favourite: fav, createdAt: now, createdBy: 'beth', homeNote: id === 'm' ? 'the steps at number 27' : '', markings: '', thumbPhotoId: null };
  const plan = [['m', 0, 'beth', 1, 1, true, 'on the steps again, very judgemental'], ['m', 3, 'both', 2, 0, false, 'under the yellow van'], ['m', 5, 'canada', 0, 2, false, ''], ['m', 6, 'beth', 1, 2, true, ''], ['m', 9, 'beth', 2, 1, true, ''],
    ['t', 0, 'beth', -6, -5, true, ''], ['t', 2, 'canada', -7, -4, false, ''], ['g', 1, 'beth', 8, 3, false, ''], ['g', 4, 'beth', 9, 4, false, ''], ['g', 6, 'beth', 7, 2, false, ''],
    ['f', 3, 'canada', 3, 8, true, 'came right up to the gate'], ['u', 0, 'canada', -2, 9, false, '']];
  plan.forEach(([c, daysAgo, who, dx, dy, pet, note], i) => { const at = now - daysAgo * L.DAY - (i % 4) * 3600000; data.sightings['demo-s' + i] = { catId: 'demo-' + c, at, ...mk(dx, dy), locationSource: 'phone', seenBy: who, insideOutside: 'outside', petted: pet, note, photoId: null, createdAt: at, createdBy: who }; });
  store.reset(data);
}

async function boot() {
  let house = params.get('house') || LS.get('house') || (DEMO ? 'demo-house-0000000000' : null);
  if (!DEMO && !configured()) return Setup('noconfig');
  if (!house) return Setup('house');
  if (params.get('house')) LS.set('house', house);
  S.house = house;
  try { S.store = await openStore(house, { demo: DEMO }); }
  catch (e) { console.error(e); $app.innerHTML = `<div class="setup"><div class="title">Couldn't open the log</div><p>${esc(e.code || e.message || e)}</p><p class="sub">Check signal and reload.</p></div>`; return; }
  if (DEMO && params.has('seed')) seedDemo(S.store);
  let first = true;
  S.store.subscribe((d, err) => {
    if (err) { S.error = err.code || err.message; render(); return; }
    S.error = null; setData(d);
    // One-off per session: cats logged before numbering existed get the next numbers, oldest first, so no card says "Unnamed".
    if (!S.backfilled) {
      S.backfilled = true;
      const todo = S.data.cats.filter(c => L.isUnnamed(c) && !c.num).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      (async () => { for (const c of todo) { try { await S.store.patch('cats', c.id, { num: S.nextNum++ }); } catch (x) { console.warn('number backfill', x); } } })();
    }
    const r = route().name;
    // Don't redraw a form or the camera under someone's thumb; they pick up new data on their next screen.
    if (first || !['repurrt', 'camera', 'meowmeries'].includes(r) && !S.renaming && !S.editing) render();
    first = false;
  });
}

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => { });
// Any error nobody caught shows as a strip at the top, so a phone can tell us what broke.
function showCrash(msg) {
  let n = document.getElementById('crash');
  if (!n) { n = document.createElement('div'); n.id = 'crash'; n.className = 'crash'; n.onclick = () => n.remove(); document.body.appendChild(n); }
  n.textContent = 'Something broke: ' + msg + ' (tap to hide)';
}
window.addEventListener('error', e => showCrash(e.message || 'unknown error'));
window.addEventListener('unhandledrejection', e => showCrash((e.reason && (e.reason.code || e.reason.message)) || String(e.reason)));
boot();
