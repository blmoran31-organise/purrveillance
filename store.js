// PURRVEILLANCE: data layer. Two backends with one shape.
//  firebase: Firestore under houses/{HOUSE}/{cats|sightings|photos}, anonymous auth, live listeners.
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

export async function openStore(house, { demo = false } = {}) {
  return demo ? demoStore(house) : firebaseStore(house);
}

async function firebaseStore(house) {
  const [{ initializeApp }, auth, fs] = await Promise.all([
    import(FB + 'firebase-app.js'), import(FB + 'firebase-auth.js'), import(FB + 'firebase-firestore.js')]);
  const app = initializeApp(firebaseConfig);
  const a = auth.getAuth(app);
  await auth.signInAnonymously(a);
  const db = fs.getFirestore(app);
  const col = name => fs.collection(db, 'houses', house, name);
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
    mode: 'firebase',
    subscribe(f) { subs.add(f); if (state.ready.cats && state.ready.sightings) f({ cats: state.cats, sightings: state.sightings }); else if (lastError) f(null, lastError); return () => subs.delete(f); },
    async put(name, id, data) { await fs.setDoc(fs.doc(db, 'houses', house, name, id), data); return id; },
    async patch(name, id, data) { await fs.updateDoc(fs.doc(db, 'houses', house, name, id), data); },
    async photo(id) {
      if (!photoCache.has(id)) photoCache.set(id, fs.getDoc(fs.doc(db, 'houses', house, 'photos', id)).then(d => d.exists() ? d.data() : null));
      return photoCache.get(id);
    },
  };
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
