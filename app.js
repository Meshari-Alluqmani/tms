/* =========================================================
   Transport Management System - shared script for every page (version 5, Nov 2026)
   - DATA: one small data layer for every page. Two ways of saving, chosen when a page opens:
       * Online mode: the Supabase database (needs supabase.js, loaded before this file).
         Real accounts with passwords, one database for everyone, and changes appear
         on every open screen within a second (Realtime).
       * Offline mode: if the database can't be reached, the site still works and keeps
         the data in this browser, so a demo never stops.
     Pages only call TMS.load / TMS.save / TMS.onChange, so they never need to know which mode is on.
   - TMS.logIn / TMS.signUp / TMS.signOut: accounts (Supabase Auth checks the password)
   - greets the user by the time of day: "Good morning, Meshari"
   - Display menu: theme (light / dark / same as my device) and text size
   - the user menu in the top bar (My vehicles, Cars for sale, Log out)
   - a footer note says where the data is saved (Golden Rule 3: informative feedback)
   ========================================================= */
(function () {
  'use strict';
  var TMS = window.TMS = {};
  var root = document.documentElement;

  /* ---------- browser storage: a blocked storage must never break the page ---------- */
  var memory = {};
  TMS.get = function (key, fallback) {
    try {
      var raw = localStorage.getItem('tms.' + key);
      if (raw !== null) return JSON.parse(raw);
    } catch (e) { /* storage blocked or value damaged: use memory */ }
    return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : fallback;
  };
  TMS.set = function (key, value) {
    memory[key] = value;
    try { localStorage.setItem('tms.' + key, JSON.stringify(value)); } catch (e) {}
  };
  TMS.remove = function (key) {
    delete memory[key];
    try { localStorage.removeItem('tms.' + key); } catch (e) {}
  };
  TMS.storageOK = (function () {
    try { localStorage.setItem('tms.test', '1'); localStorage.removeItem('tms.test'); return true; }
    catch (e) { return false; }
  })();

  /* ---------- theme and text size (Display menu) ---------- */
  var hostTheme = root.getAttribute('data-theme');   // set by the viewer app, if any
  function applyTheme() {
    var pref = TMS.get('theme', 'system');
    if (pref === 'light' || pref === 'dark') root.setAttribute('data-theme', pref);
    else if (hostTheme === 'light' || hostTheme === 'dark') root.setAttribute('data-theme', hostTheme);
    else root.removeAttribute('data-theme');          // follow the device setting
  }
  function applyText() {
    var size = TMS.get('text', '1');
    if (size === '2' || size === '3') root.setAttribute('data-text', size);
    else root.removeAttribute('data-text');
  }
  TMS.setTheme = function (pref) { TMS.set('theme', pref); applyTheme(); };
  TMS.setText = function (size) { TMS.set('text', size); applyText(); };
  applyTheme();
  applyText();
  if (window.MutationObserver) {
    new MutationObserver(function () {
      var pref = TMS.get('theme', 'system');
      var now = root.getAttribute('data-theme');
      if (pref === 'system') hostTheme = now;                       // the viewer app changed theme
      else if (now !== pref) { hostTheme = now; root.setAttribute('data-theme', pref); } // keep the user's own choice
    }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  }

  /* =========================================================
     LANGUAGE: English or Arabic
     The pages are written in English. In Arabic, every text is translated the moment it
     appears on the screen (also messages, errors and rows added later), using the word list
     in ar.js. The page turns right to left, and an Arabic font is loaded.
     ========================================================= */
  TMS.lang = function () { return TMS.get('lang', 'en') === 'ar' ? 'ar' : 'en'; };
  TMS.setLang = function (l) { TMS.set('lang', l === 'ar' ? 'ar' : 'en'); location.reload(); };
  if (TMS.lang() === 'ar') {
    root.setAttribute('lang', 'ar');
    root.setAttribute('dir', 'rtl');
    var arFont = document.createElement('link');
    arFont.rel = 'stylesheet';
    arFont.href = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;700&display=swap';
    document.head.appendChild(arFont);
  }
  var AR = null, setByUs = new WeakMap();
  var NO_TR = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, NOSCRIPT: 1 };
  var TR_ATTRS = ['aria-label', 'placeholder', 'title', 'alt'];
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  // one text: the word list first, then the rules for texts with numbers, dates and names
  function trText(s) {
    if (has(AR.dict, s)) return AR.dict[s];
    // several sentences: translate each one
    var parts = s.replace(/([.?!:])\s+(?=[A-Z“"])/g, '$1\u0000').split('\u0000');
    if (parts.length > 1) {
      var outp = parts.map(trText);
      if (outp.some(function (o, k) { return o !== parts[k]; })) return outp.join(' ');
    }
    for (var i = 0; i < AR.rules.length; i++) {
      var m = AR.rules[i][0].exec(s);
      if (m) { var r = AR.rules[i][1](m, trText); if (r !== null && r !== undefined) return r; }
    }
    // "Kia K5 · A J K · 2847": translate each part
    if (s.indexOf(' · ') > -1) {
      var bits = s.split(' · '), outb = bits.map(trText);
      if (outb.some(function (o, k) { return o !== bits[k]; })) return outb.join(' · ');
    }
    return AR.tokens(s);
  }
  TMS.t = function (s) { return TMS.lang() === 'ar' && AR ? trText(String(s)) : String(s); };
  function skipped(el) { return el.closest && el.closest('[data-notr], svg'); }
  function trNode(n) {
    var p = n.parentNode;
    if (!p || p.nodeType !== 1 || NO_TR[p.nodeName] || skipped(p)) return;
    var v = n.nodeValue;
    if (setByUs.get(n) === v) return;
    var core = v.replace(/\s+/g, ' ').trim();
    if (!core || !/[A-Za-z]/.test(core)) return;
    var out = trText(core);
    if (out === core) return;
    if (p.nodeName === 'OPTION' && !p.hasAttribute('value')) p.setAttribute('value', p.textContent);  // keep the saved value in English
    var nv = (/^\s/.test(v) ? ' ' : '') + out + (/\s$/.test(v) ? ' ' : '');
    setByUs.set(n, nv);
    n.nodeValue = nv;
  }
  function trAttrs(el) {
    if (skipped(el)) return;
    TR_ATTRS.forEach(function (a) {
      var v = el.getAttribute(a);
      if (!v || !/[A-Za-z]/.test(v)) return;
      var out = trText(v.trim());
      if (out !== v.trim()) el.setAttribute(a, out);
    });
  }
  function trTree(node) {
    if (node.nodeType === 3) { trNode(node); return; }
    if (node.nodeType !== 1 || NO_TR[node.nodeName]) return;
    trAttrs(node);
    var w = document.createTreeWalker(node, 5 /* elements and text */), x;
    while ((x = w.nextNode())) { if (x.nodeType === 3) trNode(x); else trAttrs(x); }
  }
  // called by ar.js with its word list
  TMS.startArabic = function (words) {
    AR = words;
    if (TMS.lang() !== 'ar') return;
    trTree(document.documentElement);
    new MutationObserver(function (list) {
      list.forEach(function (m) {
        if (m.type === 'characterData') trNode(m.target);
        else if (m.type === 'attributes') trAttrs(m.target);
        else m.addedNodes.forEach(trTree);
      });
    }).observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: TR_ATTRS });
  };

  /* ---------- Arabic keyboards ----------
     Digits typed as ٢٨٤٧ become 2847 at once, in every box except passwords.
     Plate letters may be typed in Arabic: each one becomes its Latin letter, as printed on
     Saudi plates. The Latin letters run in the opposite order (left to right), so we reverse them. */
  TMS.westernDigits = function (s) {
    return String(s).replace(/[٠-٩]/g, function (d) { return String(d.charCodeAt(0) - 0x0660); })
                    .replace(/[۰-۹]/g, function (d) { return String(d.charCodeAt(0) - 0x06F0); });
  };
  var PLATE_AR = { 'ا': 'A', 'أ': 'A', 'إ': 'A', 'آ': 'A', 'ب': 'B', 'ح': 'J', 'د': 'D', 'ر': 'R', 'س': 'S', 'ص': 'X', 'ط': 'T',
                   'ع': 'E', 'ق': 'G', 'ك': 'K', 'ل': 'L', 'م': 'Z', 'ن': 'N', 'ه': 'H', 'و': 'U', 'ى': 'V', 'ي': 'V' };
  TMS.plateLetters = function (s) {
    s = String(s || '').replace(/[\s\-.ـ]/g, '');
    if (!/[\u0600-\u06FF]/.test(s)) return s.toUpperCase();
    return s.split('').map(function (c) { return PLATE_AR[c] || c; }).reverse().join('').toUpperCase();
  };
  document.addEventListener('input', function (e) {
    var el = e.target;
    if (el.tagName !== 'INPUT' || el.type === 'password' || !/[٠-٩۰-۹]/.test(el.value)) return;
    var at = el.selectionStart;
    el.value = TMS.westernDigits(el.value);
    try { el.setSelectionRange(at, at); } catch (err) {}
  }, true);

  /* ---------- small helpers ---------- */
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
                     'September', 'October', 'November', 'December'];
  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  TMS.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  TMS.clone = function (x) { return x == null ? x : JSON.parse(JSON.stringify(x)); };
  TMS.uid = function (prefix) { return (prefix || 'x') + Date.now().toString(36) + Math.floor(Math.random() * 46656).toString(36); };
  TMS.today = function () { var d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  TMS.addDays = function (d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; };
  TMS.addYears = function (d, n) { var x = new Date(d); x.setFullYear(x.getFullYear() + n); return x; };
  TMS.fmt = function (d) { return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); };     // 7 Oct 2026
  TMS.fmtDay = function (d) { return DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()]; };  // Thu 8 Oct
  TMS.longDate = function (d) { return d.getDate() + ' ' + MONTHS_LONG[d.getMonth()] + ' ' + d.getFullYear(); };
  // dates are saved as "2026-11-13" (the format of a date picker)
  TMS.iso = function (d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  TMS.parseISO = function (s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
    if (!m) return null;
    var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return isNaN(d) ? null : d;
  };
  TMS.daysUntil = function (iso) {
    var d = TMS.parseISO(iso);
    return d ? Math.round((d - TMS.today()) / 86400000) : null;
  };
  TMS.sar = function (n) { return 'SAR ' + Math.round(n).toLocaleString('en-US'); };
  TMS.km = function (n) { return Math.round(n).toLocaleString('en-US') + ' km'; };
  // the next working days: workshops are closed on Friday and Saturday
  TMS.workdays = function (count) {
    var out = [], d = TMS.today();
    while (out.length < count) {
      d = TMS.addDays(d, 1);
      if (d.getDay() !== 5 && d.getDay() !== 6) out.push(new Date(d));
    }
    return out;
  };
  // "12 days", "5 months", "3 years", "Overdue 2 days", "Due today"
  TMS.leftText = function (days) {
    if (days < 0) return 'Overdue ' + (-days) + (days === -1 ? ' day' : ' days');
    if (days === 0) return 'Due today';
    if (days <= 60) return days + (days === 1 ? ' day' : ' days');
    if (days > 540) { var y = Math.round(days / 365); return y + (y === 1 ? ' year' : ' years'); }
    var m = Math.round(days / 30.4);
    return m + (m === 1 ? ' month' : ' months');
  };
  // red: 14 days or less (or overdue), amber: 15 to 30 days, green: more time
  TMS.level = function (days) { return days <= 14 ? 'red' : days <= 30 ? 'amber' : 'green'; };

  /* ---------- the user (the log-in is always per browser) ---------- */
  TMS.user = function () { return TMS.get('user', null); };
  TMS.signIn = function (user) { TMS.set('user', user); };
  TMS.signOut = function () {
    TMS.remove('user');
    if (sb) {
      session = null;
      try { localStorage.removeItem(sb.auth.storageKey); } catch (e) {}     // forget the log-in at once
      sb.auth.signOut({ scope: 'local' }).catch(function () {});
    }
  };
  // staff: in the online database the profile's role decides; the email ending is only a first check
  TMS.isStaff = function (email) {
    var e = String(email || '').trim().toLowerCase(), u = TMS.user();
    if (mode === 'supabase' && u && u.email === e && u.role) return u.role === 'admin';
    return /@tms\.sa$/.test(e);
  };
  TMS.firstName = function (name) { return String(name || '').trim().split(/\s+/)[0] || ''; };
  TMS.greeting = function (name) {
    var h = new Date().getHours();
    var hello = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    return name ? hello + ', ' + name : hello;
  };
  // after logging in, go back to the page the user wanted
  TMS.askLogin = function (next, reason) {
    TMS.set('next', next);
    TMS.set('reason', reason || '');
    TMS.go('login.html');
  };
  TMS.takeNext = function () {
    var next = TMS.get('next', null);
    TMS.remove('next'); TMS.remove('reason');
    return next;
  };

  /* =========================================================
     PAGES AND LINKS
     In the zip copy each page is its own file (normal links).
     In the published site all pages live in one document (TMS.start), so the
     database connection stays open: links are caught and the page is swapped.
     ========================================================= */
  TMS.bundle = false;
  var pages = {}, current = { page: '', param: '' }, leaveFns = [], changeFns = [];
  var PAGE_RE = /^([a-z]+\.html)(?:#(.*))?$/;

  TMS.page = function (name, fn) { pages[name] = fn; };
  TMS.param = function () {
    if (TMS.bundle) return current.param;
    try { return decodeURIComponent(location.hash.replace(/^#/, '')); } catch (e) { return ''; }
  };
  function routeHash(page, param) { return '#/' + page + (param ? '/' + encodeURIComponent(param) : ''); }
  TMS.setParam = function (p) {
    try {
      if (TMS.bundle) { current.param = p; history.replaceState(null, '', routeHash(current.page, p)); }
      else history.replaceState(null, '', '#' + p);
    } catch (e) {}
  };
  TMS.go = function (href) {
    var m = PAGE_RE.exec(href);
    if (!TMS.bundle || !m || !pages[m[1]]) { location.href = href; return; }
    route(m[1], m[2] ? decodeURIComponent(m[2]) : '', true);
  };
  TMS.onLeave = function (fn) { leaveFns.push(fn); };

  function route(page, param, push) {
    var tpl = document.getElementById('tpl-' + page);
    if (!tpl) { page = 'index.html'; param = ''; tpl = document.getElementById('tpl-index.html'); }
    leaveFns.forEach(function (f) { try { f(); } catch (e) {} });
    leaveFns = []; changeFns = [];
    closeMenus(false);
    var toast = document.getElementById('toast'); if (toast) toast.remove();
    var mount = document.getElementById('tms-root');
    mount.innerHTML = '';
    mount.appendChild(tpl.content.cloneNode(true));
    document.body.className = tpl.getAttribute('data-body') || '';
    document.title = tpl.getAttribute('data-title') || 'Transport Management System';
    current = { page: page, param: param || '' };
    try {
      if (push) history.pushState(null, '', routeHash(page, param));
      else history.replaceState(null, '', routeHash(page, param));
    } catch (e) {}
    window.scrollTo(0, 0);
    try { if (pages[page]) pages[page](); } catch (e) { if (window.console) console.error(e); }
    init();
    if (push) {   // move keyboard and screen-reader focus to the new page's heading
      var h = mount.querySelector('h1');
      if (h) { if (!h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    }
  }
  function routeFromHash(push) {
    var h = location.hash;
    if (h.indexOf('#/') !== 0) return false;
    var parts = h.slice(2).split('/');
    var page = parts.shift(), param = '';
    try { param = decodeURIComponent(parts.join('/')); } catch (e) {}
    route(page, param, push);
    return true;
  }
  TMS.start = function () {
    TMS.bundle = true;
    if (!routeFromHash(false)) route('index.html', '', false);
    window.addEventListener('popstate', function () { routeFromHash(false); });
    document.addEventListener('click', function (e) {
      if (e.defaultPrevented) return;
      var a = e.target.closest && e.target.closest('a[href]');
      if (!a) return;
      var m = PAGE_RE.exec(a.getAttribute('href'));
      if (!m || !pages[m[1]]) return;
      e.preventDefault();
      TMS.go(a.getAttribute('href'));
    });
  };

  /* =========================================================
     DATA LAYER
     ========================================================= */
  var KEYS = ['users', 'vehicles', 'listings', 'bookings', 'payments'];
  var VERSION = 6;
  var cache = {}, mode = 'loading', ready = false, readyFns = [];
  KEYS.forEach(function (k) { cache[k] = []; });

  // the same data always gives the same text, so we can tell what really changed
  function stable(x) {
    if (Array.isArray(x)) return '[' + x.map(stable).join(',') + ']';
    if (x && typeof x === 'object') {
      return '{' + Object.keys(x).sort().filter(function (k) { return x[k] !== undefined; })
        .map(function (k) { return JSON.stringify(k) + ':' + stable(x[k]); }).join(',') + '}';
    }
    return JSON.stringify(x === undefined ? null : x);
  }
  function sortItems(arr) {
    return arr.sort(function (a, b) {
      return (a.created || 0) - (b.created || 0) || String(a.id).localeCompare(String(b.id));
    });
  }
  TMS.userId = function (email) {
    var id = String(email || '').trim().toLowerCase().replace(/[^a-z0-9_\-.~:@+]/g, '_');
    return id === '.' || id === '..' || !id ? 'user_' + Date.now() : id;
  };
  var createdTick = 0;
  function normalize(key, item) {
    if (key === 'users' && !item.id) item.id = TMS.userId(item.email);
    if (!item.id) item.id = TMS.uid(key.charAt(0));
    if (!item.created) item.created = Date.now() + (createdTick++);
    return item;
  }

  TMS.mode = function () { return mode; };
  TMS.isReady = function () { return ready; };
  TMS.ready = function (fn) { if (ready) fn(); else readyFns.push(fn); };
  TMS.onChange = function (fn) { changeFns.push(fn); };
  TMS.load = function (key) { return TMS.clone(cache[key] || []); };

  function emit(keys) {
    changeFns.slice().forEach(function (fn) { try { fn(keys); } catch (e) { if (window.console) console.error(e); } });
  }
  function becomeReady() {
    if (ready) return;
    ready = true;
    updateModeNote();
    var fns = readyFns; readyFns = [];
    fns.forEach(function (fn) { try { fn(); } catch (e) { if (window.console) console.error(e); } });
  }

  // ---------- offline mode: the data is kept in this browser ----------
  function startBrowser(note) {
    if (sb) { try { sb.removeAllChannels(); } catch (e) {} }
    sb = null;
    mode = 'browser';
    if (note) modeNoteText = note;
    if (TMS.get('v', 0) !== VERSION) writeSeedsLocal();
    KEYS.forEach(function (k) { cache[k] = sortItems(TMS.get(k, [])); });
    updateModeNote();
    if (ready) emit(KEYS.slice());
    becomeReady();
  }
  function writeSeedsLocal() {
    var s = seeds();
    KEYS.forEach(function (k) { TMS.set(k, s[k]); });
    TMS.set('v', VERSION);
  }
  // another tab changed something: show it here at once
  window.addEventListener('storage', function (e) {
    if (!e.key || e.key.indexOf('tms.') !== 0) return;
    var key = e.key.slice(4);
    if (key === 'theme') { applyTheme(); return; }
    if (key === 'text') { applyText(); return; }
    if (key === 'user') { init(); emit(['session']); return; }
    if (mode === 'browser' && KEYS.indexOf(key) > -1) {
      try { cache[key] = sortItems(JSON.parse(e.newValue || '[]')); } catch (err) { return; }
      emit([key]);
    }
  });

  /* =========================================================
     ONLINE MODE: the Supabase database (one database for everyone)
     - log-in: Supabase Auth checks the email and password
     - every table has Row Level Security: each person only gets the rows they may see
     - Realtime: a change made by anyone appears on every open screen
     ========================================================= */
  var SUPABASE_URL = 'https://pylhlzejgdtfnesavhmj.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_33erD4vT41ZkJJ321LaQxg_Wr3L18Gs';   // the public key: safe in a website
  var sb = null, session = null;

  // the website's names (camelCase) and the database's columns (snake_case)
  var TABLES = {
    users: { table: 'profiles', cols: ['id', 'email', 'name', 'type', 'company', 'role', 'joined', 'created'], canChange: ['name', 'company'] },
    vehicles: { table: 'vehicles', cols: ['id', 'owner', 'make', 'model', 'year', 'body', 'plateL', 'plateN', 'km', 'location',
      'istimara', 'fahas', 'insurance', 'oilKm', 'history', 'self', 'created'] },
    bookings: { table: 'bookings', cols: ['id', 'owner', 'vehicleId', 'customer', 'car', 'plate', 'jobs', 'job', 'day', 'time',
      'place', 'driver', 'status', 'doneDate', 'created'] },
    listings: { table: 'listings', cols: ['id', 'sellerEmail', 'seller', 'sellerType', 'vehicleId', 'make', 'model', 'year', 'km',
      'price', 'city', 'body', 'status', 'approved', 'handle', 'plate', 'listed', 'history', 'photo', 'accident', 'accidentNotes',
      'buyer', 'created'] },
    payments: { table: 'payments', cols: ['id', 'buyerEmail', 'receipt', 'listingId', 'car', 'buyer', 'seller', 'amount', 'carPrice',
      'kind', 'method', 'date', 'status', 'created'] }
  };
  var NEVER_SENT = ['approved', 'owner'];              // filled in by the database itself
  var DATE_COLS = ['istimara', 'fahas', 'insurance', 'joined'];
  var EMPTY_IS_NULL = ['istimara', 'fahas', 'insurance', 'oilKm', 'vehicleId', 'listingId'];
  function column(c) { return c === 'self' ? 'self_task' : c.replace(/[A-Z]/g, function (m) { return '_' + m.toLowerCase(); }); }
  function fromRow(key, row) {
    var o = {};
    TABLES[key].cols.forEach(function (c) {
      var v = row[column(c)] === undefined ? null : row[column(c)];
      if (DATE_COLS.indexOf(c) > -1 && typeof v === 'string') v = v.slice(0, 10);   // keep dates as "2026-11-18"
      o[c] = v;
    });
    if (key === 'users' && o.joined) { var d = TMS.parseISO(o.joined); if (d) o.joined = TMS.fmt(d); }
    return o;
  }
  function toRow(key, item, only) {
    var row = {}, allowed = TABLES[key].canChange;
    (only || TABLES[key].cols).forEach(function (c) {
      if (NEVER_SENT.indexOf(c) > -1 || item[c] === undefined) return;
      if (allowed && allowed.indexOf(c) === -1) return;
      var v = item[c];
      if (v === '' && EMPTY_IS_NULL.indexOf(c) > -1) v = null;
      row[column(c)] = v;
    });
    return row;
  }
  function userFrom(p) {
    return { name: p.name, email: p.email, type: p.type, company: p.company || '', role: p.role };
  }
  function isNetwork(err) {
    return !!err && /fetch|network|load failed|timeout|offline/i.test(String(err.message || err));
  }

  // read one table (only the rows Row Level Security lets this person see)
  function fetchTable(key) {
    return sb.from(TABLES[key].table).select('*').order('created', { ascending: true }).then(function (r) {
      if (r.error) throw r.error;
      return r.data.map(function (row) { return fromRow(key, row); });
    });
  }
  function keysToRead() { return session ? KEYS.slice() : ['listings']; }   // a guest can only read the cars for sale

  function startSupabase() {
    try {
      sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
      });
    } catch (e) { startBrowser('Offline: the database could not start. Changes are saved in this browser only.'); return; }
    mode = 'supabase';
    updateModeNote();
    var settled = false;
    var timer = setTimeout(function () {
      if (settled) return;
      settled = true;
      startBrowser('Offline: we could not reach the database. Changes are saved in this browser only.');
    }, 10000);
    sb.auth.getSession().then(function (r) {
      session = r.data && r.data.session;
      if (!session && TMS.user()) { TMS.remove('user'); init(); }   // the log-in ended: show the page as a guest
      var keys = keysToRead();
      return Promise.all(keys.map(fetchTable)).then(function (lists) { return { keys: keys, lists: lists }; });
    }).then(function (res) {
      if (settled) return;
      settled = true; clearTimeout(timer);
      res.keys.forEach(function (k, i) { cache[k] = sortItems(res.lists[i]); });
      syncUser();
      listen();
      becomeReady();
    }, function (err) {
      if (settled) return;
      settled = true; clearTimeout(timer);
      if (window.console) console.error('Supabase:', err);
      startBrowser(isNetwork(err)
        ? 'Offline: we could not reach the database. Changes are saved in this browser only.'
        : 'Offline: the database answered with an error (' + (err.message || err) + '). Changes are saved in this browser only.');
    });
    sb.auth.onAuthStateChange(function (event, s) {
      if (event === 'SIGNED_OUT' && session) { session = null; TMS.remove('user'); init(); emit(['session']); }
      else if (s) session = s;
    });
  }
  // keep the saved name, type and role the same as the profile in the database
  function syncUser() {
    if (!session) return;
    var me = cache.users.filter(function (u) { return u.id === session.user.id; })[0];
    if (!me) return;                       // no profile: "My vehicles" asks the person to log in again
    var u = userFrom(me), old = TMS.user();
    if (!old || stable(old) !== stable(u)) { TMS.set('user', u); init(); }
  }

  // Realtime: when a row changes, read that table again
  var refetchTimers = {}, dirty = {}, writingBy = {};
  function listen() {
    var ch = sb.channel('tms-changes');
    keysToRead().forEach(function (k) {
      ch.on('postgres_changes', { event: '*', schema: 'public', table: TABLES[k].table }, function () { refetch(k); });
    });
    ch.subscribe();
    // back on the page after a while: catch up on anything missed
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && mode === 'supabase') keysToRead().forEach(refetch);
    });
  }
  function refetch(key) {
    if (mode !== 'supabase' || !sb) return;
    clearTimeout(refetchTimers[key]);
    refetchTimers[key] = setTimeout(function () {
      if (writingBy[key]) { dirty[key] = true; return; }      // wait for our own saves first
      fetchTable(key).then(function (arr) {
        if (writingBy[key]) { dirty[key] = true; return; }
        arr = sortItems(arr);
        if (stable(arr) === stable(cache[key])) return;
        cache[key] = arr;
        if (key === 'users') syncUser();
        emit([key]);
      }, function () {});
    }, 250);
  }

  // saves go to the database one after another, in the order they were made
  var queue = Promise.resolve();
  function enqueue(key, run) {
    writingBy[key] = (writingBy[key] || 0) + 1;
    queue = queue.then(run).then(function (r) {
      if (r && r.error) throw r.error;
      if (r && Array.isArray(r.data) && r.data.length === 0) throw { code: 'not_allowed' };
    }).catch(function (err) {
      writeFailed(err);
      dirty[key] = true;                   // read the table again, so the screen shows what was really saved
    }).then(function () {
      writingBy[key]--;
      if (!writingBy[key] && dirty[key]) { dirty[key] = false; refetch(key); }
    });
  }
  function writeFailed(err) {
    if (window.console) console.error('Save failed:', err);
    if (isNetwork(err)) { TMS.toast('Could not save the last change. Check your internet connection.'); return; }
    if (err && (err.code === 'not_allowed' || err.code === '42501')) { TMS.toast('Your account is not allowed to make this change.'); return; }
    var msg = String((err && err.message) || '');
    if (err && err.code === 'P0001' && msg) { TMS.toast(TMS.esc(msg)); return; }   // a message written by our database rules
    TMS.toast('This change could not be saved.' + (msg ? ' (' + TMS.esc(msg) + ')' : ''));
  }

  TMS.save = function (key, list) {
    list = (list || []).map(function (item) { return normalize(key, TMS.clone(item)); });
    var old = cache[key] || [], oldById = {}, newIds = {}, inserts = [], updates = [], removes = [];
    old.forEach(function (o) { oldById[o.id] = o; });
    list.forEach(function (item) {
      newIds[item.id] = true;
      var o = oldById[item.id];
      if (!o) { inserts.push(item); return; }
      var changed = Object.keys(item).filter(function (c) { return stable(item[c]) !== stable(o[c]); });
      if (changed.length) updates.push({ item: item, cols: changed });
    });
    old.forEach(function (o) { if (!newIds[o.id]) removes.push(o.id); });
    cache[key] = sortItems(TMS.clone(list));
    if (mode !== 'supabase' || !sb) { TMS.set(key, cache[key]); return; }
    var table = TABLES[key].table;
    removes.forEach(function (id) {
      enqueue(key, function () { return sb.from(table).delete().eq('id', id).select('id'); });
    });
    inserts.forEach(function (item) {
      enqueue(key, function () { return sb.from(table).insert(toRow(key, item)).select('id'); });
    });
    updates.forEach(function (u) {
      var row = toRow(key, u.item, u.cols.filter(function (c) { return TABLES[key].cols.indexOf(c) > -1; }));
      if (!Object.keys(row).length) return;
      enqueue(key, function () { return sb.from(table).update(row).eq('id', u.item.id).select('id'); });
    });
  };

  /* ---------- buying a car: a deposit and our fee are paid here, the rest through Absher ---------- */
  TMS.DEPOSIT = 1000;          // holds the car for the buyer; it is part of the car price
  TMS.DELIVERY_FEE = 120;      // our driver checks the car and delivers it
  // o: { listing, method, fees, day, time, place }  →  resolves with the receipt number
  TMS.buy = function (o) {
    var l = TMS.findListing(o.listing), u = TMS.user();
    var receipt = 'TMS-' + String(Date.now()).slice(-6);
    if (!l || l.status !== 'live') return Promise.reject({ sold: true, message: 'This car is no longer for sale' });
    if (mode !== 'supabase' || !sb) {
      var name = l.year + ' ' + l.make + ' ' + l.model, payments = TMS.load('payments'), pid = TMS.uid('p');
      payments.push({ id: pid, receipt: receipt, listingId: l.id, car: name, buyer: u.name, buyerEmail: u.email, seller: l.seller,
                      amount: TMS.DEPOSIT + o.fees, carPrice: l.price, kind: 'deposit', method: o.method, date: TMS.fmt(TMS.today()), status: 'held' });
      TMS.save('payments', payments);
      TMS.updateListing(l.id, { status: 'sold', buyer: u.name });
      if (o.day) {
        var bookings = TMS.load('bookings');
        bookings.push({ id: 'd' + pid, owner: u.email, vehicleId: '', customer: u.name, car: name, plate: 'Delivery to buyer',
                        jobs: ['Car check + delivery'], job: 'Car check + delivery', day: o.day, time: o.time, place: o.place, driver: null, status: 'waiting' });
        TMS.save('bookings', bookings);
      }
      return Promise.resolve(receipt);
    }
    // online: one database function does all three steps together, so two buyers can never buy the same car
    return sb.rpc('buy_listing', { p_listing: l.id, p_method: o.method, p_deposit: TMS.DEPOSIT, p_fees: o.fees,
                                   p_day: o.day || '', p_time: o.time || '', p_place: o.place || '', p_receipt: receipt }).then(function (r) {
      if (r.error) throw { sold: /no longer for sale/i.test(r.error.message || ''), message: r.error.message || 'The payment could not be saved.' };
      ['listings', 'payments', 'bookings'].forEach(refetch);
      return receipt;
    }, function (err) {
      throw { message: isNetwork(err) ? 'We could not reach the database. Nothing was charged. Check your internet connection and try again.' : String(err && err.message || err) };
    });
  };
  // Admin: the ownership transfer is done in Absher. The deposit goes to the seller, and the car
  // moves to the buyer's "My vehicles" with its history (an example car is added without a plate).
  TMS.completeTransfer = function (paymentId) {
    if (mode === 'supabase' && sb) {
      return sb.rpc('complete_transfer', { p_payment: paymentId }).then(function (r) {
        if (r.error) { writeFailed(r.error); throw r.error; }
        ['payments', 'vehicles', 'bookings', 'listings'].forEach(refetch);
        return r.data;
      });
    }
    var payments = TMS.load('payments'), p = payments.filter(function (x) { return x.id === paymentId; })[0];
    if (!p || p.status !== 'held') return Promise.reject(new Error('already done'));
    p.status = 'paid';
    TMS.save('payments', payments);
    var buyer = p.buyerEmail && TMS.findUser(p.buyerEmail), l = TMS.findListing(p.listingId);
    if (!buyer || !l) return Promise.resolve('paid');
    var rec = { date: TMS.fmt(TMS.today()), type: 'Ownership', detail: 'Ownership transferred in Absher', verified: true };
    var vehicles = TMS.load('vehicles'), v = vehicles.filter(function (x) { return x.id === l.vehicleId; })[0];
    if (v) {
      TMS.save('bookings', TMS.load('bookings').filter(function (b) { return !(b.vehicleId === v.id && b.status !== 'done'); }));
      v.owner = buyer.email; v.location = ''; v.self = null; v.history = [rec].concat(v.history || []);
      TMS.save('vehicles', vehicles);
      return Promise.resolve('moved');
    }
    vehicles.push({ id: 'v' + p.id, owner: buyer.email, make: l.make, model: l.model, year: l.year, body: l.body || '#ffffff',
                    plateL: null, plateN: null, km: l.km, location: '', istimara: null, fahas: null, insurance: null, oilKm: null,
                    history: [rec].concat(l.history || []), self: null });
    TMS.save('vehicles', vehicles);
    return Promise.resolve('added');
  };
  // what the seller said about accidents, in a few words
  TMS.accidentText = function (l) {
    return l.accident === 'no' ? 'No accidents' : l.accident === 'yes' ? 'Accident reported' : 'Seller does not know';
  };

  /* ---------- log in, create an account, log out ---------- */
  function authError(err) {
    var code = (err && (err.code || err.error_code)) || '', msg = String((err && err.message) || '');
    if (isNetwork(err)) return { field: 'password', message: 'We could not reach the database. Check your internet connection and try again.' };
    if (code === 'invalid_credentials' || /invalid login/i.test(msg)) return { field: 'password', message: 'The email or password is not right. Check both and try again.' };
    if (code === 'user_already_exists' || /already registered/i.test(msg)) return { field: 'email', message: 'There is already an account with this email. Log in instead.' };
    if (code === 'weak_password' || /password/i.test(msg)) return { field: 'password', message: 'Choose a stronger password, with at least 6 characters.' };
    if (code === 'email_address_invalid' || /email/i.test(msg) && /invalid/i.test(msg)) return { field: 'email', message: 'This email was not accepted. Try another one, for example name@example.com.' };
    if (err && err.status === 429 || /rate limit/i.test(msg)) return { field: 'password', message: 'Too many tries in a short time. Wait a minute, then try again.' };
    return { field: 'password', message: 'Something went wrong: ' + (msg || 'please try again.') };
  }
  function loadProfile(uid) {
    return sb.from('profiles').select('*').eq('id', uid).maybeSingle().then(function (r) {
      if (r.error) throw r.error;
      if (!r.data) throw { field: 'email', message: 'This account has no profile in the database yet. Ask the admin, or create a new account.' };
      var u = userFrom(fromRow('users', r.data));
      TMS.set('user', u);
      return u;
    });
  }
  function offlineLogIn(email) {
    var staff = TMS.isStaff(email), known = TMS.findUser(email);
    if (!staff && !known) return Promise.reject({ field: 'email', message: 'We can’t find an account with this email. Check it, or create an account.' });
    var u = staff ? { name: 'Admin', email: email, type: 'staff', company: '', role: 'admin' }
                  : { name: known.name, email: known.email, type: known.type, company: known.company || '', role: 'user' };
    TMS.signIn(u);
    return Promise.resolve(u);
  }
  // resolves with the user, or fails with { field, message } for the form to show
  TMS.logIn = function (email, password) {
    email = String(email || '').trim().toLowerCase();
    if (mode !== 'supabase' || !sb) return offlineLogIn(email);
    return sb.auth.signInWithPassword({ email: email, password: password }).then(function (r) {
      if (r.error) throw authError(r.error);
      session = r.data.session;
      return loadProfile(r.data.user.id);
    }).catch(function (err) { throw err && err.field ? err : authError(err); });
  };
  TMS.signUp = function (u) {
    var email = String(u.email || '').trim().toLowerCase();
    if (mode !== 'supabase' || !sb) {
      TMS.addUser({ name: u.name, email: email, type: u.type, company: u.company, joined: TMS.fmt(TMS.today()) });
      var me = { name: u.name, email: email, type: u.type, company: u.company, role: 'user' };
      TMS.signIn(me);
      return Promise.resolve(me);
    }
    return sb.auth.signUp({ email: email, password: u.password,
                            options: { data: { name: u.name, type: u.type, company: u.company } } }).then(function (r) {
      if (r.error) throw authError(r.error);
      if (!r.data.session) {
        // Supabase still asks for email confirmation (the setting "Confirm email" is on)
        throw { field: 'email', message: 'The account was made, but it needs an email confirmation first. (Admin: turn off “Confirm email” in Supabase.)' };
      }
      session = r.data.session;
      return loadProfile(r.data.user.id);
    }).catch(function (err) { throw err && err.field ? err : authError(err); });
  };

  // Admin: put the example data back (deletes everything added since)
  TMS.resetData = function () {
    if (mode !== 'supabase' || !sb) {
      writeSeedsLocal();
      KEYS.forEach(function (k) { cache[k] = sortItems(TMS.get(k, [])); });
      emit(KEYS.slice());
      return Promise.resolve();
    }
    return sb.rpc('reset_demo').then(function (r) {
      if (r.error) { writeFailed(r.error); throw r.error; }
      var keys = keysToRead();
      return Promise.all(keys.map(fetchTable)).then(function (lists) {
        keys.forEach(function (k, i) { cache[k] = sortItems(lists[i]); });
        emit(keys);
      });
    });
  };

  // choose the mode (called at the end of this file, once everything is defined)
  function chooseMode() {
    if (window.supabase && typeof window.supabase.createClient === 'function') startSupabase();
    else startBrowser('Offline: the database library did not load. Changes are saved in this browser only.');
  }

  /* ---------- the note in the footer: where is the data saved? ---------- */
  var modeNoteText = '';
  function modeText() {
    if (modeNoteText) return modeNoteText;
    if (mode === 'supabase') return ready ? 'Live · online database' : 'Connecting to the database…';
    if (mode === 'browser') return 'Saved in this browser only';
    return 'Loading…';
  }
  function updateModeNote() {
    document.querySelectorAll('.footer .container').forEach(function (c) {
      var p = c.querySelector('.datamode');
      if (!p) {
        p = document.createElement('p');
        p.className = 'datamode';
        p.setAttribute('role', 'status');
        c.appendChild(p);
      }
      p.classList.toggle('live', mode === 'supabase' && ready);
      p.innerHTML = '<span class="dot" aria-hidden="true"></span>' + TMS.esc(modeText());
    });
  }

  /* =========================================================
     HELPERS THE PAGES SHARE
     ========================================================= */
  TMS.findListing = function (id) {
    return TMS.load('listings').filter(function (l) { return l.id === id; })[0] || null;
  };
  TMS.updateListing = function (id, change) {
    var all = TMS.load('listings');
    all.forEach(function (l) { if (l.id === id) Object.keys(change).forEach(function (k) { l[k] = change[k]; }); });
    TMS.save('listings', all);
  };
  TMS.addUser = function (u) {
    var users = TMS.load('users');
    if (!users.some(function (x) { return x.email.toLowerCase() === u.email.toLowerCase(); })) {
      users.push(u);
      TMS.save('users', users);
    }
  };
  TMS.findUser = function (email) {
    return TMS.load('users').filter(function (x) { return x.email.toLowerCase() === String(email).trim().toLowerCase(); })[0] || null;
  };
  // a listing shows its car's records as they are now (jobs done after listing appear too)
  TMS.historyOf = function (l) {
    if (l && l.vehicleId) {
      var v = TMS.load('vehicles').filter(function (x) { return x.id === l.vehicleId; })[0];
      if (v && v.history) return v.history;
    }
    return (l && l.history) || [];
  };
  TMS.verifiedCount = function (l) { return TMS.historyOf(l).filter(function (h) { return h.verified; }).length; };

  /* ---------- vehicles: plate, reminders, renewing after a job ---------- */
  TMS.PLATE_LETTERS = 'ABDEGHJKLNRSTUVXZ';      // the 17 Latin letters used on Saudi plates
  TMS.plate = function (v) {
    if (!v.plateL) return 'Plate not added yet';
    return String(v.plateL || '').split('').join(' ') + ' · ' + String(v.plateN || '');
  };
  TMS.vehicleName = function (v) { return v.make + ' ' + v.model; };
  var OIL_EVERY = 10000;
  TMS.OIL_EVERY = OIL_EVERY;
  var DATE_ITEMS = [['Istimara', 'istimara'], ['Fahas', 'fahas'], ['Insurance', 'insurance']];
  // one line per reminder: Istimara, Fahas, Insurance (dates) and Oil service (kilometres)
  TMS.items = function (v) {
    var out = [];
    DATE_ITEMS.forEach(function (d) {
      var days = TMS.daysUntil(v[d[1]]);
      if (days === null) return;
      out.push({ what: d[0], key: d[1], kind: 'date', days: days, when: TMS.fmt(TMS.parseISO(v[d[1]])),
                 left: TMS.leftText(days), level: TMS.level(days), urgency: days });
    });
    if (v.oilKm !== null && v.oilKm !== undefined && v.oilKm !== '') {
      var next = Number(v.oilKm) + OIL_EVERY, left = next - Number(v.km);
      out.push({ what: 'Oil service', key: 'oil', kind: 'km', kmLeft: left, when: 'at ' + TMS.km(next),
                 left: left <= 0 ? 'Overdue ' + TMS.km(-left) : TMS.km(left),
                 level: left <= 0 ? 'red' : left <= 1000 ? 'amber' : 'green',
                 urgency: left <= 0 ? -1 : left <= 1000 ? 20 : 400 });
    }
    return out;
  };
  TMS.isDue = function (item) { return item.level !== 'green'; };
  // a car can have more than one open request (for example the Fahas by a driver, the insurance online)
  TMS.activeBookings = function (v, bookings) {
    return (bookings || TMS.load('bookings')).filter(function (b) { return b.vehicleId === v.id && b.status !== 'done'; });
  };
  TMS.activeBooking = function (v, bookings) { return TMS.activeBookings(v, bookings)[0] || null; };
  var RENEW = {
    Istimara: { years: 3, type: 'Istimara', detail: 'Renewed in Absher by the owner' },
    Fahas: { years: 1, type: 'Fahas', detail: 'Periodic inspection passed' },
    Insurance: { years: 1, type: 'Insurance', detail: 'Policy renewed online for 1 year' }
  };
  // a job is finished: move its date forward and add a record to the car's history
  TMS.renew = function (v, jobs, verified) {
    var t = TMS.today();
    v.history = v.history || [];
    jobs.forEach(function (job) {
      if (job === 'Oil service') {
        v.oilKm = Number(v.km);
        v.history.unshift({ date: TMS.fmt(t), type: 'Service', detail: 'Oil and filter change at ' + TMS.km(v.km), verified: !!verified });
        return;
      }
      var r = RENEW[job];
      if (!r) return;
      var key = job.toLowerCase();
      var from = TMS.parseISO(v[key]);
      if (!from || from < t) from = t;
      v[key] = TMS.iso(TMS.addYears(from, r.years));
      v.history.unshift({ date: TMS.fmt(t), type: r.type, detail: r.detail, verified: !!verified });
    });
    if (v.self) {
      v.self.jobs = v.self.jobs.filter(function (j) { return jobs.indexOf(j) === -1; });
      if (!v.self.jobs.length) v.self = null;
    }
    return v;
  };
  TMS.joinNames = function (list) {
    if (list.length <= 1) return list.join('');
    return list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1];
  };

  /* ---------- a photo chosen by the seller: made smaller so it fits in the database ---------- */
  TMS.photoFromFile = function (file) {
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\//.test(file.type)) { reject(new Error('not an image')); return; }
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('read')); };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error('decode')); };
        img.onload = function () {
          function draw(maxW, q) {
            var scale = Math.min(1, maxW / img.width, (maxW * 0.75) / img.height);
            var c = document.createElement('canvas');
            c.width = Math.max(1, Math.round(img.width * scale));
            c.height = Math.max(1, Math.round(img.height * scale));
            c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
            return c.toDataURL('image/jpeg', q);
          }
          var url = draw(1000, 0.72);
          if (url.length > 170000) url = draw(800, 0.6);
          if (url.length > 170000) url = draw(640, 0.55);
          resolve(url);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  };

  /* ---------- a car picture: the seller's photo, or a drawing in the car's colour ---------- */
  var BODY = 'M4 22.5V19.8C4 17.9 5.3 16.3 7.2 15.9L13.4 14.6L18.6 8.4C19.4 7.5 20.5 7 21.7 7H29.6C30.9 7 32.1 7.6 32.9 8.6L37.9 14.6L41.6 15.3C43.6 15.7 45 17.4 45 19.4V22.5C45 23.6 44.1 24.5 43 24.5H6C4.9 24.5 4 23.6 4 22.5Z';
  var WIN1 = 'M15.6 14.4L19.9 9.4C20.4 8.8 21.1 8.5 21.9 8.5H24.6V14.4Z';
  var WIN2 = 'M26.4 8.5H29.4C30.2 8.5 30.9 8.8 31.4 9.4L35.6 14.4H26.4Z';
  TMS.carPic = function (l, cls) {
    var name = TMS.esc(l.year + ' ' + l.make + ' ' + l.model);
    if (l.photo && /^(data:image\/(jpeg|png|webp);base64,|photos\/[\w.-]+$)/.test(l.photo)) {
      return '<img class="ill photo ' + (cls || '') + '" src="' + TMS.esc(l.photo) + '" alt="Photo of the ' + name + '" loading="lazy">';
    }
    var body = /^#[0-9a-f]{6}$/i.test(l.body || '') ? l.body : '#ffffff';
    return '<svg class="ill ' + (cls || '') + '" viewBox="0 0 320 180" role="img" aria-label="Drawing of a ' + name + '">' +
      '<rect width="320" height="180" style="fill:var(--sky)"/>' +
      '<rect y="150" width="320" height="30" style="fill:var(--line)"/>' +
      '<ellipse cx="160" cy="151" rx="118" ry="7" fill="#0f2f5c" opacity=".18"/>' +
      '<g transform="translate(28.4 -6.1) scale(5.4)">' +
        '<path fill="' + body + '" stroke="#0f2f5c" stroke-width=".55" d="' + BODY + '"/>' +
        '<path fill="#b7d8fb" d="' + WIN1 + '"/><path fill="#b7d8fb" d="' + WIN2 + '"/>' +
        '<path d="M25.5 15.2v7" stroke="#0f2f5c" stroke-opacity=".35" stroke-width=".45"/>' +
        '<rect x="4.7" y="17.5" width="2.4" height="1.5" rx=".5" fill="#9a5b00"/>' +
        '<rect x="43.1" y="17.6" width="1.4" height="1.8" rx=".4" fill="#b42318"/>' +
        '<circle cx="13.5" cy="24.5" r="4.4" fill="#0f2f5c"/><circle cx="36" cy="24.5" r="4.4" fill="#0f2f5c"/>' +
        '<circle cx="13.5" cy="24.5" r="1.8" fill="#b7d8fb"/><circle cx="36" cy="24.5" r="1.8" fill="#b7d8fb"/>' +
      '</g></svg>';
  };
  TMS.COLOURS = [['White', '#ffffff'], ['Silver', '#d5dde8'], ['Grey', '#4a5668'], ['Black', '#1c2430'], ['Blue', '#1a6dcf'], ['Red', '#b42318'], ['Beige', '#e8dcc4']];

  /* =========================================================
     EXAMPLE DATA (version 4)
     Two demo accounts with cars; new accounts start with no cars.
     ========================================================= */
  // one car's records, newest first: [days ago, type, detail]
  var HISTORY = [
    [26, 'Service', 'oil1'],
    [95, 'Insurance', 'Comprehensive policy renewed for 1 year'],
    [181, 'Fahas', 'Periodic inspection passed'],
    [182, 'Istimara', 'Registration renewed for 3 years'],
    [214, 'Service', 'oil2'],
    [302, 'Service', 'Brake pads replaced'],
    [460, 'Insurance', 'Comprehensive policy renewed for 1 year']
  ];
  // pattern: one letter per record, v = done by our drivers (Verified), o = added by the owner
  TMS.makeHistory = function (km, pattern) {
    var t = TMS.today();
    return HISTORY.map(function (h, i) {
      var detail = h[2] === 'oil1' ? 'Oil and filter change at ' + TMS.km(Math.max(km - 900, 1000))
                 : h[2] === 'oil2' ? 'Oil and filter change at ' + TMS.km(Math.max(km - 10900, 500))
                 : h[2];
      return { date: TMS.fmt(TMS.addDays(t, -h[0])), type: h[1], detail: detail, verified: pattern.charAt(i) === 'v' };
    });
  };

  function seeds() {
    var t = TMS.today(), base = Date.now(), n = 0;
    function c() { return base + (n++); }
    function d(days) { return TMS.iso(TMS.addDays(t, days)); }
    function joined(days) { return TMS.fmt(TMS.addDays(t, -days)); }
    function user(name, email, type, company, days) {
      return { id: TMS.userId(email), name: name, email: email, type: type, company: company, joined: joined(days), created: c() };
    }
    function car(id, owner, make, model, year, l, num, km, colour, ist, fah, ins, oilKm, location, pattern) {
      return { id: id, owner: owner, make: make, model: model, year: year, plateL: l, plateN: num, km: km, body: colour,
               istimara: d(ist), fahas: d(fah), insurance: d(ins), oilKm: oilKm, location: location || '',
               history: pattern ? TMS.makeHistory(km, pattern) : [], self: null, created: c() };
    }
    function listing(id, make, model, year, km, price, city, body, seller, sellerType, status, daysAgo, pattern, accident, notes) {
      return { id: id, make: make, model: model, year: year, km: km, price: price, city: city, body: body,
               seller: seller, sellerType: sellerType, sellerEmail: '', vehicleId: '', status: status, handle: false,
               listed: TMS.fmt(TMS.addDays(t, -daysAgo)), history: TMS.makeHistory(km, pattern), photo: 'photos/' + id + '.jpg',
               accident: accident || 'no', accidentNotes: notes || '', created: c() };
    }
    var A = 'ahmed@example.com', B = 'albahar@example.com';
    var w = TMS.workdays(3).map(TMS.fmtDay);
    var sold = listing('c9', 'Toyota', 'Corolla', 2020, 77000, 52000, 'Yanbu', '#ffffff', 'Hassan', 'individual', 'sold', 20, 'vvvvvoo');
    sold.buyer = 'Ahmed Ali';
    return {
      users: [
        user('Ahmed Ali', A, 'individual', '', 47),
        user('Saeed Al-Bahar', B, 'business', 'Al-Bahar Logistics', 40),
        user('Reem Saleh', 'reem@example.com', 'individual', '', 21),
        user('Omar Nasser', 'omar@example.com', 'individual', '', 12),
        user('Noura Fahad', 'noura@example.com', 'individual', '', 6)
      ],
      vehicles: [
        car('a1', A, 'Kia', 'K5', 2022, 'AJK', '2847', 51240, '#ffffff', 12, 12, 61, 42000, '', 'vvvvvov'),
        car('a2', A, 'Toyota', 'Hilux', 2019, 'RNB', '4821', 138905, '#d5dde8', 150, 150, 23, 138300, '', 'vvovvvo'),
        car('a3', A, 'Hyundai', 'Sonata', 2024, 'SND', '1190', 19480, '#1a6dcf', 221, 221, 282, 15000, '', 'vvvoooo'),
        car('f1', B, 'Isuzu', 'NPR truck', 2018, 'KNA', '4410', 214300, '#ffffff', 190, -2, 240, 210000, 'Yanbu depot', 'vvvvvvv'),
        car('f2', B, 'Hyundai', 'H1 bus', 2019, 'BDR', '2207', 168200, '#d5dde8', 150, 0, 300, 160000, 'Jeddah branch', 'vvvvvvo'),
        car('f3', B, 'Isuzu', 'NPR truck', 2018, 'KNE', '4418', 199800, '#ffffff', 210, 3, 120, 192000, 'Yanbu depot', 'vvvvvvv'),
        car('f4', B, 'Toyota', 'Camry', 2021, 'RST', '9031', 96400, '#ffffff', 330, 330, 6, 90000, 'Riyadh office', 'vvvvvov'),
        car('f5', B, 'Mercedes', 'Actros', 2017, 'KNG', '4402', 402000, '#ffffff', 13, 95, 200, 396000, 'Yanbu depot', 'vvvvvvv'),
        car('f6', B, 'Toyota', 'Camry', 2022, 'RSV', '9044', 71900, '#4a5668', 18, 180, 260, 65000, 'Riyadh office', 'vvvvoov'),
        car('f7', B, 'Hyundai', 'H1 bus', 2020, 'BDX', '2210', 143500, '#d5dde8', 260, 100, 170, 134200, 'Jeddah branch', 'vvvvvvv'),
        car('f8', B, 'Isuzu', 'D-Max', 2021, 'DHL', '4431', 88700, '#ffffff', 400, 220, 28, 80000, 'Dammam branch', 'vvvovvv')
      ],
      listings: [
        listing('c1', 'Toyota', 'Camry', 2021, 62000, 79000, 'Riyadh', '#1c2430', 'Faisal', 'individual', 'live', 3, 'vvvvvvo'),
        listing('c2', 'Hyundai', 'Elantra', 2020, 85500, 48500, 'Jeddah', '#d5dde8', 'Noura', 'individual', 'live', 6, 'vovovoo', 'yes', 'Rear bumper replaced after a small accident in 2024.'),
        listing('c3', 'Toyota', 'Hilux', 2019, 121000, 72000, 'Yanbu', '#ffffff', 'Al-Bahar Logistics', 'company', 'live', 9, 'vvvvvvv'),
        listing('c4', 'Kia', 'Sportage', 2023, 21300, 98000, 'Riyadh', '#4a5668', 'Sara', 'individual', 'live', 1, 'vvvoooo'),
        listing('c5', 'Honda', 'Accord', 2018, 141000, 39000, 'Madinah', '#d5dde8', 'Majed', 'individual', 'live', 14, 'ooooooo', 'no'),
        listing('c6', 'Nissan', 'Patrol', 2022, 58000, 215000, 'Dammam', '#1c2430', 'Khalid', 'individual', 'live', 5, 'vvovvoo'),
        listing('c7', 'Mazda', '6', 2021, 54000, 63000, 'Jeddah', '#4a5668', 'Huda', 'individual', 'pending', 0, 'vvoovvo'),
        listing('c8', 'Ford', 'Taurus', 2017, 168000, 31000, 'Riyadh', '#d5dde8', 'Turki', 'individual', 'pending', 1, 'oooovoo', 'yes', 'Front-end accident in 2022, repaired at an agency.'),
        sold
      ],
      bookings: [
        { id: 'b1', owner: B, vehicleId: 'f1', customer: 'Al-Bahar Logistics', car: 'Isuzu NPR truck', plate: 'K N A · 4410', jobs: ['Fahas'],
          job: 'Fahas', day: w[0], time: '12–2 pm', place: 'Yanbu depot', driver: null, status: 'waiting', created: c() },
        { id: 'b2', owner: 'reem@example.com', vehicleId: '', customer: 'Reem Saleh', car: 'Kia Pegas', plate: 'R D A · 7731', jobs: ['Fahas'],
          job: 'Fahas', day: w[1], time: '4–6 pm', place: 'Work', driver: 'Fahad S.', status: 'assigned', created: c() },
        { id: 'b3', owner: 'omar@example.com', vehicleId: '', customer: 'Omar Nasser', car: 'Toyota Yaris', plate: 'J G K · 1204', jobs: ['Oil service'],
          job: 'Oil service', day: w[2], time: '8–10 am', place: 'Home', driver: null, status: 'waiting', created: c() }
      ],
      payments: [
        { id: 'p1', receipt: 'TMS-1041', listingId: 'c9', car: '2020 Toyota Corolla', buyer: 'Ahmed Ali', buyerEmail: A, seller: 'Hassan',
          amount: 1120, carPrice: 52000, kind: 'deposit', method: 'mada', date: TMS.fmt(TMS.addDays(t, -9)), status: 'paid', created: c() },
        { id: 'p2', receipt: 'TMS-1042', listingId: '', car: '2019 Kia Rio', buyer: 'Reem Saleh', seller: 'Bader',
          amount: 1120, carPrice: 36000, kind: 'deposit', method: 'Apple Pay', date: TMS.fmt(TMS.addDays(t, -3)), status: 'held', created: c() }
      ]
    };
  }
  TMS.seeds = seeds;

  /* ---------- icons used by the menus ---------- */
  var ICON = {
    display: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/></svg>',
    caret: '<svg class="caret" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
    car: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 17h14v-5l-2-5H7l-2 5z"/><circle cx="8" cy="17" r="2"/><circle cx="16" cy="17" r="2"/></svg>',
    tag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.5"/></svg>',
    shield: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    out: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/></svg>',
    tick: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></svg>',
    trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
    alert: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>'
  };
  TMS.icon = ICON;

  /* ---------- a short message after an action, with an optional Undo ---------- */
  var toastTimer = null;
  TMS.toast = function (message, undo) {
    var old = document.getElementById('toast');
    if (old) old.remove();
    clearTimeout(toastTimer);
    var t = document.createElement('div');
    t.className = 'toast'; t.id = 'toast'; t.setAttribute('role', 'status');
    t.innerHTML = ICON.tick + '<span>' + message + '</span>';
    if (undo) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'linkbtn'; b.textContent = 'Undo';
      b.addEventListener('click', function () { t.remove(); undo(); });
      t.appendChild(b);
    }
    // inside an open dialog the message must sit in the dialog, or the backdrop would cover it
    var dlg = document.querySelector('dialog[open]');
    (dlg || document.body).appendChild(t);
    toastTimer = setTimeout(function () { if (t.parentNode) t.remove(); }, 7000);
  };

  /* =========================================================
     TOP BAR: Display menu, greeting and user menu
     ========================================================= */
  var openMenu = null;
  function closeMenus(focusButton) {
    if (!openMenu) return;
    openMenu.panel.hidden = true;
    openMenu.button.setAttribute('aria-expanded', 'false');
    if (focusButton && document.contains(openMenu.button)) openMenu.button.focus();
    openMenu = null;
  }
  function wireMenu(button, panel) {
    button.addEventListener('click', function (e) {
      e.stopPropagation();
      var wasOpen = openMenu && openMenu.panel === panel;
      closeMenus(false);
      if (!wasOpen) {
        panel.hidden = false;
        // keep the menu on the screen, in English (left to right) and Arabic (right to left)
        ['position', 'left', 'right', 'top', 'width', 'maxHeight', 'overflowY'].forEach(function (k) { panel.style[k] = ''; });
        if (window.innerWidth <= 760) {
          // phone: the menu opens across the screen, 16px from each edge
          var top = button.getBoundingClientRect().bottom + 8;
          panel.style.position = 'fixed'; panel.style.left = '16px'; panel.style.right = '16px';
          panel.style.top = top + 'px'; panel.style.width = 'auto';
          panel.style.maxHeight = (window.innerHeight - top - 16) + 'px'; panel.style.overflowY = 'auto';
        } else {
          var box = panel.getBoundingClientRect();
          if (box.left < 8) { panel.style.left = '0'; panel.style.right = 'auto'; }
          else if (box.right > window.innerWidth - 8) { panel.style.right = '0'; panel.style.left = 'auto'; }
        }
        button.setAttribute('aria-expanded', 'true');
        openMenu = { button: button, panel: panel };
        var first = panel.querySelector('input:checked, a, button');
        if (first) first.focus();
      }
    });
    panel.addEventListener('click', function (e) { if (!e.target.closest('a')) e.stopPropagation(); });
  }
  document.addEventListener('click', function () { closeMenus(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenus(true); });

  function buildDisplay(holder) {
    var prev = holder.previousElementSibling;
    if (!prev || !prev.classList.contains('langbtn')) {
      var lb = document.createElement('button');
      var toAr = TMS.lang() !== 'ar';
      lb.type = 'button';
      lb.className = 'menubtn langbtn';
      lb.setAttribute('data-notr', '');
      lb.setAttribute('lang', toAr ? 'ar' : 'en');
      lb.innerHTML = toAr ? '<span class="full">العربية</span><span class="short" aria-hidden="true">ع</span>'
                          : '<span class="full">English</span><span class="short" aria-hidden="true">EN</span>';
      lb.setAttribute('aria-label', toAr ? 'العربية: اعرض الموقع باللغة العربية' : 'English: show the site in English');
      lb.addEventListener('click', function () { TMS.setLang(toAr ? 'ar' : 'en'); });
      holder.parentNode.insertBefore(lb, holder);
    }
    holder.classList.add('menuwrap', 'display');
    var theme = TMS.get('theme', 'system'), size = TMS.get('text', '1');
    function radio(name, id, value, label, checked) {
      return '<input class="sr-only" type="radio" name="' + name + '" id="' + id + '" value="' + value + '"' +
             (checked ? ' checked' : '') + '><label for="' + id + '">' + label + '</label>';
    }
    holder.innerHTML =
      '<button type="button" class="menubtn" id="displayBtn" aria-expanded="false" aria-controls="displayPanel">' +
        ICON.display + '<span class="lbl">Display</span>' + ICON.caret + '</button>' +
      '<div class="panel-pop" id="displayPanel" hidden>' +
        '<fieldset class="field"><legend>Theme</legend><div class="segmented">' +
          radio('dispTheme', 'themeLight', 'light', 'Light', theme === 'light') +
          radio('dispTheme', 'themeDark', 'dark', 'Dark', theme === 'dark') +
          radio('dispTheme', 'themeSystem', 'system', 'Same as my device', theme !== 'light' && theme !== 'dark') +
        '</div></fieldset>' +
        '<fieldset class="field"><legend>Text size</legend><div class="segmented">' +
          radio('dispText', 'text1', '1', 'A<span class="sr-only"> normal</span>', size !== '2' && size !== '3') +
          radio('dispText', 'text2', '2', 'A+<span class="sr-only"> large</span>', size === '2') +
          radio('dispText', 'text3', '3', 'A++<span class="sr-only"> extra large</span>', size === '3') +
        '</div></fieldset>' +
      '</div>';
    var panel = holder.querySelector('.panel-pop');
    wireMenu(holder.querySelector('.menubtn'), panel);
    panel.addEventListener('change', function (e) {
      if (e.target.name === 'dispTheme') TMS.setTheme(e.target.value);
      if (e.target.name === 'dispText') TMS.setText(e.target.value);
    });
  }

  function buildAuth(holder) {
    var u = TMS.user();
    var mode = holder.getAttribute('data-auth');        // "", "landing", "signup", "login"
    holder.classList.remove('authwrap');
    if (!u) {
      holder.innerHTML = mode === 'signup'
        ? '<a class="btn" href="signup.html">Create account</a>'
        : '<a class="btn' + (mode === 'login' ? ' secondary' : '') + '" href="login.html">Log in</a>';
      return;
    }
    var first = TMS.firstName(u.name) || 'there';
    var staff = TMS.isStaff(u.email);
    var home = staff ? '<a href="admin.html">' + ICON.shield + 'Admin page</a>'
                     : '<a href="vehicles.html">' + ICON.car + 'My vehicles</a>';
    holder.classList.add('authwrap');
    holder.innerHTML =
      (mode === 'landing'
        ? '<a class="btn" href="' + (staff ? 'admin.html' : 'vehicles.html') + '">' + (staff ? 'Admin page' : 'My vehicles') + '</a> '
        : '') +
      '<span class="menuwrap">' +
      '<button type="button" class="menubtn" id="userBtn" aria-expanded="false" aria-controls="userPanel">' +
        '<span class="avatar" aria-hidden="true">' + TMS.esc(first.charAt(0).toUpperCase()) + '</span>' +
        '<span class="lbl" data-greet>' + TMS.esc(TMS.greeting(first)) + '</span>' + ICON.caret + '</button>' +
      '<div class="panel-pop" id="userPanel" hidden>' +
        '<p class="menu-who"><b>' + TMS.esc(u.name) + '</b>' + TMS.esc(u.email) + '</p>' +
        '<ul class="menu-list">' +
          '<li>' + home + '</li>' +
          '<li><a href="market.html">' + ICON.tag + 'Cars for sale</a></li>' +
          '<li><button type="button" id="logOut">' + ICON.out + 'Log out</button></li>' +
        '</ul>' +
      '</div></span>';
    var btn = holder.querySelector('#userBtn'), panel = holder.querySelector('#userPanel');
    wireMenu(btn, panel);
    holder.querySelector('#logOut').addEventListener('click', function () {
      TMS.signOut();
      closeMenus(false);
      TMS.go('index.html');
    });
  }

  // show or hide parts of a page: data-when="guest" / "user" / "member" (a user who is not staff) / "staff"
  function applyWhen() {
    var u = TMS.user(), staff = u && TMS.isStaff(u.email);
    root.classList.toggle('signed-in', !!u);
    document.querySelectorAll('[data-when]').forEach(function (el) {
      var w = el.getAttribute('data-when');
      var show = w === 'guest' ? !u : w === 'user' ? !!u : w === 'member' ? (u && !staff) : w === 'staff' ? staff : true;
      el.hidden = !show;
    });
    document.querySelectorAll('[data-greet-page]').forEach(function (el) {
      el.textContent = TMS.greeting(u ? TMS.firstName(u.name) : '');
    });
  }

  function init() {
    document.querySelectorAll('[data-display]').forEach(buildDisplay);
    document.querySelectorAll('[data-auth]').forEach(buildAuth);
    applyWhen();
    updateModeNote();
  }
  TMS.refreshTopbar = init;
  chooseMode();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { if (!TMS.bundle) init(); });
  else setTimeout(function () { if (!TMS.bundle) init(); }, 0);
})();
