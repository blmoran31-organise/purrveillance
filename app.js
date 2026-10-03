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
  camera: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h3l2-3h6l2 3h3v12H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  pencil: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4l10-10-4-4L4 16z"/><path d="M12 8l4 4"/></svg>',
  heart: on => `<svg width="22" height="22" viewBox="0 0 24 24" fill="${on ? '#D9641E' : 'none'}" stroke="${on ? '#D9641E' : '#B8BCC4'}" stroke-width="2" stroke-linejoin="round"><path d="M12 20s-7-4.6-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.4-7 10-7 10z"/></svg>`,
};

function nav(on) {
  const items = [['catflap', 'Catflap', I.home], ['map', 'Meow Map', I.map], ['camera', 'Pawparazzi', I.paw], ['catalogue', 'Catalogue', I.cat], ['stats', 'Meowmentum', I.stats]];
  return `<nav class="bar">${items.map(([r, t, i]) => `<a href="#/${r}" class="${r === on ? 'on' : ''}">${i}${t}</a>`).join('')}</nav>`;
}
function banner() {
  if (S.error) return `<div class="banner">Can't reach the shared log (${esc(S.error)}). Check signal; nothing new will save until it's back.</div>`;
  if (DEMO) return '<div class="banner">DEMO: sample cats on this phone only, not shared</div>';
  return '';
}

// ---------- data ----------
function setData(d) {
  S.data = d; S.sums = L.summarise(d.cats, d.sightings);
  S.byId = new Map(S.sums.map(e => [e.cat.id, e]));
}
function swatch(cat) { return cat.swatch || L.swatchFor(cat.coat, cat.id); }
function photoAttr(cat) { return cat.thumbPhotoId ? ` data-photo="${esc(cat.thumbPhotoId)}"` : ''; }
async function hydratePhotos(root = $app) {
  for (const el of root.querySelectorAll('[data-photo]')) {
    const id = el.dataset.photo; el.removeAttribute('data-photo');
    try { const p = await S.store.photo(id); if (p && p.data) { el.style.backgroundImage = `url("${p.data}")`; el.classList.add('hasphoto'); const t = el.querySelector('.ini'); if (t) t.textContent = ''; } } catch (e) { console.warn('photo', id, e); }
  }
}

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
  for (const s of S.data.sightings) if (typeof s.lat === 'number' && (!best || s.at > best.at)) best = s;
  return best ? { lat: best.lat, lng: best.lng } : null;
}

// ---------- maps ----------
function killMaps() { for (const m of S.maps) { try { m.remove(); } catch { } } S.maps = []; }
function makeMap(el, opts = {}) {
  const m = window.L.map(el, { zoomControl: false, attributionControl: true, ...opts });
  window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(m);
  S.maps.push(m); return m;
}
const divIcon = html => window.L.divIcon({ html, className: '', iconSize: [0, 0] });

// ---------- router ----------
function route() { const h = location.hash.replace(/^#\/?/, '') || 'catflap'; const [name, arg] = h.split('/'); return { name, arg }; }
function go(h) { if (location.hash === '#/' + h) render(); else location.hash = '#/' + h; }
window.addEventListener('hashchange', () => render());

function stopCamera() { if (S.stream) { for (const t of S.stream.getTracks()) t.stop(); S.stream = null; } }

function render() {
  const r = route();
  killMaps();
  if (r.name !== 'camera') stopCamera();
  if (r.name !== 'cat') S.renaming = null;
  const screens = { catflap: Catflap, map: MeowMap, camera: Pawparazzi, repurrt: Repurrt, catalogue: Catalogue, cat: CatEntry, stats: Meowmentum };
  (screens[r.name] || Catflap)(r.arg);
  if (S.toast) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = S.toast; $app.appendChild(t); const msg = S.toast; setTimeout(() => { if (S.toast === msg) { S.toast = null; t.remove(); } }, 4000); }
  hydratePhotos();
}

// ---------- 1. CATFLAP ----------
function Catflap() {
  const cats = S.sums.filter(e => e.count);
  let flash;
  if (!S.me) {
    flash = `<div class="flash"><div class="k">WHOSE PHONE IS THIS?</div><div class="d">So Mewsflash knows who "you" are. Change it any time with the B and C buttons.</div>
      <div class="seg"><button data-me="beth">Beth</button><button data-me="canada">Canada</button></div></div>`;
  } else {
    const mf = L.mewsflash(S.sums, S.me);
    const now = Date.now();
    const item = (e, line) => {
      const unnamed = !e.cat.name;
      return `<a class="item" href="#/cat/${esc(e.cat.id)}"><div class="thumb" style="background-color:${unnamed ? 'var(--moss)' : swatch(e.cat)}"${photoAttr(e.cat)}><span class="ini">${unnamed ? 'NEW' : ''}</span></div>
        <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px"><div class="t">${esc(L.displayName(e.cat))}</div><div class="d">${line}${unnamed ? ' · needs a name' : ''}</div></div></a>`;
    };
    const when = e => { const s = e.lastSighting; return L.dayWord(s.at, now) + ', ' + L.hhmm(s.at); };
    const rows = [];
    for (const e of mf.youMissed) rows.push(item(e, `${esc(themName())} saw it ${esc(when(e))} · you never have`));
    if (mf.theyMissed.length) {
      rows.push(`<div class="split">${esc(themName().toUpperCase())} HAS NOT SEEN</div>`);
      for (const e of mf.theyMissed) rows.push(item(e, `You saw it ${esc(when(e))} · ${esc(themName())} never has`));
    }
    const count = mf.youMissed.length ? `${mf.youMissed.length} you have not seen` : '';
    const empty = !cats.length ? '<div class="d">No cats yet. Spot one and it lands here for the other phone.</div>' : !rows.length ? '<div class="d">You have both seen every cat.</div>' : '';
    flash = `<div class="flash"><div style="display:flex;justify-content:space-between;align-items:center"><div class="k">MEWSFLASH</div><div class="n">${count}</div></div>${rows.join('')}${empty}</div>`;
  }
  const purr = L.stats(S.data.cats, S.data.sightings, 'week', Date.now()).purr;
  $app.innerHTML = `${banner()}<div class="screen">
    <div class="head"><div><div class="eyebrow">PURRVEILLANCE</div><div class="title">Catflap</div></div>
      <div class="who"><button class="av beth ${S.me === 'beth' ? 'me' : ''}" data-me="beth" aria-label="This is Beth's phone">B</button><button class="av ${S.me === 'canada' ? 'me' : ''}" data-me="canada" aria-label="This is Canada's phone">C</button></div></div>
    <div class="pad stack" style="padding-bottom:20px">${flash}
      <div class="tiles2">
        <a class="tile go" href="#/camera">${I.paw}<b>Spotted one</b></a>
        <a class="tile" href="#/repurrt" data-fresh>${I.gallery}<div style="display:flex;flex-direction:column;gap:2px"><b>Repurrt</b><small>no photo, just log where and who</small></div></a>
      </div>
      <div class="strip"><div class="l">Purrometer this week</div><div class="r"><span><b>Beth</b> ${purr.beth} pet${purr.beth === 1 ? '' : 's'}</span><span><b>Canada</b> ${purr.canada} pet${purr.canada === 1 ? '' : 's'}</span></div></div>
    </div></div>${nav('catflap')}`;
  for (const b of $app.querySelectorAll('[data-me]')) b.onclick = () => { S.me = b.dataset.me; LS.set('me', S.me); render(); };
  for (const a of $app.querySelectorAll('[data-fresh]')) a.onclick = () => { S.draft = null; };
}

// ---------- 2. MEOW MAP ----------
function MeowMap() {
  const n = S.sums.filter(e => e.count).length;
  $app.innerHTML = `${banner()}<div class="screen" style="overflow:hidden">
    <div class="head"><div><div class="title">MEOW MAP</div><div class="sub" id="mapsub">${n} cat${n === 1 ? '' : 's'} · ${S.data.sightings.length} sighting${S.data.sightings.length === 1 ? '' : 's'} · finding you…</div></div>
      <a href="#/catflap" class="av ${S.me === 'beth' ? 'beth' : ''}" style="width:44px;height:44px;border-radius:22px">${S.me ? PERSON[S.me][0] : '?'}</a></div>
    <div class="mapwrap"><div id="map" style="position:absolute;inset:0"></div><div class="near" id="near"><div class="label">Near you</div><div class="sub">Finding your position…</div></div></div>
  </div>
  <a class="fab" href="#/camera">${I.plus}Spotted one</a>${nav('map')}`;
  const m = makeMap(document.getElementById('map'));
  const pins = [];
  for (const e of S.sums) {
    const p = L.lastPosition(e); if (!p) continue;
    const unnamed = !e.cat.name;
    const label = unnamed ? (L.startOfDay(e.first) === L.startOfDay(Date.now()) ? 'New today' : 'Unnamed') : `${L.displayName(e.cat)} · ${e.count}`;
    const html = `<div class="pin ${unnamed ? 'unnamed' : ''}"><i style="background:${unnamed ? 'var(--moss)' : swatch(e.cat)};${unnamed ? 'font-size:20px' : ''}">${esc(L.initial(e.cat))}</i><span>${esc(label)}</span></div>`;
    const mk = window.L.marker([p.lat, p.lng], { icon: divIcon(html) }).addTo(m);
    mk.on('click', () => go('cat/' + e.cat.id));
    pins.push([p.lat, p.lng]);
  }
  const fallback = lastKnownPlace();
  if (fallback) m.setView([fallback.lat, fallback.lng], 16); else m.setView([54.5, -3], 5);
  getPos().then(pos => {
    if (!document.getElementById('map')) return;
    const sub = document.getElementById('mapsub');
    const near = document.getElementById('near');
    if (pos) {
      window.L.marker([pos.lat, pos.lng], { icon: divIcon('<div class="youdot"></div>'), interactive: false }).addTo(m);
      m.setView([pos.lat, pos.lng], 16);
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
  if (gps && typeof gps.latitude === 'number') return newDraft({ photo, lat: gps.latitude, lng: gps.longitude, source: 'exif', at: at || Date.now() });
  const pos = await getPos();
  return newDraft({ photo, lat: pos?.lat, lng: pos?.lng, source: pos ? 'phone' : 'none', at: at || Date.now(), noGpsInPhoto: true });
}
function newDraft(o = {}) {
  return { photo: null, lat: undefined, lng: undefined, source: 'none', at: Date.now(), catId: null, seenBy: S.me || 'beth', inside: false, petted: false, name: '', coat: '', note: '', ...o };
}

function Pawparazzi() {
  const facing = S.facing || 'environment';
  $app.innerHTML = `<div class="screen dark">
    <div class="cam-head"><a class="round" href="#/map" aria-label="Back to map">${I.back}</a><div style="font-size:18px;font-weight:700;letter-spacing:0.5px">PAWPARAZZI</div><div style="width:44px"></div></div>
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
  const hasPin = typeof d.lat === 'number';
  const pinAt = hasPin ? { lat: d.lat, lng: d.lng } : lastKnownPlace();
  const capText = { exif: 'From the photo · drag to fix', phone: 'Where you are now · drag to fix', manual: 'Placed by hand · drag to fix', none: 'No location yet · drag the pin to where it was' }[d.source];
  const named = S.sums.filter(e => e.count || e.cat);
  const near = pinAt ? L.nearest(named, pinAt) : named.map(e => ({ ...e, distance: Infinity })).sort((a, b) => (b.last || 0) - (a.last || 0));
  const close = near.filter(e => e.distance <= 250);
  const shown = S.showAllChips ? near : close;
  if (d.catId && d.catId !== 'new' && !shown.some(e => e.cat.id === d.catId)) { const sel = near.find(e => e.cat.id === d.catId); if (sel) shown.unshift(sel); }
  const more = near.length - shown.length;
  const chip = e => `<button class="chip ${d.catId === e.cat.id ? 'on' : ''}" data-cat="${esc(e.cat.id)}"><div class="face" style="background-color:${swatch(e.cat)}"${photoAttr(e.cat)}></div><b>${esc(L.displayName(e.cat))}</b><small>${isFinite(e.distance) ? L.distWord(e.distance) : (e.last ? L.dayWord(e.last, Date.now()) : 'no pins')}</small></button>`;
  const sel = d.catId && d.catId !== 'new' ? S.byId.get(d.catId) : null;
  const saveLabel = d.catId === 'new' ? (d.name.trim() ? `Save new cat: ${d.name.trim()}` : 'Save new cat (unnamed)') : sel ? `Save sighting of ${L.displayName(sel.cat)}` : 'Pick a cat first';
  const summary = `${d.inside ? 'inside' : 'outside'}, ${d.petted ? 'petted' : 'not petted'} · ${L.longStamp(d.at)}`;
  const COATS = ['Ginger', 'Black', 'Tux', 'Grey', 'Tabby', 'White', 'Calico', 'Fluffy'];
  $app.innerHTML = `${banner()}<div class="screen">
    <div class="formhead"><button class="back" id="back">${I.back}Back</button><div style="font-size:18px;font-weight:700">REPURRT</div><div style="width:50px"></div></div>
    <div class="pad stack" style="gap:12px;padding-bottom:16px">
      <label class="addphoto ${d.photo ? 'has' : ''}" ${d.photo ? `style="background-image:url('${d.photo.data}')"` : ''}>
        ${d.photo ? `<span class="cap">${d.noGpsInPhoto ? 'Photo had no location · tap to change' : 'Tap to change photo'}</span>` : `${I.camera}<span style="font-size:15px;font-weight:600">Add a photo</span><span class="sub" style="font-size:13px">optional</span>`}
        <input id="addphoto" type="file" accept="image/*" aria-label="Add a photo"></label>
      <div class="stack8"><div class="label">Where</div><div class="wheremap"><div id="wmap" style="position:absolute;inset:0"></div><div class="cap">${capText}</div></div></div>
      <div class="stack8"><div class="label">Which cat? (nearest first)</div>
        <div class="chips">${shown.map(chip).join('')}
          ${more > 0 ? `<button class="chip new" id="morechips"><div class="face">…</div><b>${more} more</b><small>further away</small></button>` : ''}
          <button class="chip new ${d.catId === 'new' ? 'on' : ''}" data-cat="new"><div class="face">+</div><b>New cat</b></button></div></div>
      <div class="stack8"><div class="label">Who saw it</div><div class="seg">${['beth', 'canada', 'both'].map(p => `<button data-who="${p}" class="${d.seenBy === p ? 'on' : ''}">${PERSON[p]}</button>`).join('')}</div></div>
      ${d.catId ? `<div class="stack8"><label class="label" for="catname">${d.catId === 'new' ? 'Name (leave blank if you don\'t know yet)' : 'Name (change it to rename)'}</label>
        <input id="catname" class="field" type="text" autocomplete="off" value="${esc(d.name)}" placeholder="${d.catId === 'new' ? 'e.g. Mittens' : ''}"></div>` : ''}
      ${d.catId === 'new' ? `<div class="stack8"><div class="label">Looks like</div><div class="coats">${COATS.map(c => `<button data-coat="${c}" class="${d.coat === c ? 'on' : ''}">${c}</button>`).join('')}</div></div>` : ''}
      <div class="pair"><div class="stack8"><div class="label">Where was it</div><div class="seg small"><button data-in="1" class="${d.inside ? 'on' : ''}">Inside</button><button data-in="0" class="${!d.inside ? 'on' : ''}">Outside</button></div></div>
        <div class="stack8"><div class="label">Purrometer: petted?</div><div class="seg small"><button data-pet="1" class="${d.petted ? 'on warm' : ''}">Yes</button><button data-pet="0" class="${!d.petted ? 'on' : ''}">No</button></div></div></div>
      <div class="stack8"><label class="label" for="note">Note</label><textarea id="note" class="field" placeholder="optional, e.g. under the yellow van">${esc(d.note)}</textarea></div>
    </div></div>
    <div class="savebar"><button class="primary" id="save" ${d.catId ? '' : 'disabled'}>${esc(saveLabel)}</button><div class="note" id="savenote">Saves to both phones · ${esc(summary)}</div><div class="err" id="saveerr" hidden></div></div>`;

  document.getElementById('back').onclick = () => { S.draft = null; S.showAllChips = false; history.length > 1 ? history.back() : go('catflap'); };
  const m = makeMap(document.getElementById('wmap'), { attributionControl: false });
  const at = pinAt || { lat: 54.5, lng: -3 };
  m.setView([at.lat, at.lng], pinAt ? 17 : 5);
  const mk = window.L.marker([at.lat, at.lng], { draggable: true, icon: divIcon('<div class="dragpin"></div>') }).addTo(m);
  mk.on('dragend', () => { const p = mk.getLatLng(); d.lat = p.lat; d.lng = p.lng; d.source = 'manual'; render(); });
  m.on('click', ev => { d.lat = ev.latlng.lat; d.lng = ev.latlng.lng; d.source = 'manual'; render(); });

  const keep = () => { const n = document.getElementById('catname'); if (n) d.name = n.value; const t = document.getElementById('note'); if (t) d.note = t.value; };
  for (const b of $app.querySelectorAll('[data-cat]')) b.onclick = () => { keep(); d.catId = b.dataset.cat; d.name = d.catId === 'new' ? '' : (S.byId.get(d.catId)?.cat.name || ''); render(); };
  const mc = document.getElementById('morechips'); if (mc) mc.onclick = () => { keep(); S.showAllChips = true; render(); };
  for (const b of $app.querySelectorAll('[data-who]')) b.onclick = () => { keep(); d.seenBy = b.dataset.who; render(); };
  for (const b of $app.querySelectorAll('[data-in]')) b.onclick = () => { keep(); d.inside = b.dataset.in === '1'; render(); };
  for (const b of $app.querySelectorAll('[data-pet]')) b.onclick = () => { keep(); d.petted = b.dataset.pet === '1'; render(); };
  for (const b of $app.querySelectorAll('[data-coat]')) b.onclick = () => { keep(); d.coat = d.coat === b.dataset.coat ? '' : b.dataset.coat; render(); };
  const nm = document.getElementById('catname'); if (nm) nm.oninput = () => { d.name = nm.value; const s = document.getElementById('save'); if (d.catId === 'new') s.textContent = d.name.trim() ? `Save new cat: ${d.name.trim()}` : 'Save new cat (unnamed)'; };
  document.getElementById('addphoto').onchange = async e => {
    const f = e.target.files && e.target.files[0]; if (!f) return; keep();
    try { const nd = await draftFromFile(f); d.photo = nd.photo; d.noGpsInPhoto = nd.noGpsInPhoto; if (nd.source === 'exif') { d.lat = nd.lat; d.lng = nd.lng; d.source = 'exif'; d.at = nd.at; } render(); }
    catch (x) { const er = document.getElementById('saveerr'); er.textContent = x.message; er.hidden = false; }
  };
  document.getElementById('save').onclick = async () => {
    keep();
    const er = document.getElementById('saveerr'); er.hidden = true;
    if (typeof d.lat !== 'number') { er.textContent = 'Drag the pin to where you saw it, then save.'; er.hidden = false; return; }
    const btn = document.getElementById('save'); btn.disabled = true; btn.textContent = 'Saving…';
    try { const catId = await saveDraft(d); S.draft = null; S.showAllChips = false; S.toast = `Saved to both phones · ${summary}`; go('cat/' + catId); }
    catch (x) { console.error(x); btn.disabled = false; btn.textContent = saveLabel; er.textContent = 'Not saved: ' + (x.code || x.message || x) + '. Check signal and try again.'; er.hidden = false; }
  };
}

async function saveDraft(d) {
  const now = Date.now();
  let catId = d.catId;
  const name = d.name.trim();
  if (catId === 'new') {
    catId = newId();
    await S.store.put('cats', catId, { name, coat: d.coat || '', swatch: L.swatchFor(d.coat, catId), markings: '', homeNote: '', favourite: false, createdAt: now, createdBy: S.me || d.seenBy, thumbPhotoId: null });
  } else {
    const cat = S.byId.get(catId)?.cat;
    if (cat && name && name !== (cat.name || '')) await S.store.patch('cats', catId, { name });
  }
  let photoId = null;
  if (d.photo) {
    photoId = newId();
    await S.store.put('photos', photoId, { data: d.photo.data, w: d.photo.w, h: d.photo.h, catId, at: d.at, createdAt: now });
    await S.store.patch('cats', catId, { thumbPhotoId: photoId });
  }
  await S.store.put('sightings', newId(), { catId, at: d.at, lat: d.lat, lng: d.lng, locationSource: d.source === 'none' ? 'manual' : d.source, seenBy: d.seenBy, insideOutside: d.inside ? 'inside' : 'outside', petted: !!d.petted, note: d.note.trim(), photoId, createdAt: now, createdBy: S.me || d.seenBy });
  return catId;
}

// ---------- 5. THE CATALOGUE ----------
function Catalogue() {
  const now = Date.now();
  const f = S.filter;
  let list = S.sums.slice();
  if (f === 'fav') list = list.filter(e => e.cat.favourite);
  if (f === 'pet') list = list.filter(e => e.petted > 0);
  if (f === 'unnamed') list = list.filter(e => !e.cat.name);
  list.sort((a, b) => (b.last || b.cat.createdAt || 0) - (a.last || a.cat.createdAt || 0));
  const row = e => {
    const c = e.cat, unnamed = !c.name;
    const ls = e.lastSighting;
    const by = ls && S.me && ls.seenBy !== 'both' && ls.seenBy !== S.me ? `, by ${PERSON[ls.seenBy]}` : '';
    const m1 = unnamed ? `${e.count} sighting${e.count === 1 ? '' : 's'} · tap to name` : [c.coat, `${e.count} sighting${e.count === 1 ? '' : 's'}`, L.pettedWord(e.petted)].filter(Boolean).join(' · ');
    return `<a class="catrow" href="#/cat/${esc(c.id)}"><div class="big" style="background-color:${unnamed ? 'var(--moss)' : swatch(c)}"${photoAttr(c)}><span class="ini">${unnamed ? 'NEW' : ''}</span></div>
      <div class="txt"><div class="nm ${unnamed ? 'grey' : ''}">${esc(L.displayName(c))}</div><div class="m1">${esc(m1)}</div><div class="m2">${e.last ? `${unnamed ? 'Seen' : 'Last seen'} ${L.dayWord(e.last, now)}${esc(by)}` : 'No sightings yet'}</div></div>${I.heart(c.favourite)}</a>`;
  };
  const F = [['all', 'All'], ['fav', I.heart(true).replace('width="22" height="22"', 'width="14" height="14"') + 'Favourites'], ['pet', 'Petted'], ['unnamed', 'Unnamed']];
  $app.innerHTML = `${banner()}<div class="screen">
    <div class="head" style="flex-direction:column;align-items:stretch"><div style="display:flex;justify-content:space-between;align-items:flex-end"><div class="title">CATALOGUE</div><div class="sub">${S.sums.length} cat${S.sums.length === 1 ? '' : 's'}</div></div>
      <div class="filters">${F.map(([k, t]) => `<button data-f="${k}" class="${f === k ? 'on' : ''}">${t}</button>`).join('')}</div></div>
    <div class="pad">${list.map(row).join('') || `<div class="empty">${S.sums.length ? 'No cats in this list yet.' : 'No cats yet.<br>Tap Pawparazzi to log the first one.'}</div>`}</div>
  </div>${nav('catalogue')}`;
  for (const b of $app.querySelectorAll('[data-f]')) b.onclick = () => { S.filter = b.dataset.f; render(); };
}

// ---------- 6. CATALOGUE ENTRY ----------
function CatEntry(id) {
  const e = S.byId.get(id);
  if (!e) { $app.innerHTML = `${banner()}<div class="screen"><div class="setup"><div class="title">Cat not found</div><p>It may still be loading.</p><a class="primary" style="display:flex;align-items:center;justify-content:center" href="#/catalogue">Back to the Catalogue</a></div></div>${nav('catalogue')}`; return; }
  const c = e.cat, now = Date.now();
  const days = e.first !== null ? Math.max(0, Math.floor((L.startOfDay(now) - L.startOfDay(e.first)) / L.DAY)) : 0;
  const terr = L.territory(e);
  const desc = [c.coat, c.homeNote].filter(Boolean).join(' · ');
  const nameBlock = S.renaming === id
    ? `<form class="rename" id="rn"><input id="rnin" class="field" value="${esc(c.name || '')}" placeholder="Name this cat" aria-label="New name"><button type="submit">Save</button></form>`
    : `<div class="nameline"><div class="nm">${esc(L.displayName(c))}</div><button class="pencil" id="pencil" aria-label="Rename this cat">${I.pencil}</button></div>
       <div class="desc">${esc(desc ? desc + ' · ' : '')}tap the pencil to ${c.name ? 'rename' : 'name'}</div>`;
  $app.innerHTML = `${banner()}<div class="screen">
    <div class="hero" style="background-color:${swatch(c)}"${photoAttr(c)}>
      <a class="round lt" style="left:20px" href="#/catalogue" aria-label="Back to Catalogue">${I.back}</a>
      <button class="round lt" style="right:20px" id="fav" aria-label="${c.favourite ? 'Remove from favourites' : 'Add to favourites'}">${I.heart(c.favourite).replace('#B8BCC4', '#17181C')}</button>
      ${nameBlock}</div>
    <div class="tiles3"><div class="stat"><b>${e.count}</b><small>sighting${e.count === 1 ? '' : 's'}</small></div><div class="stat"><b>${days}d</b><small>since first</small></div><div class="stat"><b>${e.petted}</b><small>Purrometer</small></div></div>
    <div class="pad stack8" style="padding-top:16px"><div class="label">Territory</div>
      <div class="terr"><div id="tmap" style="position:absolute;inset:0"></div><div class="cap">${terr.pins ? `${terr.pins} pin${terr.pins === 1 ? '' : 's'}${terr.pins > 1 ? `, all within ${L.distWord(terr.radius)}` : ''}` : 'No pins yet'}</div></div></div>
    <div class="pad stack8" style="padding-top:16px;padding-bottom:16px"><div class="label">Sightings</div><div>
      ${e.sightings.map(s => `<div class="srow"><div style="display:flex;flex-direction:column;gap:2px;min-width:0"><div class="t">${esc(L.dayWord(s.at, now).replace(/^./, x => x.toUpperCase()))}, ${L.hhmm(s.at)}</div>
        <div class="d">${esc(s.note || 'no note')}${s.petted ? ' · petted' : ''}${s.insideOutside === 'inside' ? ' · inside' : ''}</div></div><span class="tag ${esc(s.seenBy)}">${esc(PERSON[s.seenBy] || s.seenBy)}</span></div>`).join('') || '<div class="empty">No sightings yet.</div>'}
    </div></div></div>${nav('catalogue')}`;
  if (terr.pins) {
    const m = makeMap(document.getElementById('tmap'), { dragging: false, scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false, boxZoom: false, keyboard: false, attributionControl: false });
    const pts = e.sightings.filter(s => typeof s.lat === 'number').map(s => [s.lat, s.lng]);
    for (const p of pts) window.L.marker(p, { icon: divIcon(`<div class="minipin" style="background:${swatch(c)}"></div>`), interactive: false }).addTo(m);
    if (pts.length > 1) { window.L.circle([terr.centre.lat, terr.centre.lng], { radius: Math.max(terr.radius, 15), stroke: false, fillColor: swatch(c), fillOpacity: 0.18 }).addTo(m); m.fitBounds(pts, { padding: [24, 24], maxZoom: 18 }); }
    else m.setView(pts[0], 17);
  } else document.getElementById('tmap').remove();
  document.getElementById('fav').onclick = () => S.store.patch('cats', id, { favourite: !c.favourite });
  const p = document.getElementById('pencil'); if (p) p.onclick = () => { S.renaming = id; render(); const i = document.getElementById('rnin'); i.focus(); i.select(); };
  const rn = document.getElementById('rn');
  if (rn) rn.onsubmit = async ev => { ev.preventDefault(); const v = document.getElementById('rnin').value.trim(); S.renaming = null; if (v !== (c.name || '')) await S.store.patch('cats', id, { name: v }); else render(); };
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
    const r = route().name;
    // Don't redraw a form or the camera under someone's thumb; they pick up new data on their next screen.
    if (first || !['repurrt', 'camera'].includes(r) && !S.renaming) render();
    first = false;
  });
}

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => { });
boot();
