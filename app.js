// NYC 2026 — trip app. Firebase (Firestore + anonymous auth) on GitHub Pages.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, collection, onSnapshot, writeBatch, limit, query
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { SEED } from './data.js';

// ▼▼▼ הדבק כאן את ה־config מהפרויקט שלך בפיירבייס (Project settings → Your apps → Web) ▼▼▼
const firebaseConfig = {
  apiKey: "AIzaSyD8LfeooJ1pBiIq0hWO4BJqB2bH60zfy0g",
  authDomain: "nyc-2026-67f7c.firebaseapp.com",
  projectId: "nyc-2026-67f7c",
  storageBucket: "nyc-2026-67f7c.firebasestorage.app",
  messagingSenderId: "294727573533",
  appId: "1:294727573533:web:5cb76e6104068ba3d4e6f4"
};

// ▲▲▲

const PEOPLE = {
  dor:  { name: 'דור',  color: '#FCCC0A', ink: '#000', letter: 'ד' },
  moti: { name: 'מוטי', color: '#EE352E', ink: '#fff', letter: 'מ' },
  ben:  { name: 'בן',   color: '#0039A6', ink: '#fff', letter: 'ב' }
};
const WORLDS = {
  brothers: { name: 'האחים', long: 'האחים בניו יורק', range: '30/9 – 4/10', col: 'brothers_items',
    colors: ['#FF6319', '#00933C', '#EE352E', '#B933AD', '#FCCC0A'] },
  mba: { name: 'MBA', long: 'משלחת ה־MBA', range: '4/10 – 10/10', col: 'mba_items',
    colors: ['#0039A6', '#6CBE45', '#FF6319', '#B933AD', '#EE352E', '#00933C', '#A7A9AC'] }
};
const LIGHT_BULLETS = ['#FCCC0A', '#A7A9AC', '#6CBE45'];
const DEPARTURE = new Date('2026-09-30T01:00:00+03:00');
const SPLIT_NY = '2026-10-04 15:00';
const AIRPORT_OFFSET = { TLV: '+03:00', JFK: '-04:00', EWR: '-04:00', LGA: '-04:00', MSP: '-05:00', ORD: '-05:00', CDG: '+02:00', LHR: '+01:00', FRA: '+02:00', IST: '+03:00' };
const AIRPORT_CITY = { TLV: 'תל אביב', JFK: 'ניו יורק', EWR: 'ניוארק', LGA: 'ניו יורק', MSP: 'מיניאפוליס', ORD: 'שיקגו', CDG: 'פריז', LHR: 'לונדון', FRA: 'פרנקפורט', IST: 'איסטנבול' };
const WD = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

// ---------------- state ----------------
const S = {
  uid: null, me: null, world: 'brothers', view: 'home', day: {}, tab: 'tasks',
  items: { brothers: [], mba: [] }, expenses: [], settings: {}, tasks: [], flights: [], packing: [], notes: '',
  rate: 3.7, weather: {}, unsubs: [], drawer: false
};

// ---------------- firebase ----------------
let app, auth, db;
const configured = !String(FIREBASE_CONFIG.apiKey).includes('PASTE');
if (configured) {
  app = initializeApp(FIREBASE_CONFIG);
  auth = getAuth(app);
  db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
}

// ---------------- utils ----------------
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const bdi = s => `<bdi>${esc(s)}</bdi>`;
const safeUrl = u => /^https?:\/\//i.test(u || '') ? u : '';
const uid8 = () => Math.random().toString(36).slice(2, 10);
const other = p => Object.keys(PEOPLE).filter(k => k !== p);

function tzParts(tz, d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}
const nyNow = () => tzParts('America/New_York');
const ilNow = () => tzParts('Asia/Jerusalem');
const nowKey = () => { const n = nyNow(); return `${n.date} ${n.time}`; };
const key = it => `${it.date} ${it.time || '00:00'}`;
function fmtDay(date, withWd = true) {
  const d = new Date(date + 'T12:00:00');
  return `${withWd ? WD[d.getDay()] + ' ' : ''}${d.getDate()}/${d.getMonth() + 1}`;
}
function addMin(t, m) { const [h, mi] = t.split(':').map(Number); const x = h * 60 + mi + m; return `${String(Math.floor(x / 60) % 24).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`; }
function ago(ms) {
  const s = (Date.now() - ms) / 1000;
  if (s < 60) return 'עכשיו'; if (s < 3600) return `לפני ${Math.round(s / 60)} ד׳`;
  if (s < 86400) return `לפני ${Math.round(s / 3600)} ש׳`; return `לפני ${Math.round(s / 86400)} ימים`;
}
const mapsUrl = a => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a)}`;
const dirUrl = a => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(a)}&travelmode=transit`;
const routeUrl = list => 'https://www.google.com/maps/dir/' + list.map(a => encodeURIComponent(a)).join('/');
const liSearch = (name, company) => `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${name} ${company}`)}`;
const frUrl = code => `https://www.flightradar24.com/data/flights/${String(code).replace(/\s+/g, '').toLowerCase()}`;
async function sha(s) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
const pinHash = (p, pin) => sha(`nyc26:${p}:${pin}`);
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2200); }
function money(usd) { const v = Math.abs(usd); return `<bdi class="ltr amt">$${v.toFixed(v % 1 ? 2 : 0)}</bdi>`; }
const days = w => SEED.days[w];
const dayIndex = (w, date) => days(w).findIndex(d => d.date === date);
const dayColor = (w, date) => WORLDS[w].colors[Math.max(0, dayIndex(w, date)) % WORLDS[w].colors.length];
const bulletInk = c => LIGHT_BULLETS.includes(c) ? 'dark-ink' : '';
const itemsOf = (w, date) => S.items[w].filter(i => !date || i.date === date).sort((a, b) => key(a).localeCompare(key(b)));
const icon = {
  menu: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  plus: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  nav: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M21 3 3 10.5l7.5 3L13.5 21z"/></svg>',
  link: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>',
  plane: '<svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/></svg>'
};

// ---------------- boot ----------------
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
applyTheme();
if (!configured) {
  $('#app').innerHTML = `<div class="login"><div class="brand"><span class="bullet big dark-ink" style="--c:#FCCC0A">NY</span><h1>כמעט מוכן</h1><p>צריך להדביק את ה־config של פיירבייס בראש הקובץ app.js. ההוראות המלאות בקובץ README.</p></div></div>`;
} else {
  onAuthStateChanged(auth, async user => {
    if (!user) { signInAnonymously(auth).catch(e => fatal(e)); return; }
    S.uid = user.uid;
    try {
      const ses = await getDoc(doc(db, 'sessions', S.uid));
      if (ses.exists() && PEOPLE[ses.data().profile]) start(ses.data().profile);
      else showLogin();
    } catch (e) { showLogin(); }
  });
}
function fatal(e) { console.error(e); $('#app').innerHTML = `<div class="login"><div class="brand"><h1>אין חיבור</h1><p>${esc(e.message)}</p><button class="btn" onclick="location.reload()">לנסות שוב</button></div></div>`; }

// ---------------- login ----------------
async function showLogin() {
  let setupDone = false;
  try { setupDone = (await getDoc(doc(db, 'meta', 'setup'))).exists(); } catch (e) {}
  const el = $('#app');
  if (!setupDone) {
    el.innerHTML = `<div class="login setup"><div class="brand">
      <span class="bullet big dark-ink" style="--c:#FCCC0A">NY</span>
      <h1>הגדרה ראשונה</h1><p>קובעים קוד של 4 ספרות לכל אחד. אחרי השמירה אי אפשר לשנות מכאן, רק מקונסולת פיירבייס.</p>
      <form id="setup">${Object.entries(PEOPLE).map(([k, p]) => `<label for="pin-${k}">הקוד של ${p.name}</label><input id="pin-${k}" name="${k}" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" required autocomplete="off">`).join('')}
      <button class="btn block" style="margin-top:22px">לשמור ולהתחיל</button></form></div></div>`;
    $('#setup').onsubmit = async e => {
      e.preventDefault();
      const f = new FormData(e.target);
      try {
        for (const k of Object.keys(PEOPLE)) await setDoc(doc(db, 'users', k), { name: PEOPLE[k].name, pinHash: await pinHash(k, f.get(k)) });
        await setDoc(doc(db, 'meta', 'setup'), { at: Date.now() });
        toast('הקודים נשמרו'); showLogin();
      } catch (err) { toast('השמירה נכשלה. בדוק שחוקי האבטחה הועלו'); console.error(err); }
    };
    return;
  }
  el.innerHTML = `<div class="login"><div class="brand">
    <span class="bullet big dark-ink" style="--c:#FCCC0A">NY</span>
    <h1>ניו יורק 2026</h1><p>מי נכנס?</p></div>
    <div class="who-list">${Object.entries(PEOPLE).map(([k, p]) => `<button class="who-btn" data-who="${k}"><span class="bullet ${bulletInk(p.color)}" style="--c:${p.color}">${p.letter}</span><span>${p.name}<span class="sub">${k === 'dor' ? 'האחים וה־MBA' : 'האחים, 30/9 – 4/10'}</span></span></button>`).join('')}</div></div>`;
  el.querySelectorAll('[data-who]').forEach(b => b.onclick = () => showPin(b.dataset.who));
}
function showPin(profile) {
  const p = PEOPLE[profile]; let pin = '';
  $('#app').innerHTML = `<div class="login"><div class="brand" style="text-align:center">
    <span class="bullet big ${bulletInk(p.color)}" style="--c:${p.color}">${p.letter}</span>
    <h1 style="font-size:32px">היי ${p.name}</h1><p>הקוד שלך</p>
    <div class="pin-dots" aria-live="polite"><i></i><i></i><i></i><i></i></div>
    <div class="pad-grid">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-n="${n}">${n}</button>`).join('')}<button class="ghost" data-back>חזרה</button><button data-n="0">0</button><button class="ghost" data-del aria-label="מחיקה">⌫</button></div></div></div>`;
  const dots = () => $('.pin-dots').querySelectorAll('i').forEach((d, i) => d.classList.toggle('on', i < pin.length));
  const submit = async () => {
    try {
      await setDoc(doc(db, 'sessions', S.uid), { profile, pinHash: await pinHash(profile, pin), at: Date.now() });
      start(profile);
    } catch (e) {
      pin = ''; dots(); const d = $('.pin-dots'); d.classList.remove('shake'); void d.offsetWidth; d.classList.add('shake'); toast('קוד שגוי');
    }
  };
  $('.pad-grid').onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.back !== undefined) return showLogin();
    if (b.dataset.del !== undefined) pin = pin.slice(0, -1);
    else if (b.dataset.n && pin.length < 4) pin += b.dataset.n;
    dots(); if (pin.length === 4) submit();
  };
}
async function logout() {
  S.unsubs.forEach(u => u()); S.unsubs = [];
  try { await deleteDoc(doc(db, 'sessions', S.uid)); } catch (e) {}
  S.me = null; closeDrawer(); showLogin();
}

// ---------------- start & data ----------------
async function start(profile) {
  S.me = profile;
  const saved = localStorage.getItem('nyc26_world');
  S.world = profile === 'dor' ? (saved || (nowKey() >= SPLIT_NY ? 'mba' : 'brothers')) : 'brothers';
  initDays();
  shell();
  subscribe();
  seed().catch(e => console.error('seed', e));
  fetchRate(); fetchWeather();
  setInterval(tick, 30000);
}
function initDays() {
  const n = nyNow().date;
  for (const w of Object.keys(WORLDS)) {
    const ds = days(w).map(d => d.date);
    S.day[w] = ds.includes(n) ? n : (n > ds[ds.length - 1] ? ds[ds.length - 1] : ds[0]);
  }
}
function subscribe() {
  const on = (ref, fn) => S.unsubs.push(onSnapshot(ref, fn, e => console.error(e)));
  on(collection(db, 'brothers_items'), s => { S.items.brothers = s.docs.map(d => ({ id: d.id, ...d.data() })); refresh(); });
  on(collection(db, 'expenses'), s => { S.expenses = s.docs.map(d => ({ id: d.id, ...d.data() })); refresh(); });
  on(doc(db, 'settings', 'app'), s => { S.settings = s.data() || {}; refresh(); });
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
  if (await empty('brothers_items')) {
    const b = writeBatch(db); SEED.brothers.forEach(({ id, ...it }) => b.set(doc(db, 'brothers_items', id), { status: 'none', ...it, ...stamp })); await b.commit();
  }
  if (S.me === 'dor' && await empty('mba_items')) {
    const b = writeBatch(db); SEED.mba.forEach(({ id, ...it }) => b.set(doc(db, 'mba_items', id), { status: 'none', ...it, ...stamp })); await b.commit();
  }
  const flag = doc(db, 'personal', S.me, 'meta', 'seeded');
  if (!(await getDoc(flag)).exists()) {
    const b = writeBatch(db);
    (SEED.flights[S.me] || []).forEach(({ id, ...f }) => b.set(doc(db, 'personal', S.me, 'flights', id), f));
    (SEED.tasks[S.me] || []).forEach(({ id, ...t }) => b.set(doc(db, 'personal', S.me, 'tasks', id), { done: false, ...t }));
    SEED.packing.forEach((t, i) => b.set(doc(db, 'personal', S.me, 'packing', 'p' + String(i).padStart(2, '0')), { text: t, done: false, order: i }));
    b.set(flag, { at: Date.now() });
    await b.commit();
  }
}
async function fetchRate() {
  try { const r = await (await fetch('https://open.er-api.com/v6/latest/USD')).json(); if (r?.rates?.ILS) { S.rate = r.rates.ILS; refresh(); } } catch (e) {}
}
async function fetchWeather() {
  try {
    const r = await (await fetch('https://api.open-meteo.com/v1/forecast?latitude=40.75&longitude=-73.99&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=America%2FNew_York&forecast_days=16')).json();
    r.daily.time.forEach((d, i) => S.weather[d] = { code: r.daily.weather_code[i], max: Math.round(r.daily.temperature_2m_max[i]), min: Math.round(r.daily.temperature_2m_min[i]), rain: r.daily.precipitation_probability_max[i] });
    refresh();
  } catch (e) {}
}
function wxText(date) {
  const w = S.weather[date]; if (!w) return '';
  const c = w.code, label = c === 0 ? 'בהיר' : c <= 2 ? 'מעונן חלקית' : c === 3 ? 'מעונן' : c <= 48 ? 'ערפל' : c <= 67 || (c >= 80 && c <= 82) ? 'גשם' : c <= 77 ? 'שלג' : 'סופה';
  return `<span class="weather">${label} · <bdi>${w.min}°–${w.max}°</bdi>${w.rain >= 40 ? ` · ${w.rain}% גשם` : ''}</span>`;
}

// ---------------- shell / drawer ----------------
function shell() {
  document.documentElement.dataset.world = S.world;
  $('#app').innerHTML = `<header class="sign" id="sign"></header><main id="main"></main>
    <button class="fab" id="fab" aria-label="הוספה" hidden>${icon.plus}</button>
    <div class="scrim" id="scrim"></div><nav class="drawer" id="drawer" aria-label="תפריט"></nav>`;
  $('#scrim').onclick = closeDrawer;
  $('#fab').onclick = () => FAB[S.view]?.();
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeSheet(); closeDrawer(); } });
  render();
}
let raf; function refresh() { cancelAnimationFrame(raf); raf = requestAnimationFrame(render); }
function tick() { renderHeader(); if (S.view === 'home' || S.view === 'schedule') render(); }
function render() {
  if (!S.me) return;
  document.documentElement.dataset.world = S.world;
  renderHeader();
  const m = $('#main'); if (!m) return;
  if (S.view === 'personal' && document.activeElement?.id === 'notes') return;
  m.innerHTML = (VIEWS[S.view] || VIEWS.home)();
  $('#fab').hidden = !FAB[S.view];
  AFTER[S.view]?.();
}
function renderHeader() {
  const h = $('#sign'); if (!h) return;
  const ny = nyNow(), il = ilNow();
  const titles = { home: WORLDS[S.world].long, schedule: 'לו"ז', map: 'מפה', tasks: 'משימות', expenses: 'הוצאות', people: 'אנשים', flights: 'הטיסות שלי', personal: 'האזור שלי', settings: 'הגדרות' };
  let bar = '';
  if (S.view === 'schedule') {
    bar = `<div class="daybar" role="tablist">${days(S.world).map((d, i) => {
      const c = dayColor(S.world, d.date);
      return `<button class="daybtn" role="tab" data-day="${d.date}" aria-current="${d.date === S.day[S.world]}"><span class="bullet ${bulletInk(c)}" style="--c:${c}">${i + 1}</span>${fmtDay(d.date)}</button>`;
    }).join('')}</div>`;
  }
  h.innerHTML = `<div class="sign-row"><button class="icon-btn" id="menu" aria-label="תפריט">${icon.menu}</button>
    <h1>${esc(titles[S.view])}</h1>
    <div class="clocks"><b><bdi>${ny.time}</bdi> ניו יורק</b><span><bdi>${il.time}</bdi> ישראל</span></div></div>${bar}`;
  $('#menu').onclick = openDrawer;
  h.querySelectorAll('[data-day]').forEach(b => b.onclick = () => { S.day[S.world] = b.dataset.day; render(); window.scrollTo({ top: 0 }); });
}
function openDrawer() {
  const p = PEOPLE[S.me], w = S.world;
  const needCount = S.items[w].filter(i => i.status === 'need').length;
  const nav = [['home', 'עכשיו'], ['schedule', 'לו"ז'], ['map', 'מפה'], ['tasks', 'משימות', needCount], w === 'brothers' ? ['expenses', 'הוצאות'] : ['people', 'אנשים'], ['-'], ['flights', 'הטיסות שלי'], ['personal', 'האזור שלי'], ['settings', 'הגדרות']];
  $('#drawer').innerHTML = `<div class="who"><span class="bullet ${bulletInk(p.color)}" style="--c:${p.color}">${p.letter}</span><div><b>${p.name}</b><div class="small" style="color:#9aa0a8">NYC 2026</div></div></div>
    ${S.me === 'dor' ? `<div class="worlds">${Object.entries(WORLDS).map(([k, x]) => `<button class="${k}" data-world="${k}" aria-pressed="${k === w}"><span class="bullet sm ${k === 'brothers' ? 'dark-ink' : ''}" style="--c:${k === 'brothers' ? '#FCCC0A' : '#0039A6'}">${k === 'brothers' ? 'א' : 'M'}</span><b>${x.name}</b><small><bdi>${x.range}</bdi></small></button>`).join('')}</div>` : ''}
    <ul class="nav">${nav.map(([k, l, c]) => k === '-' ? '<li class="sep" role="separator"></li>' : `<li><button data-view="${k}" ${k === S.view ? 'aria-current="page"' : ''}><span class="dot"></span>${l}${c ? `<span class="count">${c}</span>` : ''}</button></li>`).join('')}</ul>`;
  $('#drawer').querySelectorAll('[data-view]').forEach(b => b.onclick = () => go(b.dataset.view));
  $('#drawer').querySelectorAll('[data-world]').forEach(b => b.onclick = () => { S.world = b.dataset.world; localStorage.setItem('nyc26_world', S.world); if (S.world === 'mba' && S.view === 'expenses') S.view = 'home'; if (S.world === 'brothers' && S.view === 'people') S.view = 'home'; openDrawer(); render(); });
  $('#drawer').classList.add('open'); $('#scrim').classList.add('open'); S.drawer = true;
}
function closeDrawer() { $('#drawer')?.classList.remove('open'); $('#scrim')?.classList.remove('open'); S.drawer = false; }
function go(v) { S.view = v; closeDrawer(); render(); window.scrollTo({ top: 0 }); }

// ---------------- sheet ----------------
function openSheet(html, mount) {
  $('#sheet-root').innerHTML = `<div class="sheet-scrim" data-close></div><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div>`;
  $('#sheet-root [data-close]').onclick = closeSheet;
  $('#sheet-root').querySelectorAll('[data-dismiss]').forEach(b => b.onclick = closeSheet);
  mount?.($('#sheet-root .sheet'));
  setTimeout(() => $('#sheet-root .sheet input:not([type=hidden]):not([type=radio]):not([type=checkbox])')?.focus({ preventScroll: true }), 50);
}
function closeSheet() { $('#sheet-root').innerHTML = ''; }

// ---------------- items: save / history ----------------
const TRACK = ['title', 'date', 'time', 'end', 'desc', 'address', 'status', 'link', 'linkLabel', 'conf', 'notes', 'speaker', 'role', 'linkedin'];
async function saveItem(w, id, data) {
  const col = WORLDS[w].col;
  if (!id) { await addDoc(collection(db, col), { status: 'none', kind: 'custom', ...data, updatedBy: S.me, updatedAt: Date.now(), history: [] }); return; }
  const cur = S.items[w].find(i => i.id === id) || {};
  const prev = Object.fromEntries(TRACK.filter(k => cur[k] !== undefined).map(k => [k, cur[k]]));
  const history = [{ by: cur.updatedBy || 'seed', at: cur.updatedAt || Date.now(), prev }, ...(cur.history || [])].slice(0, 8);
  await updateDoc(doc(db, col, id), { ...data, updatedBy: S.me, updatedAt: Date.now(), history });
}
const whoName = p => PEOPLE[p]?.name || 'המקור';

// ---------------- views ----------------
const VIEWS = {}, AFTER = {}, FAB = {};

VIEWS.home = () => {
  const w = S.world, nk = nowKey(), now = Date.now();
  let hero = '';
  if (now < DEPARTURE.getTime()) {
    const ms = DEPARTURE - now, d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5);
    hero = `<section class="next"><div class="top"><span>הטיסה הבאה</span><span><bdi>LY 1</bdi> · ${fmtDay('2026-09-30')} · <bdi>01:00</bdi></span></div>
      <div class="countdown"><div class="n"><bdi>${d >= 1 ? d : h}</bdi></div><div class="l">${d >= 1 ? (d === 1 ? 'יום אחד' : 'ימים') : 'שעות'} להמראה<small>תל אביב ← ניו יורק</small></div></div></section>`;
  } else {
    const all = itemsOf(w);
    const idx = all.findIndex(i => key(i) > nk);
    const nxt = idx === -1 ? null : all[idx];
    const cur = [...all].reverse().find(i => key(i) <= nk && nk < `${i.date} ${i.end || addMin(i.time || '00:00', 60)}`);
    if (nxt) {
      const c = dayColor(w, nxt.date), di = dayIndex(w, nxt.date) + 1;
      hero = `<section class="next"><div class="top"><span>התחנה הבאה</span><span>${nxt.date === nyNow().date ? 'היום' : fmtDay(nxt.date)} · <bdi>${esc(nxt.time)}</bdi></span></div>
        <div class="body"><span class="bullet ${bulletInk(c)}" style="--c:${c}">${di}</span><div class="grow"><h2>${bdi(nxt.title)}</h2>
        <div class="when">${esc(nxt.desc || nxt.speaker || '')}</div></div></div>
        <div class="actions">${nxt.address ? `<a class="btn" href="${dirUrl(nxt.address)}" target="_blank" rel="noopener">${icon.nav} איך מגיעים</a>` : ''}
        ${safeUrl(nxt.link) ? `<a class="btn quiet" href="${esc(nxt.link)}" target="_blank" rel="noopener">${esc(nxt.linkLabel || 'קישור')}</a>` : ''}
        <button class="btn quiet" data-open="${nxt.id}">פרטים</button></div>
        ${cur ? `<div class="now-line">עכשיו: ${bdi(cur.title)}</div>` : ''}</section>`;
    } else hero = `<section class="next"><div class="body"><div><h2>החלק הזה של הטיול נגמר</h2><div class="when">אפשר לעבור לחלק השני מהתפריט.</div></div></div></section>`;
  }
  const todayFlight = S.flights.find(f => f.dep?.slice(0, 10) === nyNow().date || f.dep?.slice(0, 10) === ilNow().date);
  const need = S.items[w].filter(i => i.status === 'need').sort((a, b) => key(a).localeCompare(key(b)));
  const tasks = S.tasks.filter(t => !t.done && (t.world === w || t.world === 'general' || !t.world)).sort((a, b) => (a.due || '9').localeCompare(b.due || '9')).slice(0, 4);
  const mine = w === 'mba' ? S.items.mba.filter(i => i.mine).sort((a, b) => key(a).localeCompare(key(b))) : [];
  const today = days(w).find(d => d.date === nyNow().date);
  return `${hero}
    ${todayFlight ? `<div class="section-title">טיסה היום</div>${passHtml(todayFlight)}` : ''}
    ${today ? `<div class="section-title">היום</div><div class="card pad"><div class="row"><div class="grow"><b>${esc(today.title)}</b><div class="small muted">${esc(today.note)}</div></div>${today.dress ? `<span class="chip dress">${esc(today.dress)}</span>` : ''}</div><div style="margin-top:6px">${wxText(today.date)}</div></div>` : ''}
    ${mine.length ? `<div class="section-title">המשימה שלי</div><div class="card">${mine.map(i => `<div class="li" data-open="${i.id}"><span class="chip mine">שלך</span><div class="main"><div class="title">${bdi(i.title)}</div><div class="small muted">${fmtDay(i.date)} · <bdi>${esc(i.time)}</bdi> · ${esc(i.notes || i.desc || '')}</div></div></div>`).join('')}</div>` : ''}
    ${need.length ? `<div class="section-title">צריך להזמין · ${need.length}</div><div class="card">${need.slice(0, 4).map(needRow).join('')}${need.length > 4 ? `<div class="li"><button class="btn quiet sm" data-go="tasks">עוד ${need.length - 4}</button></div>` : ''}</div>` : ''}
    ${tasks.length ? `<div class="section-title">המשימות הקרובות שלך</div><div class="card">${tasks.map(taskRow).join('')}</div>` : ''}`;
};
AFTER.home = () => bindCommon();

function needRow(i) {
  return `<div class="li"><span class="chip need">להזמין</span><div class="main" data-open="${i.id}"><div class="title">${bdi(i.title)}</div><div class="small muted">${fmtDay(i.date)} · <bdi>${esc(i.time)}</bdi></div></div>
    ${safeUrl(i.link) ? `<a class="btn sm" href="${esc(i.link)}" target="_blank" rel="noopener">להזמנה</a>` : ''}<button class="btn quiet sm" data-booked="${i.id}">הוזמן</button></div>`;
}
function taskRow(t) {
  const late = t.due && t.due < nyNow().date && !t.done;
  return `<div class="li ${t.done ? 'done' : ''}"><input type="checkbox" class="check" data-task="${t.id}" ${t.done ? 'checked' : ''} aria-label="בוצע"><div class="main" data-edit-task="${t.id}"><div class="title">${bdi(t.text)}</div>${t.due ? `<div class="small ${late ? 'overdue' : 'muted'}">${late ? 'עבר המועד · ' : 'עד '}${fmtDay(t.due)}</div>` : ''}</div></div>`;
}
function bindCommon() {
  const m = $('#main');
  m.querySelectorAll('[data-open]').forEach(el => el.onclick = e => { if (e.target.closest('a,button:not([data-open])')) return; editItem(S.world, el.dataset.open); });
  m.querySelectorAll('[data-booked]').forEach(b => b.onclick = async () => { await saveItem(S.world, b.dataset.booked, { status: 'booked' }); toast('סומן כהוזמן'); editItem(S.world, b.dataset.booked); });
  m.querySelectorAll('[data-task]').forEach(c => c.onchange = () => updateDoc(doc(db, 'personal', S.me, 'tasks', c.dataset.task), { done: c.checked }));
  m.querySelectorAll('[data-edit-task]').forEach(el => el.onclick = () => editTask(el.dataset.editTask));
  m.querySelectorAll('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
}

// ----- schedule -----
VIEWS.schedule = () => {
  const w = S.world, date = S.day[w], meta = days(w).find(d => d.date === date) || {}, c = dayColor(w, date), di = dayIndex(w, date) + 1;
  const list = itemsOf(w, date), nk = nowKey();
  const stops = list.filter(i => i.address).map(i => i.address);
  const next = list.find(i => key(i) > nk);
  const curId = [...list].reverse().find(i => key(i) <= nk && nk < `${i.date} ${i.end || addMin(i.time || '00:00', 60)}`)?.id;
  return `<div class="dayhead" style="--daycolor:${c}"><span class="bullet big ${bulletInk(c)}" style="--c:${c}">${di}</span><div class="grow">
      <div class="small muted">${fmtDay(date)}</div><h2>${esc(meta.title || '')}</h2><p>${esc(meta.note || '')}</p>
      <div class="meta">${meta.dress ? `<span class="chip dress">קוד לבוש: ${esc(meta.dress)}</span>` : ''}${wxText(date)}</div></div></div>
    ${stops.length > 1 ? `<a class="btn quiet block" style="margin-bottom:16px" href="${routeUrl(stops)}" target="_blank" rel="noopener">${icon.nav} המסלול של היום בגוגל מפות</a>` : ''}
    ${list.length ? `<div class="timeline" style="--daycolor:${c}">${list.map(i => stopHtml(i, i.id === curId, next && i.id === next.id, key(i) < nk && i.id !== curId)).join('')}</div>
      <p class="hint">לחיצה ארוכה על עצירה וגרירה לעיגול של יום אחר מעבירה אותה ליום הזה</p>`
      : `<div class="card empty"><strong>היום הזה ריק</strong>אפשר להוסיף עצירה בכפתור הפלוס.</div>`}`;
};
function stopHtml(i, isNow, isNext, isPast) {
  const st = i.status === 'need' ? '<span class="chip need">צריך להזמין</span>' : i.status === 'booked' ? `<span class="chip booked">הוזמן${i.conf ? ` · <bdi>${esc(i.conf)}</bdi>` : ''}</span>` : '';
  const edited = i.updatedBy && i.updatedBy !== 'seed' ? `<button class="edited" data-hist="${i.id}">עודכן ע״י ${whoName(i.updatedBy)} · ${ago(i.updatedAt)}</button>` : '';
  return `<article class="stop ${isNow ? 'now' : ''} ${isPast ? 'past' : ''} ${i.kind === 'free' ? 'free' : ''}" data-id="${i.id}">
    <div class="t"><span class="node"></span></div>
    <div class="c card" data-open="${i.id}">
      <div class="row"><span class="time"><bdi>${esc(i.time || '')}${i.end ? `–${esc(i.end)}` : ''}</bdi></span>${isNow ? '<span class="chip mine">עכשיו</span>' : isNext ? '<span class="chip">הבא</span>' : ''}${i.mine ? '<span class="chip mine">שלך</span>' : ''}</div>
      <h3>${bdi(i.title)}</h3>
      ${i.desc ? `<p class="desc">${bdi(i.desc)}</p>` : ''}
      ${i.speaker ? `<div class="speaker"><b>${bdi(i.speaker)}</b>${i.role ? ` <span class="muted small">· ${bdi(i.role)}</span>` : ''}</div>` : ''}
      ${i.notes ? `<div class="note">${bdi(i.notes)}</div>` : ''}
      <div class="tools">${i.address ? `<a class="btn sm" href="${dirUrl(i.address)}" target="_blank" rel="noopener">${icon.nav} נווט</a>` : ''}
        ${safeUrl(i.link) ? `<a class="btn quiet sm" href="${esc(i.link)}" target="_blank" rel="noopener">${icon.link} ${esc(i.linkLabel || (i.status === 'need' ? 'להזמנה' : 'קישור'))}</a>` : ''}
        ${st}${edited}</div>
    </div></article>`;
}
AFTER.schedule = () => {
  bindCommon();
  $('#main').querySelectorAll('[data-hist]').forEach(b => b.onclick = e => { e.stopPropagation(); showHistory(S.world, b.dataset.hist); });
  bindDrag();
};
FAB.schedule = () => editItem(S.world, null);

function bindDrag() {
  let timer, start, dragging = null, ghost, over;
  const cancel = () => { clearTimeout(timer); timer = null; };
  $('#main').querySelectorAll('.stop').forEach(el => {
    el.addEventListener('pointerdown', e => {
      if (e.target.closest('a,button')) return;
      start = { x: e.clientX, y: e.clientY };
      timer = setTimeout(() => {
        dragging = el; el.classList.add('dragging'); navigator.vibrate?.(15);
        ghost = document.createElement('div'); ghost.className = 'ghost'; ghost.textContent = el.querySelector('h3').textContent;
        document.body.appendChild(ghost); move(e.clientX, e.clientY);
      }, 420);
    });
  });
  const move = (x, y) => {
    ghost.style.left = x + 'px'; ghost.style.top = y + 'px';
    const t = document.elementFromPoint(x, y)?.closest('[data-day]');
    document.querySelectorAll('.daybtn.drop').forEach(b => b.classList.remove('drop'));
    over = t && t.dataset.day !== S.day[S.world] ? t : null; over?.classList.add('drop');
  };
  const onMove = e => {
    if (timer && !dragging && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 8) cancel();
    if (dragging) { e.preventDefault(); move(e.clientX, e.clientY); }
  };
  const onUp = async () => {
    cancel(); if (!dragging) return;
    const id = dragging.dataset.id; dragging.classList.remove('dragging'); ghost.remove(); dragging = null;
    document.querySelectorAll('.daybtn.drop').forEach(b => b.classList.remove('drop'));
    if (over) { const d = over.dataset.day; over = null; await saveItem(S.world, id, { date: d }); toast(`הועבר ל${fmtDay(d)}`); }
  };
  if (!bindDrag.bound) {
    document.addEventListener('pointermove', e => bindDrag.move?.(e), { passive: false });
    document.addEventListener('pointerup', () => bindDrag.up?.());
    document.addEventListener('pointercancel', () => bindDrag.up?.());
    document.addEventListener('touchmove', e => { if (bindDrag.active?.()) e.preventDefault(); }, { passive: false });
    document.addEventListener('contextmenu', e => { if (e.target.closest('.stop')) e.preventDefault(); });
    bindDrag.bound = true;
  }
  bindDrag.move = onMove; bindDrag.up = onUp; bindDrag.active = () => !!dragging;
}

function editItem(w, id) {
  const it = id ? S.items[w].find(i => i.id === id) : { date: S.day[w], time: '12:00', status: 'none' };
  if (!it) return;
  const isMba = w === 'mba';
  const ds = days(w);
  openSheet(`<h2>${id ? 'עריכת עצירה' : 'עצירה חדשה'}</h2><form id="itemf">
    <div class="field"><label for="f-title">שם</label><input id="f-title" name="title" value="${esc(it.title || '')}" required dir="auto"></div>
    <div class="field"><label for="f-date">יום</label><select id="f-date" name="date">${ds.map((d, i) => `<option value="${d.date}" ${d.date === it.date ? 'selected' : ''}>יום ${i + 1} · ${fmtDay(d.date)} · ${esc(d.title)}</option>`).join('')}</select></div>
    <div class="two"><div class="field"><label for="f-time">משעה</label><input id="f-time" type="time" name="time" value="${esc(it.time || '')}"></div><div class="field"><label for="f-end">עד שעה</label><input id="f-end" type="time" name="end" value="${esc(it.end || '')}"></div></div>
    <div class="field"><label for="f-desc">תיאור</label><input id="f-desc" name="desc" value="${esc(it.desc || '')}" dir="auto"></div>
    <div class="field"><label for="f-addr">כתובת או שם מקום (לגוגל מפות)</label><input id="f-addr" name="address" value="${esc(it.address || '')}" dir="auto"></div>
    ${isMba ? `<div class="two"><div class="field"><label for="f-sp">דובר</label><input id="f-sp" name="speaker" value="${esc(it.speaker || '')}" dir="auto"></div><div class="field"><label for="f-role">תפקיד</label><input id="f-role" name="role" value="${esc(it.role || '')}" dir="auto"></div></div>
      <div class="field"><label for="f-li">לינקדאין של הדובר</label><input id="f-li" name="linkedin" type="url" value="${esc(it.linkedin || '')}" dir="ltr" placeholder="https://www.linkedin.com/in/..."></div>` : ''}
    <div class="field"><label>הזמנה</label><div class="seg">${[['none', 'לא צריך'], ['need', 'צריך להזמין'], ['booked', 'הוזמן']].map(([v, l]) => `<label><input type="radio" name="status" value="${v}" ${(it.status || 'none') === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></div>
    <div class="two"><div class="field"><label for="f-link">קישור</label><input id="f-link" name="link" type="url" value="${esc(it.link || '')}" dir="ltr"></div><div class="field"><label for="f-conf">מספר אישור</label><input id="f-conf" name="conf" value="${esc(it.conf || '')}" dir="ltr"></div></div>
    <div class="field"><label for="f-notes">הערות</label><textarea id="f-notes" name="notes" dir="auto">${esc(it.notes || '')}</textarea></div>
    <div class="sheet-actions"><button class="btn block">שמירה</button>${id ? '<button type="button" class="btn danger" id="del">מחיקה</button>' : ''}</div>
    ${id && it.history?.length ? `<button type="button" class="btn quiet block" style="margin-top:10px" id="hist">היסטוריית שינויים (${it.history.length})</button>` : ''}
  </form>`, sh => {
    sh.querySelector('#itemf').onsubmit = async e => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target));
      if (data.link && !safeUrl(data.link)) data.link = 'https://' + data.link;
      closeSheet();
      await saveItem(w, id, data); S.day[w] = data.date; toast('נשמר'); render();
    };
    sh.querySelector('#del')?.addEventListener('click', async () => { if (confirm('למחוק את העצירה?')) { await deleteDoc(doc(db, WORLDS[w].col, id)); closeSheet(); toast('נמחק'); } });
    sh.querySelector('#hist')?.addEventListener('click', () => showHistory(w, id));
  });
}
function showHistory(w, id) {
  const it = S.items[w].find(i => i.id === id); if (!it) return;
  openSheet(`<h2>מה השתנה ב${bdi(it.title)}</h2>
    <div class="hist"><b>עכשיו</b> · ${whoName(it.updatedBy)} · ${ago(it.updatedAt)}</div>
    ${(it.history || []).map((h, n) => `<div class="hist"><div class="row"><div class="grow"><b>גרסה קודמת</b> · ${whoName(h.by)} · ${ago(h.at)}<div class="small muted">${fmtDay(h.prev.date || it.date)} · <bdi>${esc(h.prev.time || '')}</bdi> · ${bdi(h.prev.title || '')}</div></div><button class="btn quiet sm" data-restore="${n}">שחזור</button></div></div>`).join('')}
    <button class="btn quiet block" data-dismiss style="margin-top:12px">סגירה</button>`, sh => {
    sh.querySelectorAll('[data-restore]').forEach(b => b.onclick = async () => { await saveItem(w, id, it.history[+b.dataset.restore].prev); closeSheet(); toast('שוחזר'); });
  });
}

// ----- map -----
VIEWS.map = () => {
  const w = S.world, raw = S.settings['map_' + w] || '';
  const src = (raw.match(/src="([^"]+)"/) || [null, raw])[1];
  const ok = /^https:\/\/(www\.)?google\.com\/maps\//.test(src || '');
  const places = [];
  itemsOf(w).forEach(i => { if (i.address && !places.find(p => p.address === i.address)) places.push(i); });
  return `${ok ? `<iframe class="mapframe" src="${esc(src)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="מפת ${WORLDS[w].name}"></iframe>
      <a class="btn quiet block" style="margin-top:10px" href="${esc(src.replace('/embed', '/viewer'))}" target="_blank" rel="noopener">לפתוח בגוגל מפות</a>`
    : `<div class="card empty"><strong>עוד אין מפה לחלק הזה</strong>${S.me === 'dor' ? 'מייבאים את הקובץ ל־Google My Maps ומדביקים את קישור ההטמעה בהגדרות.<br><br><button class="btn" data-go="settings">להגדרות</button>' : 'דור עוד לא חיבר את המפה.'}</div>`}
    <div class="section-title">כל הנקודות · ${places.length}</div>
    <div class="card">${places.map(p => { const c = dayColor(w, p.date); return `<div class="li"><span class="bullet sm ${bulletInk(c)}" style="--c:${c}">${dayIndex(w, p.date) + 1}</span><div class="main"><div class="title">${bdi(p.title)}</div><div class="small muted"><bdi>${esc(p.address)}</bdi></div></div><a class="btn quiet sm" href="${mapsUrl(p.address)}" target="_blank" rel="noopener">${icon.nav}</a></div>`; }).join('')}</div>`;
};
AFTER.map = bindCommon;

// ----- tasks -----
VIEWS.tasks = () => {
  const w = S.world;
  const need = S.items[w].filter(i => i.status === 'need').sort((a, b) => key(a).localeCompare(key(b)));
  const booked = S.items[w].filter(i => i.status === 'booked').sort((a, b) => key(a).localeCompare(key(b)));
  const mine = S.tasks.filter(t => t.world === w || t.world === 'general' || !t.world).sort((a, b) => (a.done - b.done) || (a.due || '9').localeCompare(b.due || '9'));
  return `<div class="section-title">צריך להזמין · ${need.length}</div>
    ${need.length ? `<div class="card">${need.map(needRow).join('')}</div>` : '<div class="card empty">הכול מוזמן.</div>'}
    <div class="section-title">המשימות שלי · ${mine.filter(t => !t.done).length} פתוחות</div>
    ${mine.length ? `<div class="card">${mine.map(taskRow).join('')}</div>` : '<div class="card empty">אין משימות. הפלוס מוסיף אחת.</div>'}
    ${booked.length ? `<div class="section-title">מוזמן</div><div class="card">${booked.map(i => `<div class="li" data-open="${i.id}"><span class="chip booked">הוזמן</span><div class="main"><div class="title">${bdi(i.title)}</div><div class="small muted">${fmtDay(i.date)} · <bdi>${esc(i.time)}</bdi>${i.conf ? ` · <bdi>${esc(i.conf)}</bdi>` : ''}</div></div></div>`).join('')}</div>` : ''}`;
};
AFTER.tasks = bindCommon;
FAB.tasks = () => editTask(null);

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
    const parts = (e.participants || []).filter(p => bal[p] !== undefined); if (!parts.length) continue;
    bal[e.payer] += usd; parts.forEach(p => bal[p] -= usd / parts.length);
  }
  const cred = Object.entries(bal).filter(([, v]) => v > 0.01).map(([p, v]) => [p, v]).sort((a, b) => b[1] - a[1]);
  const debt = Object.entries(bal).filter(([, v]) => v < -0.01).map(([p, v]) => [p, -v]).sort((a, b) => b[1] - a[1]);
  const tx = [];
  let i = 0, j = 0;
  while (i < debt.length && j < cred.length) {
    const x = Math.min(debt[i][1], cred[j][1]); tx.push({ from: debt[i][0], to: cred[j][0], amt: x });
    debt[i][1] -= x; cred[j][1] -= x; if (debt[i][1] < 0.01) i++; if (cred[j][1] < 0.01) j++;
  }
  return { bal, tx };
}
VIEWS.expenses = () => {
  const { bal, tx } = balances(), me = S.me, my = bal[me];
  const mineTx = tx.filter(t => t.from === me || t.to === me);
  const list = [...S.expenses].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const total = S.expenses.filter(e => e.type !== 'settle').reduce((s, e) => s + (e.currency === 'ILS' ? e.amount / S.rate : e.amount), 0);
  return `<section class="balance">
      <div class="big">${Math.abs(my) < 0.01 ? 'אתה מאוזן' : my > 0 ? `חייבים לך ${money(my)}` : `אתה חייב ${money(my)}`}</div>
      <div class="sub">סה״כ הוצאות משותפות ${money(total)} · שער <bdi>₪${S.rate.toFixed(2)}</bdi> לדולר</div>
      ${mineTx.length ? `<div class="owe">${mineTx.map(t => `<div class="row"><div class="grow">${t.from === me ? `אתה ← ${whoName(t.to)}` : `${whoName(t.from)} ← אתה`}</div><span class="${t.from === me ? 'neg' : 'pos'}">${money(t.amt)}</span>${t.from === me ? `<button class="btn sm" data-settle="${t.to}" data-amt="${t.amt.toFixed(2)}">סגרנו</button>` : ''}</div>`).join('')}</div>` : ''}
    </section>
    ${tx.filter(t => t.from !== me && t.to !== me).length ? `<p class="small muted" style="margin:10px 4px 0">בין השניים האחרים: ${tx.filter(t => t.from !== me && t.to !== me).map(t => `${whoName(t.from)} חייב ל${whoName(t.to)} ${money(t.amt)}`).join(', ')}</p>` : ''}
    <div class="section-title">כל ההוצאות</div>
    ${list.length ? `<div class="card">${list.map(e => `<div class="li" data-exp="${e.id}"><span class="bullet sm ${bulletInk(PEOPLE[e.payer].color)}" style="--c:${PEOPLE[e.payer].color}">${PEOPLE[e.payer].letter}</span><div class="main"><div class="title">${e.type === 'settle' ? `החזר ל${whoName(e.participants[0])}` : bdi(e.desc)}</div><div class="small muted">${whoName(e.payer)} שילם · ${e.type === 'settle' ? '' : (e.participants.length === 3 ? 'כולם' : e.participants.map(whoName).join(' ו'))} · ${fmtDay(e.date)}</div></div><span class="amt"><bdi>${e.currency === 'ILS' ? '₪' : '$'}${Number(e.amount).toFixed(e.amount % 1 ? 2 : 0)}</bdi></span></div>`).join('')}</div>`
      : '<div class="card empty"><strong>עוד אין הוצאות</strong>מי ששילם על משהו משותף רושם אותו כאן, והחשבון נסגר לבד.</div>'}`;
};
AFTER.expenses = () => {
  $('#main').querySelectorAll('[data-exp]').forEach(el => el.onclick = () => editExpense(el.dataset.exp));
  $('#main').querySelectorAll('[data-settle]').forEach(b => b.onclick = async () => {
    if (!confirm(`לרשום שהחזרת ל${whoName(b.dataset.settle)} $${b.dataset.amt}?`)) return;
    await addDoc(collection(db, 'expenses'), { type: 'settle', desc: 'החזר', amount: +b.dataset.amt, currency: 'USD', payer: S.me, participants: [b.dataset.settle], date: nyNow().date, createdBy: S.me, createdAt: Date.now() });
    toast('נרשם');
  });
};
FAB.expenses = () => editExpense(null);
function editExpense(id) {
  const e = id ? S.expenses.find(x => x.id === id) : { currency: 'USD', payer: S.me, participants: Object.keys(PEOPLE), date: nyNow().date };
  if (e.type === 'settle') {
    openSheet(`<h2>החזר</h2><p>${whoName(e.payer)} החזיר ל${whoName(e.participants[0])} ${money(e.amount)}</p><div class="sheet-actions"><button class="btn danger block" id="del">ביטול ההחזר</button></div>`, sh => sh.querySelector('#del').onclick = async () => { await deleteDoc(doc(db, 'expenses', id)); closeSheet(); });
    return;
  }
  openSheet(`<h2>${id ? 'עריכת הוצאה' : 'הוצאה חדשה'}</h2><form id="expf">
    <div class="field"><label for="e-desc">על מה</label><input id="e-desc" name="desc" value="${esc(e.desc || '')}" required dir="auto" placeholder="כרטיסים לברודוויי"></div>
    <div class="two"><div class="field"><label for="e-amt">סכום</label><input id="e-amt" name="amount" type="number" step="0.01" min="0" inputmode="decimal" value="${e.amount ?? ''}" required dir="ltr"></div>
      <div class="field"><label>מטבע</label><div class="seg">${[['USD', '$ דולר'], ['ILS', '₪ שקל']].map(([v, l]) => `<label><input type="radio" name="currency" value="${v}" ${e.currency === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></div></div>
    <div class="field"><label>מי שילם</label><div class="seg">${Object.entries(PEOPLE).map(([k, p]) => `<label><input type="radio" name="payer" value="${k}" ${e.payer === k ? 'checked' : ''}><span>${p.name}</span></label>`).join('')}</div></div>
    <div class="field"><label>מי השתתף (חלוקה שווה)</label><div class="pills">${Object.entries(PEOPLE).map(([k, p]) => `<label><input type="checkbox" name="participants" value="${k}" ${e.participants.includes(k) ? 'checked' : ''}>${p.name}</label>`).join('')}</div></div>
    <div class="field"><label for="e-date">תאריך</label><input id="e-date" type="date" name="date" value="${esc(e.date)}"></div>
    <div class="sheet-actions"><button class="btn block">שמירה</button>${id ? '<button type="button" class="btn danger" id="del">מחיקה</button>' : ''}</div></form>`, sh => {
    sh.querySelector('#expf').onsubmit = async ev => {
      ev.preventDefault();
      const f = new FormData(ev.target), parts = f.getAll('participants');
      if (!parts.length) return toast('צריך לבחור לפחות משתתף אחד');
      const d = { desc: f.get('desc'), amount: +f.get('amount'), currency: f.get('currency'), payer: f.get('payer'), participants: parts, date: f.get('date'), type: 'expense' };
      closeSheet();
      if (id) await updateDoc(doc(db, 'expenses', id), { ...d, updatedBy: S.me }); else await addDoc(collection(db, 'expenses'), { ...d, createdBy: S.me, createdAt: Date.now() });
      toast('נשמר');
    };
    sh.querySelector('#del')?.addEventListener('click', async () => { if (confirm('למחוק את ההוצאה?')) { await deleteDoc(doc(db, 'expenses', id)); closeSheet(); } });
  });
}

// ----- people (MBA) -----
VIEWS.people = () => {
  const list = itemsOf('mba').filter(i => i.speaker);
  return days('mba').filter(d => list.some(i => i.date === d.date)).map(d => `<div class="section-title">${fmtDay(d.date)} · ${esc(d.title)}</div><div class="card">${list.filter(i => i.date === d.date).map(i => {
    const url = safeUrl(i.linkedin) || liSearch(i.speaker.split(',')[0], i.title);
    return `<div class="person"><div class="avatar">${esc((i.speaker.match(/[A-Za-zא-ת]/g) || ['?']).slice(0, 1).join(''))}</div>
      <div class="grow" data-open="${i.id}"><div class="title" style="font-weight:700">${bdi(i.speaker)}</div><div class="small muted">${bdi(i.role || '')}</div><div class="small">${bdi(i.title)} · <bdi>${esc(i.time)}</bdi></div></div>
      <a class="li-btn" href="${esc(url)}" target="_blank" rel="noopener" aria-label="לינקדאין של ${esc(i.speaker)}" title="${i.linkedin ? 'פרופיל' : 'חיפוש בלינקדאין'}">in</a></div>`;
  }).join('')}</div>`).join('') + '<p class="hint">הכפתור פותח חיפוש בלינקדאין. כשמוצאים את הפרופיל, מדביקים את הקישור בעריכת הפגישה.</p>';
};
AFTER.people = bindCommon;

// ----- flights -----
function flightTime(f, which) {
  const ap = which === 'dep' ? f.from : f.to, v = f[which];
  return v ? new Date(v + ':00' + (AIRPORT_OFFSET[ap] || '-04:00')) : null;
}
function passHtml(f) {
  const dep = flightTime(f, 'dep'), arr = flightTime(f, 'arr');
  const dur = dep && arr ? Math.round((arr - dep) / 6e4) : null;
  const left = dep ? dep - Date.now() : 0;
  const status = !dep ? '' : left > 864e5 ? `בעוד ${Math.ceil(left / 864e5)} ימים` : left > 0 ? `בעוד ${Math.floor(left / 36e5)} ש׳ ${Math.floor(left / 6e4) % 60} ד׳` : arr && arr > Date.now() ? 'באוויר' : 'נחתה';
  return `<article class="pass"><div class="band"><b><bdi>${esc(f.code)}</bdi></b><span>${esc(f.airline || '')}${f.alt ? ` · <bdi>${esc(f.alt)}</bdi>` : ''}</span><span>${status}</span></div>
    <div class="route"><div class="ap"><bdi>${esc(f.from)}</bdi><small>${esc(AIRPORT_CITY[f.from] || '')} · ${f.dep ? fmtDay(f.dep.slice(0, 10)) : ''} · <bdi>${esc(f.dep?.slice(11) || '')}</bdi></small></div>
    <div class="plane">${icon.plane}</div>
    <div class="ap to"><bdi>${esc(f.to)}</bdi><small>${esc(AIRPORT_CITY[f.to] || '')} · ${f.arr ? fmtDay(f.arr.slice(0, 10)) : ''} · <bdi>${esc(f.arr?.slice(11) || '')}</bdi></small></div></div>
    <div class="perf"></div>
    <div class="facts"><div>הזמנה<b><bdi>${esc(f.conf || '—')}</bdi></b></div><div>מושב<b><bdi>${esc(f.seat || '—')}</bdi></b></div><div>משך<b>${dur ? `<bdi>${Math.floor(dur / 60)}:${String(dur % 60).padStart(2, '0')}</bdi> ש׳` : '—'}</b></div></div>
    <div class="tools"><a class="btn sm" href="${frUrl(f.code)}" target="_blank" rel="noopener">סטטוס חי</a>${f.alt ? `<a class="btn quiet sm" href="${frUrl(f.alt)}" target="_blank" rel="noopener">לפי <bdi>${esc(f.alt)}</bdi></a>` : ''}<button class="btn quiet sm" data-flight="${f.id}">עריכה</button></div></article>`;
}
VIEWS.flights = () => {
  const list = [...S.flights].sort((a, b) => (a.dep || '').localeCompare(b.dep || ''));
  return list.length ? `<div class="stack">${list.map(passHtml).join('')}</div><p class="hint">השעות מקומיות בכל שדה. "סטטוס חי" פותח את Flightradar24 על הטיסה.</p>`
    : '<div class="card empty"><strong>עוד אין טיסות</strong>הפלוס מוסיף טיסה: מספר, שדות ושעות.</div>';
};
AFTER.flights = () => $('#main').querySelectorAll('[data-flight]').forEach(b => b.onclick = () => editFlight(b.dataset.flight));
FAB.flights = () => editFlight(null);
function editFlight(id) {
  const f = id ? S.flights.find(x => x.id === id) : {};
  const dt = v => v ? [v.slice(0, 10), v.slice(11, 16)] : ['', ''];
  const [dd, dtm] = dt(f.dep), [ad, atm] = dt(f.arr);
  openSheet(`<h2>${id ? 'עריכת טיסה' : 'טיסה חדשה'}</h2><form id="flf">
    <div class="two"><div class="field"><label for="fl-code">מספר טיסה</label><input id="fl-code" name="code" value="${esc(f.code || '')}" required dir="ltr" placeholder="LY 1"></div><div class="field"><label for="fl-air">חברה</label><input id="fl-air" name="airline" value="${esc(f.airline || '')}" dir="auto"></div></div>
    <div class="two"><div class="field"><label for="fl-from">משדה (קוד)</label><input id="fl-from" name="from" value="${esc(f.from || '')}" required dir="ltr" maxlength="3" placeholder="MSP"></div><div class="field"><label for="fl-to">לשדה (קוד)</label><input id="fl-to" name="to" value="${esc(f.to || '')}" required dir="ltr" maxlength="3" placeholder="JFK"></div></div>
    <div class="two"><div class="field"><label for="fl-dd">המראה, תאריך</label><input id="fl-dd" type="date" name="dd" value="${dd}" required></div><div class="field"><label for="fl-dt">שעה מקומית</label><input id="fl-dt" type="time" name="dt" value="${dtm}" required></div></div>
    <div class="two"><div class="field"><label for="fl-ad">נחיתה, תאריך</label><input id="fl-ad" type="date" name="ad" value="${ad}"></div><div class="field"><label for="fl-at">שעה מקומית</label><input id="fl-at" type="time" name="at" value="${atm}"></div></div>
    <div class="two"><div class="field"><label for="fl-conf">מספר הזמנה</label><input id="fl-conf" name="conf" value="${esc(f.conf || '')}" dir="ltr"></div><div class="field"><label for="fl-seat">מושב</label><input id="fl-seat" name="seat" value="${esc(f.seat || '')}" dir="ltr"></div></div>
    <div class="field"><label for="fl-alt">מספר טיסה נוסף (קוד־שייר)</label><input id="fl-alt" name="alt" value="${esc(f.alt || '')}" dir="ltr"></div>
    <div class="sheet-actions"><button class="btn block">שמירה</button>${id ? '<button type="button" class="btn danger" id="del">מחיקה</button>' : ''}</div></form>`, sh => {
    sh.querySelector('#flf').onsubmit = async e => {
      e.preventDefault(); const x = Object.fromEntries(new FormData(e.target));
      const d = { code: x.code.toUpperCase(), airline: x.airline, from: x.from.toUpperCase(), to: x.to.toUpperCase(), dep: `${x.dd}T${x.dt}`, arr: x.ad && x.at ? `${x.ad}T${x.at}` : '', conf: x.conf, seat: x.seat, alt: x.alt.toUpperCase() };
      closeSheet();
      if (id) await setDoc(doc(db, 'personal', S.me, 'flights', id), d); else await addDoc(collection(db, 'personal', S.me, 'flights'), d);
      toast('הטיסה נשמרה');
    };
    sh.querySelector('#del')?.addEventListener('click', async () => { if (confirm('למחוק את הטיסה?')) { await deleteDoc(doc(db, 'personal', S.me, 'flights', id)); closeSheet(); } });
  });
}

// ----- personal -----
VIEWS.personal = () => {
  const tabs = [['tasks', 'משימות'], ['notes', 'פתקים'], ['packing', 'אריזה']];
  const seg = `<div class="seg" style="margin-bottom:14px">${tabs.map(([k, l]) => `<label><input type="radio" name="ptab" value="${k}" ${S.tab === k ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>`;
  if (S.tab === 'notes') return seg + `<div class="card pad"><textarea id="notes" dir="auto" style="width:100%;min-height:55vh;border:0;background:none;resize:vertical;font-size:16px;line-height:1.6;outline:none" placeholder="דברים לזכור, רק אתה רואה">${esc(S.notes)}</textarea></div><p class="hint">נשמר אוטומטית</p>`;
  if (S.tab === 'packing') {
    const list = [...S.packing].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
    return seg + `<div class="card">${list.map(p => `<div class="li ${p.done ? 'done' : ''}"><input type="checkbox" class="check" data-pack="${p.id}" ${p.done ? 'checked' : ''} aria-label="נארז"><div class="main"><div class="title">${bdi(p.text)}</div></div><button class="edited" data-unpack="${p.id}" aria-label="הסרה">הסרה</button></div>`).join('')}
      <form class="li" id="packf"><input name="t" class="grow" placeholder="להוסיף פריט" dir="auto" style="border:0;background:none;font-size:16px;outline:none"><button class="btn sm">הוספה</button></form></div>
      <p class="hint">${list.filter(p => p.done).length} מתוך ${list.length} ארוזים</p>`;
  }
  const all = [...S.tasks].sort((a, b) => (a.done - b.done) || (a.due || '9').localeCompare(b.due || '9'));
  return seg + (all.length ? `<div class="card">${all.map(taskRow).join('')}</div>` : '<div class="card empty"><strong>אין משימות</strong>הפלוס מוסיף אחת.</div>');
};
AFTER.personal = () => {
  bindCommon();
  $('#main').querySelectorAll('[name=ptab]').forEach(r => r.onchange = () => { S.tab = r.value; render(); });
  const n = $('#notes');
  if (n) { let t; n.oninput = () => { clearTimeout(t); t = setTimeout(() => setDoc(doc(db, 'personal', S.me, 'notes', 'main'), { text: n.value, at: Date.now() }), 600); }; n.onblur = () => { S.notes = n.value; }; }
  $('#main').querySelectorAll('[data-pack]').forEach(c => c.onchange = () => updateDoc(doc(db, 'personal', S.me, 'packing', c.dataset.pack), { done: c.checked }));
  $('#main').querySelectorAll('[data-unpack]').forEach(b => b.onclick = () => deleteDoc(doc(db, 'personal', S.me, 'packing', b.dataset.unpack)));
  const pf = $('#packf'); if (pf) pf.onsubmit = async e => { e.preventDefault(); const v = pf.t.value.trim(); if (!v) return; await addDoc(collection(db, 'personal', S.me, 'packing'), { text: v, done: false, order: S.packing.length }); };
};
FAB.personal = () => S.tab === 'tasks' ? editTask(null) : null;

// ----- settings -----
VIEWS.settings = () => {
  const th = localStorage.getItem('nyc26_theme') || 'auto';
  return `<div class="section-title">תצוגה</div><div class="card pad"><div class="seg">${[['auto', 'אוטומטי'], ['light', 'בהיר'], ['dark', 'כהה']].map(([v, l]) => `<label><input type="radio" name="theme" value="${v}" ${th === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></div>
    ${S.me === 'dor' ? `<div class="section-title">מפות</div><form class="card pad" id="mapsf">
      <p class="small muted" style="margin-top:0">ב־My Maps: שיתוף ← הטמעה באתר שלי. מדביקים כאן את כל הקוד או רק את הקישור.</p>
      <div class="field"><label for="m-b">מפת האחים</label><input id="m-b" name="map_brothers" value="${esc(S.settings.map_brothers || '')}" dir="ltr"></div>
      <div class="field"><label for="m-m">מפת ה־MBA</label><input id="m-m" name="map_mba" value="${esc(S.settings.map_mba || '')}" dir="ltr"></div>
      <button class="btn">שמירת המפות</button></form>` : ''}
    <div class="section-title">משתמש</div><div class="card pad"><p style="margin-top:0">מחובר בתור <b>${PEOPLE[S.me].name}</b> במכשיר הזה.</p><button class="btn quiet" id="logout">החלפת משתמש</button></div>`;
};
AFTER.settings = () => {
  $('#main').querySelectorAll('[name=theme]').forEach(r => r.onchange = () => { localStorage.setItem('nyc26_theme', r.value); applyTheme(); });
  const mf = $('#mapsf'); if (mf) mf.onsubmit = async e => { e.preventDefault(); await setDoc(doc(db, 'settings', 'app'), Object.fromEntries(new FormData(mf)), { merge: true }); toast('המפות נשמרו'); };
  $('#logout').onclick = logout;
};
function applyTheme() { const t = localStorage.getItem('nyc26_theme') || 'auto'; if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t; }
