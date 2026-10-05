// PURRVEILLANCE: data layer. Two backends with one shape.
//  firebase: Firestore under houses/{VIEW CODE}/{cats|sightings|photos}, anonymous auth, live listeners.
//            A house link can write; a view link (?view=) is read only, enforced by firestore.rules.
//  demo:     this browser's localStorage only, for testing with ?demo=1. Never shared, says so on screen.
// Nothing is ever deleted by the app (Contract rule 2 spirit; the Firestore rules refuse delete too).

import { firebaseConfig } from './config.js';

const FB = 'https://www.gstatic.com/firebasejs/12.19.0/';

export function newId() {
  const a = new Uint8Array(12); crypto.getRandomValues(a);
  return [...a].map(b => b.toString(36).padStart(2, '0')).join('').slice(0, 20);
}

export function newHouseCode() {
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789';
  const a = new Uint8Array(20); crypto.getRandomValues(a);
  return [...a].map(b => abc[b % abc.length]).join('');
}

export function configured() { return !!(firebaseConfig && firebaseConfig.apiKey && firebaseConfig.projectId); }

// The view-only code (2026-10-05): SHA-256 of the house code, 64 hex characters. One-way, so a view link can
// never be turned back into the house link. Data lives under houses/{viewCode}; see firestore.rules.
export async function viewCodeFor(house) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('purrveillance-view:' + house));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
export const isViewCode = v => /^[0-9a-f]{64}$/.test(v || '');

// house: the full house code (can change things). view: a view code (read only). Give one, not both.
// guest: the guest code, given with a view code (a guest link); the store is read only apart from drop().
export async function openStore(house, { demo = false, view = null, guest = null, onStatus = () => {} } = {}) {
  return demo ? demoStore(house) : firebaseStore(house, view, onStatus, guest);
}
export const isGuestCode = g => /^[a-z0-9]{24}$/.test(g || '');

const READ_ONLY = Object.assign(new Error('This is a view-only link: nothing can be added or changed.'), { code: 'view-only' });

async function firebaseStore(house, view, onStatus, guest) {
  const [{ initializeApp }, auth, fs] = await Promise.all([
    import(FB + 'firebase-app.js'), import(FB + 'firebase-auth.js'), import(FB + 'firebase-firestore.js')]);
  const app = initializeApp(firebaseConfig);
  const a = auth.getAuth(app);
  await auth.signInAnonymously(a);
  const db = fs.getFirestore(app);
  const readOnly = !house;
  const root = readOnly ? view : await viewCodeFor(house);
  if (!readOnly) await joinHouse(fs, db, a.currentUser.uid, house, root, onStatus);
  // A guest joins with the guest code; a code that has been replaced is refused here and the guest stays view-only.
  let guestOk = false;
  if (readOnly && guest) { try { await fs.setDoc(fs.doc(db, 'houses', root, 'guests', a.currentUser.uid), { key: guest, at: Date.now() }); guestOk = true; } catch (e) { console.warn('guest join refused', e.code); } }
  const col = name => fs.collection(db, 'houses', root, name);
  const state = { cats: [], sightings: [], ready: { cats: false, sightings: false } };
  const subs = new Set();
  const emit = () => { if (state.ready.cats && state.ready.sightings) for (const f of subs) f({ cats: state.cats, sightings: state.sightings }); };
  let lastError = null;
  for (const name of ['cats', 'sightings']) {
    fs.onSnapshot(col(name), snap => {
      state[name] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      state.ready[name] = true; emit();
    }, err => { lastError = err; for (const f of subs) f(null, err); });
  }
  const photoCache = new Map();
  return {
    mode: 'firebase', readOnly, viewCode: root, guestOk,
    // GUEST: one new cat into the Guest drops queue. Everything else stays refused.
    async drop(data) { if (!guestOk && readOnly) throw READ_ONLY; const id = newId(); await fs.setDoc(fs.doc(db, 'houses', root, 'drops', id), data); return id; },
    // HOUSE phones: the guest code (made on first ask), a fresh one (old guest links stop adding), and the queue.
    async guestKey(fresh = false) {
      if (readOnly) throw READ_ONLY;
      const ref = fs.doc(db, 'houses', root, 'meta', 'guestkey');
      if (!fresh) { const d = await fs.getDoc(ref); if (d.exists()) return d.data().key; }
      const abc = 'abcdefghjkmnpqrstuvwxyz23456789', r = new Uint8Array(24); crypto.getRandomValues(r);
      const key = [...r].map(b => abc[b % abc.length]).join('');
      await fs.setDoc(ref, { key, at: Date.now() }); return key;
    },
    watchDrops(f) { if (readOnly) return () => {}; return fs.onSnapshot(fs.collection(db, 'houses', root, 'drops'), snap => f(snap.docs.map(d => ({ id: d.id, ...d.data() }))), err => console.warn('drops', err.code)); },
    subscribe(f) { subs.add(f); if (state.ready.cats && state.ready.sightings) f({ cats: state.cats, sightings: state.sightings }); else if (lastError) f(null, lastError); return () => subs.delete(f); },
    async put(name, id, data) { if (readOnly) throw READ_ONLY; await fs.setDoc(fs.doc(db, 'houses', root, name, id), data); return id; },
    // A changed photo (focal point, delete) must not be served from the cache afterwards.
    async patch(name, id, data) { if (readOnly) throw READ_ONLY; await fs.updateDoc(fs.doc(db, 'houses', root, name, id), data); if (name === 'photos') photoCache.delete(id); },
    async photo(id) {
      if (!photoCache.has(id)) photoCache.set(id, fs.getDoc(fs.doc(db, 'houses', root, 'photos', id)).then(d => d.exists() ? d.data() : null));
      return photoCache.get(id);
    },
  };
}

// A phone with the full house code: claim the house (first phone only), join it, and copy any data still on the
// old path across ONCE. Copying only adds what is missing, so a second phone doing it at the same time is harmless,
// and nothing on the old path is removed: it is frozen by meta/moved instead (rules).
async function joinHouse(fs, db, uid, house, root, onStatus) {
  const ref = (...p) => fs.doc(db, 'houses', ...p);
  try { await fs.setDoc(ref(root, 'meta', 'owner'), { key: house, at: Date.now() }); }
  catch (e) { if (e.code !== 'permission-denied') throw e; } // already claimed: the members write below proves the code
  await fs.setDoc(ref(root, 'members', uid), { key: house, at: Date.now() });
  const done = await fs.getDoc(ref(root, 'meta', 'move'));
  if (done.exists()) return;
  // Pass 1 copies everything missing. Then the old path is frozen (meta/moved), and pass 2 copies anything an
  // old copy of the app wrote there in between, so nothing is stranded.
  const copied = { cats: 0, sightings: 0, photos: 0 }, known = { cats: new Set(), sightings: new Set(), photos: new Set() };
  const pass = async (label, readDst) => {
    for (const name of ['cats', 'sightings', 'photos']) {
      onStatus(`Moving your log to the new layout (${label}): ${name}…`);
      const [src, dst] = await Promise.all([fs.getDocs(fs.collection(db, 'houses', house, name)), readDst ? fs.getDocs(fs.collection(db, 'houses', root, name)) : null]);
      if (dst) for (const d of dst.docs) known[name].add(d.id);
      const todo = src.docs.filter(d => !known[name].has(d.id));
      let n = 0;
      const worker = async () => { while (todo.length) { const d = todo.shift(); await fs.setDoc(ref(root, name, d.id), d.data()); known[name].add(d.id); n++; if (n % 20 === 0) onStatus(`Moving your log to the new layout (${label}): ${name} ${n}…`); } };
      await Promise.all(Array.from({ length: 6 }, worker));
      copied[name] += n;
    }
  };
  await pass('1 of 2', true);
  try { await fs.setDoc(ref(house, 'meta', 'moved'), { at: Date.now() }); } catch (e) { if (e.code !== 'permission-denied') throw e; }
  await pass('2 of 2', false);
  await fs.setDoc(ref(root, 'meta', 'move'), { at: Date.now(), copied });
  onStatus('');
}

function demoStore(house) {
  const key = 'purrveillance-demo-' + house;
  const load = () => { try { return JSON.parse(localStorage.getItem(key)) || { cats: {}, sightings: {}, photos: {} }; } catch { return { cats: {}, sightings: {}, photos: {} }; } };
  let data = load();
  const save = () => { try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) { console.warn('demo save failed', e); } };
  const subs = new Set();
  const view = () => ({ cats: Object.entries(data.cats).map(([id, v]) => ({ id, ...v })), sightings: Object.entries(data.sightings).map(([id, v]) => ({ id, ...v })) });
  const emit = () => { const v = view(); for (const f of subs) f(v); };
  return {
    mode: 'demo',
    subscribe(f) { subs.add(f); queueMicrotask(() => f(view())); return () => subs.delete(f); },
    async put(name, id, d) { data[name][id] = d; save(); if (name !== 'photos') emit(); return id; },
    async patch(name, id, d) { data[name][id] = { ...data[name][id], ...d }; save(); if (name !== 'photos') emit(); },
    async photo(id) { return data.photos[id] || null; },
    reset(seed) { data = seed || { cats: {}, sightings: {}, photos: {} }; save(); emit(); },
  };
}
