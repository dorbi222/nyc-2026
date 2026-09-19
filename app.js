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

// ---------------- constants ----------------
const PEOPLE = {
  dor:  { name: 'דור',  color: '#16917D' },
  moti: { name: 'מוטי', color: '#E4506F' },
  ben:  { name: 'בן',   color: '#3955D6' }
};
const PHOTOS = {
  brothers: { src: 'https://commons.wikimedia.org/wiki/Special:FilePath/Statue_of_Liberty_7.jpg?width=1280', pos: 'center 25%', credit: 'https://commons.wikimedia.org/wiki/File:Statue_of_Liberty_7.jpg' },
  mba: { src: 'https://commons.wikimedia.org/wiki/Special:FilePath/View_of_Empire_State_Building_from_Rockefeller_Center_New_York_City_dllu.jpg?width=1280', pos: 'center 40%', credit: 'https://commons.wikimedia.org/wiki/File:View_of_Empire_State_Building_from_Rockefeller_Center_New_York_City_dllu.jpg' }
};
const WORLDS = {
  brothers: { name: 'האחים', long: 'האחים בניו יורק', emoji: '🗽', range: '30/9 – 4/10', col: 'brothers_items',
    colors: ['#16917D', '#F07B3F', '#E4506F', '#7B61FF', '#2B8FE0'] },
  mba: { name: 'MBA', long: 'משלחת ה־MBA', emoji: '🏙️', range: '4/10 – 10/10', col: 'mba_items',
    colors: ['#3955D6', '#16917D', '#F07B3F', '#E4506F', '#7B61FF', '#D99A1E', '#2B8FE0'] }
};
const KIND = { food: '🍽️', sight: '🗽', show: '🎭', hotel: '🏨', transport: '✈️', meeting: '💼', bar: '🍺', shop: '🛍️', sport: '🏃', game: '🏀', free: '☕', event: '🎉', brief: '📝', custom: '📍' };
const DEPARTURE = new Date('2026-09-30T01:00:00+03:00');
const SPLIT_NY = '2026-10-04 15:00';
const AIRPORT = {
  TLV: ['+03:00', 'תל אביב'], JFK: ['-04:00', 'ניו יורק'], EWR: ['-04:00', 'ניוארק'], LGA: ['-04:00', 'ניו יורק'],
  MSP: ['-05:00', 'מיניאפוליס'], ORD: ['-05:00', 'שיקגו'], DTW: ['-04:00', 'דטרויט'], ATL: ['-04:00', 'אטלנטה'],
  CDG: ['+02:00', 'פריז'], LHR: ['+01:00', 'לונדון'], FRA: ['+02:00', 'פרנקפורט'], IST: ['+03:00', 'איסטנבול'], ATH: ['+03:00', 'אתונה']
};
const AIRLINE = { LY: 'אל על', DL: 'דלתא', AF: 'אייר פראנס', UA: 'יונייטד', AA: 'אמריקן', LH: 'לופטהנזה', BA: 'בריטיש', TK: 'טורקיש', IZ: 'ישראייר', '6H': 'ארקיע', KL: 'KLM', SN: 'בריסל', AC: 'אייר קנדה' };
const WD = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

// ---------------- state ----------------
const S = {
  uid: null, me: null, world: 'brothers', view: 'home', day: {}, tab: 'tasks', mapDay: 'all',
  items: { brothers: [], mba: [] }, expenses: [], tasks: [], flights: [], packing: [], notes: '',
  rate: 3.7, weather: {}, unsubs: []
};

// ---------------- firebase ----------------
const app = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
const db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });

// ---------------- utils ----------------
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const bdi = s => `<bdi>${esc(s)}</bdi>`;
const safeUrl = u => /^https?:\/\//i.test(u || '') ? u : '';
function tzParts(tz, d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}`, hour: +p.hour };
}
const nyNow = () => tzParts('America/New_York');
const ilNow = () => tzParts('Asia/Jerusalem');
const nowKey = () => { const n = nyNow(); return `${n.date} ${n.time}`; };
const key = it => `${it.date} ${it.time || '00:00'}`;
const fmtDay = (date, wd = true) => { const d = new Date(date + 'T12:00:00'); return `${wd ? WD[d.getDay()] + ' ' : ''}${d.getDate()}/${d.getMonth() + 1}`; };
const addMin = (t, m) => { const [h, mi] = t.split(':').map(Number); const x = h * 60 + mi + m; return `${String(Math.floor(x / 60) % 24).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`; };
const ago = ms => { const s = (Date.now() - ms) / 1000; return s < 60 ? 'עכשיו' : s < 3600 ? `לפני ${Math.round(s / 60)} דק׳` : s < 86400 ? `לפני ${Math.round(s / 3600)} שע׳` : `לפני ${Math.round(s / 86400)} ימים`; };
const dirUrl = a => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(a)}&travelmode=transit`;
const mapsUrl = a => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a)}`;
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
const whoName = p => PEOPLE[p]?.name || 'המקור';
const kindOf = i => KIND[i.kind] || KIND.custom;
const IC = {
  menu: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h10"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
  cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="m8 12 3 3 5-6"/></svg>',
  money: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="6" width="20" height="13" rx="3"/><circle cx="12" cy="12.5" r="2.5"/><path d="M6 9.5v6M18 9.5v6"/></svg>',
  people: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6"/></svg>',
  plus: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  nav: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M21 3 3 10.5l7.5 3L13.5 21z"/></svg>',
  plane: '<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" style="transform:rotate(-90deg)"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/></svg>'
};

// ---------------- theme ----------------
function applyTheme() { document.documentElement.dataset.theme = localStorage.getItem('nyc26_theme') || 'light'; }
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
function fatal(e) { console.error(e); $('#app').innerHTML = `<div class="login"><div class="panel" style="margin-top:20vh"><h1>אין חיבור</h1><p>${esc(e.code || '')} ${esc(e.message)}</p><button class="btn" onclick="location.reload()">לנסות שוב</button></div></div>`; }

// ---------------- login ----------------
const loginPhoto = () => `<div class="photo"><img src="${PHOTOS.brothers.src}" alt="פסל החירות" onerror="this.remove()"></div>`;
async function showLogin() {
  let setupDone = false;
  try { setupDone = (await getDoc(doc(db, 'meta', 'setup'))).exists(); } catch (e) {}
  const el = $('#app');
  if (!setupDone) {
    el.innerHTML = `<div class="login">${loginPhoto()}<div class="panel setup"><h1>הגדרה ראשונה</h1><p>קובעים קוד של 4 ספרות לכל אחד. אחר כך אי אפשר לשנות מכאן, רק מקונסולת פיירבייס.</p>
      <form id="setup">${Object.entries(PEOPLE).map(([k, p]) => `<label for="pin-${k}">הקוד של ${p.name}</label><input id="pin-${k}" name="${k}" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" required autocomplete="off">`).join('')}
      <button class="btn block" style="margin-top:22px">שמירה והתחלה</button></form></div></div>`;
    $('#setup').onsubmit = async e => {
      e.preventDefault(); const f = new FormData(e.target);
      try {
        for (const k of Object.keys(PEOPLE)) await setDoc(doc(db, 'users', k), { name: PEOPLE[k].name, pinHash: await pinHash(k, f.get(k)) });
        await setDoc(doc(db, 'meta', 'setup'), { at: Date.now() }); toast('הקודים נשמרו'); showLogin();
      } catch (err) { toast('השמירה נכשלה. בדוק שחוקי האבטחה הועלו'); console.error(err); }
    };
    return;
  }
  el.innerHTML = `<div class="login">${loginPhoto()}<div class="panel"><h1>ניו יורק 2026</h1><p>מי נכנס?</p>
    ${Object.entries(PEOPLE).map(([k, p]) => `<button class="who-btn" data-who="${k}"><span class="avatar" style="--c:${p.color}">${p.name[0]}</span><span>${p.name}<span class="sub">${k === 'dor' ? 'האחים וה־MBA' : 'הטיול של האחים, 30/9 – 4/10'}</span></span></button>`).join('')}</div></div>`;
  el.querySelectorAll('[data-who]').forEach(b => b.onclick = () => showPin(b.dataset.who));
}
function showPin(profile) {
  const p = PEOPLE[profile]; let pin = '';
  $('#app').innerHTML = `<div class="login">${loginPhoto()}<div class="panel" style="text-align:center">
    <span class="avatar" style="--c:${p.color};width:64px;height:64px;font-size:26px;margin:0 auto 10px">${p.name[0]}</span>
    <h1>היי ${p.name}</h1><p>הקוד שלך</p>
    <div class="pin-dots" aria-live="polite" aria-label="ספרות שהוקלדו"><i></i><i></i><i></i><i></i></div>
    <div class="pad-grid">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-n="${n}">${n}</button>`).join('')}<button class="ghost" data-back>חזרה</button><button data-n="0">0</button><button class="ghost" data-del aria-label="מחיקה">מחק</button></div></div></div>`;
  const dots = () => $('.pin-dots').querySelectorAll('i').forEach((d, i) => d.classList.toggle('on', i < pin.length));
  const submit = async () => {
    try { await setDoc(doc(db, 'sessions', S.uid), { profile, pinHash: await pinHash(profile, pin), at: Date.now() }); start(profile); }
    catch (e) { pin = ''; dots(); const d = $('.pin-dots'); d.classList.remove('shake'); void d.offsetWidth; d.classList.add('shake'); toast('קוד שגוי'); }
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
async function start(profile) {
  S.me = profile;
  S.world = profile === 'dor' ? (localStorage.getItem('nyc26_world') || (nowKey() >= SPLIT_NY ? 'mba' : 'brothers')) : 'brothers';
  const n = nyNow().date;
  for (const w of Object.keys(WORLDS)) { const ds = days(w).map(d => d.date); S.day[w] = ds.includes(n) ? n : (n > ds.at(-1) ? ds.at(-1) : ds[0]); }
  shell(); subscribe();
  seed().catch(e => console.error('seed', e));
  fetchRate(); fetchWeather();
  setInterval(tick, 30000);
}
function subscribe() {
  const on = (ref, fn) => S.unsubs.push(onSnapshot(ref, fn, e => console.error(e)));
  on(collection(db, 'brothers_items'), s => { S.items.brothers = s.docs.map(d => ({ id: d.id, ...d.data() })); refresh(); });
  on(collection(db, 'expenses'), s => { S.expenses = s.docs.map(d => ({ id: d.id, ...d.data() })); refresh(); });
  if (S.me === 'dor') on(collection(db, 'mba_items'), s => { S.items.mba = s.docs.map(d => ({ id: d.id, ...d.data() })); refresh(); });
  const P = c => collection(db, 'personal', S.me, c);
  on(P('tasks'), s => { S.tasks = s.docs.map(d => ({ id: d.id, ...d.data() })); refresh(); });
  on(P('flights'), s => { S.flights = s.docs.map(d => ({ id: d.id, ...d.data() })); refresh(); });
  on(P('packing'), s => { S.packing = s.docs.map(d => ({ id: d.id, ...d.data() })); refresh(); });
  on(doc(db, 'personal', S.me, 'notes', 'main'), s => { if (document.activeElement?.id !== 'notes') { S.notes = s.data()?.text || ''; refresh(); } });
}
async function seed() {
  const stamp = { updatedBy: 'seed', updatedAt: Date.now(), history: [] };
  const empty = async c => (await getDocs(query(collection(db, c), limit(1)))).empty;
  if (await empty('brothers_items')) { const b = writeBatch(db); SEED.brothers.forEach(({ id, ...it }) => b.set(doc(db, 'brothers_items', id), { status: 'none', ...it, ...stamp })); await b.commit(); }
  if (S.me === 'dor' && await empty('mba_items')) { const b = writeBatch(db); SEED.mba.forEach(({ id, ...it }) => b.set(doc(db, 'mba_items', id), { status: 'none', ...it, ...stamp })); await b.commit(); }
  const flag = doc(db, 'personal', S.me, 'meta', 'seeded');
  if (!(await getDoc(flag)).exists()) {
    const b = writeBatch(db);
    (SEED.flights[S.me] || []).forEach(({ id, ...f }) => b.set(doc(db, 'personal', S.me, 'flights', id), f));
    (SEED.tasks[S.me] || []).forEach(({ id, ...t }) => b.set(doc(db, 'personal', S.me, 'tasks', id), { done: false, ...t }));
    SEED.packing.forEach((t, i) => b.set(doc(db, 'personal', S.me, 'packing', 'p' + String(i).padStart(2, '0')), { text: t, done: false, order: i }));
    b.set(flag, { at: Date.now() }); await b.commit();
  }
  // one-time upgrade: airline codes for flights saved before logos existed
  const f2 = doc(db, 'personal', S.me, 'meta', 'v2');
  if (!(await getDoc(f2)).exists()) {
    const b = writeBatch(db);
    (SEED.flights[S.me] || []).forEach(f => b.set(doc(db, 'personal', S.me, 'flights', f.id), { carrier: f.carrier }, { merge: true }));
    b.set(f2, { at: Date.now() }); await b.commit();
  }
}
async function fetchRate() { try { const r = await (await fetch('https://open.er-api.com/v6/latest/USD')).json(); if (r?.rates?.ILS) { S.rate = r.rates.ILS; refresh(); } } catch (e) {} }
async function fetchWeather() {
  try {
    const r = await (await fetch('https://api.open-meteo.com/v1/forecast?latitude=40.75&longitude=-73.99&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=America%2FNew_York&forecast_days=16')).json();
    r.daily.time.forEach((d, i) => S.weather[d] = { code: r.daily.weather_code[i], max: Math.round(r.daily.temperature_2m_max[i]), min: Math.round(r.daily.temperature_2m_min[i]), rain: r.daily.precipitation_probability_max[i] });
    refresh();
  } catch (e) {}
}
function wx(date) {
  const w = S.weather[date]; if (!w) return '';
  const c = w.code, [e, l] = c === 0 ? ['☀️', 'בהיר'] : c <= 2 ? ['🌤️', 'מעונן חלקית'] : c === 3 ? ['☁️', 'מעונן'] : c <= 48 ? ['🌫️', 'ערפל'] : c <= 67 || (c >= 80 && c <= 82) ? ['🌧️', 'גשם'] : c <= 77 ? ['🌨️', 'שלג'] : ['⛈️', 'סופה'];
  return `<span class="wx">${e} ${l} · <bdi>${w.min}°–${w.max}°</bdi>${w.rain >= 40 ? ` · ${w.rain}% גשם` : ''}</span>`;
}

// ---------------- shell ----------------
const TABS = w => [['home', 'בית', IC.home], ['schedule', 'לו"ז', IC.cal], ['map', 'מפה', IC.map], ['tasks', 'משימות', IC.check], w === 'brothers' ? ['expenses', 'הוצאות', IC.money] : ['people', 'אנשים', IC.people]];
const TITLES = { home: '', schedule: 'הלו"ז', map: 'מפה', tasks: 'משימות', expenses: 'הוצאות משותפות', people: 'הדוברים', flights: 'הטיסות שלי', personal: 'האזור שלי', settings: 'הגדרות' };
function shell() {
  document.documentElement.dataset.world = S.world;
  $('#app').innerHTML = `<header class="appbar" id="bar"></header><main id="main"></main>
    <button class="fab" id="fab" hidden></button>
    <nav class="tabbar" id="tabs" aria-label="ניווט ראשי"></nav>
    <div class="scrim" id="scrim"></div><nav class="drawer" id="drawer" aria-label="תפריט"></nav>`;
  $('#scrim').onclick = closeDrawer;
  $('#fab').onclick = () => FAB[S.view]?.[1]();
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeSheet(); closeDrawer(); } });
  window.addEventListener('scroll', () => $('#bar')?.classList.toggle('scrolled', scrollY > 4), { passive: true });
  render();
}
let raf; function refresh() { cancelAnimationFrame(raf); raf = requestAnimationFrame(render); }
function tick() { renderBar(); if (S.view === 'home' || S.view === 'schedule') render(); }
function render() {
  if (!S.me || !$('#main')) return;
  document.documentElement.dataset.world = S.world;
  renderBar(); renderTabs();
  if (S.view === 'personal' && document.activeElement?.id === 'notes') return;
  if (S.view === 'map' && MAP.inst && $('#map')) { updateMap(); return; }
  $('#main').innerHTML = (VIEWS[S.view] || VIEWS.home)();
  const f = FAB[S.view]; $('#fab').hidden = !f; if (f) $('#fab').innerHTML = `${IC.plus}<span>${f[0]}</span>`;
  AFTER[S.view]?.();
}
function renderBar() {
  const ny = nyNow(), il = ilNow();
  const title = S.view === 'home' ? `${WORLDS[S.world].emoji} ${WORLDS[S.world].long}` : TITLES[S.view];
  $('#bar').innerHTML = `<div class="appbar-row"><button class="icon-btn" id="menu" aria-label="פתיחת תפריט">${IC.menu}</button><h1>${title}</h1>
    <div class="timechip" aria-label="שעה בניו יורק ${ny.time}, בישראל ${il.time}"><b><bdi>${ny.time}</bdi> 🇺🇸</b><span><bdi>${il.time}</bdi> 🇮🇱</span></div></div>`;
  $('#menu').onclick = openDrawer;
}
function renderTabs() {
  $('#tabs').innerHTML = `<ul>${TABS(S.world).map(([k, l, ic]) => `<li><button data-view="${k}" ${S.view === k ? 'aria-current="page"' : ''}><span class="ic">${ic}</span>${l}</button></li>`).join('')}</ul>`;
  $('#tabs').querySelectorAll('[data-view]').forEach(b => b.onclick = () => go(b.dataset.view));
}
function openDrawer() {
  const w = S.world, need = S.items[w].filter(i => i.status === 'need').length;
  const nav = [['home', 'בית', '🏠'], ['schedule', 'לו"ז', '🗓️'], ['map', 'מפה', '🗺️'], ['tasks', 'משימות והזמנות', '✅', need], w === 'brothers' ? ['expenses', 'הוצאות משותפות', '💵'] : ['people', 'הדוברים', '🤝'], ['-'], ['flights', 'הטיסות שלי', '✈️'], ['personal', 'האזור שלי', '🎒'], ['settings', 'הגדרות', '⚙️']];
  $('#drawer').innerHTML = `<div class="who"><span class="avatar" style="--c:${PEOPLE[S.me].color}">${PEOPLE[S.me].name[0]}</span><div><b>${PEOPLE[S.me].name}</b><div class="small muted">ניו יורק 2026</div></div></div>
    ${S.me === 'dor' ? `<div class="worlds" role="group" aria-label="חלק בטיול">${Object.entries(WORLDS).map(([k, x]) => `<button data-world="${k}" aria-pressed="${k === w}"><span class="em">${x.emoji}</span><b>${x.name}</b><small><bdi>${x.range}</bdi></small></button>`).join('')}</div>` : ''}
    <ul class="nav">${nav.map(([k, l, e, c]) => k === '-' ? '<li class="sep" role="separator"></li>' : `<li><button data-view="${k}" ${k === S.view ? 'aria-current="page"' : ''}><span class="e">${e}</span>${l}${c ? `<span class="count">${c}</span>` : ''}</button></li>`).join('')}</ul>`;
  $('#drawer').querySelectorAll('[data-view]').forEach(b => b.onclick = () => go(b.dataset.view));
  $('#drawer').querySelectorAll('[data-world]').forEach(b => b.onclick = () => { setWorld(b.dataset.world); openDrawer(); });
  $('#drawer').classList.add('open'); $('#scrim').classList.add('open');
  $('#drawer button')?.focus();
}
function setWorld(w) {
  S.world = w; localStorage.setItem('nyc26_world', w);
  if (w === 'mba' && S.view === 'expenses') S.view = 'home';
  if (w === 'brothers' && S.view === 'people') S.view = 'home';
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
const TRACK = ['title', 'date', 'time', 'end', 'desc', 'address', 'status', 'link', 'linkLabel', 'conf', 'notes', 'speaker', 'role', 'linkedin'];
async function saveItem(w, id, data) {
  const col = WORLDS[w].col;
  if (!id) { await addDoc(collection(db, col), { status: 'none', kind: 'custom', ...data, updatedBy: S.me, updatedAt: Date.now(), history: [] }); return; }
  const cur = S.items[w].find(i => i.id === id) || {};
  const prev = Object.fromEntries(TRACK.filter(k => cur[k] !== undefined).map(k => [k, cur[k]]));
  const history = [{ by: cur.updatedBy || 'seed', at: cur.updatedAt || Date.now(), prev }, ...(cur.history || [])].slice(0, 8);
  const extra = data.address !== undefined && data.address !== cur.address ? { lat: null, lng: null } : {};
  await updateDoc(doc(db, col, id), { ...data, ...extra, updatedBy: S.me, updatedAt: Date.now(), history });
}

// ---------------- flights ----------------
const carrierOf = f => (f.carrier || String(f.code).replace(/\s+/g, '').slice(0, 2)).toUpperCase();
const logoHtml = f => { const c = carrierOf(f); return `<span class="logo-wrap"><img src="https://images.kiwi.com/airlines/64/${c}.png" alt="" onerror="if(!this.dataset.b){this.dataset.b=1;this.src='https://pics.avs.io/80/80/${c}.png'}else{this.parentNode.innerHTML='<span>${esc(c)}</span>'}"></span>`; };
const fTime = (f, w) => { const v = f[w], ap = w === 'dep' ? f.from : f.to; return v ? new Date(v + ':00' + (AIRPORT[ap]?.[0] || '-04:00')) : null; };
function flightCard(f, full) {
  const dep = fTime(f, 'dep'), arr = fTime(f, 'arr'), now = Date.now();
  const dur = dep && arr ? Math.round((arr - dep) / 6e4) : null;
  const left = dep ? dep - now : 0;
  let badge, prog = 0;
  if (!dep) badge = '';
  else if (left > 864e5 * 2) badge = `<span class="badge">בעוד ${Math.ceil(left / 864e5)} ימים</span>`;
  else if (left > 0) badge = `<span class="badge">בעוד ${Math.floor(left / 36e5)}:${String(Math.floor(left / 6e4) % 60).padStart(2, '0')} שע׳</span>`;
  else if (arr && arr > now) { prog = (now - dep) / (arr - dep); badge = '<span class="badge air">באוויר</span>'; }
  else { prog = 1; badge = '<span class="badge done">נחתה</span>'; }
  const airline = f.airline || AIRLINE[carrierOf(f)] || carrierOf(f);
  const t = s => s ? s.slice(11, 16) : '—', d = s => s ? fmtDay(s.slice(0, 10)) : '';
  return `<article class="flight ${full ? 'full' : ''}" aria-label="טיסה ${esc(f.code)} מ${esc(AIRPORT[f.from]?.[1] || f.from)} ל${esc(AIRPORT[f.to]?.[1] || f.to)}">
    <div class="top">${logoHtml(f)}<div class="grow"><div class="airline">${esc(airline)}</div><div class="code"><bdi>${esc(f.code)}</bdi>${f.alt ? ` · <bdi>${esc(f.alt)}</bdi>` : ''}</div></div>${badge}</div>
    <div class="route">
      <div class="ap"><b><bdi>${esc(f.from)}</bdi></b><span class="t"><bdi>${t(f.dep)}</bdi></span><small>${esc(AIRPORT[f.from]?.[1] || '')} · ${d(f.dep)}</small></div>
      <div class="path"><span class="dot s"></span><span class="plane" style="right:${Math.round(prog * 100)}%">${IC.plane}</span><span class="dot e"></span>${dur ? `<span class="dur">${Math.floor(dur / 60)} שע׳ ${dur % 60 ? `${dur % 60} דק׳` : ''}</span>` : ''}</div>
      <div class="ap to"><b><bdi>${esc(f.to)}</bdi></b><span class="t"><bdi>${t(f.arr)}</bdi></span><small>${esc(AIRPORT[f.to]?.[1] || '')} · ${d(f.arr)}</small></div>
    </div>
    <div class="foot"><span class="meta">${f.conf ? `הזמנה <bdi>${esc(f.conf)}</bdi>` : ''}${f.seat ? ` · מושב <bdi>${esc(f.seat)}</bdi>` : ''}</span>
      <a class="btn sm soft" href="${frUrl(f.code)}" target="_blank" rel="noopener">סטטוס חי</a>${full ? `<button class="btn sm line" data-flight="${f.id}">עריכה</button>` : ''}</div></article>`;
}
const sortedFlights = () => [...S.flights].sort((a, b) => (a.dep || '').localeCompare(b.dep || ''));

// ---------------- views ----------------
const VIEWS = {}, AFTER = {}, FAB = {};

function hero() {
  const w = S.world, p = PHOTOS[w], now = Date.now(), name = PEOPLE[S.me].name;
  const h = (now < DEPARTURE ? ilNow() : nyNow()).hour;
  const hi = h < 5 ? 'לילה טוב' : h < 12 ? 'בוקר טוב' : h < 17 ? 'צהריים טובים' : h < 21 ? 'ערב טוב' : 'לילה טוב';
  let title, sub;
  if (now < DEPARTURE) {
    const d = Math.ceil((DEPARTURE - now) / 864e5);
    title = d <= 1 ? 'מחר טסים לניו יורק!' : `עוד ${d} ימים לניו יורק`;
    sub = 'המראה ב־30/9 בשעה 01:00 מנתב״ג';
  } else {
    const today = days(w).find(x => x.date === nyNow().date);
    title = today ? today.title : WORLDS[w].long;
    sub = today ? `יום ${dayIndex(w, today.date) + 1} · ${fmtDay(today.date)}` : WORLDS[w].range;
  }
  return `<section class="hero"><img src="${p.src}" alt="" style="object-position:${p.pos}" onerror="this.remove()">
    ${S.me === 'dor' ? `<div class="worldtoggle" role="group" aria-label="חלק בטיול">${Object.entries(WORLDS).map(([k, x]) => `<button data-world="${k}" aria-pressed="${k === w}">${x.name}</button>`).join('')}</div>` : ''}
    <div class="in"><p class="hi">${hi}, ${name}</p><h2>${esc(title)}</h2><p class="sub">${esc(sub)}</p></div></section>`;
}

VIEWS.home = () => {
  const w = S.world, nk = nowKey();
  const fl = sortedFlights();
  const flights = `<div class="sec"><h2>✈️ הטיסות שלך</h2><button data-go="flights">הכול</button></div>
    <div class="scroller">${fl.map(f => flightCard(f)).join('')}<button class="add-flight" data-addflight>${IC.plus}הוספת טיסה</button></div>`;
  const all = itemsOf(w);
  const nxt = all.find(i => key(i) > nk);
  const cur = [...all].reverse().find(i => key(i) <= nk && nk < `${i.date} ${i.end || addMin(i.time || '00:00', 60)}`);
  const next = nxt ? `<div class="sec"><h2>${Date.now() < DEPARTURE ? '📍 התחנה הראשונה' : '📍 הבא בתור'}</h2><button data-go="schedule">ללו"ז</button></div>
    <section class="next"><div class="label"><span>${nxt.date === nyNow().date ? 'היום' : fmtDay(nxt.date)} · <bdi>${esc(nxt.time)}</bdi></span>${nxt.status === 'need' ? '<span class="chip need">צריך להזמין</span>' : ''}</div>
      <div class="main"><span class="kind" style="background:color-mix(in srgb,${dayColor(w, nxt.date)} 16%,transparent)">${kindOf(nxt)}</span><div class="grow"><h3>${bdi(nxt.title)}</h3>${nxt.desc || nxt.speaker ? `<p class="d">${bdi(nxt.desc || nxt.speaker)}</p>` : ''}</div></div>
      <div class="actions">${nxt.address ? `<a class="btn" href="${dirUrl(nxt.address)}" target="_blank" rel="noopener">${IC.nav} איך מגיעים</a>` : ''}${safeUrl(nxt.link) ? `<a class="btn soft" href="${esc(nxt.link)}" target="_blank" rel="noopener">${esc(nxt.linkLabel || 'קישור')}</a>` : ''}<button class="btn line" data-open="${nxt.id}">פרטים</button></div>
      ${cur ? `<div class="nowline">עכשיו: ${bdi(cur.title)}</div>` : ''}</section>` : '';
  const today = days(w).find(d => d.date === nyNow().date);
  const need = all.filter(i => i.status === 'need');
  const tasks = S.tasks.filter(t => !t.done && (t.world === w || t.world === 'general' || !t.world)).sort((a, b) => (a.due || '9').localeCompare(b.due || '9')).slice(0, 4);
  const mine = w === 'mba' ? all.filter(i => i.mine) : [];
  return `${hero()}${flights}${next}
    ${today && (today.dress || S.weather[today.date]) ? `<div class="card pad" style="margin-top:12px"><div class="row" style="flex-wrap:wrap">${today.dress ? `<span class="chip dress">👔 קוד לבוש: ${esc(today.dress)}</span>` : ''}${wx(today.date)}</div></div>` : ''}
    ${mine.length ? `<div class="sec"><h2>⭐ המשימה שלי</h2></div><div class="card">${mine.map(i => `<div class="li"><span class="kind sm" style="background:var(--sun-soft)">${kindOf(i)}</span><div class="main" data-open="${i.id}"><div class="title">${bdi(i.title)}</div><div class="sub">${fmtDay(i.date)} · <bdi>${esc(i.time)}</bdi>${i.notes ? ` · ${bdi(i.notes)}` : ''}</div></div></div>`).join('')}</div>` : ''}
    ${need.length ? `<div class="sec"><h2>🎟️ צריך להזמין (${need.length})</h2><button data-go="tasks">הכול</button></div><div class="card">${need.slice(0, 3).map(needRow).join('')}</div>` : ''}
    ${tasks.length ? `<div class="sec"><h2>✅ משימות קרובות</h2><button data-go="personal">הכול</button></div><div class="card">${tasks.map(taskRow).join('')}</div>` : ''}`;
};
AFTER.home = () => { bindCommon(); $('#main').querySelectorAll('[data-flight]').forEach(b => b.onclick = () => editFlight(b.dataset.flight)); };

function needRow(i) {
  return `<div class="li" style="align-items:flex-start"><span class="kind sm">${kindOf(i)}</span><div class="grow"><div class="main" data-open="${i.id}"><div class="title">${bdi(i.title)}</div><div class="sub">${fmtDay(i.date)} · <bdi>${esc(i.time)}</bdi></div></div>
    <div class="row" style="gap:8px;margin-top:10px;flex-wrap:wrap">${safeUrl(i.link) ? `<a class="btn sm" href="${esc(i.link)}" target="_blank" rel="noopener">להזמנה ↗</a>` : ''}<button class="btn sm line" data-booked="${i.id}">כבר הזמנו ✓</button></div></div></div>`;
}
function taskRow(t) {
  const late = t.due && t.due < nyNow().date && !t.done;
  return `<div class="li ${t.done ? 'done' : ''}"><input type="checkbox" class="check" data-task="${t.id}" ${t.done ? 'checked' : ''} aria-label="סימון: ${esc(t.text)}"><div class="main" data-edit-task="${t.id}"><div class="title">${bdi(t.text)}</div>${t.due ? `<div class="sub ${late ? 'overdue' : ''}">${late ? 'עבר המועד · ' : 'עד '}${fmtDay(t.due)}</div>` : ''}</div></div>`;
}
function bindCommon() {
  const m = $('#main');
  m.querySelectorAll('[data-open]').forEach(el => el.onclick = e => { if (e.target.closest('a')) return; editItem(S.world, el.dataset.open); });
  m.querySelectorAll('[data-booked]').forEach(b => b.onclick = async () => { await saveItem(S.world, b.dataset.booked, { status: 'booked' }); toast('מעולה, סומן כהוזמן'); editItem(S.world, b.dataset.booked); });
  m.querySelectorAll('[data-task]').forEach(c => c.onchange = () => updateDoc(doc(db, 'personal', S.me, 'tasks', c.dataset.task), { done: c.checked }));
  m.querySelectorAll('[data-edit-task]').forEach(el => el.onclick = () => editTask(el.dataset.editTask));
  m.querySelectorAll('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
  m.querySelectorAll('[data-world]').forEach(b => b.onclick = () => setWorld(b.dataset.world));
  m.querySelectorAll('[data-addflight]').forEach(b => b.onclick = () => editFlight(null));
}

// ----- schedule -----
function dayChips(w, sel, withAll) {
  const today = nyNow().date;
  return `<div class="scroller" role="tablist" aria-label="ימים">${withAll ? `<button class="filter" data-mapday="all" aria-pressed="${sel === 'all'}">כל הימים</button>` : ''}${days(w).map((d, i) => {
    const c = dayColor(w, d.date), dt = new Date(d.date + 'T12:00:00');
    return withAll ? `<button class="filter" data-mapday="${d.date}" aria-pressed="${sel === d.date}" style="--dc:${c}"><i></i>יום ${i + 1}</button>`
      : `<button class="day ${d.date === today ? 'today' : ''}" role="tab" data-day="${d.date}" aria-current="${d.date === sel}" aria-label="יום ${i + 1}, ${fmtDay(d.date)}" style="--dc:${c}">יום ${i + 1}<b>${dt.getDate()}/${dt.getMonth() + 1}</b>${WD[dt.getDay()]}</button>`;
  }).join('')}</div>`;
}
VIEWS.schedule = () => {
  const w = S.world, date = S.day[w], meta = days(w).find(d => d.date === date) || {}, c = dayColor(w, date);
  const list = itemsOf(w, date), nk = nowKey();
  const stops = list.filter(i => i.address).map(i => i.address);
  const nextId = list.find(i => key(i) > nk)?.id;
  const curId = [...list].reverse().find(i => key(i) <= nk && nk < `${i.date} ${i.end || addMin(i.time || '00:00', 60)}`)?.id;
  return `<div class="days">${dayChips(w, date)}</div>
    <div class="dayhead" style="--dc:${c}"><div class="k">יום ${dayIndex(w, date) + 1} · ${fmtDay(date)}</div><h2>${esc(meta.title || '')}</h2><p>${esc(meta.note || '')}</p>
      <div class="meta">${meta.dress ? `<span class="chip dress">👔 ${esc(meta.dress)}</span>` : ''}${wx(date)}</div></div>
    ${stops.length > 1 ? `<a class="btn soft block" style="margin-bottom:16px" href="${routeUrl(stops)}" target="_blank" rel="noopener">${IC.nav} כל המסלול של היום בגוגל מפות</a>` : ''}
    ${list.length ? `<div class="tl" style="--dc:${c}">${list.map(i => stopHtml(i, i.id === curId, i.id === nextId, key(i) < nk && i.id !== curId)).join('')}</div>
      <p class="hint">רוצה להזיז עצירה ליום אחר? לחיצה ארוכה עליה וגרירה לריבוע של היום.</p>`
      : `<div class="card empty"><span class="em">🌤️</span><strong>היום הזה עוד ריק</strong>לוחצים על "הוספה" למטה ומוסיפים עצירה.</div>`}`;
};
function stopHtml(i, isNow, isNext, isPast) {
  const st = i.status === 'need' ? '<span class="chip need">צריך להזמין</span>' : i.status === 'booked' ? `<span class="chip booked">✓ הוזמן${i.conf ? ` · <bdi>${esc(i.conf)}</bdi>` : ''}</span>` : '';
  const edited = i.updatedBy && i.updatedBy !== 'seed' ? `<button class="edited" data-hist="${i.id}">עודכן ע״י ${whoName(i.updatedBy)} · ${ago(i.updatedAt)}</button>` : '';
  return `<article class="stop ${isNow ? 'now' : ''} ${isPast ? 'past' : ''} ${i.kind === 'free' ? 'free' : ''}" data-id="${i.id}">
    <div class="time"><bdi>${esc(i.time || '')}</bdi>${i.end ? `<small><bdi>עד ${esc(i.end)}</bdi></small>` : ''}</div>
    <div class="c card" data-open="${i.id}" role="button" tabindex="0" aria-label="${esc(i.title)}, לעריכה">
      <div class="head"><span class="kind sm" style="background:color-mix(in srgb,var(--dc) 14%,transparent)">${kindOf(i)}</span><div class="grow">
        ${isNow ? '<span class="chip now">עכשיו</span> ' : isNext ? '<span class="chip">הבא</span> ' : ''}${i.mine ? '<span class="chip mine">⭐ שלך</span>' : ''}
        <h3>${bdi(i.title)}</h3>${i.desc ? `<p class="desc">${bdi(i.desc)}</p>` : ''}</div></div>
      ${i.speaker ? `<div class="speaker">🎤 <b>${bdi(i.speaker)}</b>${i.role ? ` <span class="muted">· ${bdi(i.role)}</span>` : ''}</div>` : ''}
      ${i.notes ? `<div class="note">${bdi(i.notes)}</div>` : ''}
      <div class="tools">${i.address ? `<a class="btn sm" href="${dirUrl(i.address)}" target="_blank" rel="noopener">${IC.nav} ניווט</a>` : ''}
        ${safeUrl(i.link) ? `<a class="btn sm soft" href="${esc(i.link)}" target="_blank" rel="noopener">${esc(i.linkLabel || (i.status === 'need' ? 'להזמנה' : 'קישור'))}</a>` : ''}${st}${edited}</div>
    </div></article>`;
}
AFTER.schedule = () => {
  bindCommon();
  const m = $('#main');
  m.querySelectorAll('[data-day]').forEach(b => b.onclick = () => { S.day[S.world] = b.dataset.day; render(); scrollTo({ top: 0 }); });
  m.querySelector('.day[aria-current="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  m.querySelectorAll('[data-hist]').forEach(b => b.onclick = e => { e.stopPropagation(); showHistory(S.world, b.dataset.hist); });
  m.querySelectorAll('.stop .c').forEach(c => c.onkeydown = e => { if (e.key === 'Enter') editItem(S.world, c.dataset.open); });
  bindDrag();
};
FAB.schedule = ['הוספה', () => editItem(S.world, null)];

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
    document.addEventListener('pointermove', e => bindDrag.move(e), { passive: false });
    document.addEventListener('pointerup', () => bindDrag.up());
    document.addEventListener('pointercancel', () => bindDrag.up());
    document.addEventListener('touchmove', e => { if (bindDrag.active()) e.preventDefault(); }, { passive: false });
    document.addEventListener('contextmenu', e => { if (e.target.closest('.stop')) e.preventDefault(); });
    bindDrag.bound = true;
  }
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
  openSheet(`<h2>מה השתנה</h2><div class="hist"><b>הגרסה הנוכחית</b> · ${whoName(it.updatedBy)} · ${ago(it.updatedAt)}</div>
    ${(it.history || []).map((h, n) => `<div class="hist row"><div class="grow"><b>לפני כן</b> · ${whoName(h.by)} · ${ago(h.at)}<div class="small muted">${fmtDay(h.prev.date || it.date)} · <bdi>${esc(h.prev.time || '')}</bdi> · ${bdi(h.prev.title || '')}</div></div><button class="btn sm line" data-restore="${n}">להחזיר</button></div>`).join('')}
    <button class="btn line block" data-dismiss style="margin-top:12px">סגירה</button>`, sh => {
    sh.querySelectorAll('[data-restore]').forEach(b => b.onclick = async () => { await saveItem(w, id, it.history[+b.dataset.restore].prev); closeSheet(); toast('הוחזר'); });
  });
}

// ----- map (Leaflet + OpenStreetMap, loads by itself) -----
const MAP = { inst: null, layer: null, lib: null, queue: [], busy: false, failed: new Set() };
function loadLeaflet() {
  if (MAP.lib) return MAP.lib;
  MAP.lib = new Promise((res, rej) => {
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'; document.head.appendChild(css);
    const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'; s.onload = () => res(window.L); s.onerror = rej; document.head.appendChild(s);
  });
  return MAP.lib;
}
VIEWS.map = () => `<div class="mapfilters">${dayChips(S.world, S.mapDay, true)}</div>
  <div class="mapwrap"><div id="map" role="application" aria-label="מפת הנקודות"></div><div class="maploading" id="maploading" hidden></div></div>
  <p class="hint">לחיצה על נקודה פותחת את הפרטים וכפתור ניווט. המספר על הנקודה הוא הסדר שלה באותו יום.</p>`;
AFTER.map = async () => {
  $('#main').querySelectorAll('[data-mapday]').forEach(b => b.onclick = () => { S.mapDay = b.dataset.mapday; $('#main').querySelectorAll('[data-mapday]').forEach(x => x.setAttribute('aria-pressed', x.dataset.mapday === S.mapDay)); updateMap(true); });
  try {
    const L = await loadLeaflet();
    if (!$('#map')) return;
    MAP.inst = L.map('map', { zoomControl: true, attributionControl: true }).setView([40.735, -73.99], 12);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 19, subdomains: 'abcd', attribution: '© OpenStreetMap © CARTO' }).addTo(MAP.inst);
    MAP.layer = L.layerGroup().addTo(MAP.inst);
    updateMap(true);
  } catch (e) { $('#map').innerHTML = '<div class="empty"><span class="em">🗺️</span><strong>המפה לא נטענה</strong>בדוק חיבור לאינטרנט ונסה שוב.</div>'; }
};
function updateMap(fit) {
  const L = window.L; if (!MAP.inst || !L) return;
  const w = S.world, list = itemsOf(w).filter(i => i.address && (S.mapDay === 'all' || i.date === S.mapDay));
  MAP.layer.clearLayers();
  const pts = [];
  list.forEach(i => {
    if (i.lat == null || i.lng == null) { if (!MAP.failed.has(i.id)) enqueueGeo(w, i); return; }
    const order = itemsOf(w, i.date).filter(x => x.address).findIndex(x => x.id === i.id) + 1;
    const c = dayColor(w, i.date);
    const icon = L.divIcon({ className: '', html: `<div class="pin" style="--dc:${c}"><span>${order}</span></div>`, iconSize: [34, 34], iconAnchor: [17, 34], popupAnchor: [0, -30] });
    L.marker([i.lat, i.lng], { icon, title: i.title }).addTo(MAP.layer)
      .bindPopup(`<b>${esc(i.title)}</b><br><span style="color:#5A6A82">יום ${dayIndex(w, i.date) + 1} · ${fmtDay(i.date)} · <bdi>${esc(i.time)}</bdi></span><br><a class="btn sm" href="${dirUrl(i.address)}" target="_blank" rel="noopener">ניווט בגוגל מפות</a>`);
    pts.push([i.lat, i.lng]);
  });
  if (fit && pts.length) MAP.inst.fitBounds(pts, { padding: [40, 40], maxZoom: 15 });
  mapStatus();
}
function mapStatus() { const el = $('#maploading'); if (!el) return; const n = MAP.queue.length + (MAP.busy ? 1 : 0); el.hidden = !n; el.textContent = `ממקם עוד ${n} נקודות על המפה…`; }
function enqueueGeo(w, i) { if (MAP.cur === i.id || MAP.queue.find(q => q.i.id === i.id)) return; MAP.queue.push({ w, i }); if (!MAP.busy) runGeo(); }
async function runGeo() {
  MAP.busy = true;
  while (MAP.queue.length) {
    const { w, i } = MAP.queue.shift(); MAP.cur = i.id; mapStatus();
    const tryQ = async q => { const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=en&viewbox=-74.3,40.95,-73.65,40.45&bounded=1&q=${encodeURIComponent(q)}`); const j = await r.json(); return j[0]; };
    try {
      let hit = await tryQ(i.address);
      if (!hit && i.address.includes(',')) { await new Promise(r => setTimeout(r, 1100)); hit = await tryQ(i.address.split(',').slice(1).join(',')); }
      if (hit) await updateDoc(doc(db, WORLDS[w].col, i.id), { lat: +hit.lat, lng: +hit.lon });
      else MAP.failed.add(i.id);
    } catch (e) { MAP.failed.add(i.id); }
    await new Promise(r => setTimeout(r, 1100));
  }
  MAP.cur = null; MAP.busy = false; mapStatus(); if (S.view === 'map') updateMap(true);
}

// ----- tasks -----
VIEWS.tasks = () => {
  const w = S.world, all = itemsOf(w);
  const need = all.filter(i => i.status === 'need'), booked = all.filter(i => i.status === 'booked');
  const mine = S.tasks.filter(t => t.world === w || t.world === 'general' || !t.world).sort((a, b) => (a.done - b.done) || (a.due || '9').localeCompare(b.due || '9'));
  return `<div class="sec"><h2>🎟️ צריך להזמין (${need.length})</h2></div>${need.length ? `<div class="card">${need.map(needRow).join('')}</div>` : '<div class="card empty"><span class="em">🎉</span><strong>הכול מוזמן</strong></div>'}
    <div class="sec"><h2>✅ המשימות שלי (${mine.filter(t => !t.done).length})</h2></div>${mine.length ? `<div class="card">${mine.map(taskRow).join('')}</div>` : '<div class="card empty">אין משימות. מוסיפים בכפתור למטה.</div>'}
    ${booked.length ? `<div class="sec"><h2>✓ כבר הוזמן</h2></div><div class="card">${booked.map(i => `<div class="li"><span class="kind sm">${kindOf(i)}</span><div class="main" data-open="${i.id}"><div class="title">${bdi(i.title)}</div><div class="sub">${fmtDay(i.date)} · <bdi>${esc(i.time)}</bdi>${i.conf ? ` · <bdi>${esc(i.conf)}</bdi>` : ''}</div></div><span class="chip booked">הוזמן</span></div>`).join('')}</div>` : ''}`;
};
AFTER.tasks = bindCommon;
FAB.tasks = ['משימה', () => editTask(null)];
function editTask(id) {
  const t = id ? S.tasks.find(x => x.id === id) : { world: S.world, due: '' };
  openSheet(`<h2>${id ? 'עריכת משימה' : 'משימה חדשה'}</h2><form id="taskf">
    <div class="field"><label for="t-text">מה צריך לעשות</label><input id="t-text" name="text" value="${esc(t.text || '')}" required dir="auto"></div>
    <div class="two"><div class="field"><label for="t-due">עד מתי</label><input id="t-due" type="date" name="due" value="${esc(t.due || '')}"></div>
    <div class="field"><label for="t-w">שייך ל</label><select id="t-w" name="world"><option value="general">כללי</option><option value="brothers" ${t.world === 'brothers' ? 'selected' : ''}>האחים</option>${S.me === 'dor' ? `<option value="mba" ${t.world === 'mba' ? 'selected' : ''}>MBA</option>` : ''}</select></div></div>
    <div class="sheet-actions"><button class="btn block">שמירה</button>${id ? '<button type="button" class="btn danger" id="del">מחיקה</button>' : ''}</div></form>`, sh => {
    sh.querySelector('#taskf').onsubmit = async e => {
      e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)); closeSheet();
      if (id) await updateDoc(doc(db, 'personal', S.me, 'tasks', id), d); else await addDoc(collection(db, 'personal', S.me, 'tasks'), { ...d, done: false });
      toast('נשמר');
    };
    sh.querySelector('#del')?.addEventListener('click', async () => { await deleteDoc(doc(db, 'personal', S.me, 'tasks', id)); closeSheet(); toast('נמחק'); });
  });
}

// ----- expenses -----
function balances() {
  const bal = { dor: 0, moti: 0, ben: 0 };
  for (const e of S.expenses) {
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
  const { bal, tx } = balances(), me = S.me, my = bal[me];
  const mine = tx.filter(t => t.from === me || t.to === me), others = tx.filter(t => t.from !== me && t.to !== me);
  const list = [...S.expenses].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const total = S.expenses.filter(e => e.type !== 'settle').reduce((s, e) => s + (e.currency === 'ILS' ? e.amount / S.rate : e.amount), 0);
  return `<section class="balance"><div class="big">${Math.abs(my) < .01 ? 'אתה מאוזן 👌' : my > 0 ? `חייבים לך ${money(my)}` : `אתה חייב ${money(my)}`}</div>
      <div class="sub">סה״כ הוצאות משותפות ${money(total)} · דולר = <bdi>₪${S.rate.toFixed(2)}</bdi></div>
      ${mine.length ? `<div class="owe">${mine.map(t => `<div class="row"><div class="grow">${t.from === me ? `אתה צריך להעביר ל${whoName(t.to)}` : `${whoName(t.from)} צריך להעביר לך`}</div>${money(t.amt)}${t.from === me ? `<button class="btn sm" data-settle="${t.to}" data-amt="${t.amt.toFixed(2)}">העברתי</button>` : ''}</div>`).join('')}</div>` : ''}</section>
    ${others.length ? `<p class="small muted" style="margin:10px 4px 0">בין השניים האחרים: ${others.map(t => `${whoName(t.from)} ← ${whoName(t.to)} ${money(t.amt)}`).join(', ')}</p>` : ''}
    <div class="sec"><h2>כל ההוצאות</h2></div>
    ${list.length ? `<div class="card">${list.map(e => `<div class="li" data-exp="${e.id}" role="button" tabindex="0"><span class="avatar" style="--c:${PEOPLE[e.payer]?.color}">${whoName(e.payer)[0]}</span><div class="main"><div class="title">${e.type === 'settle' ? `העברה ל${whoName(e.participants[0])}` : bdi(e.desc)}</div><div class="sub">${whoName(e.payer)} שילם${e.type === 'settle' ? '' : ` · ${e.participants.length === 3 ? 'לכולם' : 'ל' + e.participants.map(whoName).join(' ול')}`} · ${fmtDay(e.date)}</div></div><bdi class="amt">${e.currency === 'ILS' ? '₪' : '$'}${Number(e.amount).toFixed(e.amount % 1 ? 2 : 0)}</bdi></div>`).join('')}</div>`
      : '<div class="card empty"><span class="em">💵</span><strong>עוד אין הוצאות</strong>מי ששילם על משהו משותף רושם כאן, והחשבון נסגר לבד.</div>'}`;
};
AFTER.expenses = () => {
  $('#main').querySelectorAll('[data-exp]').forEach(el => el.onclick = () => editExpense(el.dataset.exp));
  $('#main').querySelectorAll('[data-settle]').forEach(b => b.onclick = async () => {
    if (!confirm(`לרשום שהעברת ל${whoName(b.dataset.settle)} $${b.dataset.amt}?`)) return;
    await addDoc(collection(db, 'expenses'), { type: 'settle', desc: 'העברה', amount: +b.dataset.amt, currency: 'USD', payer: S.me, participants: [b.dataset.settle], date: nyNow().date, createdBy: S.me, createdAt: Date.now() });
    toast('נרשם');
  });
};
FAB.expenses = ['הוצאה', () => editExpense(null)];
function editExpense(id) {
  const e = id ? S.expenses.find(x => x.id === id) : { currency: 'USD', payer: S.me, participants: Object.keys(PEOPLE), date: nyNow().date };
  if (e.type === 'settle') { openSheet(`<h2>העברה</h2><p>${whoName(e.payer)} העביר ל${whoName(e.participants[0])} ${money(e.amount)}</p><button class="btn danger block" id="del">ביטול ההעברה</button>`, sh => sh.querySelector('#del').onclick = async () => { await deleteDoc(doc(db, 'expenses', id)); closeSheet(); }); return; }
  openSheet(`<h2>${id ? 'עריכת הוצאה' : 'הוצאה חדשה'}</h2><form id="expf">
    <div class="field"><label for="e-desc">על מה</label><input id="e-desc" name="desc" value="${esc(e.desc || '')}" required dir="auto" placeholder="כרטיסים לברודוויי"></div>
    <div class="two"><div class="field"><label for="e-amt">סכום</label><input id="e-amt" name="amount" type="number" step="0.01" min="0" inputmode="decimal" value="${e.amount ?? ''}" required dir="ltr"></div>
      <div class="field"><span class="lbl">מטבע</span><div class="seg">${[['USD', '$ דולר'], ['ILS', '₪ שקל']].map(([v, l]) => `<label><input type="radio" name="currency" value="${v}" ${e.currency === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></div></div>
    <div class="field"><span class="lbl">מי שילם</span><div class="seg">${Object.entries(PEOPLE).map(([k, p]) => `<label><input type="radio" name="payer" value="${k}" ${e.payer === k ? 'checked' : ''}><span>${p.name}</span></label>`).join('')}</div></div>
    <div class="field"><span class="lbl">על מי זה מתחלק (שווה בשווה)</span><div class="pills">${Object.entries(PEOPLE).map(([k, p]) => `<label><input type="checkbox" name="participants" value="${k}" ${e.participants.includes(k) ? 'checked' : ''}>${p.name}</label>`).join('')}</div></div>
    <div class="field"><label for="e-date">תאריך</label><input id="e-date" type="date" name="date" value="${esc(e.date)}"></div>
    <div class="sheet-actions"><button class="btn block">שמירה</button>${id ? '<button type="button" class="btn danger" id="del">מחיקה</button>' : ''}</div></form>`, sh => {
    sh.querySelector('#expf').onsubmit = async ev => {
      ev.preventDefault(); const f = new FormData(ev.target), parts = f.getAll('participants');
      if (!parts.length) return toast('צריך לבחור לפחות אחד');
      const d = { desc: f.get('desc'), amount: +f.get('amount'), currency: f.get('currency'), payer: f.get('payer'), participants: parts, date: f.get('date'), type: 'expense' };
      closeSheet(); if (id) await updateDoc(doc(db, 'expenses', id), { ...d, updatedBy: S.me }); else await addDoc(collection(db, 'expenses'), { ...d, createdBy: S.me, createdAt: Date.now() });
      toast('נשמר');
    };
    sh.querySelector('#del')?.addEventListener('click', async () => { if (confirm('למחוק?')) { await deleteDoc(doc(db, 'expenses', id)); closeSheet(); } });
  });
}

// ----- people -----
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
VIEWS.flights = () => { const l = sortedFlights(); return l.length ? `<div style="display:flex;flex-direction:column;gap:12px;margin-top:8px">${l.map(f => flightCard(f, true)).join('')}</div><p class="hint">השעות מקומיות בכל שדה.</p>` : '<div class="card empty"><span class="em">✈️</span><strong>עוד אין טיסות</strong>מוסיפים בכפתור למטה: מספר טיסה, שדות ושעות.</div>'; };
AFTER.flights = () => $('#main').querySelectorAll('[data-flight]').forEach(b => b.onclick = () => editFlight(b.dataset.flight));
FAB.flights = ['טיסה', () => editFlight(null)];
function editFlight(id) {
  const f = id ? S.flights.find(x => x.id === id) : {};
  const sp = v => v ? [v.slice(0, 10), v.slice(11, 16)] : ['', ''];
  const [dd, dt] = sp(f.dep), [ad, at] = sp(f.arr);
  openSheet(`<h2>${id ? 'עריכת טיסה' : 'טיסה חדשה'}</h2><form id="flf">
    <div class="two"><div class="field"><label for="fl-code">מספר טיסה</label><input id="fl-code" name="code" value="${esc(f.code || '')}" required dir="ltr" placeholder="DL 2654"></div><div class="field"><label for="fl-car">קוד חברה (לסמל)</label><input id="fl-car" name="carrier" value="${esc(f.carrier || '')}" dir="ltr" maxlength="2" placeholder="DL"></div></div>
    <div class="two"><div class="field"><label for="fl-from">משדה</label><input id="fl-from" name="from" value="${esc(f.from || '')}" required dir="ltr" maxlength="3" placeholder="MSP"></div><div class="field"><label for="fl-to">לשדה</label><input id="fl-to" name="to" value="${esc(f.to || '')}" required dir="ltr" maxlength="3" placeholder="JFK"></div></div>
    <div class="two"><div class="field"><label for="fl-dd">תאריך המראה</label><input id="fl-dd" type="date" name="dd" value="${dd}" required></div><div class="field"><label for="fl-dt">שעת המראה</label><input id="fl-dt" type="time" name="dt" value="${dt}" required></div></div>
    <div class="two"><div class="field"><label for="fl-ad">תאריך נחיתה</label><input id="fl-ad" type="date" name="ad" value="${ad}"></div><div class="field"><label for="fl-at">שעת נחיתה</label><input id="fl-at" type="time" name="at" value="${at}"></div></div>
    <p class="small muted" style="margin:-4px 0 12px">שעות מקומיות, כמו שמופיע בכרטיס.</p>
    <div class="two"><div class="field"><label for="fl-conf">מספר הזמנה</label><input id="fl-conf" name="conf" value="${esc(f.conf || '')}" dir="ltr"></div><div class="field"><label for="fl-seat">מושב</label><input id="fl-seat" name="seat" value="${esc(f.seat || '')}" dir="ltr"></div></div>
    <div class="sheet-actions"><button class="btn block">שמירה</button>${id ? '<button type="button" class="btn danger" id="del">מחיקה</button>' : ''}</div></form>`, sh => {
    sh.querySelector('#flf').onsubmit = async e => {
      e.preventDefault(); const x = Object.fromEntries(new FormData(e.target));
      const code = x.code.toUpperCase().trim();
      const d = { ...f, code, carrier: (x.carrier || code.replace(/\s+/g, '').slice(0, 2)).toUpperCase(), from: x.from.toUpperCase(), to: x.to.toUpperCase(), dep: `${x.dd}T${x.dt}`, arr: x.ad && x.at ? `${x.ad}T${x.at}` : '', conf: x.conf, seat: x.seat };
      delete d.id; closeSheet();
      if (id) await setDoc(doc(db, 'personal', S.me, 'flights', id), d); else await addDoc(collection(db, 'personal', S.me, 'flights'), d);
      toast('הטיסה נשמרה');
    };
    sh.querySelector('#del')?.addEventListener('click', async () => { if (confirm('למחוק את הטיסה?')) { await deleteDoc(doc(db, 'personal', S.me, 'flights', id)); closeSheet(); } });
  });
}

// ----- personal -----
VIEWS.personal = () => {
  const seg = `<div class="seg" style="margin:8px 0 16px">${[['tasks', '✅ משימות'], ['notes', '📝 פתקים'], ['packing', '🧳 אריזה']].map(([k, l]) => `<label><input type="radio" name="ptab" value="${k}" ${S.tab === k ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>`;
  if (S.tab === 'notes') return seg + `<div class="card pad"><label for="notes" class="sr">פתקים</label><textarea id="notes" dir="auto" style="width:100%;min-height:55vh;border:0;background:none;resize:vertical;font-size:16px;line-height:1.7;outline:none" placeholder="דברים לזכור. רק אתה רואה את זה.">${esc(S.notes)}</textarea></div><p class="hint">נשמר לבד</p>`;
  if (S.tab === 'packing') {
    const l = [...S.packing].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
    return seg + `<div class="card">${l.map(p => `<div class="li ${p.done ? 'done' : ''}"><input type="checkbox" class="check" data-pack="${p.id}" ${p.done ? 'checked' : ''} aria-label="נארז: ${esc(p.text)}"><div class="main"><div class="title">${bdi(p.text)}</div></div><button class="edited" data-unpack="${p.id}">הסרה</button></div>`).join('')}
      <form class="li" id="packf"><label for="pk" class="sr">פריט חדש</label><input id="pk" name="t" class="grow" placeholder="להוסיף פריט…" dir="auto" style="border:0;background:none;font-size:16px;outline:none;min-height:40px"><button class="btn sm">הוספה</button></form></div>
      <p class="hint">${l.filter(p => p.done).length} מתוך ${l.length} ארוזים</p>`;
  }
  const all = [...S.tasks].sort((a, b) => (a.done - b.done) || (a.due || '9').localeCompare(b.due || '9'));
  return seg + (all.length ? `<div class="card">${all.map(taskRow).join('')}</div>` : '<div class="card empty">אין משימות.</div>');
};
AFTER.personal = () => {
  bindCommon();
  $('#main').querySelectorAll('[name=ptab]').forEach(r => r.onchange = () => { S.tab = r.value; $('#fab').hidden = S.tab !== 'tasks'; render(); });
  const n = $('#notes'); if (n) { let t; n.oninput = () => { clearTimeout(t); t = setTimeout(() => setDoc(doc(db, 'personal', S.me, 'notes', 'main'), { text: n.value, at: Date.now() }), 600); }; n.onblur = () => { S.notes = n.value; }; }
  $('#main').querySelectorAll('[data-pack]').forEach(c => c.onchange = () => updateDoc(doc(db, 'personal', S.me, 'packing', c.dataset.pack), { done: c.checked }));
  $('#main').querySelectorAll('[data-unpack]').forEach(b => b.onclick = () => deleteDoc(doc(db, 'personal', S.me, 'packing', b.dataset.unpack)));
  const pf = $('#packf'); if (pf) pf.onsubmit = async e => { e.preventDefault(); const v = pf.t.value.trim(); if (!v) return; await addDoc(collection(db, 'personal', S.me, 'packing'), { text: v, done: false, order: S.packing.length }); };
  if (S.tab !== 'tasks') $('#fab').hidden = true;
};
FAB.personal = ['משימה', () => editTask(null)];

// ----- settings -----
VIEWS.settings = () => {
  const th = localStorage.getItem('nyc26_theme') || 'light';
  return `<div class="sec"><h2>תצוגה</h2></div><div class="card pad"><div class="seg">${[['light', '☀️ בהיר'], ['dark', '🌙 כהה'], ['auto', 'לפי הטלפון']].map(([v, l]) => `<label><input type="radio" name="theme" value="${v}" ${th === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></div>
    <div class="sec"><h2>משתמש</h2></div><div class="card pad"><p style="margin-top:0">מחובר בתור <b>${PEOPLE[S.me].name}</b> במכשיר הזה.</p><button class="btn line" id="logout">החלפת משתמש</button></div>
    <p class="hint">תמונות: <a href="${PHOTOS.brothers.credit}" target="_blank" rel="noopener">פסל החירות</a> ו<a href="${PHOTOS.mba.credit}" target="_blank" rel="noopener">האמפייר סטייט</a> מוויקימדיה קומונס. מפה: OpenStreetMap ו־CARTO.</p>`;
};
AFTER.settings = () => {
  $('#main').querySelectorAll('[name=theme]').forEach(r => r.onchange = () => { localStorage.setItem('nyc26_theme', r.value); applyTheme(); });
  $('#logout').onclick = logout;
};
