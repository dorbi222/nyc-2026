// NYC 2026 — trip app. Firebase (Firestore + anonymous auth) on GitHub Pages.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, collection, onSnapshot, writeBatch, limit, query
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { SEED } from './data.js';

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyD8LfeooJ1pBiIq0hWO4BJqB2bH60zfy0g",
  authDomain: "nyc-2026-67f7c.firebaseapp.com",
  projectId: "nyc-2026-67f7c",
  storageBucket: "nyc-2026-67f7c.firebasestorage.app",
  messagingSenderId: "294727573533",
  appId: "1:294727573533:web:5cb76e6104068ba3d4e6f4"
};

// ---------------- people, worlds, access ----------------
const PEOPLE = {
  dor:    { he: 'דור',   en: 'Dor',    color: '#16917D' },
  moti:   { he: 'מוטי',  en: 'Moti',   color: '#E4506F' },
  ben:    { he: 'בן',    en: 'Ben',    color: '#3955D6' },
  sydney: { he: 'סידני', en: 'Sydney', color: '#D99A1E' }
};
const ACCESS = { dor: ['brothers', 'mba'], moti: ['brothers', 'boston'], ben: ['brothers', 'boston'], sydney: ['brothers', 'boston'] };
const EDITORS = { brothers: ['dor', 'moti', 'ben'], mba: ['dor'], boston: ['moti', 'ben'] };
const PHOTO = f => `https://commons.wikimedia.org/wiki/Special:FilePath/${f}?width=1280`;
const WORLDS = {
  brothers: { he: 'האחים', en: 'The Brothers', longHe: 'האחים בניו יורק', longEn: 'The Brothers in NYC', emoji: '🗽', range: '30/9 – 4/10', rangeEn: '9/30 – 10/4', col: 'brothers_items', exp: 'expenses', people: ['dor', 'moti', 'ben'],
    destHe: 'ניו יורק', destEn: 'New York', photo: 'Statue_of_Liberty_7.jpg', pos: 'center 25%', colors: ['#16917D', '#F07B3F', '#E4506F', '#7B61FF', '#2B8FE0'] },
  mba: { he: 'MBA', en: 'MBA', longHe: 'משלחת ה־MBA', longEn: 'MBA trip', emoji: '🏙️', range: '4/10 – 10/10', rangeEn: '10/4 – 10/10', col: 'mba_items',
    destHe: 'המשלחת', destEn: 'the MBA trip', photo: 'View_of_Empire_State_Building_from_Rockefeller_Center_New_York_City_dllu.jpg', pos: 'center 40%', colors: ['#3955D6', '#16917D', '#F07B3F', '#E4506F', '#7B61FF', '#D99A1E', '#2B8FE0'] },
  boston: { he: 'בוסטון', en: 'Boston', longHe: 'מוטי ובן בבוסטון', longEn: 'Moti & Ben in Boston', emoji: '🍂', range: '5/10 – 7/10', rangeEn: '10/5 – 10/7', col: 'boston_items', exp: 'boston_expenses', people: ['moti', 'ben'],
    destHe: 'בוסטון', destEn: 'Boston', photo: 'Charles_River_Esplanade_Boston_May_2018_panorama.jpg', pos: 'center 50%', colors: ['#D96A2B', '#2B8FE0', '#16917D'] }
};
const KIND = { food: '🍽️', sight: '🗽', show: '🎭', hotel: '🏨', transport: '🚗', meeting: '💼', bar: '🍺', shop: '🛍️', sport: '🏃', game: '🏀', free: '☕', event: '🎉', brief: '📝', nature: '🌲', custom: '📍' };
const DEPARTURE = new Date('2026-09-30T01:00:00+03:00');
const STARTS = { brothers: '2026-09-30T14:00:00-04:00', mba: '2026-10-04T15:00:00-04:00', boston: '2026-10-05T07:00:00-04:00' };
const AIRPORT = {
  TLV: ['+03:00', 'תל אביב', 'Tel Aviv'], JFK: ['-04:00', 'ניו יורק', 'New York'], EWR: ['-04:00', 'ניוארק', 'Newark'], LGA: ['-04:00', 'ניו יורק', 'New York'],
  MSP: ['-05:00', 'מיניאפוליס', 'Minneapolis'], ORD: ['-05:00', 'שיקגו', 'Chicago'], DTW: ['-04:00', 'דטרויט', 'Detroit'], ATL: ['-04:00', 'אטלנטה', 'Atlanta'], BOS: ['-04:00', 'בוסטון', 'Boston'],
  CDG: ['+02:00', 'פריז', 'Paris'], LHR: ['+01:00', 'לונדון', 'London'], FRA: ['+02:00', 'פרנקפורט', 'Frankfurt'], IST: ['+03:00', 'איסטנבול', 'Istanbul'], ATH: ['+03:00', 'אתונה', 'Athens']
};
const AIRLINE = { LY: ['אל על', 'El Al'], DL: ['דלתא', 'Delta'], AF: ['אייר פראנס', 'Air France'], UA: ['יונייטד', 'United'], AA: ['אמריקן', 'American'], LH: ['לופטהנזה', 'Lufthansa'], BA: ['בריטיש', 'British Airways'], TK: ['טורקיש', 'Turkish'], IZ: ['ישראייר', 'Israir'], '6H': ['ארקיע', 'Arkia'], B6: ['ג׳טבלו', 'JetBlue'], WN: ['סאות׳ווסט', 'Southwest'], NK: ['ספיריט', 'Spirit'], SY: ['סאן קאנטרי', 'Sun Country'] };
const WD = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'], WD_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ---------------- state ----------------
const S = { uid: null, me: null, lang: 'he', world: 'brothers', view: 'home', day: {}, tab: 'tasks', mapDay: 'all',
  items: { brothers: [], mba: [], boston: [] }, expenses: { brothers: [], boston: [] }, tasks: [], flights: [], packing: [], notes: '', rate: 3.7, weather: {}, unsubs: [] };

// ---------------- firebase ----------------
const app = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
const db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });

// ---------------- i18n & utils ----------------
const L = (he, en) => S.lang === 'en' ? en : he;
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const bdi = s => `<bdi>${esc(s)}</bdi>`;
const safeUrl = u => /^https?:\/\//i.test(u || '') ? u : '';
const HEB = /[\u0590-\u05FF]/;
const TR = { cache: JSON.parse(localStorage.getItem('nyc26_tr') || '{}'), queue: [], busy: false };
function autoTr(v) {
  if (TR.cache[v]) return TR.cache[v];
  if (!TR.queue.includes(v)) { TR.queue.push(v); runTr(); }
  return v;
}
async function runTr() {
  if (TR.busy) return; TR.busy = true;
  while (TR.queue.length) {
    const v = TR.queue.shift();
    try {
      const r = await (await fetch(`https://api.mymemory.translated.net/get?langpair=he|en&q=${encodeURIComponent(v)}`)).json();
      const t = r?.responseData?.translatedText;
      if (t && !HEB.test(t)) { TR.cache[v] = t; localStorage.setItem('nyc26_tr', JSON.stringify(TR.cache)); refresh(); }
    } catch (e) {}
  }
  TR.busy = false;
}
const tr = (o, k) => { if (!o) return ''; const v = o[k] || ''; if (S.lang !== 'en') return v; if (o[k + 'En']) return o[k + 'En']; return HEB.test(v) ? autoTr(v) : v; };
const pname = p => PEOPLE[p] ? L(PEOPLE[p].he, PEOPLE[p].en) : L('המקור', 'original');
const wname = w => L(WORLDS[w].he, WORLDS[w].en);
const readonly = () => S.me === 'sydney';
const canEdit = w => !readonly() && EDITORS[w].includes(S.me);

function tzParts(tz, d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}`, hour: +p.hour };
}
const nyNow = () => tzParts('America/New_York');
const ilNow = () => tzParts('Asia/Jerusalem');
const nowKey = () => { const n = nyNow(); return `${n.date} ${n.time}`; };
const key = it => `${it.date} ${it.time || '00:00'}`;
const fmtDay = (date, wd = true) => { const d = new Date(date + 'T12:00:00'), m = d.getMonth() + 1, dd = d.getDate(); return S.lang === 'en' ? `${wd ? WD_EN[d.getDay()] + ' ' : ''}${m}/${dd}` : `${wd ? WD[d.getDay()] + ' ' : ''}${dd}/${m}`; };
const addMin = (t, m) => { const [h, mi] = t.split(':').map(Number); const x = h * 60 + mi + m; return `${String(Math.floor(x / 60) % 24).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`; };
const ago = ms => { const s = (Date.now() - ms) / 1000; return s < 60 ? L('עכשיו', 'just now') : s < 3600 ? L(`לפני ${Math.round(s / 60)} דק׳`, `${Math.round(s / 60)} min ago`) : s < 86400 ? L(`לפני ${Math.round(s / 3600)} שע׳`, `${Math.round(s / 3600)} h ago`) : L(`לפני ${Math.round(s / 86400)} ימים`, `${Math.round(s / 86400)} days ago`); };
const dirUrl = a => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(a)}&travelmode=${S.world === 'boston' ? 'driving' : 'transit'}`;
const routeUrl = list => 'https://www.google.com/maps/dir/' + list.map(a => encodeURIComponent(a)).join('/');
const liSearch = (n, c) => `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${n} ${c}`)}`;
const frUrl = code => `https://www.flightradar24.com/data/flights/${String(code).replace(/\s+/g, '').toLowerCase()}`;
async function sha(s) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
const pinHash = (p, pin) => sha(`nyc26:${p}:${pin}`);
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2200); }
const money = usd => { const v = Math.abs(usd); return `<bdi class="amt">$${v.toFixed(v % 1 ? 2 : 0)}</bdi>`; };
const days = w => SEED.days[w];
const dayIndex = (w, d) => days(w).findIndex(x => x.date === d);
const dayColor = (w, d) => WORLDS[w].colors[Math.max(0, dayIndex(w, d)) % WORLDS[w].colors.length];
const itemsOf = (w, d) => S.items[w].filter(i => !d || i.date === d).sort((a, b) => key(a).localeCompare(key(b)));
const kindOf = i => KIND[i.kind] || KIND.custom;
const IC = {
  menu: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h10"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
  cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="m8 12 3 3 5-6"/></svg>',
  money: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="6" width="20" height="13" rx="3"/><circle cx="12" cy="12.5" r="2.5"/><path d="M6 9.5v6M18 9.5v6"/></svg>',
  people: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6"/></svg>',
  bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M5 8h14l-1 13H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
  plus: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  nav: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M21 3 3 10.5l7.5 3L13.5 21z"/></svg>',
  plane: '<svg class="pl" width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/></svg>'
};

// ---------------- theme / lang ----------------
function applyTheme() { document.documentElement.dataset.theme = localStorage.getItem('nyc26_theme') || 'light'; }
function applyLang() { const h = document.documentElement; h.lang = S.lang; h.dir = S.lang === 'en' ? 'ltr' : 'rtl'; document.title = 'NYC 2026'; }
applyTheme();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});

// ---------------- boot ----------------
window.__step = 'התחברות לפיירבייס';
onAuthStateChanged(auth, async user => {
  if (!user) { window.__step = 'כניסה אנונימית'; signInAnonymously(auth).catch(fatal); return; }
  S.uid = user.uid; window.__step = 'קריאה מהדאטהבייס';
  try {
    const ses = await getDoc(doc(db, 'sessions', S.uid));
    if (ses.exists() && PEOPLE[ses.data().profile]) start(ses.data().profile); else showLogin();
  } catch (e) { showLogin(); }
});
function fatal(e) { console.error(e); $('#app').innerHTML = `<div class="login"><div class="panel" style="margin-top:20vh"><h1>${L('אין חיבור', 'No connection')}</h1><p>${esc(e.code || '')} ${esc(e.message)}</p><button class="btn" onclick="location.reload()">${L('לנסות שוב', 'Try again')}</button></div></div>`; }

// ---------------- login ----------------
const loginPhoto = () => `<div class="photo"><img src="${PHOTO(WORLDS.brothers.photo)}" alt="" onerror="this.remove()"></div>`;
async function showLogin() {
  S.lang = 'he'; applyLang();
  let setupDone = false;
  try { setupDone = (await getDoc(doc(db, 'meta', 'setup'))).exists(); } catch (e) {}
  const el = $('#app');
  if (!setupDone) {
    const three = ['dor', 'moti', 'ben'];
    el.innerHTML = `<div class="login">${loginPhoto()}<div class="panel setup"><h1>הגדרה ראשונה</h1><p>קובעים קוד של 4 ספרות לכל אחד.</p>
      <form id="setup">${three.map(k => `<label for="pin-${k}">הקוד של ${PEOPLE[k].he}</label><input id="pin-${k}" name="${k}" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" required autocomplete="off">`).join('')}
      <button class="btn block" style="margin-top:22px">שמירה והתחלה</button></form></div></div>`;
    $('#setup').onsubmit = async e => {
      e.preventDefault(); const f = new FormData(e.target);
      try { for (const k of three) await setDoc(doc(db, 'users', k), { pinHash: await pinHash(k, f.get(k)) }); await setDoc(doc(db, 'meta', 'setup'), { at: Date.now() }); showLogin(); }
      catch (err) { toast('השמירה נכשלה. בדוק שחוקי האבטחה הועלו'); }
    };
    return;
  }
  const sub = { dor: 'האחים וה־MBA', moti: 'האחים ובוסטון', ben: 'האחים ובוסטון', sydney: 'View only · English' };
  el.innerHTML = `<div class="login">${loginPhoto()}<div class="panel"><h1>ניו יורק 2026</h1><p>מי נכנס? · Who's this?</p>
    ${Object.entries(PEOPLE).map(([k, p]) => `<button class="who-btn" data-who="${k}" ${k === 'sydney' ? 'dir="ltr" lang="en" style="text-align:left"' : ''}><span class="avatar" style="--c:${p.color}">${k === 'sydney' ? 'S' : p.he[0]}</span><span>${k === 'sydney' ? p.en : p.he}<span class="sub">${sub[k]}</span></span></button>`).join('')}</div></div>`;
  el.querySelectorAll('[data-who]').forEach(b => b.onclick = () => showPin(b.dataset.who));
}
function showPin(profile) {
  S.lang = profile === 'sydney' ? 'en' : 'he'; applyLang();
  const p = PEOPLE[profile]; let pin = '';
  $('#app').innerHTML = `<div class="login">${loginPhoto()}<div class="panel" style="text-align:center">
    <span class="avatar" style="--c:${p.color};width:64px;height:64px;font-size:26px;margin:0 auto 10px">${L(p.he[0], p.en[0])}</span>
    <h1>${L('היי', 'Hi')} ${pname(profile)}</h1><p>${L('הקוד שלך', 'Enter your code')}</p>
    <div class="pin-dots" aria-live="polite"><i></i><i></i><i></i><i></i></div>
    <div class="pad-grid">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-n="${n}">${n}</button>`).join('')}<button class="ghost" data-back>${L('חזרה', 'Back')}</button><button data-n="0">0</button><button class="ghost" data-del>${L('מחק', 'Delete')}</button></div></div></div>`;
  const dots = () => $('.pin-dots').querySelectorAll('i').forEach((d, i) => d.classList.toggle('on', i < pin.length));
  const submit = async () => {
    try { await setDoc(doc(db, 'sessions', S.uid), { profile, pinHash: await pinHash(profile, pin), at: Date.now() }); start(profile); }
    catch (e) { pin = ''; dots(); const d = $('.pin-dots'); d.classList.remove('shake'); void d.offsetWidth; d.classList.add('shake'); toast(L('קוד שגוי', 'Wrong code')); }
  };
  $('.pad-grid').onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.back !== undefined) return showLogin();
    if (b.dataset.del !== undefined) pin = pin.slice(0, -1); else if (b.dataset.n && pin.length < 4) pin += b.dataset.n;
    dots(); if (pin.length === 4) submit();
  };
}
async function logout() { S.unsubs.forEach(u => u()); S.unsubs = []; try { await deleteDoc(doc(db, 'sessions', S.uid)); } catch (e) {} S.me = null; closeDrawer(); showLogin(); }

// ---------------- start & data ----------------
function defaultWorld() {
  const saved = localStorage.getItem('nyc26_world_' + S.me);
  if (saved && ACCESS[S.me].includes(saved)) return saved;
  if (S.me === 'dor') return nowKey() >= '2026-10-04 15:00' ? 'mba' : 'brothers';
  return nyNow().date >= '2026-10-05' ? 'boston' : 'brothers';
}
async function start(profile) {
  S.me = profile; S.lang = profile === 'sydney' ? 'en' : 'he'; applyLang();
  S.world = defaultWorld();
  const n = nyNow().date;
  for (const w of Object.keys(WORLDS)) { const ds = days(w).map(d => d.date); S.day[w] = ds.includes(n) ? n : (n > ds.at(-1) ? ds.at(-1) : ds[0]); }
  shell(); subscribe();
  migrate().catch(e => console.error('migrate', e));
  fetchRate(); fetchWeather();
  setInterval(tick, 30000);
}
function subscribe() {
  const on = (ref, fn) => S.unsubs.push(onSnapshot(ref, fn, e => console.error(e)));
  const rows = s => s.docs.map(d => ({ id: d.id, ...d.data() }));
  for (const w of ACCESS[S.me]) {
    on(collection(db, WORLDS[w].col), s => { S.items[w] = rows(s); refresh(); });
    if (WORLDS[w].exp && canEdit(w)) on(collection(db, WORLDS[w].exp), s => { S.expenses[w] = rows(s); refresh(); });
  }
  const P = c => collection(db, 'personal', S.me, c);
  on(P('tasks'), s => { S.tasks = rows(s); refresh(); });
  on(P('flights'), s => { S.flights = rows(s); refresh(); });
  on(P('packing'), s => { S.packing = rows(s); refresh(); });
  on(doc(db, 'personal', S.me, 'notes', 'main'), s => { if (document.activeElement?.id !== 'notes') { S.notes = s.data()?.text || ''; refresh(); } });
}
const OLD_B30 = 'איסוף מזוודות. מוטי ובן מתקפלים, דור ממשיך למשלחת';
async function migrate() {
  if (readonly()) return;
  const stamp = { updatedBy: 'seed', updatedAt: Date.now(), history: [] };
  const all = async c => (await getDocs(collection(db, c))).docs;
  const seedCol = async (c, list) => { const b = writeBatch(db); list.forEach(({ id, ...it }) => b.set(doc(db, c, id), { status: 'none', ...it, ...stamp })); await b.commit(); };
  if (EDITORS.brothers.includes(S.me)) {
    const docs = await all('brothers_items');
    if (!docs.length) await seedCol('brothers_items', SEED.brothers);
    else if (!(await getDoc(doc(db, 'migrations', 'brothers_v3'))).exists()) {
      const cur = Object.fromEntries(docs.map(d => [d.id, d.data()]));
      const b = writeBatch(db);
      for (const s of SEED.brothers) {
        const c = cur[s.id];
        if (!c) { if (s.id === 'b31') { const { id, ...it } = s; b.set(doc(db, 'brothers_items', id), { status: 'none', ...it, ...stamp }); } continue; }
        const up = {};
        if (s.titleEn && c.title === s.title) up.titleEn = s.titleEn;
        if (s.id === 'b30' && c.desc === OLD_B30) { up.desc = s.desc; up.descEn = s.descEn; }
        else if (s.descEn && c.desc === s.desc) up.descEn = s.descEn;
        if (s.notesEn && c.notes === s.notes) up.notesEn = s.notesEn;
        if (s.id === 'b14' && c.date === '2026-10-01' && c.time === '15:00') up.time = '15:45';
        if (Object.keys(up).length) b.update(doc(db, 'brothers_items', s.id), up);
      }
      b.set(doc(db, 'migrations', 'brothers_v3'), { at: Date.now(), by: S.me });
      await b.commit();
    }
  }
  if (S.me === 'dor' && !(await all('mba_items')).length) await seedCol('mba_items', SEED.mba);
  if (EDITORS.boston.includes(S.me) && !(await all('boston_items')).length) await seedCol('boston_items', SEED.boston);
  const flag = doc(db, 'personal', S.me, 'meta', 'seeded');
  if (!(await getDoc(flag)).exists()) {
    const b = writeBatch(db);
    (SEED.flights[S.me] || []).forEach(({ id, ...f }) => b.set(doc(db, 'personal', S.me, 'flights', id), f));
    (SEED.tasks[S.me] || []).forEach(({ id, ...t }) => b.set(doc(db, 'personal', S.me, 'tasks', id), { done: false, ...t }));
    SEED.packing.forEach((t, i) => b.set(doc(db, 'personal', S.me, 'packing', 'p' + String(i).padStart(2, '0')), { text: t, done: false, order: i }));
    b.set(flag, { at: Date.now() }); await b.commit();
  }
  const v3 = doc(db, 'personal', S.me, 'meta', 'v3');
  if (!(await getDoc(v3)).exists()) {
    const b = writeBatch(db);
    (SEED.flights[S.me] || []).forEach(f => b.set(doc(db, 'personal', S.me, 'flights', f.id), { carrier: f.carrier }, { merge: true }));
    if (EDITORS.boston.includes(S.me)) SEED.bostonTasks.forEach(({ id, ...t }) => b.set(doc(db, 'personal', S.me, 'tasks', id), { done: false, ...t }));
    b.set(v3, { at: Date.now() }); await b.commit();
  }
}
async function fetchRate() { try { const r = await (await fetch('https://open.er-api.com/v6/latest/USD')).json(); if (r?.rates?.ILS) { S.rate = r.rates.ILS; refresh(); } } catch (e) {} }
async function fetchWeather() {
  const spots = { ny: [40.75, -73.99], bos: [42.36, -71.06] };
  for (const [k, [la, lo]] of Object.entries(spots)) {
    try {
      const r = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=America%2FNew_York&forecast_days=16`)).json();
      S.weather[k] = {}; r.daily.time.forEach((d, i) => S.weather[k][d] = { code: r.daily.weather_code[i], max: Math.round(r.daily.temperature_2m_max[i]), min: Math.round(r.daily.temperature_2m_min[i]), rain: r.daily.precipitation_probability_max[i] });
      refresh();
    } catch (e) {}
  }
}
function wx(date, w = S.world) {
  const cityW = S.weather[w === 'boston' ? 'bos' : 'ny'] || {}, x = cityW[date]; if (!x) return '';
  const c = x.code, [e, he, en] = c === 0 ? ['☀️', 'בהיר', 'Clear'] : c <= 2 ? ['🌤️', 'מעונן חלקית', 'Partly cloudy'] : c === 3 ? ['☁️', 'מעונן', 'Cloudy'] : c <= 48 ? ['🌫️', 'ערפל', 'Fog'] : c <= 67 || (c >= 80 && c <= 82) ? ['🌧️', 'גשם', 'Rain'] : c <= 77 ? ['🌨️', 'שלג', 'Snow'] : ['⛈️', 'סופה', 'Storm'];
  const t = S.lang === 'en' ? `${Math.round(x.min * 9 / 5 + 32)}–${Math.round(x.max * 9 / 5 + 32)}°F` : `${x.min}°–${x.max}°`;
  return `<span class="wx">${e} ${L(he, en)} · <bdi>${t}</bdi>${x.rain >= 40 ? ` · ${x.rain}% ${L('גשם', 'rain')}` : ''}</span>`;
}

// ---------------- shell ----------------
function tabs() {
  const w = S.world, base = [['home', L('בית', 'Home'), IC.home], ['schedule', L('לו"ז', 'Schedule'), IC.cal], ['map', L('מפה', 'Map'), IC.map], ['tasks', L('משימות', 'To-do'), IC.check]];
  if (readonly()) return [...base, ['personal', 'My stuff', IC.bag]];
  return [...base, w === 'mba' ? ['people', 'אנשים', IC.people] : ['expenses', 'הוצאות', IC.money]];
}
const TITLES = () => ({ home: '', schedule: L('הלו"ז', 'Schedule'), map: L('מפה', 'Map'), tasks: L('משימות', 'To-do'), expenses: 'הוצאות משותפות', people: 'הדוברים', flights: L('הטיסות שלי', 'My flights'), personal: L('האזור שלי', 'My stuff'), settings: L('הגדרות', 'Settings') });
function shell() {
  document.documentElement.dataset.world = S.world;
  $('#app').innerHTML = `<header class="appbar" id="bar"></header><main id="main"></main>
    <button class="fab" id="fab" hidden></button><nav class="tabbar" id="tabs" aria-label="${L('ניווט ראשי', 'Main navigation')}"></nav>
    <div class="scrim" id="scrim"></div><nav class="drawer" id="drawer" aria-label="${L('תפריט', 'Menu')}"></nav>`;
  $('#scrim').onclick = closeDrawer;
  $('#fab').onclick = () => fabFor(S.view)?.[1]();
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeSheet(); closeDrawer(); } });
  window.addEventListener('scroll', () => $('#bar')?.classList.toggle('scrolled', scrollY > 4), { passive: true });
  render();
}
let raf; function refresh() { cancelAnimationFrame(raf); raf = requestAnimationFrame(render); }
function tick() { renderBar(); if (S.view === 'home' || S.view === 'schedule') render(); }
function fabFor(v) { const f = FAB[v]; if (!f) return null; if (f.world && !canEdit(S.world)) return null; if (v === 'personal' && S.tab !== 'tasks') return null; return f; }
function render() {
  if (!S.me || !$('#main')) return;
  document.documentElement.dataset.world = S.world;
  renderBar(); renderTabs();
  if (S.view === 'personal' && document.activeElement?.id === 'notes') return;
  if (S.view === 'map' && MAP.inst && $('#map')) { updateMap(); return; }
  $('#main').innerHTML = (VIEWS[S.view] || VIEWS.home)();
  const f = fabFor(S.view); $('#fab').hidden = !f; if (f) $('#fab').innerHTML = `${IC.plus}<span>${f[0]()}</span>`;
  AFTER[S.view]?.();
}
function renderBar() {
  const ny = nyNow(), il = ilNow(), w = WORLDS[S.world];
  const title = S.view === 'home' ? `${w.emoji} ${wname(S.world)}` : TITLES()[S.view];
  $('#bar').innerHTML = `<div class="appbar-row"><button class="icon-btn" id="menu" aria-label="${L('פתיחת תפריט', 'Open menu')}">${IC.menu}</button><h1>${title}</h1>
    <div class="timechip"><b><bdi>${ny.time}</bdi> 🇺🇸</b>${S.lang === 'en' ? '<span>NY time</span>' : `<span><bdi>${il.time}</bdi> 🇮🇱</span>`}</div></div>`;
  $('#menu').onclick = openDrawer;
}
function renderTabs() {
  $('#tabs').innerHTML = `<ul>${tabs().map(([k, l, ic]) => `<li><button data-view="${k}" ${S.view === k ? 'aria-current="page"' : ''}><span class="ic">${ic}</span>${l}</button></li>`).join('')}</ul>`;
  $('#tabs').querySelectorAll('[data-view]').forEach(b => b.onclick = () => go(b.dataset.view));
}
function openDrawer() {
  const w = S.world, need = S.items[w].filter(i => i.status === 'need').length;
  const fifth = readonly() ? null : w === 'mba' ? ['people', 'הדוברים', '🤝'] : ['expenses', 'הוצאות משותפות', '💵'];
  const nav = [['home', L('בית', 'Home'), '🏠'], ['schedule', L('לו"ז', 'Schedule'), '🗓️'], ['map', L('מפה', 'Map'), '🗺️'], ['tasks', L('משימות והזמנות', 'To-do & bookings'), '✅', need], fifth, ['-'], ['flights', L('הטיסות שלי', 'My flights'), '✈️'], ['personal', L('האזור שלי', 'My stuff'), '🎒'], ['settings', L('הגדרות', 'Settings'), '⚙️']].filter(Boolean);
  $('#drawer').innerHTML = `<div class="who"><span class="avatar" style="--c:${PEOPLE[S.me].color}">${pname(S.me)[0]}</span><div><b>${pname(S.me)}</b><div class="small muted">${L('ניו יורק 2026', 'NYC 2026')}${readonly() ? ' · View only' : ''}</div></div></div>
    <div class="worlds" role="group">${ACCESS[S.me].map(k => { const x = WORLDS[k]; return `<button data-world="${k}" aria-pressed="${k === w}"><span class="em">${x.emoji}</span><b>${wname(k)}</b><small><bdi>${L(x.range, x.rangeEn)}</bdi></small></button>`; }).join('')}</div>
    <ul class="nav">${nav.map(([k, l, e, c]) => k === '-' ? '<li class="sep" role="separator"></li>' : `<li><button data-view="${k}" ${k === S.view ? 'aria-current="page"' : ''}><span class="e">${e}</span>${l}${c ? `<span class="count">${c}</span>` : ''}</button></li>`).join('')}</ul>`;
  $('#drawer').querySelectorAll('[data-view]').forEach(b => b.onclick = () => go(b.dataset.view));
  $('#drawer').querySelectorAll('[data-world]').forEach(b => b.onclick = () => { setWorld(b.dataset.world); openDrawer(); });
  $('#drawer').classList.add('open'); $('#scrim').classList.add('open');
}
function setWorld(w) {
  S.world = w; localStorage.setItem('nyc26_world_' + S.me, w);
  if (S.view === 'expenses' && !WORLDS[w].exp) S.view = 'home';
  if (S.view === 'people' && w !== 'mba') S.view = 'home';
  S.mapDay = 'all'; MAP.inst = null; render();
}
function closeDrawer() { $('#drawer')?.classList.remove('open'); $('#scrim')?.classList.remove('open'); }
function go(v) { MAP.inst = null; S.view = v; closeDrawer(); render(); scrollTo({ top: 0 }); }

// ---------------- sheet ----------------
function openSheet(html, mount) {
  $('#sheet-root').innerHTML = `<div class="sheet-scrim" data-close></div><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div>`;
  $('#sheet-root [data-close]').onclick = closeSheet;
  $('#sheet-root').querySelectorAll('[data-dismiss]').forEach(b => b.onclick = closeSheet);
  mount?.($('#sheet-root .sheet'));
}
function closeSheet() { $('#sheet-root').innerHTML = ''; }

// ---------------- items ----------------
const TRACK = ['title', 'titleEn', 'date', 'time', 'end', 'desc', 'descEn', 'address', 'status', 'link', 'linkLabel', 'conf', 'notes', 'notesEn', 'speaker', 'role', 'linkedin'];
async function saveItem(w, id, data) {
  const col = WORLDS[w].col;
  if (!id) { await addDoc(collection(db, col), { status: 'none', kind: 'custom', ...data, updatedBy: S.me, updatedAt: Date.now(), history: [] }); return; }
  const cur = S.items[w].find(i => i.id === id) || {};
  const prev = Object.fromEntries(TRACK.filter(k => cur[k] !== undefined).map(k => [k, cur[k]]));
  const history = [{ by: cur.updatedBy || 'seed', at: cur.updatedAt || Date.now(), prev }, ...(cur.history || [])].slice(0, 8);
  const extra = {};
  if (data.address !== undefined && data.address !== cur.address) Object.assign(extra, { lat: null, lng: null });
  for (const k of ['title', 'desc', 'notes']) if (data[k] !== undefined && data[k] !== cur[k] && data[k + 'En'] === undefined) extra[k + 'En'] = '';
  await updateDoc(doc(db, col, id), { ...data, ...extra, updatedBy: S.me, updatedAt: Date.now(), history });
}
function openItem(w, id) { canEdit(w) ? editItem(w, id) : viewItem(w, id); }

// ---------------- flights ----------------
const carrierOf = f => (f.carrier || String(f.code).replace(/\s+/g, '').slice(0, 2)).toUpperCase();
const logoHtml = f => { const c = esc(carrierOf(f)); return `<span class="logo-wrap"><img src="https://images.kiwi.com/airlines/64/${c}.png" alt="" onerror="if(!this.dataset.b){this.dataset.b=1;this.src='https://pics.avs.io/80/80/${c}.png'}else{this.parentNode.innerHTML='<span>${c}</span>'}"></span>`; };
const fTime = (f, w) => { const v = f[w], ap = w === 'dep' ? f.from : f.to; return v ? new Date(v + ':00' + (AIRPORT[ap]?.[0] || '-04:00')) : null; };
const apCity = c => AIRPORT[c] ? L(AIRPORT[c][1], AIRPORT[c][2]) : '';
function flightCard(f, full) {
  const dep = fTime(f, 'dep'), arr = fTime(f, 'arr'), now = Date.now();
  const dur = dep && arr ? Math.round((arr - dep) / 6e4) : null, left = dep ? dep - now : 0;
  let badge = '', prog = 0;
  if (dep) {
    if (left > 864e5 * 2) badge = `<span class="badge">${L(`בעוד ${Math.ceil(left / 864e5)} ימים`, `in ${Math.ceil(left / 864e5)} days`)}</span>`;
    else if (left > 0) badge = `<span class="badge">${L('בעוד', 'in')} ${Math.floor(left / 36e5)}:${String(Math.floor(left / 6e4) % 60).padStart(2, '0')} ${L('שע׳', 'h')}</span>`;
    else if (arr && arr > now) { prog = (now - dep) / (arr - dep); badge = `<span class="badge air">${L('באוויר', 'In the air')}</span>`; }
    else { prog = 1; badge = `<span class="badge done">${L('נחתה', 'Landed')}</span>`; }
  }
  const al = AIRLINE[carrierOf(f)], airline = S.lang === 'en' ? (al?.[1] || carrierOf(f)) : (f.airline || al?.[0] || carrierOf(f));
  const t = s => s ? s.slice(11, 16) : '—', d = s => s ? fmtDay(s.slice(0, 10)) : '';
  return `<article class="flight ${full ? 'full' : ''}">
    <div class="top">${logoHtml(f)}<div class="grow"><div class="airline">${esc(airline)}</div><div class="code"><bdi>${esc(f.code)}</bdi>${f.alt ? ` · <bdi>${esc(f.alt)}</bdi>` : ''}</div></div>${badge}</div>
    <div class="route">
      <div class="ap"><b><bdi>${esc(f.from)}</bdi></b><span class="t"><bdi>${t(f.dep)}</bdi></span><small>${esc(apCity(f.from))} · ${d(f.dep)}</small></div>
      <div class="path"><span class="dot s"></span><span class="plane" style="--p:${Math.round(prog * 100)}%">${IC.plane}</span><span class="dot e"></span>${dur ? `<span class="dur">${Math.floor(dur / 60)}${L(' שע׳', 'h')} ${dur % 60 ? `${dur % 60}${L(' דק׳', 'm')}` : ''}</span>` : ''}</div>
      <div class="ap to"><b><bdi>${esc(f.to)}</bdi></b><span class="t"><bdi>${t(f.arr)}</bdi></span><small>${esc(apCity(f.to))} · ${d(f.arr)}</small></div>
    </div>
    <div class="foot"><span class="meta">${f.conf ? `${L('הזמנה', 'Booking')} <bdi>${esc(f.conf)}</bdi>` : ''}${f.seat ? ` · ${L('מושב', 'Seat')} <bdi>${esc(f.seat)}</bdi>` : ''}</span>
      <a class="btn sm soft" href="${frUrl(f.code)}" target="_blank" rel="noopener">${L('סטטוס חי', 'Live status')}</a>${full ? `<button class="btn sm line" data-flight="${f.id}">${L('עריכה', 'Edit')}</button>` : ''}</div></article>`;
}
const sortedFlights = () => [...S.flights].sort((a, b) => (a.dep || '').localeCompare(b.dep || ''));

// ---------------- views ----------------
const VIEWS = {}, AFTER = {}, FAB = {};
function hero() {
  const w = S.world, W = WORLDS[w], now = Date.now();
  const startAt = (w === 'brothers' && ['dor', 'moti'].includes(S.me)) ? DEPARTURE : new Date(STARTS[w]);
  const h = (now < DEPARTURE && S.lang !== 'en' ? ilNow() : nyNow()).hour;
  const hi = h < 5 || h >= 21 ? L('לילה טוב', 'Good evening') : h < 12 ? L('בוקר טוב', 'Good morning') : h < 17 ? L('צהריים טובים', 'Good afternoon') : L('ערב טוב', 'Good evening');
  const today = days(w).find(x => x.date === nyNow().date);
  let title, sub;
  if (now < startAt) {
    const d = Math.ceil((startAt - now) / 864e5);
    title = d <= 1 ? L(`מחר ${W.destHe}!`, `${W.destEn} tomorrow!`) : L(`עוד ${d} ימים ל${W.destHe}`, `${d} days to ${W.destEn}`);
    sub = startAt === DEPARTURE ? 'המראה ב־30/9 בשעה 01:00 מנתב״ג' : `${L('מתחילים', 'Starts')} ${fmtDay(days(w)[0].date)} · ${tr(days(w)[0], 'title')}`;
  } else if (today) { title = tr(today, 'title'); sub = `${L('יום', 'Day')} ${dayIndex(w, today.date) + 1} · ${fmtDay(today.date)}`; }
  else { title = L(W.longHe, W.longEn); sub = L(W.range, W.rangeEn); }
  const worlds = ACCESS[S.me];
  return `<section class="hero"><img src="${PHOTO(W.photo)}" alt="" style="object-position:${W.pos}" onerror="this.remove()">
    <div class="worldtoggle" role="group">${worlds.map(k => `<button data-world="${k}" aria-pressed="${k === w}">${wname(k)}</button>`).join('')}</div>
    <div class="in"><p class="hi">${hi}, ${pname(S.me)}</p><h2>${esc(title)}</h2><p class="sub">${esc(sub)}</p></div></section>`;
}
VIEWS.home = () => {
  const w = S.world, nk = nowKey(), fl = sortedFlights();
  const flights = readonly() && !fl.length ? '' : `<div class="sec"><h2>✈️ ${L('הטיסות שלך', 'Your flights')}</h2><button data-go="flights">${L('הכול', 'All')}</button></div>
    <div class="scroller">${fl.map(f => flightCard(f)).join('')}<button class="add-flight" data-addflight>${IC.plus}${L('הוספת טיסה', 'Add a flight')}</button></div>`;
  const all = itemsOf(w), nxt = all.find(i => key(i) > nk);
  const cur = [...all].reverse().find(i => key(i) <= nk && nk < `${i.date} ${i.end || addMin(i.time || '00:00', 60)}`);
  const first = !all.some(i => key(i) <= nk);
  const next = nxt ? `<div class="sec"><h2>📍 ${first ? L('התחנה הראשונה', 'First stop') : L('הבא בתור', 'Up next')}</h2><button data-go="schedule">${L('ללו"ז', 'Schedule')}</button></div>
    <section class="next"><div class="label"><span>${nxt.date === nyNow().date ? L('היום', 'Today') : fmtDay(nxt.date)} · <bdi>${esc(nxt.time)}</bdi></span>${nxt.status === 'need' ? `<span class="chip need">${L('צריך להזמין', 'Needs booking')}</span>` : ''}</div>
      <div class="main"><span class="kind" style="background:color-mix(in srgb,${dayColor(w, nxt.date)} 16%,transparent)">${kindOf(nxt)}</span><div class="grow"><h3>${bdi(tr(nxt, 'title'))}</h3>${nxt.desc || nxt.speaker ? `<p class="d">${bdi(tr(nxt, 'desc') || nxt.speaker)}</p>` : ''}</div></div>
      <div class="actions">${nxt.address ? `<a class="btn" href="${dirUrl(nxt.address)}" target="_blank" rel="noopener">${IC.nav} ${L('איך מגיעים', 'Directions')}</a>` : ''}${safeUrl(nxt.link) ? `<a class="btn soft" href="${esc(nxt.link)}" target="_blank" rel="noopener">${esc(S.lang === 'en' ? nxt.linkLabelEn || 'Link' : nxt.linkLabel || 'קישור')}</a>` : ''}<button class="btn line" data-open="${nxt.id}">${L('פרטים', 'Details')}</button></div>
      ${cur ? `<div class="nowline">${L('עכשיו', 'Now')}: ${bdi(tr(cur, 'title'))}</div>` : ''}</section>` : '';
  const today = days(w).find(d => d.date === nyNow().date);
  const need = all.filter(i => i.status === 'need');
  const tasks = S.tasks.filter(t => !t.done && (t.world === w || t.world === 'general' || !t.world)).sort((a, b) => (a.due || '9').localeCompare(b.due || '9')).slice(0, 4);
  const mine = w === 'mba' ? all.filter(i => i.mine) : [];
  return `${hero()}${flights}${next}
    ${today && (today.dress || wx(today.date)) ? `<div class="card pad" style="margin-top:12px"><div class="row" style="flex-wrap:wrap">${today.dress ? `<span class="chip dress">👔 קוד לבוש: ${esc(today.dress)}</span>` : ''}${wx(today.date)}</div></div>` : ''}
    ${mine.length ? `<div class="sec"><h2>⭐ המשימה שלי</h2></div><div class="card">${mine.map(i => `<div class="li"><span class="kind sm" style="background:var(--sun-soft)">${kindOf(i)}</span><div class="main" data-open="${i.id}"><div class="title">${bdi(i.title)}</div><div class="sub">${fmtDay(i.date)} · <bdi>${esc(i.time)}</bdi>${i.notes ? ` · ${bdi(i.notes)}` : ''}</div></div></div>`).join('')}</div>` : ''}
    ${need.length ? `<div class="sec"><h2>🎟️ ${L('צריך להזמין', 'Still to book')} (${need.length})</h2><button data-go="tasks">${L('הכול', 'All')}</button></div><div class="card">${need.slice(0, 3).map(needRow).join('')}</div>` : ''}
    ${tasks.length ? `<div class="sec"><h2>✅ ${L('משימות קרובות', 'Coming up')}</h2><button data-go="personal">${L('הכול', 'All')}</button></div><div class="card">${tasks.map(taskRow).join('')}</div>` : ''}`;
};
AFTER.home = () => { bindCommon(); $('#main').querySelectorAll('[data-flight]').forEach(b => b.onclick = () => editFlight(b.dataset.flight)); };

function needRow(i) {
  return `<div class="li" style="align-items:flex-start"><span class="kind sm">${kindOf(i)}</span><div class="grow"><div class="main" data-open="${i.id}"><div class="title">${bdi(tr(i, 'title'))}</div><div class="sub">${fmtDay(i.date)} · <bdi>${esc(i.time)}</bdi></div></div>
    ${canEdit(S.world) || safeUrl(i.link) ? `<div class="row" style="gap:8px;margin-top:10px;flex-wrap:wrap">${safeUrl(i.link) ? `<a class="btn sm" href="${esc(i.link)}" target="_blank" rel="noopener">${L('להזמנה', 'Book')} ↗</a>` : ''}${canEdit(S.world) ? `<button class="btn sm line" data-booked="${i.id}">כבר הזמנו ✓</button>` : ''}</div>` : ''}</div></div>`;
}
function taskRow(t) {
  const late = t.due && t.due < nyNow().date && !t.done;
  return `<div class="li ${t.done ? 'done' : ''}"><input type="checkbox" class="check" data-task="${t.id}" ${t.done ? 'checked' : ''} aria-label="${esc(t.text)}"><div class="main" data-edit-task="${t.id}"><div class="title">${bdi(t.text)}</div>${t.due ? `<div class="sub ${late ? 'overdue' : ''}">${late ? L('עבר המועד · ', 'Overdue · ') : L('עד ', 'By ')}${fmtDay(t.due)}</div>` : ''}</div></div>`;
}
function bindCommon() {
  const m = $('#main');
  m.querySelectorAll('[data-open]').forEach(el => el.onclick = e => { if (e.target.closest('a')) return; openItem(S.world, el.dataset.open); });
  m.querySelectorAll('[data-booked]').forEach(b => b.onclick = async () => { await saveItem(S.world, b.dataset.booked, { status: 'booked' }); toast('מעולה, סומן כהוזמן'); editItem(S.world, b.dataset.booked); });
  m.querySelectorAll('[data-task]').forEach(c => c.onchange = () => updateDoc(doc(db, 'personal', S.me, 'tasks', c.dataset.task), { done: c.checked }));
  m.querySelectorAll('[data-edit-task]').forEach(el => el.onclick = () => editTask(el.dataset.editTask));
  m.querySelectorAll('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
  m.querySelectorAll('[data-world]').forEach(b => b.onclick = () => setWorld(b.dataset.world));
  m.querySelectorAll('[data-addflight]').forEach(b => b.onclick = () => editFlight(null));
}

// ----- schedule -----
function dayChips(w, sel, forMap) {
  const today = nyNow().date;
  return `<div class="scroller" role="tablist">${forMap ? `<button class="filter" data-mapday="all" aria-pressed="${sel === 'all'}">${L('כל הימים', 'All days')}</button>` : ''}${days(w).map((d, i) => {
    const c = dayColor(w, d.date), dt = new Date(d.date + 'T12:00:00'), md = S.lang === 'en' ? `${dt.getMonth() + 1}/${dt.getDate()}` : `${dt.getDate()}/${dt.getMonth() + 1}`;
    return forMap ? `<button class="filter" data-mapday="${d.date}" aria-pressed="${sel === d.date}" style="--dc:${c}"><i></i>${L('יום', 'Day')} ${i + 1}</button>`
      : `<button class="day ${d.date === today ? 'today' : ''}" role="tab" data-day="${d.date}" aria-current="${d.date === sel}" style="--dc:${c}">${L('יום', 'Day')} ${i + 1}<b>${md}</b>${S.lang === 'en' ? WD_EN[dt.getDay()] : WD[dt.getDay()]}</button>`;
  }).join('')}</div>`;
}
VIEWS.schedule = () => {
  const w = S.world, date = S.day[w], meta = days(w).find(d => d.date === date) || {}, c = dayColor(w, date);
  const list = itemsOf(w, date), nk = nowKey();
  const stops = list.filter(i => i.address).map(i => i.address);
  const nextId = list.find(i => key(i) > nk)?.id;
  const curId = [...list].reverse().find(i => key(i) <= nk && nk < `${i.date} ${i.end || addMin(i.time || '00:00', 60)}`)?.id;
  return `<div class="days">${dayChips(w, date)}</div>
    <div class="dayhead" style="--dc:${c}"><div class="k">${L('יום', 'Day')} ${dayIndex(w, date) + 1} · ${fmtDay(date)}</div><h2>${esc(tr(meta, 'title'))}</h2><p>${esc(tr(meta, 'note'))}</p>
      <div class="meta">${meta.dress ? `<span class="chip dress">👔 ${esc(meta.dress)}</span>` : ''}${wx(date)}</div></div>
    ${stops.length > 1 ? `<a class="btn soft block" style="margin-bottom:16px" href="${routeUrl(stops)}" target="_blank" rel="noopener">${IC.nav} ${L('כל המסלול של היום בגוגל מפות', "Today's full route in Google Maps")}</a>` : ''}
    ${list.length ? `<div class="tl" style="--dc:${c}">${list.map(i => stopHtml(i, i.id === curId, i.id === nextId, key(i) < nk && i.id !== curId)).join('')}</div>
      ${canEdit(w) ? '<p class="hint">רוצה להזיז עצירה ליום אחר? לחיצה ארוכה עליה וגרירה לריבוע של היום.</p>' : ''}`
      : `<div class="card empty"><span class="em">🌤️</span><strong>${L('היום הזה עוד ריק', 'Nothing planned yet')}</strong>${canEdit(w) ? 'לוחצים על "הוספה" למטה ומוסיפים עצירה.' : ''}</div>`}`;
};
function stopHtml(i, isNow, isNext, isPast) {
  const st = i.status === 'need' ? `<span class="chip need">${L('צריך להזמין', 'Needs booking')}</span>` : i.status === 'booked' ? `<span class="chip booked">✓ ${L('הוזמן', 'Booked')}${i.conf ? ` · <bdi>${esc(i.conf)}</bdi>` : ''}</span>` : '';
  const edited = i.updatedBy && i.updatedBy !== 'seed' ? `<button class="edited" data-hist="${i.id}">${L(`עודכן ע״י ${pname(i.updatedBy)}`, `Updated by ${pname(i.updatedBy)}`)} · ${ago(i.updatedAt)}</button>` : '';
  const label = S.lang === 'en' ? (i.linkLabelEn || (i.status === 'need' ? 'Book' : 'Link')) : (i.linkLabel || (i.status === 'need' ? 'להזמנה' : 'קישור'));
  return `<article class="stop ${isNow ? 'now' : ''} ${isPast ? 'past' : ''} ${i.kind === 'free' ? 'free' : ''}" data-id="${i.id}">
    <div class="time"><bdi>${esc(i.time || '')}</bdi>${i.end ? `<small><bdi>${L('עד', 'to')} ${esc(i.end)}</bdi></small>` : ''}</div>
    <div class="c card" data-open="${i.id}" role="button" tabindex="0">
      <div class="head"><span class="kind sm" style="background:color-mix(in srgb,var(--dc) 14%,transparent)">${kindOf(i)}</span><div class="grow">
        ${isNow ? `<span class="chip now">${L('עכשיו', 'Now')}</span> ` : isNext ? `<span class="chip">${L('הבא', 'Next')}</span> ` : ''}${i.mine ? '<span class="chip mine">⭐ שלך</span>' : ''}
        <h3>${bdi(tr(i, 'title'))}</h3>${i.desc ? `<p class="desc">${bdi(tr(i, 'desc'))}</p>` : ''}</div></div>
      ${i.speaker ? `<div class="speaker">🎤 <b>${bdi(i.speaker)}</b>${i.role ? ` <span class="muted">· ${bdi(i.role)}</span>` : ''}</div>` : ''}
      ${i.notes ? `<div class="note">${bdi(tr(i, 'notes'))}</div>` : ''}
      <div class="tools">${i.address ? `<a class="btn sm" href="${dirUrl(i.address)}" target="_blank" rel="noopener">${IC.nav} ${L('ניווט', 'Directions')}</a>` : ''}
        ${safeUrl(i.link) ? `<a class="btn sm soft" href="${esc(i.link)}" target="_blank" rel="noopener">${esc(label)}</a>` : ''}${st}${edited}</div>
    </div></article>`;
}
AFTER.schedule = () => {
  bindCommon();
  const m = $('#main');
  m.querySelectorAll('[data-day]').forEach(b => b.onclick = () => { S.day[S.world] = b.dataset.day; render(); scrollTo({ top: 0 }); });
  m.querySelector('.day[aria-current="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  m.querySelectorAll('[data-hist]').forEach(b => b.onclick = e => { e.stopPropagation(); showHistory(S.world, b.dataset.hist); });
  m.querySelectorAll('.stop .c').forEach(c => c.onkeydown = e => { if (e.key === 'Enter') openItem(S.world, c.dataset.open); });
  if (canEdit(S.world)) bindDrag();
};
FAB.schedule = [() => 'הוספה', () => editItem(S.world, null)]; FAB.schedule.world = true;

function bindDrag() {
  let timer, start, dragging = null, ghost, over;
  const cancel = () => { clearTimeout(timer); timer = null; };
  $('#main').querySelectorAll('.stop').forEach(el => el.addEventListener('pointerdown', e => {
    if (e.target.closest('a,button')) return;
    start = { x: e.clientX, y: e.clientY };
    timer = setTimeout(() => {
      dragging = el; el.classList.add('dragging'); navigator.vibrate?.(15);
      ghost = document.createElement('div'); ghost.className = 'ghost'; ghost.textContent = el.querySelector('h3').textContent;
      document.body.appendChild(ghost); move(e.clientX, e.clientY);
    }, 450);
  }));
  const move = (x, y) => {
    ghost.style.left = x + 'px'; ghost.style.top = y + 'px';
    const t = document.elementFromPoint(x, y)?.closest('[data-day]');
    document.querySelectorAll('.day.drop').forEach(b => b.classList.remove('drop'));
    over = t && t.dataset.day !== S.day[S.world] ? t : null; over?.classList.add('drop');
  };
  bindDrag.move = e => { if (timer && !dragging && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 8) cancel(); if (dragging) { e.preventDefault(); move(e.clientX, e.clientY); } };
  bindDrag.up = async () => {
    cancel(); if (!dragging) return;
    const id = dragging.dataset.id; dragging.classList.remove('dragging'); ghost.remove(); dragging = null;
    document.querySelectorAll('.day.drop').forEach(b => b.classList.remove('drop'));
    if (over) { const d = over.dataset.day; over = null; await saveItem(S.world, id, { date: d }); toast(`הועבר ל${fmtDay(d)}`); }
  };
  bindDrag.active = () => !!dragging;
  if (!bindDrag.bound) {
    document.addEventListener('pointermove', e => bindDrag.move?.(e), { passive: false });
    document.addEventListener('pointerup', () => bindDrag.up?.());
    document.addEventListener('pointercancel', () => bindDrag.up?.());
    document.addEventListener('touchmove', e => { if (bindDrag.active?.()) e.preventDefault(); }, { passive: false });
    document.addEventListener('contextmenu', e => { if (e.target.closest('.stop') && canEdit(S.world)) e.preventDefault(); });
    bindDrag.bound = true;
  }
}

function viewItem(w, id) {
  const i = S.items[w].find(x => x.id === id); if (!i) return;
  const label = S.lang === 'en' ? (i.linkLabelEn || 'Open link') : (i.linkLabel || 'קישור');
  openSheet(`<div class="row" style="align-items:flex-start"><span class="kind">${kindOf(i)}</span><div class="grow"><div class="small muted">${L('יום', 'Day')} ${dayIndex(w, i.date) + 1} · ${fmtDay(i.date)} · <bdi>${esc(i.time)}${i.end ? '–' + esc(i.end) : ''}</bdi></div><h2 style="margin:2px 0 0">${bdi(tr(i, 'title'))}</h2></div></div>
    ${i.desc ? `<p>${bdi(tr(i, 'desc'))}</p>` : ''}${i.speaker ? `<p>🎤 <b>${bdi(i.speaker)}</b> · ${bdi(i.role || '')}</p>` : ''}
    ${i.notes ? `<div class="card pad" style="background:var(--soft);box-shadow:none;border:0;margin:12px 0">${bdi(tr(i, 'notes'))}</div>` : ''}
    ${i.address ? `<p class="small muted"><bdi>${esc(i.address)}</bdi></p>` : ''}
    ${i.status === 'booked' ? `<p><span class="chip booked">✓ ${L('הוזמן', 'Booked')}${i.conf ? ` · <bdi>${esc(i.conf)}</bdi>` : ''}</span></p>` : i.status === 'need' ? `<p><span class="chip need">${L('צריך להזמין', 'Needs booking')}</span></p>` : ''}
    <div class="sheet-actions" style="flex-wrap:wrap">${i.address ? `<a class="btn" href="${dirUrl(i.address)}" target="_blank" rel="noopener">${IC.nav} ${L('ניווט', 'Directions')}</a>` : ''}${safeUrl(i.link) ? `<a class="btn soft" href="${esc(i.link)}" target="_blank" rel="noopener">${esc(label)}</a>` : ''}<button class="btn line" data-dismiss>${L('סגירה', 'Close')}</button></div>`);
}
function editItem(w, id) {
  const it = id ? S.items[w].find(i => i.id === id) : { date: S.day[w], time: '12:00', status: 'none' };
  if (!it) return;
  openSheet(`<h2>${id ? 'עריכה' : 'עצירה חדשה'}</h2><form id="itemf">
    <div class="field"><label for="f-title">מה עושים</label><input id="f-title" name="title" value="${esc(it.title || '')}" required dir="auto"></div>
    <div class="field"><label for="f-date">באיזה יום</label><select id="f-date" name="date">${days(w).map((d, i) => `<option value="${d.date}" ${d.date === it.date ? 'selected' : ''}>יום ${i + 1} · ${fmtDay(d.date)} · ${esc(d.title)}</option>`).join('')}</select></div>
    <div class="two"><div class="field"><label for="f-time">משעה</label><input id="f-time" type="time" name="time" value="${esc(it.time || '')}"></div><div class="field"><label for="f-end">עד שעה</label><input id="f-end" type="time" name="end" value="${esc(it.end || '')}"></div></div>
    <div class="field"><label for="f-desc">כמה מילים</label><input id="f-desc" name="desc" value="${esc(it.desc || '')}" dir="auto"></div>
    <div class="field"><label for="f-addr">כתובת או שם המקום</label><input id="f-addr" name="address" value="${esc(it.address || '')}" dir="auto" placeholder="לדוגמה: Katz's Delicatessen, New York"></div>
    ${w === 'mba' ? `<div class="two"><div class="field"><label for="f-sp">דובר</label><input id="f-sp" name="speaker" value="${esc(it.speaker || '')}" dir="auto"></div><div class="field"><label for="f-role">תפקיד</label><input id="f-role" name="role" value="${esc(it.role || '')}" dir="auto"></div></div>
      <div class="field"><label for="f-li">לינקדאין של הדובר</label><input id="f-li" name="linkedin" type="url" value="${esc(it.linkedin || '')}" dir="ltr" placeholder="https://www.linkedin.com/in/..."></div>` : ''}
    <div class="field"><span class="lbl">צריך להזמין מראש?</span><div class="seg">${[['none', 'לא צריך'], ['need', 'צריך להזמין'], ['booked', 'הוזמן ✓']].map(([v, l]) => `<label><input type="radio" name="status" value="${v}" ${(it.status || 'none') === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></div>
    <div class="two"><div class="field"><label for="f-link">קישור</label><input id="f-link" name="link" type="url" value="${esc(it.link || '')}" dir="ltr" placeholder="https://"></div><div class="field"><label for="f-conf">מספר אישור</label><input id="f-conf" name="conf" value="${esc(it.conf || '')}" dir="ltr"></div></div>
    <div class="field"><label for="f-notes">הערות</label><textarea id="f-notes" name="notes" dir="auto">${esc(it.notes || '')}</textarea></div>
    <div class="sheet-actions"><button class="btn block">שמירה</button>${id ? '<button type="button" class="btn danger" id="del">מחיקה</button>' : ''}</div>
    ${id && it.history?.length ? `<button type="button" class="btn line block" style="margin-top:10px" id="hist">מה השתנה כאן (${it.history.length})</button>` : ''}
  </form>`, sh => {
    sh.querySelector('#itemf').onsubmit = async e => {
      e.preventDefault(); const data = Object.fromEntries(new FormData(e.target));
      if (data.link && !safeUrl(data.link)) data.link = 'https://' + data.link;
      closeSheet(); await saveItem(w, id, data); S.day[w] = data.date; toast('נשמר'); render();
    };
    sh.querySelector('#del')?.addEventListener('click', async () => { if (confirm('למחוק?')) { await deleteDoc(doc(db, WORLDS[w].col, id)); closeSheet(); toast('נמחק'); } });
    sh.querySelector('#hist')?.addEventListener('click', () => showHistory(w, id));
  });
}
function showHistory(w, id) {
  const it = S.items[w].find(i => i.id === id); if (!it) return;
  const ro = !canEdit(w);
  openSheet(`<h2>${L('מה השתנה', 'Change history')}</h2><div class="hist"><b>${L('הגרסה הנוכחית', 'Current')}</b> · ${pname(it.updatedBy)} · ${ago(it.updatedAt)}</div>
    ${(it.history || []).map((h, n) => `<div class="hist row"><div class="grow"><b>${L('לפני כן', 'Before')}</b> · ${pname(h.by)} · ${ago(h.at)}<div class="small muted">${fmtDay(h.prev.date || it.date)} · <bdi>${esc(h.prev.time || '')}</bdi> · ${bdi(S.lang === 'en' ? h.prev.titleEn || h.prev.title || '' : h.prev.title || '')}</div></div>${ro ? '' : `<button class="btn sm line" data-restore="${n}">להחזיר</button>`}</div>`).join('')}
    <button class="btn line block" data-dismiss style="margin-top:12px">${L('סגירה', 'Close')}</button>`, sh => {
    sh.querySelectorAll('[data-restore]').forEach(b => b.onclick = async () => { await saveItem(w, id, it.history[+b.dataset.restore].prev); closeSheet(); toast('הוחזר'); });
  });
}

// ----- map -----
const MAP = { inst: null, layer: null, lib: null, queue: [], busy: false, cur: null, failed: new Set(), local: JSON.parse(localStorage.getItem('nyc26_geo') || '{}') };
function loadLeaflet() {
  if (MAP.lib) return MAP.lib;
  MAP.lib = new Promise((res, rej) => {
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'; document.head.appendChild(css);
    const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'; s.onload = () => res(window.L); s.onerror = rej; document.head.appendChild(s);
  });
  return MAP.lib;
}
const coords = i => i.lat != null && i.lng != null ? [i.lat, i.lng] : MAP.local[i.address] || null;
VIEWS.map = () => `<div class="mapfilters">${dayChips(S.world, S.mapDay, true)}</div>
  <div class="mapwrap"><div id="map" role="application" aria-label="${L('מפת הנקודות', 'Map of all stops')}"></div><div class="maploading" id="maploading" hidden></div></div>
  <p class="hint">${L('לחיצה על נקודה פותחת את הפרטים וכפתור ניווט. המספר על הנקודה הוא הסדר שלה באותו יום.', 'Tap a pin for details and directions. The number is its order within that day.')}</p>`;
AFTER.map = async () => {
  $('#main').querySelectorAll('[data-mapday]').forEach(b => b.onclick = () => { S.mapDay = b.dataset.mapday; $('#main').querySelectorAll('[data-mapday]').forEach(x => x.setAttribute('aria-pressed', x.dataset.mapday === S.mapDay)); updateMap(true); });
  try {
    const Lf = await loadLeaflet(); if (!$('#map')) return;
    const center = S.world === 'boston' ? [41.8, -71.8] : [40.735, -73.99];
    MAP.inst = Lf.map('map').setView(center, S.world === 'boston' ? 8 : 12);
    Lf.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 19, subdomains: 'abcd', attribution: '© OpenStreetMap © CARTO' }).addTo(MAP.inst);
    MAP.layer = Lf.layerGroup().addTo(MAP.inst);
    updateMap(true);
  } catch (e) { $('#map').innerHTML = `<div class="empty"><span class="em">🗺️</span><strong>${L('המפה לא נטענה', "The map didn't load")}</strong></div>`; }
};
function updateMap(fit) {
  const Lf = window.L; if (!MAP.inst || !Lf) return;
  const w = S.world, list = itemsOf(w).filter(i => i.address && (S.mapDay === 'all' || i.date === S.mapDay));
  MAP.layer.clearLayers(); const pts = [];
  list.forEach(i => {
    const c0 = coords(i);
    if (!c0) { if (!MAP.failed.has(i.address)) enqueueGeo(w, i); return; }
    const order = itemsOf(w, i.date).filter(x => x.address).findIndex(x => x.id === i.id) + 1;
    const icon = Lf.divIcon({ className: '', html: `<div class="pin" style="--dc:${dayColor(w, i.date)}"><span>${order}</span></div>`, iconSize: [34, 34], iconAnchor: [17, 34], popupAnchor: [0, -30] });
    Lf.marker(c0, { icon, title: tr(i, 'title') }).addTo(MAP.layer)
      .bindPopup(`<div dir="${S.lang === 'en' ? 'ltr' : 'rtl'}"><b>${esc(tr(i, 'title'))}</b><br><span style="color:#5A6A82">${L('יום', 'Day')} ${dayIndex(w, i.date) + 1} · ${fmtDay(i.date)} · <bdi>${esc(i.time)}</bdi></span><br><a class="btn sm" href="${dirUrl(i.address)}" target="_blank" rel="noopener">${L('ניווט בגוגל מפות', 'Open in Google Maps')}</a></div>`);
    pts.push(c0);
  });
  if (fit && pts.length) MAP.inst.fitBounds(pts, { padding: [40, 40], maxZoom: 15 });
  mapStatus();
}
function mapStatus() { const el = $('#maploading'); if (!el) return; const n = MAP.queue.length + (MAP.busy ? 1 : 0); el.hidden = !n; el.textContent = L(`ממקם עוד ${n} נקודות על המפה…`, `Placing ${n} more pins…`); }
function enqueueGeo(w, i) { if (MAP.cur === i.address || MAP.queue.find(q => q.i.address === i.address)) return; MAP.queue.push({ w, i }); if (!MAP.busy) runGeo(); }
async function runGeo() {
  MAP.busy = true;
  while (MAP.queue.length) {
    const { w, i } = MAP.queue.shift(); MAP.cur = i.address; mapStatus();
    const box = w === 'boston' ? '-74.4,42.8,-70.5,40.4' : '-74.3,40.95,-73.65,40.45';
    const tryQ = async q => (await (await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=en&viewbox=${box}&bounded=1&q=${encodeURIComponent(q)}`)).json())[0];
    try {
      let hit = await tryQ(i.address);
      if (!hit && i.address.includes(',')) { await new Promise(r => setTimeout(r, 1100)); hit = await tryQ(i.address.split(',').slice(1).join(',')); }
      if (hit) {
        MAP.local[i.address] = [+hit.lat, +hit.lon]; localStorage.setItem('nyc26_geo', JSON.stringify(MAP.local));
        if (canEdit(w)) await updateDoc(doc(db, WORLDS[w].col, i.id), { lat: +hit.lat, lng: +hit.lon }).catch(() => {});
        if (S.view === 'map') updateMap();
      } else MAP.failed.add(i.address);
    } catch (e) { MAP.failed.add(i.address); }
    await new Promise(r => setTimeout(r, 1100));
  }
  MAP.cur = null; MAP.busy = false; mapStatus(); if (S.view === 'map') updateMap(true);
}

// ----- tasks -----
VIEWS.tasks = () => {
  const w = S.world, all = itemsOf(w);
  const need = all.filter(i => i.status === 'need'), booked = all.filter(i => i.status === 'booked');
  const mine = S.tasks.filter(t => t.world === w || t.world === 'general' || !t.world).sort((a, b) => (a.done - b.done) || (a.due || '9').localeCompare(b.due || '9'));
  return `<div class="sec"><h2>🎟️ ${L('צריך להזמין', 'Still to book')} (${need.length})</h2></div>${need.length ? `<div class="card">${need.map(needRow).join('')}</div>` : `<div class="card empty"><span class="em">🎉</span><strong>${L('הכול מוזמן', 'All booked')}</strong></div>`}
    <div class="sec"><h2>✅ ${L('המשימות שלי', 'My to-dos')} (${mine.filter(t => !t.done).length})</h2></div>${mine.length ? `<div class="card">${mine.map(taskRow).join('')}</div>` : `<div class="card empty">${L('אין משימות. מוסיפים בכפתור למטה.', 'Nothing here yet. Add one with the button below.')}</div>`}
    ${booked.length ? `<div class="sec"><h2>✓ ${L('כבר הוזמן', 'Booked')}</h2></div><div class="card">${booked.map(i => `<div class="li"><span class="kind sm">${kindOf(i)}</span><div class="main" data-open="${i.id}"><div class="title">${bdi(tr(i, 'title'))}</div><div class="sub">${fmtDay(i.date)} · <bdi>${esc(i.time)}</bdi>${i.conf ? ` · <bdi>${esc(i.conf)}</bdi>` : ''}</div></div><span class="chip booked">${L('הוזמן', 'Booked')}</span></div>`).join('')}</div>` : ''}`;
};
AFTER.tasks = bindCommon;
FAB.tasks = [() => L('משימה', 'To-do'), () => editTask(null)];
function editTask(id) {
  const t = id ? S.tasks.find(x => x.id === id) : { world: S.world, due: '' };
  const opts = [['general', L('כללי', 'General')], ...ACCESS[S.me].map(w => [w, wname(w)])];
  openSheet(`<h2>${id ? L('עריכת משימה', 'Edit to-do') : L('משימה חדשה', 'New to-do')}</h2><form id="taskf">
    <div class="field"><label for="t-text">${L('מה צריך לעשות', 'What needs doing')}</label><input id="t-text" name="text" value="${esc(t.text || '')}" required dir="auto"></div>
    <div class="two"><div class="field"><label for="t-due">${L('עד מתי', 'Due')}</label><input id="t-due" type="date" name="due" value="${esc(t.due || '')}"></div>
    <div class="field"><label for="t-w">${L('שייך ל', 'Part of')}</label><select id="t-w" name="world">${opts.map(([v, l]) => `<option value="${v}" ${t.world === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>
    <div class="sheet-actions"><button class="btn block">${L('שמירה', 'Save')}</button>${id ? `<button type="button" class="btn danger" id="del">${L('מחיקה', 'Delete')}</button>` : ''}</div></form>`, sh => {
    sh.querySelector('#taskf').onsubmit = async e => {
      e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)); closeSheet();
      if (id) await updateDoc(doc(db, 'personal', S.me, 'tasks', id), d); else await addDoc(collection(db, 'personal', S.me, 'tasks'), { ...d, done: false });
      toast(L('נשמר', 'Saved'));
    };
    sh.querySelector('#del')?.addEventListener('click', async () => { await deleteDoc(doc(db, 'personal', S.me, 'tasks', id)); closeSheet(); toast(L('נמחק', 'Deleted')); });
  });
}

// ----- expenses (per world: brothers = three of us, boston = Moti & Ben) -----
function balances(w) {
  const ppl = WORLDS[w].people, bal = Object.fromEntries(ppl.map(p => [p, 0]));
  for (const e of S.expenses[w]) {
    const usd = e.currency === 'ILS' ? e.amount / S.rate : e.amount;
    const parts = (e.participants || []).filter(p => bal[p] !== undefined); if (!parts.length || bal[e.payer] === undefined) continue;
    bal[e.payer] += usd; parts.forEach(p => bal[p] -= usd / parts.length);
  }
  const cred = Object.entries(bal).filter(([, v]) => v > .01).sort((a, b) => b[1] - a[1]);
  const debt = Object.entries(bal).filter(([, v]) => v < -.01).map(([p, v]) => [p, -v]).sort((a, b) => b[1] - a[1]);
  const tx = []; let i = 0, j = 0;
  while (i < debt.length && j < cred.length) { const x = Math.min(debt[i][1], cred[j][1]); tx.push({ from: debt[i][0], to: cred[j][0], amt: x }); debt[i][1] -= x; cred[j][1] -= x; if (debt[i][1] < .01) i++; if (cred[j][1] < .01) j++; }
  return { bal, tx };
}
VIEWS.expenses = () => {
  const w = S.world, ppl = WORLDS[w].people, { bal, tx } = balances(w), me = S.me, my = bal[me] || 0;
  const mine = tx.filter(t => t.from === me || t.to === me), others = tx.filter(t => t.from !== me && t.to !== me);
  const list = [...S.expenses[w]].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const total = S.expenses[w].filter(e => e.type !== 'settle').reduce((s, e) => s + (e.currency === 'ILS' ? e.amount / S.rate : e.amount), 0);
  return `<section class="balance"><div class="big">${Math.abs(my) < .01 ? 'אתה מאוזן 👌' : my > 0 ? `חייבים לך ${money(my)}` : `אתה חייב ${money(my)}`}</div>
      <div class="sub">${w === 'boston' ? 'הוצאות בוסטון, מוטי ובן' : 'סה״כ הוצאות משותפות'} ${money(total)} · דולר = <bdi>₪${S.rate.toFixed(2)}</bdi></div>
      ${mine.length ? `<div class="owe">${mine.map(t => `<div class="row"><div class="grow">${t.from === me ? `אתה צריך להעביר ל${pname(t.to)}` : `${pname(t.from)} צריך להעביר לך`}</div>${money(t.amt)}${t.from === me ? `<button class="btn sm" data-settle="${t.to}" data-amt="${t.amt.toFixed(2)}">העברתי</button>` : ''}</div>`).join('')}</div>` : ''}</section>
    ${others.length ? `<p class="small muted" style="margin:10px 4px 0">בין השניים האחרים: ${others.map(t => `${pname(t.from)} ← ${pname(t.to)} ${money(t.amt)}`).join(', ')}</p>` : ''}
    <div class="sec"><h2>כל ההוצאות</h2></div>
    ${list.length ? `<div class="card">${list.map(e => `<div class="li" data-exp="${e.id}" role="button" tabindex="0"><span class="avatar" style="--c:${PEOPLE[e.payer]?.color}">${pname(e.payer)[0]}</span><div class="main"><div class="title">${e.type === 'settle' ? `העברה ל${pname(e.participants[0])}` : bdi(e.desc)}</div><div class="sub">${pname(e.payer)} שילם${e.type === 'settle' ? '' : ` · ${e.participants.length === ppl.length ? 'לכולם' : 'ל' + e.participants.map(pname).join(' ול')}`} · ${fmtDay(e.date)}</div></div><bdi class="amt">${e.currency === 'ILS' ? '₪' : '$'}${Number(e.amount).toFixed(e.amount % 1 ? 2 : 0)}</bdi></div>`).join('')}</div>`
      : '<div class="card empty"><span class="em">💵</span><strong>עוד אין הוצאות</strong>מי ששילם על משהו משותף רושם כאן, והחשבון נסגר לבד.</div>'}`;
};
AFTER.expenses = () => {
  const w = S.world;
  $('#main').querySelectorAll('[data-exp]').forEach(el => el.onclick = () => editExpense(el.dataset.exp));
  $('#main').querySelectorAll('[data-settle]').forEach(b => b.onclick = async () => {
    if (!confirm(`לרשום שהעברת ל${pname(b.dataset.settle)} $${b.dataset.amt}?`)) return;
    await addDoc(collection(db, WORLDS[w].exp), { type: 'settle', desc: 'העברה', amount: +b.dataset.amt, currency: 'USD', payer: S.me, participants: [b.dataset.settle], date: nyNow().date, createdBy: S.me, createdAt: Date.now() });
    toast('נרשם');
  });
};
FAB.expenses = [() => 'הוצאה', () => editExpense(null)]; FAB.expenses.world = true;
function editExpense(id) {
  const w = S.world, col = WORLDS[w].exp, ppl = WORLDS[w].people;
  const e = id ? S.expenses[w].find(x => x.id === id) : { currency: 'USD', payer: S.me, participants: [...ppl], date: nyNow().date };
  if (e.type === 'settle') { openSheet(`<h2>העברה</h2><p>${pname(e.payer)} העביר ל${pname(e.participants[0])} ${money(e.amount)}</p><button class="btn danger block" id="del">ביטול ההעברה</button>`, sh => sh.querySelector('#del').onclick = async () => { await deleteDoc(doc(db, col, id)); closeSheet(); }); return; }
  openSheet(`<h2>${id ? 'עריכת הוצאה' : 'הוצאה חדשה'}</h2><form id="expf">
    <div class="field"><label for="e-desc">על מה</label><input id="e-desc" name="desc" value="${esc(e.desc || '')}" required dir="auto" placeholder="${w === 'boston' ? 'דלק' : 'כרטיסים לברודוויי'}"></div>
    <div class="two"><div class="field"><label for="e-amt">סכום</label><input id="e-amt" name="amount" type="number" step="0.01" min="0" inputmode="decimal" value="${e.amount ?? ''}" required dir="ltr"></div>
      <div class="field"><span class="lbl">מטבע</span><div class="seg">${[['USD', '$ דולר'], ['ILS', '₪ שקל']].map(([v, l]) => `<label><input type="radio" name="currency" value="${v}" ${e.currency === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></div></div>
    <div class="field"><span class="lbl">מי שילם</span><div class="seg">${ppl.map(k => `<label><input type="radio" name="payer" value="${k}" ${e.payer === k ? 'checked' : ''}><span>${pname(k)}</span></label>`).join('')}</div></div>
    <div class="field"><span class="lbl">על מי זה מתחלק (שווה בשווה)</span><div class="pills">${ppl.map(k => `<label><input type="checkbox" name="participants" value="${k}" ${e.participants.includes(k) ? 'checked' : ''}>${pname(k)}</label>`).join('')}</div></div>
    <div class="field"><label for="e-date">תאריך</label><input id="e-date" type="date" name="date" value="${esc(e.date)}"></div>
    <div class="sheet-actions"><button class="btn block">שמירה</button>${id ? '<button type="button" class="btn danger" id="del">מחיקה</button>' : ''}</div></form>`, sh => {
    sh.querySelector('#expf').onsubmit = async ev => {
      ev.preventDefault(); const f = new FormData(ev.target), parts = f.getAll('participants');
      if (!parts.length) return toast('צריך לבחור לפחות אחד');
      const d = { desc: f.get('desc'), amount: +f.get('amount'), currency: f.get('currency'), payer: f.get('payer'), participants: parts, date: f.get('date'), type: 'expense' };
      closeSheet(); if (id) await updateDoc(doc(db, col, id), { ...d, updatedBy: S.me }); else await addDoc(collection(db, col), { ...d, createdBy: S.me, createdAt: Date.now() });
      toast('נשמר');
    };
    sh.querySelector('#del')?.addEventListener('click', async () => { if (confirm('למחוק?')) { await deleteDoc(doc(db, col, id)); closeSheet(); } });
  });
}

// ----- people (MBA, Dor only) -----
VIEWS.people = () => {
  const list = itemsOf('mba').filter(i => i.speaker);
  return days('mba').filter(d => list.some(i => i.date === d.date)).map(d => `<div class="sec"><h2>יום ${dayIndex('mba', d.date) + 1} · ${fmtDay(d.date)}</h2></div><div class="card">${list.filter(i => i.date === d.date).map(i => {
    const url = safeUrl(i.linkedin) || liSearch(i.speaker.split(',')[0], i.title);
    return `<div class="li"><span class="avatar" style="--c:${dayColor('mba', d.date)}">${esc(i.speaker.trim()[0])}</span><div class="main" data-open="${i.id}"><div class="title">${bdi(i.speaker)}</div><div class="sub">${bdi(i.role || '')}</div><div class="sub">${bdi(i.title)} · <bdi>${esc(i.time)}</bdi></div></div>
      <a class="li-btn" href="${esc(url)}" target="_blank" rel="noopener" aria-label="לינקדאין של ${esc(i.speaker)}">in</a></div>`;
  }).join('')}</div>`).join('') + '<p class="hint">כפתור in פותח חיפוש בלינקדאין. כשמוצאים את הפרופיל, מדביקים את הקישור בעריכת הפגישה.</p>';
};
AFTER.people = bindCommon;

// ----- flights -----
VIEWS.flights = () => { const l = sortedFlights(); return l.length ? `<div style="display:flex;flex-direction:column;gap:12px;margin-top:8px">${l.map(f => flightCard(f, true)).join('')}</div><p class="hint">${L('השעות מקומיות בכל שדה.', 'Times are local to each airport.')}</p>` : `<div class="card empty"><span class="em">✈️</span><strong>${L('עוד אין טיסות', 'No flights yet')}</strong>${L('מוסיפים בכפתור למטה: מספר טיסה, שדות ושעות.', 'Add one with the button below: flight number, airports and times.')}</div>`; };
AFTER.flights = () => $('#main').querySelectorAll('[data-flight]').forEach(b => b.onclick = () => editFlight(b.dataset.flight));
FAB.flights = [() => L('טיסה', 'Flight'), () => editFlight(null)];
function editFlight(id) {
  const f = id ? S.flights.find(x => x.id === id) : {};
  const sp = v => v ? [v.slice(0, 10), v.slice(11, 16)] : ['', ''];
  const [dd, dt] = sp(f.dep), [ad, at] = sp(f.arr);
  openSheet(`<h2>${id ? L('עריכת טיסה', 'Edit flight') : L('טיסה חדשה', 'New flight')}</h2><form id="flf">
    <div class="two"><div class="field"><label for="fl-code">${L('מספר טיסה', 'Flight number')}</label><input id="fl-code" name="code" value="${esc(f.code || '')}" required dir="ltr" placeholder="DL 2654"></div><div class="field"><label for="fl-car">${L('קוד חברה (לסמל)', 'Airline code (for the logo)')}</label><input id="fl-car" name="carrier" value="${esc(f.carrier || '')}" dir="ltr" maxlength="2" placeholder="DL"></div></div>
    <div class="two"><div class="field"><label for="fl-from">${L('משדה', 'From')}</label><input id="fl-from" name="from" value="${esc(f.from || '')}" required dir="ltr" maxlength="3" placeholder="MSP"></div><div class="field"><label for="fl-to">${L('לשדה', 'To')}</label><input id="fl-to" name="to" value="${esc(f.to || '')}" required dir="ltr" maxlength="3" placeholder="JFK"></div></div>
    <div class="two"><div class="field"><label for="fl-dd">${L('תאריך המראה', 'Departure date')}</label><input id="fl-dd" type="date" name="dd" value="${dd}" required></div><div class="field"><label for="fl-dt">${L('שעת המראה', 'Departure time')}</label><input id="fl-dt" type="time" name="dt" value="${dt}" required></div></div>
    <div class="two"><div class="field"><label for="fl-ad">${L('תאריך נחיתה', 'Arrival date')}</label><input id="fl-ad" type="date" name="ad" value="${ad}"></div><div class="field"><label for="fl-at">${L('שעת נחיתה', 'Arrival time')}</label><input id="fl-at" type="time" name="at" value="${at}"></div></div>
    <p class="small muted" style="margin:-4px 0 12px">${L('שעות מקומיות, כמו שמופיע בכרטיס.', 'Local times, as on your ticket.')}</p>
    <div class="two"><div class="field"><label for="fl-conf">${L('מספר הזמנה', 'Booking code')}</label><input id="fl-conf" name="conf" value="${esc(f.conf || '')}" dir="ltr"></div><div class="field"><label for="fl-seat">${L('מושב', 'Seat')}</label><input id="fl-seat" name="seat" value="${esc(f.seat || '')}" dir="ltr"></div></div>
    <div class="sheet-actions"><button class="btn block">${L('שמירה', 'Save')}</button>${id ? `<button type="button" class="btn danger" id="del">${L('מחיקה', 'Delete')}</button>` : ''}</div></form>`, sh => {
    sh.querySelector('#flf').onsubmit = async e => {
      e.preventDefault(); const x = Object.fromEntries(new FormData(e.target)), code = x.code.toUpperCase().trim();
      const d = { ...f, code, carrier: (x.carrier || code.replace(/\s+/g, '').slice(0, 2)).toUpperCase(), from: x.from.toUpperCase(), to: x.to.toUpperCase(), dep: `${x.dd}T${x.dt}`, arr: x.ad && x.at ? `${x.ad}T${x.at}` : '', conf: x.conf, seat: x.seat };
      delete d.id; closeSheet();
      if (id) await setDoc(doc(db, 'personal', S.me, 'flights', id), d); else await addDoc(collection(db, 'personal', S.me, 'flights'), d);
      toast(L('הטיסה נשמרה', 'Flight saved'));
    };
    sh.querySelector('#del')?.addEventListener('click', async () => { if (confirm(L('למחוק את הטיסה?', 'Delete this flight?'))) { await deleteDoc(doc(db, 'personal', S.me, 'flights', id)); closeSheet(); } });
  });
}

// ----- personal -----
VIEWS.personal = () => {
  const seg = `<div class="seg" style="margin:8px 0 16px">${[['tasks', L('✅ משימות', '✅ To-dos')], ['notes', L('📝 פתקים', '📝 Notes')], ['packing', L('🧳 אריזה', '🧳 Packing')]].map(([k, l]) => `<label><input type="radio" name="ptab" value="${k}" ${S.tab === k ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>`;
  if (S.tab === 'notes') return seg + `<div class="card pad"><label for="notes" class="sr">${L('פתקים', 'Notes')}</label><textarea id="notes" dir="auto" style="width:100%;min-height:55vh;border:0;background:none;resize:vertical;font-size:16px;line-height:1.7;outline:none" placeholder="${L('דברים לזכור. רק אתה רואה את זה.', 'Things to remember. Only you can see this.')}">${esc(S.notes)}</textarea></div><p class="hint">${L('נשמר לבד', 'Saves automatically')}</p>`;
  if (S.tab === 'packing') {
    const l = [...S.packing].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
    return seg + `<div class="card">${l.map(p => `<div class="li ${p.done ? 'done' : ''}"><input type="checkbox" class="check" data-pack="${p.id}" ${p.done ? 'checked' : ''} aria-label="${esc(p.text)}"><div class="main"><div class="title">${bdi(S.lang === 'en' && HEB.test(p.text) ? autoTr(p.text) : p.text)}</div></div><button class="edited" data-unpack="${p.id}">${L('הסרה', 'Remove')}</button></div>`).join('')}
      <form class="li" id="packf"><label for="pk" class="sr">${L('פריט חדש', 'New item')}</label><input id="pk" name="t" class="grow" placeholder="${L('להוסיף פריט…', 'Add an item…')}" dir="auto" style="border:0;background:none;font-size:16px;outline:none;min-height:40px"><button class="btn sm">${L('הוספה', 'Add')}</button></form></div>
      <p class="hint">${L(`${l.filter(p => p.done).length} מתוך ${l.length} ארוזים`, `${l.filter(p => p.done).length} of ${l.length} packed`)}</p>`;
  }
  const all = [...S.tasks].sort((a, b) => (a.done - b.done) || (a.due || '9').localeCompare(b.due || '9'));
  return seg + (all.length ? `<div class="card">${all.map(taskRow).join('')}</div>` : `<div class="card empty">${L('אין משימות.', 'No to-dos yet.')}</div>`);
};
AFTER.personal = () => {
  bindCommon();
  $('#main').querySelectorAll('[name=ptab]').forEach(r => r.onchange = () => { S.tab = r.value; render(); });
  const n = $('#notes'); if (n) { let t; n.oninput = () => { clearTimeout(t); t = setTimeout(() => setDoc(doc(db, 'personal', S.me, 'notes', 'main'), { text: n.value, at: Date.now() }), 600); }; n.onblur = () => { S.notes = n.value; }; }
  $('#main').querySelectorAll('[data-pack]').forEach(c => c.onchange = () => updateDoc(doc(db, 'personal', S.me, 'packing', c.dataset.pack), { done: c.checked }));
  $('#main').querySelectorAll('[data-unpack]').forEach(b => b.onclick = () => deleteDoc(doc(db, 'personal', S.me, 'packing', b.dataset.unpack)));
  const pf = $('#packf'); if (pf) pf.onsubmit = async e => { e.preventDefault(); const v = pf.t.value.trim(); if (!v) return; await addDoc(collection(db, 'personal', S.me, 'packing'), { text: v, done: false, order: S.packing.length }); };
};
FAB.personal = [() => L('משימה', 'To-do'), () => editTask(null)];

// ----- settings -----
VIEWS.settings = () => {
  const th = localStorage.getItem('nyc26_theme') || 'light';
  return `<div class="sec"><h2>${L('תצוגה', 'Display')}</h2></div><div class="card pad"><div class="seg">${[['light', L('☀️ בהיר', '☀️ Light')], ['dark', L('🌙 כהה', '🌙 Dark')], ['auto', L('לפי הטלפון', 'Match phone')]].map(([v, l]) => `<label><input type="radio" name="theme" value="${v}" ${th === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></div>
    ${S.me === 'dor' ? `<div class="sec"><h2>משתמשת נוספת: Sydney</h2></div><form class="card pad" id="sydf"><p class="small muted" style="margin-top:0">צפייה בלבד בטיול של האחים ובבוסטון, באנגלית. פעולה חד־פעמית.</p>
      <div class="field"><label for="syd-pin">הקוד של Sydney</label><input id="syd-pin" name="pin" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" required autocomplete="off" dir="ltr"></div><button class="btn">ליצור כניסה ל־Sydney</button></form>` : ''}
    <div class="sec"><h2>${L('משתמש', 'Account')}</h2></div><div class="card pad"><p style="margin-top:0">${L('מחובר בתור', 'Signed in as')} <b>${pname(S.me)}</b>${L(' במכשיר הזה.', ' on this device.')}</p><button class="btn line" id="logout">${L('החלפת משתמש', 'Switch user')}</button></div>
    <p class="hint">${L('תמונות מוויקימדיה קומונס. מפה: OpenStreetMap ו־CARTO.', 'Photos from Wikimedia Commons. Map: OpenStreetMap & CARTO.')}</p>`;
};
AFTER.settings = () => {
  $('#main').querySelectorAll('[name=theme]').forEach(r => r.onchange = () => { localStorage.setItem('nyc26_theme', r.value); applyTheme(); });
  $('#logout').onclick = logout;
  const sf = $('#sydf'); if (sf) sf.onsubmit = async e => {
    e.preventDefault();
    try { await setDoc(doc(db, 'users', 'sydney'), { pinHash: await pinHash('sydney', sf.pin.value) }); toast('נוצרה כניסה ל־Sydney'); sf.reset(); }
    catch (err) { toast('לא הצליח: או שהכניסה כבר קיימת, או שחוקי האבטחה לא עודכנו'); }
  };
};
