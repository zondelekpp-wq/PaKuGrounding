/* PaKuGrounding – offline grounding app. All data stays on the device. */
'use strict';
(() => {
  const APP_VERSION = '1.4.3';
  /* PaKu family: this app works alone; the family screen only shows the other apps */
  const F = window.PaKuFamily || null;
  const SELF = 'grounding';
  const DEFAULT_ACCENT = '#7a5ca8';
  const ACCENTS = [['lavender', '#7a5ca8'], ['blue', '#3f6fb5'], ['teal', '#2f8a85'], ['green', '#4f8a4f'], ['rose', '#b0507a'], ['amber', '#b5762a'], ['grey', '#646a78']];
  const APP_URL = 'https://zondelekpp-wq.github.io/PaKuGrounding/';   // the QR code in qr.svg points here
  const CONTACT_EMAIL = 'zondelek.p.p@gmail.com';                       // e.g. 'kontakt@example.com' – shown in Terms & privacy when set
  const BMC_URL = 'https://buymeacoffee.com/Hieronim';
  const LANGS = [['en', 'English'], ['pl', 'Polski'], ['de', 'Deutsch'], ['es', 'Español'], ['fr', 'Français'], ['zh', '中文'], ['uk', 'Українська'], ['lv', 'Latviešu']];
  const LOCALES = { en: 'en-GB', pl: 'pl-PL', de: 'de-DE', es: 'es-ES', fr: 'fr-FR', zh: 'zh-CN', uk: 'uk-UA', lv: 'lv-LV' };
  const KEY = 'pakugrounding.v1';
  const PATTERNS = { calm: [['in', 4], ['out', 6]], box: [['in', 4], ['hold', 4], ['out', 4], ['hold', 4]], r478: [['in', 4], ['hold', 7], ['out', 8]] };
  const PATTERN_LABEL = { calm: 'br_calm', box: 'br_box', r478: 'br_478' };
  const LENGTHS = [1, 2, 3, 5];
  const SENSES = [5, 4, 3, 2, 1];
  const HUNT = [
    { k: 'h1', c: '#3f6fd1' }, { k: 'h2', c: '#d13f3f' }, { k: 'h3', c: '#3f9a56' }, { k: 'h4', c: '#f2c12e' },
    { k: 'h5', c: '#ffffff' }, { k: 'h6', c: '#1b1b1b' }, { k: 'h7', c: '#8a4fc8' }, { k: 'h8', c: '#ef8a2b' },
    { k: 'h9' }, { k: 'h10' }, { k: 'h11' }, { k: 'h12' }, { k: 'h13' }, { k: 'h14' }
  ];
  const SOS_ORDER = ['here', 'breathe', 'senses', 'phrase'];
  const SOS_LABEL = { here: 't_here', breathe: 't_breathe', senses: 't_senses', phrase: 't_phrases' };
  const MAX_REC_SECONDS = 300;

  const mq = q => { try { return matchMedia(q).matches; } catch (e) { return false; } };
  const DEFAULTS = () => ({
    lang: 'en', theme: mq('(prefers-color-scheme: dark)') ? 'night' : 'calm', textSize: 'normal',
    reduceMotion: mq('(prefers-reduced-motion: reduce)'), vibrate: true, tone: false,
    breathPattern: 'calm', breathMinutes: 2,
    name: '', place: '', statement: '', emergency: '112',
    sosSteps: { here: true, breathe: true, senses: true, phrase: true }, sosRecId: null,
    phrases: [], people: [], tipDismissed: false, offlineToastShown: false, accent: DEFAULT_ACCENT
  });

  function normalize(p) {
    const d = DEFAULTS();
    if (!p || typeof p !== 'object') return d;
    for (const k of Object.keys(d)) {
      if (!(k in p)) continue;
      const v = p[k];
      if (k === 'sosSteps') { if (v && typeof v === 'object') for (const s of SOS_ORDER) if (typeof v[s] === 'boolean') d.sosSteps[s] = v[s]; }
      else if (k === 'phrases') { if (Array.isArray(v)) d.phrases = v.filter(x => typeof x === 'string' && x.trim()).map(x => x.slice(0, 300)).slice(0, 100); }
      else if (k === 'people') { if (Array.isArray(v)) d.people = v.filter(x => x && typeof x.name === 'string' && typeof x.phone === 'string').map(x => ({ name: x.name.slice(0, 60), phone: x.phone.slice(0, 30) })).slice(0, 30); }
      else if (k === 'sosRecId') d.sosRecId = typeof v === 'string' ? v : null;
      else if (typeof v === typeof d[k]) d[k] = typeof v === 'string' ? v.slice(0, 300) : v;
    }
    if (!window.I18N[d.lang]) d.lang = 'en';
    if (!PATTERNS[d.breathPattern]) d.breathPattern = 'calm';
    if (!['calm', 'night', 'contrast'].includes(d.theme)) d.theme = 'calm';
    if (!['normal', 'large', 'xl'].includes(d.textSize)) d.textSize = 'normal';
    if (!LENGTHS.includes(d.breathMinutes)) d.breathMinutes = 2;
    if (!/^#[0-9a-f]{6}$/i.test(d.accent)) d.accent = DEFAULT_ACCENT;
    d.accent = d.accent.toLowerCase();
    return d;
  }
  function load() { try { return normalize(JSON.parse(localStorage.getItem(KEY) || 'null')); } catch (e) { return DEFAULTS(); } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } }

  let S = load();
  const ft = k => (F ? F.t(k, S.lang) : k);

  /* ---------- helpers ---------- */
  function t(k, v) {
    let s = (window.I18N[S.lang] || {})[k];
    if (s == null) s = window.I18N.en[k];
    if (s == null) return k;
    if (v) s = s.replace(/\{(\w+)\}/g, (m, n) => (v[n] != null ? v[n] : m));
    return s;
  }
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const te = (k, v) => esc(t(k, v));
  const $ = (sel, root = document) => root.querySelector(sel);
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const telClean = s => String(s || '').replace(/[^\d+*#]/g, '');
  const mmss = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const shuffleDots = (n, filled, label) => Array.from({ length: n }, (_, j) =>
    `<button class="dot${j < filled ? ' on' : ''}" data-j="${j}" aria-pressed="${j < filled}" aria-label="${esc(label)} ${j + 1}"></button>`).join('');

  let cleanups = [];
  const onCleanup = f => cleanups.push(f);
  function runCleanup() { const c = cleanups; cleanups = []; c.forEach(f => { try { f(); } catch (e) { } }); }
  const later = (fn, ms) => { const id = setTimeout(fn, ms); onCleanup(() => clearTimeout(id)); return id; };
  const every = (fn, ms) => { const id = setInterval(fn, ms); onCleanup(() => clearInterval(id)); return id; };

  async function keepAwake() {
    try { if ('wakeLock' in navigator) { const l = await navigator.wakeLock.request('screen'); onCleanup(() => l.release().catch(() => { })); } } catch (e) { }
  }

  /* ---------- icons ---------- */
  const sv = p => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  const ICON = {
    anchor: sv('<circle cx="12" cy="5" r="2.5"/><path d="M12 7.5V21M8 11h8M4.5 13.5A7.5 7.5 0 0 0 12 21a7.5 7.5 0 0 0 7.5-7.5"/><path d="M3 15l1.5-1.5L6 15M18 15l1.5-1.5L21 15"/>'),
    back: sv('<path d="M15 5l-7 7 7 7"/>'),
    globe: sv('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z"/>'),
    settings: sv('<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>'),
    wind: sv('<path d="M3 8h10a3 3 0 1 0-3-3"/><path d="M3 12h15a3 3 0 1 1-3 3"/><path d="M3 16h7"/>'),
    senses: sv('<circle cx="12" cy="12" r="2"/><circle cx="12" cy="4.5" r="1.5"/><circle cx="19.5" cy="10" r="1.5"/><circle cx="16.5" cy="19" r="1.5"/><circle cx="7.5" cy="19" r="1.5"/><circle cx="4.5" cy="10" r="1.5"/>'),
    clock: sv('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    eye: sv('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
    quote: sv('<path d="M4 5h16v11H9l-5 4z"/>'),
    mic: sv('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>'),
    heart: sv('<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/>'),
    phone: sv('<path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>'),
    msg: sv('<path d="M4 5h16v11H9l-5 4z"/><path d="M8 10h8"/>'),
    trash: sv('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
    play: sv('<path d="M7 4l13 8-13 8z"/>'),
    pause: sv('<path d="M8 5v14M16 5v14"/>'),
    check: sv('<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>'),
    star: sv('<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>'),
    coffee: sv('<path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17M8 3v3M12 3v3"/>'),
    upload: sv('<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>'),
    info: sv('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>'),
    leaf: sv('<polygon stroke-width="1.6" points="12.0,2.0 13.8,5.8 16.2,4.6 15.4,9.8 19.0,6.6 19.8,8.6 22.6,8.0 21.0,11.8 22.4,12.6 17.0,16.2 17.8,18.6 13.0,17.6 13.0,22.0 11.0,22.0 11.0,17.6 6.2,18.6 7.0,16.2 1.6,12.6 3.0,11.8 1.4,8.0 4.2,8.6 5.0,6.6 8.6,9.8 7.8,4.6 10.2,5.8"/>'),
    sound: sv('<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>'),
    share: sv('<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/>'),
    link: sv('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
    download: sv('<path d="M12 4v12M7 11l5 5 5-5M5 20h14"/>')
  };

  /* ---------- storage for recordings (IndexedDB) ---------- */
  const DB = {
    db: null,
    open() {
      if (this.db) return Promise.resolve(this.db);
      return new Promise((res, rej) => {
        try {
          const r = indexedDB.open('pakugrounding', 1);
          r.onupgradeneeded = () => r.result.createObjectStore('recordings', { keyPath: 'id' });
          r.onsuccess = () => { this.db = r.result; res(this.db); };
          r.onerror = () => rej(r.error);
        } catch (e) { rej(e); }
      });
    },
    async run(mode, fn) {
      const db = await this.open();
      return new Promise((res, rej) => {
        const tx = db.transaction('recordings', mode);
        const req = fn(tx.objectStore('recordings'));
        tx.oncomplete = () => res(req ? req.result : undefined);
        tx.onerror = () => rej(tx.error);
        tx.onabort = () => rej(tx.error);
      });
    },
    all() { return this.run('readonly', s => s.getAll()).then(a => (a || []).sort((x, y) => x.created - y.created)); },
    get(id) { return this.run('readonly', s => s.get(id)); },
    put(r) { return this.run('readwrite', s => s.put(r)); },
    del(id) { return this.run('readwrite', s => s.delete(id)); },
    clear() { return this.run('readwrite', s => s.clear()); }
  };

  /* ---------- audio ---------- */
  let player = null, playerUrl = null, playingId = null;
  /* lock-screen / notification media controls */
  function setMediaSession(title, handlers) {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title, artist: 'PaKuGrounding',
        artwork: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }] });
      for (const a of ['play', 'pause', 'stop']) { try { navigator.mediaSession.setActionHandler(a, (handlers && handlers[a]) || null); } catch (e) { } }
    } catch (e) { }
  }
  function clearMediaSession() {
    if (!('mediaSession' in navigator)) return;
    try { navigator.mediaSession.metadata = null; for (const a of ['play', 'pause', 'stop']) navigator.mediaSession.setActionHandler(a, null); } catch (e) { }
  }
  function stopAudio() {
    if (player) { try { player.pause(); } catch (e) { } player = null; clearMediaSession(); }
    if (playerUrl) { URL.revokeObjectURL(playerUrl); playerUrl = null; }
    playingId = null;
  }
  function playBlob(blob, id, onEnd, title) {
    stopAudio();
    playerUrl = URL.createObjectURL(blob);
    player = new Audio(playerUrl);
    playingId = id;
    const p = player;
    player.onended = () => { stopAudio(); if (onEnd) onEnd(); };
    setMediaSession(title || 'PaKuGrounding', {
      play: () => p.play().catch(() => { }),
      pause: () => p.pause(),
      stop: () => { stopAudio(); if (onEnd) onEnd(); }
    });
    return player.play().catch(() => { if (onEnd) onEnd(); });
  }
  let actx = null;
  function ensureAudioCtx() {
    if (!S.tone) return;
    try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch (e) { }
  }
  function beep(freq) {
    if (!actx) return;
    try {
      const o = actx.createOscillator(), g = actx.createGain(), n = actx.currentTime;
      o.type = 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, n); g.gain.linearRampToValueAtTime(0.07, n + 0.06); g.gain.exponentialRampToValueAtTime(0.0001, n + 0.9);
      o.connect(g).connect(actx.destination); o.start(n); o.stop(n + 1);
    } catch (e) { }
  }

  /* ---------- look & feel ---------- */
  /* user colour: derive a full, readable palette from one accent colour */
  const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const rgbHex = a => '#' + a.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
  const mixc = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const lum = c => { const s = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2]; };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const PALETTE_VARS = ['--primary', '--primary-2', '--bg', '--surface', '--surface2', '--border', '--ring'];
  function palette(hex, theme) {
    const W = [255, 255, 255], B = [0, 0, 0], K = [16, 13, 22];
    let a = hexRgb(hex);
    if (theme === 'calm') {
      for (let i = 0; i < 30 && ratio(a, W) < 4.6; i++) a = mixc(a, B, 0.07);   // white text must stay readable on the accent
      return { '--primary': a, '--primary-2': mixc(a, W, 0.3), '--bg': mixc(a, W, 0.94), '--surface': W, '--surface2': mixc(a, W, 0.87), '--border': mixc(a, W, 0.8), '--ring': mixc(a, W, 0.5) };
    }
    const bg = mixc(a, K, 0.92);
    let p = a;
    for (let i = 0; i < 30 && ratio(p, bg) < 6; i++) p = mixc(p, W, 0.08);              // accent must stand out on the dark background
    return { '--primary': p, '--primary-2': mixc(p, K, 0.25), '--bg': bg, '--surface': mixc(a, K, 0.86), '--surface2': mixc(a, K, 0.8), '--border': mixc(a, K, 0.72), '--ring': mixc(p, K, 0.4) };
  }
  function applyLook() {
    const r = document.documentElement;
    r.dataset.theme = S.theme; r.dataset.size = S.textSize; r.dataset.motion = S.reduceMotion ? 'reduce' : 'full';
    r.lang = S.lang === 'zh' ? 'zh-CN' : S.lang;
    PALETTE_VARS.forEach(v => r.style.removeProperty(v));
    let bg = { calm: '#f5f1fb', night: '#14111b', contrast: '#000000' }[S.theme];
    if (S.theme !== 'contrast' && S.accent !== DEFAULT_ACCENT) {
      const p = palette(S.accent, S.theme);
      for (const k in p) r.style.setProperty(k, rgbHex(p[k]));
      bg = rgbHex(p['--bg']);
    }
    const m = $('meta[name="theme-color"]');
    if (m) m.content = bg;
  }

  /* ---------- toast & modal ---------- */
  let toastTimer = null;
  function toast(msg, action, fn, ms) {
    const el = $('#toast');
    const hide = () => { el.classList.remove('show'); el.hidden = true; el.innerHTML = ''; };
    el.innerHTML = `<span>${esc(msg)}</span>${action ? `<button class="btn small primary">${esc(action)}</button>` : ''}`;
    el.hidden = false; requestAnimationFrame(() => el.classList.add('show'));
    if (action) $('button', el).onclick = () => { hide(); fn(); };
    clearTimeout(toastTimer); toastTimer = setTimeout(hide, ms || (action ? 15000 : 3500));
  }
  function modal(html, setup) {
    const m = $('#modal');
    const prev = document.activeElement;
    m.innerHTML = `<div class="modal-back"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
    m.hidden = false;
    const close = () => { m.hidden = true; m.innerHTML = ''; document.removeEventListener('keydown', onKey); if (prev && prev.focus) prev.focus(); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    $('.modal-back', m).addEventListener('click', e => { if (e.target.classList.contains('modal-back')) close(); });
    setup($('.modal', m), close);
    const f = $('.modal [autofocus], .modal button', m); if (f) f.focus();
  }
  function confirmBox(text, okLabel) {
    return new Promise(res => modal(
      `<p class="lead">${esc(text)}</p><div class="row end"><button class="btn ghost" data-r="0">${te('cancel')}</button><button class="btn danger" data-r="1">${esc(okLabel)}</button></div>`,
      (el, close) => el.addEventListener('click', e => { const b = e.target.closest('[data-r]'); if (b) { close(); res(b.dataset.r === '1'); } })
    ));
  }
  function langPicker() {
    modal(`<h2 class="modal-title">${ICON.globe}<span>${te('language')}</span></h2><div class="lang-list">${LANGS.map(([c, n]) =>
      `<button class="lang-opt${c === S.lang ? ' on' : ''}" data-l="${c}" lang="${c === 'zh' ? 'zh-CN' : c}" aria-pressed="${c === S.lang}">${esc(n)}</button>`).join('')}</div>`,
      (el, close) => el.addEventListener('click', e => {
        const b = e.target.closest('[data-l]'); if (!b) return;
        S.lang = b.dataset.l; save(); applyLook(); close(); show(current.screen, current.params, false);
      }));
  }

  async function copyText(s) {
    try { await navigator.clipboard.writeText(s); return true; } catch (err) {
      const ta = document.createElement('textarea'); ta.value = s; document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (e2) { } ta.remove(); return ok;
    }
  }
  function shareModal() {
    modal(`<h2 class="modal-title">${ICON.share}<span>${te('share_title')}</span></h2>
      <div class="qr-box"><img src="qr.svg" alt="QR: ${esc(APP_URL)}" width="240" height="240"></div>
      <p class="center small muted">${te('share_d')}</p>
      <p class="center link-text">${esc(APP_URL.replace(/^https:\/\//, ''))}</p>
      <div class="stack">
        ${navigator.share ? `<button class="btn primary" data-s="share">${ICON.share}<span>${te('share_btn')}</span></button>` : ''}
        <button class="btn" data-s="copy">${ICON.link}<span>${te('copy_btn')}</span></button>
        <button class="btn ghost" data-s="close">${te('close')}</button>
      </div>`,
      (el, close) => el.addEventListener('click', async e => {
        const b = e.target.closest('[data-s]'); if (!b) return;
        if (b.dataset.s === 'close') close();
        else if (b.dataset.s === 'share') { try { await navigator.share({ title: 'PaKuGrounding', text: t('share_text'), url: APP_URL }); } catch (err) { } }
        else if (b.dataset.s === 'copy') {
          let ok = false;
          try { await navigator.clipboard.writeText(APP_URL); ok = true; } catch (err) {
            const ta = document.createElement('textarea'); ta.value = APP_URL; document.body.appendChild(ta); ta.select();
            try { ok = document.execCommand('copy'); } catch (e2) { } ta.remove();
          }
          if (ok) toast(t('copied'));
        }
      }));
  }

  /* ---------- router ---------- */
  const app = $('#app');
  let current = { screen: 'home', params: {} }, depth = 0;
  function show(screen, params = {}, push = true) {
    runCleanup(); stopAudio();
    if (push) { history.pushState({ screen, params }, ''); depth++; }
    current = { screen, params };
    (SCREENS[screen] || SCREENS.home)(params);
    window.scrollTo(0, 0);
    const h = $('.bar-title, .brand-name', app);
    if (h && push) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  }
  function goBack() { if (depth > 0) history.back(); else show('home', {}, false); }
  window.addEventListener('popstate', e => {
    const st = e.state || { screen: 'home', params: {} };
    depth = Math.max(0, depth - 1);
    const m = $('#modal'); if (!m.hidden) { m.hidden = true; m.innerHTML = ''; }
    show(st.screen, st.params || {}, false);
  });

  function frame(title, body, home) {
    return `<header class="bar">${home
      ? `<div class="brand"><span class="brand-mark">${ICON.anchor}</span><span class="brand-name">PaKuGrounding</span></div>`
      : `<button class="icon-btn" data-act="back" aria-label="${te('back')}">${ICON.back}</button><h1 class="bar-title">${esc(title)}</h1>`}
      <div class="bar-actions">${home ? `<button class="icon-btn" data-act="share" aria-label="${te('share_title')}">${ICON.share}</button>` : ''}<button class="icon-btn" data-act="lang"aria-label="${te('language')}">${ICON.globe}</button>${home ? `<button class="icon-btn" data-act="settings" aria-label="${te('settings')}">${ICON.settings}</button>` : ''}</div>
      </header><main class="main" id="main">${body}</main>`;
  }

  app.addEventListener('click', e => {
    const a = e.target.closest('[data-act],[data-go]');
    if (!a) return;
    if (a.dataset.go) { show(a.dataset.go); return; }
    switch (a.dataset.act) {
      case 'back': goBack(); break;
      case 'settings': show('settings'); break;
      case 'lang': langPicker(); break;
      case 'share': shareModal(); break;
      case 'sos': show('sos'); break;
      case 'tip': S.tipDismissed = true; save(); a.closest('.tip').remove(); break;
    }
  });

  /* dots: tapping any circle fills the next empty one */
  function bindDots(root, onChange) {
    let count = root.querySelectorAll('.dot.on').length;
    const dots = [...root.querySelectorAll('.dot')];
    root.addEventListener('click', e => {
      if (!e.target.closest('.dot') || count >= dots.length) return;
      const d = dots[count]; d.classList.add('on'); d.setAttribute('aria-pressed', 'true');
      count++;
      if (S.vibrate && navigator.vibrate) navigator.vibrate(25);
      onChange(count, dots.length);
    });
  }

  /* ---------- components ---------- */
  function fmtDate(d) { try { return new Intl.DateTimeFormat(LOCALES[S.lang], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d); } catch (e) { return d.toDateString(); } }
  function fmtTime(d) { try { return new Intl.DateTimeFormat(LOCALES[S.lang], { hour: '2-digit', minute: '2-digit' }).format(d); } catch (e) { return d.toTimeString().slice(0, 5); } }

  function compHere(el, o) {
    const name = S.name.trim(), place = S.place.trim(), st = S.statement.trim() || t('h_statement_default');
    el.innerHTML = `
      <div class="card center here">
        <div class="label">${te('h_today')}</div><div class="big" id="hDate"></div>
        <div class="label">${te('h_time')}</div><div class="huge" id="hTime"></div>
      </div>
      <div class="audio-bar" id="sosAudio" hidden></div>
      <div class="card">
        <p class="lead">${te('h_where')}</p>
        ${name ? `<p class="lead strong">${te('h_name', { name })}</p>` : ''}
        ${place ? `<p class="lead">${te('h_safeplace', { place })}</p>` : ''}
      </div>
      <div class="card statement"><p>${esc(st)}</p></div>
      <p class="hint center">${te('h_feet')}</p>`;
    const upd = () => { const d = new Date(); $('#hDate', el).textContent = fmtDate(d); $('#hTime', el).textContent = fmtTime(d); };
    upd(); every(upd, 5000);
    onCleanup(stopAudio);
    if (o.sos && S.sosRecId) {
      DB.get(S.sosRecId).then(r => {
        if (!r || !el.isConnected) return;
        const bar = $('#sosAudio', el);
        bar.hidden = false;
        const paint = playing => {
          bar.innerHTML = `<button class="icon-btn" id="sap" aria-label="${te(playing ? 'pause' : 'play')}">${playing ? ICON.pause : ICON.play}</button><span>${te('sos_playing', { name: r.name })}</span>`;
          $('#sap', bar).onclick = () => {
            if (player && playingId === r.id) { if (player.paused) { player.play().catch(() => { }); paint(true); } else { player.pause(); paint(false); } }
            else { playBlob(r.blob, r.id, () => paint(false), r.name); paint(true); }
          };
        };
        playBlob(r.blob, r.id, () => paint(false), r.name); paint(true);
      }).catch(() => { });
    }
  }

  /* ---------- breathing sound guide: pre-rendered audio, so it keeps playing with the screen locked ---------- */
  function breathSchedule(pattern, minutes) {
    const ph = PATTERNS[pattern], total = minutes * 60, phases = []; let t0 = 0;
    while (t0 < total) for (const [kind, dur] of ph) { phases.push({ kind, start: t0, dur }); t0 += dur; }
    return { phases, length: t0 };
  }
  function breathWav(sched) {
    const SR = 16000, n = Math.ceil((sched.length + 0.4) * SR), pcm = new Int16Array(n);
    const LO = 174.6, HI = 261.6; let high = false;
    for (const p of sched.phases) {
      const s0 = Math.floor(p.start * SR), len = Math.floor(p.dur * SR);
      const from = p.kind === 'in' ? LO : p.kind === 'out' ? HI : (high ? HI : LO);
      const to = p.kind === 'in' ? HI : p.kind === 'out' ? LO : from;
      const amp = p.kind === 'hold' ? 0.03 : 0.1, bell = p.kind === 'in' ? 784 : p.kind === 'out' ? 587 : 659;
      let ph = 0;
      for (let i = 0; i < len && s0 + i < n; i++) {
        const t = i / SR, k = i / len;
        const f = from + (to - from) * (0.5 - 0.5 * Math.cos(Math.PI * k));
        ph += 2 * Math.PI * f / SR;
        const env = Math.max(0, Math.min(1, t / 0.35, (p.dur - t) / 0.35));
        let v = amp * env * (Math.sin(ph) + 0.3 * Math.sin(2 * ph));
        if (t < 1.2) v += 0.08 * Math.exp(-t * 4) * Math.sin(2 * Math.PI * bell * t);
        pcm[s0 + i] = Math.max(-1, Math.min(1, v)) * 32767;
      }
      if (p.kind === 'in') high = true; else if (p.kind === 'out') high = false;
    }
    const buf = new ArrayBuffer(44 + n * 2), dv = new DataView(buf);
    const ws = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    ws(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); ws(8, 'WAVE'); ws(12, 'fmt '); dv.setUint32(16, 16, true);
    dv.setUint16(20, 1, true); dv.setUint16(22, 1, true); dv.setUint32(24, SR, true); dv.setUint32(28, SR * 2, true);
    dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); ws(36, 'data'); dv.setUint32(40, n * 2, true);
    new Int16Array(buf, 44).set(pcm);
    return new Blob([buf], { type: 'audio/wav' });
  }

  function compBreathe(el, o) {
    let pattern = S.breathPattern, minutes = o.sos ? 1 : S.breathMinutes, running = false;
    let sched = null, audio = null, audioUrl = null, t0 = 0, lastIdx = -1, loop = null;
    el.innerHTML = `
      ${o.sos ? '' : `
      <div class="field-label">${te('br_pattern')}</div>
      <div class="chips" id="pat">${Object.keys(PATTERNS).map(p => `<button class="chip" data-p="${p}" aria-pressed="${p === pattern}">${te(PATTERN_LABEL[p])}</button>`).join('')}</div>
      <div class="field-label">${te('br_length')}</div>
      <div class="chips" id="len">${LENGTHS.map(m => `<button class="chip" data-m="${m}" aria-pressed="${m === minutes}">${te('min', { n: m })}</button>`).join('')}</div>`}
      <div class="center"><button class="chip snd" id="snd" aria-pressed="${S.tone}"></button></div>
      <div class="breath-wrap"><div class="breath-halo"></div><div class="breath-circle" id="bc" data-phase="rest"></div>
        <div class="breath-text"><div class="breath-label" id="bl" aria-live="polite"></div><div class="breath-num" id="bn" aria-hidden="true"></div></div></div>
      <p class="center muted" id="bt"></p>
      <p class="center hint" id="bmsg">${te('br_ready')}</p>
      ${o.sos ? '' : `<div class="center"><button class="btn primary big-btn" id="bgo">${te('start')}</button></div>`}`;
    const bc = $('#bc', el), bl = $('#bl', el), bn = $('#bn', el), bt = $('#bt', el), bmsg = $('#bmsg', el), bgo = $('#bgo', el);
    const snd = $('#snd', el);
    const paintSnd = () => { snd.setAttribute('aria-pressed', S.tone); snd.innerHTML = `${ICON.sound}<span>${te(S.tone ? 'snd_on' : 'snd_off')}</span>`; };
    paintSnd();
    const stopTrack = () => {
      if (audio) { try { audio.pause(); } catch (e) { } audio.removeAttribute('src'); audio = null; }
      if (audioUrl) { URL.revokeObjectURL(audioUrl); audioUrl = null; }
      clearMediaSession();
    };
    const elapsed = () => (audio ? audio.currentTime : (performance.now() - t0) / 1000);
    const setCircle = (kind, secs) => { bc.style.transitionDuration = secs + 's'; if (kind !== 'hold') bc.dataset.phase = kind; bc.classList.toggle('holding', kind === 'hold'); };
    function reset(msgKey) {
      running = false; clearInterval(loop); loop = null; stopTrack(); lastIdx = -1;
      bl.textContent = ''; bn.textContent = ''; bt.textContent = '';
      bc.style.transitionDuration = '1.2s'; bc.dataset.phase = 'rest'; bc.classList.remove('holding');
      bmsg.textContent = t(msgKey);
      if (bgo) bgo.textContent = t('start');
    }
    onCleanup(() => { running = false; clearInterval(loop); stopTrack(); });
    // The state is always computed from elapsed time (or the audio position), so it stays correct after the screen was off.
    function tick() {
      if (!running) return;
      const e = elapsed();
      if (e >= sched.length) { reset('br_done'); if (o.onDone) o.onDone(); return; }
      if (audio && audio.paused && e > 0) { bl.textContent = t('pause'); bn.textContent = ''; lastIdx = -1; return; }
      let idx = sched.phases.findIndex(p => e < p.start + p.dur); if (idx < 0) idx = sched.phases.length - 1;
      const p = sched.phases[idx], left = p.start + p.dur - e;
      if (idx !== lastIdx) {
        lastIdx = idx; bl.textContent = t('br_' + p.kind); setCircle(p.kind, Math.max(0.2, left));
        if (S.vibrate && navigator.vibrate && !document.hidden) navigator.vibrate(p.kind === 'hold' ? 20 : 45);
      }
      bn.textContent = Math.max(1, Math.ceil(left - 0.05)); bt.textContent = mmss(sched.length - e);
    }
    function start() {
      sched = breathSchedule(pattern, minutes); running = true; lastIdx = -1; keepAwake();
      bmsg.textContent = ''; if (bgo) bgo.textContent = t('stop');
      stopAudio();
      if (S.tone) {
        try {
          audioUrl = URL.createObjectURL(breathWav(sched));
          audio = new Audio(audioUrl);
          audio.onended = tick;
          setMediaSession(`${t('t_breathe')} · ${t(PATTERN_LABEL[pattern])}`, {
            play: () => audio && audio.play().catch(() => { }),
            pause: () => audio && audio.pause(),
            stop: () => reset('br_ready')
          });
          audio.play().catch(() => { stopTrack(); t0 = performance.now(); });
        } catch (e) { stopTrack(); }
      }
      t0 = performance.now();
      tick(); loop = setInterval(tick, 200);
    }
    snd.onclick = () => { S.tone = !S.tone; save(); paintSnd(); if (running) reset('br_ready'); };
    if (bgo) bgo.onclick = () => (running ? reset('br_ready') : start());
    const pat = $('#pat', el), len = $('#len', el);
    if (pat) pat.onclick = e => {
      const b = e.target.closest('[data-p]'); if (!b) return;
      pattern = b.dataset.p; S.breathPattern = pattern; save();
      pat.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', c === b));
      if (running) reset('br_ready');
    };
    if (len) len.onclick = e => {
      const b = e.target.closest('[data-m]'); if (!b) return;
      minutes = +b.dataset.m; S.breathMinutes = minutes; save();
      len.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', c === b));
      if (running) reset('br_ready');
    };
    if (o.sos) start();   // started inside the tap, so the sound may play (iOS)
  }

  function compSenses(el, o) {
    const keys = ['s5', 's4', 's3', 's2', 's1'];
    let step = 0;
    const render = () => {
      if (step >= SENSES.length) {
        el.innerHTML = `<div class="card center done-card"><span class="done-icon">${ICON.check}</span><p class="lead">${te('senses_done')}</p>
          ${o.sos ? '' : `<button class="btn" id="again">${te('sos_again')}</button>`}</div>`;
        const a = $('#again', el); if (a) a.onclick = () => { step = 0; render(); };
        return;
      }
      const n = SENSES[step];
      el.innerHTML = `
        <ol class="steps" aria-hidden="true">${SENSES.map((x, j) => `<li class="${j < step ? 'past' : j === step ? 'now' : ''}">${x}</li>`).join('')}</ol>
        <div class="card center">
          <h2 class="step-title">${te(keys[step])}</h2>
          <p class="muted">${te(keys[step] + 'h')}</p>
          <div class="dots" id="dots">${shuffleDots(n, 0, t(keys[step]))}</div>
          <p class="hint">${te('tap_count')}</p>
        </div>
        ${o.sos ? '' : `<div class="center"><button class="btn ghost" id="sk">${te('skip')}</button></div>`}`;
      bindDots($('#dots', el), (c, total) => { if (c === total) later(() => { step++; render(); }, 700); });
      const sk = $('#sk', el); if (sk) sk.onclick = () => { step++; render(); };
    };
    render();
  }

  function compHunt(el) {
    let last = -1;
    const render = () => {
      let i; do { i = Math.floor(Math.random() * HUNT.length); } while (i === last);
      last = i; const h = HUNT[i];
      el.innerHTML = `
        <div class="card center">
          ${h.c ? `<div class="swatch" style="background:${h.c}" aria-hidden="true"></div>` : `<div class="swatch none" aria-hidden="true">${ICON.eye}</div>`}
          <h2 class="step-title">${te(h.k)}</h2>
          <div class="dots" id="dots">${shuffleDots(3, 0, t(h.k))}</div>
          <p class="hint" id="hh" aria-live="polite">${te('hunt_hint')}</p>
        </div>
        <div class="center"><button class="btn primary" id="another">${te('hunt_another')}</button></div>`;
      bindDots($('#dots', el), (c, total) => { if (c === total) $('#hh', el).textContent = t('hunt_done'); });
      $('#another', el).onclick = render;
    };
    render();
  }

  function phrasePool() {
    const d = [1, 2, 3, 4, 5, 6, 7, 8].map(i => t('ph' + i));
    const mine = S.phrases.filter(Boolean);
    return mine.length ? [...mine, ...mine, ...d] : d;
  }
  function compPhraseCard(el) {
    let last = '';
    el.innerHTML = `<div class="card phrase"><p id="pt" aria-live="polite"></p></div><div class="center"><button class="btn" id="pn">${te('ph_next')}</button></div>`;
    const pick = () => { const p = phrasePool(); let s, n = 0; do { s = p[Math.floor(Math.random() * p.length)]; } while (s === last && n++ < 12); last = s; $('#pt', el).textContent = s; };
    pick(); $('#pn', el).onclick = pick;
  }

  /* ---------- screens ---------- */
  const SCREENS = {
    home() {
      const tiles = [
        ['breathe', 't_breathe', ICON.wind], ['senses', 't_senses', ICON.senses], ['here', 't_here', ICON.clock],
        ['hunt', 't_hunt', ICON.eye], ['phrases', 't_phrases', ICON.quote], ['voices', 't_rec', ICON.mic]
      ];
      app.innerHTML = frame('', `
        <section class="hero">
          <p class="tagline">${te('tagline')}</p>
          <button class="sos" data-act="sos"><span class="sos-in">${ICON.anchor}<span class="sos-label">${te('sos_btn')}</span></span></button>
          <p class="muted center">${te('sos_sub')}</p>
        </section>
        ${S.tipDismissed ? '' : `<div class="tip card"><p>${te('tip_first')}</p><button class="btn ghost small" data-act="tip">${te('got_it')}</button></div>`}
        <h2 class="section-title">${te('tools')}</h2>
        <div class="tiles">${tiles.map(([go, k, ic]) => `<button class="tile" data-go="${go}"><span class="tile-ic">${ic}</span><span class="tile-t">${te(k)}</span><span class="tile-d">${te(k + '_d')}</span></button>`).join('')}</div>
        <button class="tile wide help-tile" data-go="help"><span class="tile-ic">${ICON.heart}</span><span><span class="tile-t">${te('t_help')}</span><span class="tile-d">${te('t_help_d')}</span></span></button>
        <button class="tile wide" data-go="why"><span class="tile-ic">${ICON.info}</span><span><span class="tile-t">${te('why_link')}</span><span class="tile-d">${te('why_link_d')}</span></span></button>
        ${F ? `<button class="tile wide" data-go="family"><span class="tile-ic">${ICON.leaf}</span><span><span class="tile-t">${esc(ft('fam_title'))}</span><span class="tile-d">${esc(ft('fam_d'))}</span></span></button>` : ''}
      `, true);
    },

    sos() {
      const steps = SOS_ORDER.filter(s => S.sosSteps[s]);
      if (!steps.length) steps.push('breathe');
      let i = 0;
      app.innerHTML = frame(t('sos_btn'), `<p class="sos-progress" id="sp"></p><div id="step"></div><div class="sos-foot" id="foot"><button class="btn primary wide big-btn" id="sosNext"></button></div>`);
      const stepEl = $('#step'), sp = $('#sp'), foot = $('#foot'), nextBtn = $('#sosNext');
      const COMP = { here: compHere, breathe: compBreathe, senses: compSenses, phrase: compPhraseCard };
      const render = () => {
        runCleanup(); stopAudio(); keepAwake(); window.scrollTo(0, 0);
        if (i >= steps.length) {
          sp.textContent = ''; foot.hidden = true;
          stepEl.innerHTML = `<div class="card center"><h2 class="step-title">${te('sos_finish')}</h2>
            <div class="stack"><button class="btn primary wide" id="fb">${te('sos_better')}</button>
            <button class="btn wide" id="fa">${te('sos_again')}</button>
            <button class="btn ghost wide" id="fs">${ICON.heart}<span>${te('sos_still')}</span></button></div></div>`;
          $('#fb').onclick = goBack;
          $('#fa').onclick = () => { i = 0; render(); };
          $('#fs').onclick = () => show('help');
          return;
        }
        foot.hidden = false;
        sp.textContent = `${t('sos_step', { a: i + 1, b: steps.length })} · ${t(SOS_LABEL[steps[i]])}`;
        COMP[steps[i]](stepEl, { sos: true });
        nextBtn.textContent = t(i === steps.length - 1 ? 'done' : 'next');
      };
      nextBtn.onclick = () => { i++; render(); };
      render();
    },

    breathe() { app.innerHTML = frame(t('t_breathe'), '<div id="c"></div>'); compBreathe($('#c'), {}); },
    senses() { app.innerHTML = frame(t('t_senses'), '<div id="c"></div>'); compSenses($('#c'), {}); },
    here() { app.innerHTML = frame(t('t_here'), '<div id="c"></div>'); compHere($('#c'), {}); },
    hunt() { app.innerHTML = frame(t('t_hunt'), '<div id="c"></div>'); compHunt($('#c')); },

    phrases() {
      app.innerHTML = frame(t('t_phrases'), `<div id="pc"></div>
        <h2 class="section-title">${te('ph_mine')}</h2>
        <form class="add-row" id="pf"><textarea id="pi" rows="2" maxlength="300" placeholder="${te('ph_placeholder')}" aria-label="${te('ph_add')}"></textarea>
        <button class="btn primary" type="submit">${te('ph_add')}</button></form>
        <ul class="list" id="pl"></ul>`);
      compPhraseCard($('#pc'));
      const pl = $('#pl');
      const list = () => {
        pl.innerHTML = S.phrases.length
          ? S.phrases.map((p, i) => `<li class="list-item"><span class="grow">${esc(p)}</span><button class="icon-btn" data-del="${i}" aria-label="${te('delete')}">${ICON.trash}</button></li>`).join('')
          : `<li class="muted empty">${te('ph_empty')}</li>`;
      };
      list();
      $('#pf').onsubmit = e => {
        e.preventDefault(); const v = $('#pi').value.trim(); if (!v) return;
        S.phrases.push(v.slice(0, 300)); save(); $('#pi').value = ''; list();
      };
      pl.onclick = e => { const b = e.target.closest('[data-del]'); if (!b) return; S.phrases.splice(+b.dataset.del, 1); save(); list(); };
    },

    voices() {
      app.innerHTML = frame(t('t_rec'), `
        <p class="lead">${te('rec_intro')}</p>
        <div class="card center rec-card">
          <button class="rec-btn" id="rb" aria-pressed="false">${ICON.mic}<span id="rbl">${te('rec_start')}</span></button>
          <p class="muted" id="rt" aria-live="polite"></p>
          <label class="btn ghost file-btn">${ICON.upload}<span>${te('rec_import')}</span><input type="file" accept="audio/*" id="rf" hidden></label>
        </div>
        <ul class="list" id="rl"></ul>`);
      const rl = $('#rl'), rb = $('#rb'), rbl = $('#rbl'), rt = $('#rt');
      let recs = [], recorder = null, stream = null, chunks = [], recTimer = null, recStart = 0;

      const list = async () => {
        try { recs = await DB.all(); } catch (e) { recs = []; }
        if (!rl.isConnected) return;
        rl.innerHTML = recs.length ? recs.map(r => `
          <li class="list-item rec-item" data-id="${esc(r.id)}">
            <button class="icon-btn play" data-a="play" aria-label="${te(playingId === r.id ? 'pause' : 'play')}">${playingId === r.id ? ICON.pause : ICON.play}</button>
            <input class="grow name-in" data-a="name" value="${esc(r.name)}" maxlength="80" aria-label="${te('rec_name_ph')}" placeholder="${te('rec_name_ph')}">
            <button class="icon-btn pin${S.sosRecId === r.id ? ' on' : ''}" data-a="sos" aria-pressed="${S.sosRecId === r.id}" title="${te(S.sosRecId === r.id ? 'rec_sos_on' : 'rec_sos')}" aria-label="${te(S.sosRecId === r.id ? 'rec_sos_on' : 'rec_sos')}">${ICON.star}</button>
            <button class="icon-btn" data-a="del" aria-label="${te('delete')}">${ICON.trash}</button>
            ${S.sosRecId === r.id ? `<small class="pin-note">${te('rec_sos_on')}</small>` : ''}
          </li>`).join('') : `<li class="muted empty">${te('rec_empty')}</li>`;
      };
      const addBlob = async (blob, name) => {
        const r = { id: uid(), name: (name || t('rec_default_name', { n: recs.length + 1 })).slice(0, 80), type: blob.type, created: Date.now(), blob };
        try { await DB.put(r); } catch (e) { }
        await list();
      };
      rl.addEventListener('click', async e => {
        const b = e.target.closest('[data-a]'); if (!b || b.dataset.a === 'name') return;
        const id = b.closest('[data-id]').dataset.id, r = recs.find(x => x.id === id); if (!r) return;
        if (b.dataset.a === 'play') {
          if (playingId === id) stopAudio(); else playBlob(r.blob, id, list, r.name);
          list();
        } else if (b.dataset.a === 'sos') {
          S.sosRecId = S.sosRecId === id ? null : id; save(); list();
        } else if (b.dataset.a === 'del') {
          if (await confirmBox(t('rec_delete_confirm'), t('delete'))) {
            if (playingId === id) stopAudio();
            if (S.sosRecId === id) { S.sosRecId = null; save(); }
            try { await DB.del(id); } catch (e) { }
            list();
          }
        }
      });
      rl.addEventListener('change', async e => {
        if (!e.target.matches('.name-in')) return;
        const id = e.target.closest('[data-id]').dataset.id, r = recs.find(x => x.id === id); if (!r) return;
        r.name = e.target.value.trim().slice(0, 80) || r.name; try { await DB.put(r); } catch (err) { }
      });

      const stopRec = () => { if (recorder && recorder.state !== 'inactive') recorder.stop(); };
      const paintRec = on => { rb.classList.toggle('on', on); rb.setAttribute('aria-pressed', on); rbl.textContent = t(on ? 'rec_stop' : 'rec_start'); if (!on) rt.textContent = ''; };
      rb.onclick = async () => {
        if (recorder && recorder.state === 'recording') { stopRec(); return; }
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) { toast(t('rec_no_mic')); return; }
        try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) { toast(t('rec_no_mic')); return; }
        stopAudio();
        const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find(m => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) || '';
        try { recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined); } catch (e) { stream.getTracks().forEach(x => x.stop()); toast(t('rec_no_mic')); return; }
        chunks = [];
        recorder.ondataavailable = ev => { if (ev.data && ev.data.size) chunks.push(ev.data); };
        recorder.onstop = () => {
          clearInterval(recTimer); stream.getTracks().forEach(x => x.stop());
          const blob = new Blob(chunks, { type: recorder.mimeType || mime || 'audio/webm' });
          recorder = null; if (rb.isConnected) paintRec(false);
          if (blob.size) addBlob(blob);
        };
        recorder.start(1000); recStart = Date.now(); paintRec(true);
        rt.textContent = t('rec_recording', { t: '0:00' });
        recTimer = setInterval(() => {
          const s = (Date.now() - recStart) / 1000;
          rt.textContent = t('rec_recording', { t: mmss(s) });
          if (s >= MAX_REC_SECONDS) stopRec();
        }, 500);
      };
      onCleanup(() => { stopRec(); clearInterval(recTimer); });
      $('#rf').onchange = e => {
        const f = e.target.files && e.target.files[0]; if (!f) return;
        if (!/^audio\//.test(f.type) && !/\.(mp3|m4a|aac|wav|ogg|oga|opus|webm|flac)$/i.test(f.name)) { toast(t('set_import_bad')); return; }
        addBlob(f, f.name.replace(/\.[^.]+$/, '')); e.target.value = '';
      };
      list();
    },

    help() {
      const em = S.emergency.trim() || '112';
      app.innerHTML = frame(t('t_help'), `
        <p class="lead">${te('help_intro')}</p>
        <a class="emergency" href="tel:${esc(telClean(em))}">${ICON.phone}<span><strong>${te('help_emergency')}: ${esc(em)}</strong><small>${te('help_emergency_note')}</small></span></a>
        <p class="hint">${te('help_change')}</p>
        <h2 class="section-title">${te('help_people')}</h2>
        <ul class="list" id="pp"></ul>
        <form class="card add-person" id="pf">
          <input id="pn" required maxlength="60" autocomplete="off" placeholder="${te('help_name_ph')}" aria-label="${te('help_name_ph')}">
          <input id="ph" type="tel" required maxlength="30" autocomplete="off" placeholder="${te('help_phone_ph')}" aria-label="${te('help_phone_ph')}">
          <button class="btn primary" type="submit">${te('help_add')}</button>
        </form>
        <p class="note">${te('help_not_therapy')}</p>`);
      const pp = $('#pp');
      const list = () => {
        const body = encodeURIComponent(t('sms_body'));
        pp.innerHTML = S.people.length ? S.people.map((p, i) => `
          <li class="list-item person">
            <span class="grow"><strong>${esc(p.name)}</strong><small class="muted">${esc(p.phone)}</small></span>
            <a class="btn small" href="tel:${esc(telClean(p.phone))}">${ICON.phone}<span>${te('help_call')}</span></a>
            <a class="btn small" href="sms:${esc(telClean(p.phone))}?&body=${body}">${ICON.msg}<span>${te('help_text')}</span></a>
            <button class="icon-btn" data-del="${i}" aria-label="${te('delete')}">${ICON.trash}</button>
          </li>`).join('') : `<li class="muted empty">${te('help_empty')}</li>`;
      };
      list();
      $('#pf').onsubmit = e => {
        e.preventDefault();
        const name = $('#pn').value.trim(), phone = $('#ph').value.trim();
        if (!name || !telClean(phone)) return;
        S.people.push({ name: name.slice(0, 60), phone: phone.slice(0, 30) }); save();
        $('#pn').value = ''; $('#ph').value = ''; list();
      };
      pp.onclick = async e => {
        const b = e.target.closest('[data-del]'); if (!b) return;
        const p = S.people[+b.dataset.del]; if (!p) return;
        if (await confirmBox(`${t('delete')}: ${p.name}?`, t('delete'))) { S.people.splice(+b.dataset.del, 1); save(); list(); }
      };
    },

    settings() {
      const chips = (key, opts) => `<div class="chips" data-chips="${key}">${opts.map(([v, lbl]) => `<button class="chip" data-v="${esc(v)}" aria-pressed="${String(S[key]) === String(v)}">${esc(lbl)}</button>`).join('')}</div>`;
      const toggle = (key, label, desc, sub) => {
        const on = sub ? S[key][sub] : S[key];
        return `<label class="toggle"><span class="grow"><span>${esc(label)}</span>${desc ? `<small class="muted">${esc(desc)}</small>` : ''}</span>
          <input type="checkbox" data-tg="${key}" ${sub ? `data-sub="${sub}"` : ''} ${on ? 'checked' : ''}><span class="sw" aria-hidden="true"></span></label>`;
      };
      const standalone = mq('(display-mode: standalone)') || navigator.standalone === true;
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      app.innerHTML = frame(t('settings'), `
        <section class="card set">
          <h2 class="set-title">${te('language')}</h2>
          <div class="chips" data-chips="lang">${LANGS.map(([c, n]) => `<button class="chip" data-v="${c}" lang="${c === 'zh' ? 'zh-CN' : c}" aria-pressed="${S.lang === c}">${esc(n)}</button>`).join('')}</div>
        </section>
        <section class="card set">
          <h2 class="set-title">${te('set_look')}</h2>
          ${chips('theme', [['calm', t('theme_calm')], ['night', t('theme_night')], ['contrast', t('theme_contrast')]])}
          <div class="field-label">${te('set_color')}</div>
          <div class="swatches" id="swatches">
            ${ACCENTS.map(([n, c]) => `<button class="sw-btn" data-c="${c}" style="background:${c}" aria-pressed="${S.accent === c}" aria-label="${te('col_' + n)}" title="${te('col_' + n)}"></button>`).join('')}
            <label class="sw-btn sw-custom" title="${te('col_custom')}" aria-pressed="${!ACCENTS.some(([, c]) => c === S.accent)}"><input type="color" id="swc" value="${S.accent}" aria-label="${te('col_custom')}"></label>
          </div>
          <p class="hint">${te('set_color_d')}</p>
          <div class="field-label">${te('set_text')}</div>
          ${chips('textSize', [['normal', t('size_normal')], ['large', t('size_large')], ['xl', t('size_xl')]])}
          ${toggle('reduceMotion', t('set_motion'), t('set_motion_d'))}
        </section>
        <section class="card set">
          <h2 class="set-title">${te('t_breathe')}</h2>
          <div class="field-label">${te('set_breath_default')}</div>
          ${chips('breathPattern', Object.keys(PATTERNS).map(p => [p, t(PATTERN_LABEL[p])]))}
          ${toggle('vibrate', t('set_vibe'))}
          ${toggle('tone', t('set_tone'), t('set_tone_d'))}
        </section>
        <section class="card set">
          <h2 class="set-title">${te('set_sos')}</h2>
          ${SOS_ORDER.map(s => toggle('sosSteps', t(SOS_LABEL[s]), '', s)).join('')}
        </section>
        <section class="card set">
          <h2 class="set-title">${te('set_personal')}</h2>
          <p class="muted">${te('set_personal_d')}</p>
          <label class="field"><span>${te('set_my_name')}</span><input data-txt="name" maxlength="60" value="${esc(S.name)}" autocomplete="off"></label>
          <label class="field"><span>${te('set_my_place')}</span><input data-txt="place" maxlength="120" value="${esc(S.place)}" autocomplete="off"></label>
          <label class="field"><span>${te('set_statement')}</span><textarea data-txt="statement" rows="3" maxlength="300" placeholder="${te('h_statement_default')}">${esc(S.statement)}</textarea></label>
        </section>
        <section class="card set">
          <h2 class="set-title">${te('set_emergency')}</h2>
          <label class="field"><input data-txt="emergency" type="tel" maxlength="20" value="${esc(S.emergency)}" aria-label="${te('set_emergency')}"></label>
          <p class="hint">${te('set_emergency_hint')}</p>
        </section>
        ${standalone ? '' : `<section class="card set" id="installSec" ${deferredPrompt || ios ? '' : 'hidden'}>
          <h2 class="set-title">${te('install')}</h2>
          ${ios && !deferredPrompt ? `<p>${te('install_ios')}</p>` : `<button class="btn primary" id="installBtn">${ICON.download}<span>${te('install')}</span></button>`}
        </section>`}
        <section class="card set">
          <h2 class="set-title">${te('share_title')}</h2>
          <p class="muted">${te('share_d')}</p>
          <div class="stack"><button class="btn primary" data-act="share">${ICON.share}<span>${te('share_title')}</span></button></div>
        </section>
        <section class="card set">
          <h2 class="set-title">${te('qa_title')}</h2>
          <h3 class="qa-h">Android</h3><p>${te('qa_android')}</p>
          <h3 class="qa-h">iPhone</h3><p>${te('qa_ios')}</p>
          <p class="link-text">${esc(APP_URL + '?sos=1')}</p>
          <div class="stack"><button class="btn" id="qaCopy">${ICON.link}<span>${te('qa_copy')}</span></button></div>
        </section>
        <section class="card set">
          <h2 class="set-title">${te('set_data')}</h2>
          <p class="muted">${te('set_data_d')}</p>
          <div class="stack">
            <button class="btn" id="exp">${ICON.download}<span>${te('set_export')}</span></button>
            <label class="btn file-btn">${ICON.upload}<span>${te('set_import')}</span><input type="file" accept="application/json,.json" id="imp" hidden></label>
            <button class="btn danger-ghost" id="wipe">${ICON.trash}<span>${te('set_wipe')}</span></button>
          </div>
        </section>
        <section class="card set">
          <h2 class="set-title">${te('set_about')}</h2>
          <p>${te('about_text')}</p>
          <div class="stack">
            <a class="btn coffee" href="${BMC_URL}" target="_blank" rel="noopener noreferrer">${ICON.coffee}<span>${te('bmc')}</span></a>
            <button class="btn ghost" data-go="why">${ICON.info}<span>${te('why_link')}</span></button>
            ${F ? `<button class="btn ghost" data-go="family">${ICON.leaf}<span>${esc(ft('fam_title'))}</span></button>` : ''}
            <button class="btn ghost" data-go="terms">${te('terms_title')}</button>
          </div>
          <p class="muted center small">PaKuGrounding · ${te('version', { v: APP_VERSION })}</p>
        </section>`);

      const main = $('#main');
      main.addEventListener('click', e => {
        const c = e.target.closest('.chip'); if (!c) return;
        const key = c.parentElement.dataset.chips; let v = c.dataset.v;
        S[key] = v; save(); applyLook();
        if (key === 'lang') { show('settings', {}, false); return; }
        c.parentElement.querySelectorAll('.chip').forEach(x => x.setAttribute('aria-pressed', x === c));
      });
      main.addEventListener('change', e => {
        const tg = e.target.closest('[data-tg]');
        if (tg) {
          if (tg.dataset.sub) S[tg.dataset.tg][tg.dataset.sub] = tg.checked; else S[tg.dataset.tg] = tg.checked;
          save(); applyLook(); if (tg.dataset.tg === 'tone' && tg.checked) { ensureAudioCtx(); beep(392); }
        }
      });
      main.addEventListener('input', e => {
        const f = e.target.closest('[data-txt]'); if (!f) return;
        S[f.dataset.txt] = f.value.slice(0, 300); save();
      });
      const ib = $('#installBtn');
      if (ib) ib.onclick = async () => { if (!deferredPrompt) return; deferredPrompt.prompt(); try { await deferredPrompt.userChoice; } catch (e) { } deferredPrompt = null; const s = $('#installSec'); if (s) s.hidden = true; };
      const swr = $('#swatches');
      const setAccent = c => {
        S.accent = c.toLowerCase(); save(); applyLook();
        swr.querySelectorAll('.sw-btn').forEach(b => b.setAttribute('aria-pressed', b.dataset.c ? b.dataset.c === S.accent : !ACCENTS.some(([, x]) => x === S.accent)));
      };
      swr.addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (b) setAccent(b.dataset.c); });
      $('#swc').addEventListener('input', e => setAccent(e.target.value));
      $('#qaCopy').onclick = async () => { if (await copyText(APP_URL + '?sos=1')) toast(t('copied')); };
      $('#exp').onclick = exportData;
      $('#imp').onchange = e => { const f = e.target.files && e.target.files[0]; if (f) importData(f); e.target.value = ''; };
      $('#wipe').onclick = async () => {
        if (!(await confirmBox(t('set_wipe_confirm'), t('delete')))) return;
        stopAudio();
        try { localStorage.removeItem(KEY); } catch (e) { }
        try { await DB.clear(); } catch (e) { }
        location.replace(location.pathname);
      };
    },

    why() {
      const parts = [['why_h_for', 'why_for'], ['why_h_works', 'why_works'], ['why_h_helps', 'why_helps'], ['why_h_tips', 'why_tips'], ['why_h_limits', 'why_limits']];
      app.innerHTML = frame(t('why_link'), parts.map(([h, p]) => `<section class="card why"><h2>${te(h)}</h2><p>${te(p)}</p></section>`).join('') +
        `<div class="center"><button class="btn primary big-btn" data-act="sos">${ICON.anchor}<span>${te('sos_btn')}</span></button></div>`);
    },

    family() {
      if (!F) { show('home', {}, false); return; }
      const paint = () => {
        app.innerHTML = frame(ft('fam_title'), `<p class="muted">${esc(ft('fam_d'))}</p>
          <ul class="list fam">${F.all().map(a => {
            const me = a.id === SELF, used = me || F.used(a.id);
            return `<li class="card fam-app${me ? ' me' : ''}">
              <div class="fam-head"><img class="fam-ic" src="${esc(F.icon(a))}" alt="" width="48" height="48" onerror="this.style.visibility='hidden'">
                <span class="grow"><strong>${esc(a.name)}</strong><small class="muted">${esc(F.desc(a, S.lang))}</small>
                ${me ? `<small class="fam-tag">${esc(ft('fam_this'))}</small>` : used ? `<small class="fam-tag">${ICON.check}${esc(ft('fam_used'))}</small>` : ''}</span>
                ${me ? '' : `<a class="btn small${used ? ' primary' : ''}" href="${esc(F.url(a))}" target="_blank" rel="noopener">${esc(ft(used ? 'fam_open' : 'fam_get'))}</a>`}</div>
            </li>`;
          }).join('')}</ul>
          <a class="btn wide" href="${esc(F.hub)}" target="_blank" rel="noopener">${ICON.leaf}<span>${esc(ft('fam_hub'))}</span></a>`);
      };
      paint();
      F.detect().then(() => { if (current.screen === 'family') paint(); });
    },

    terms() {
      app.innerHTML = frame(t('terms_title'), `<article class="card prose">
        ${[1, 2, 3, 4, 5].map(i => `<p>${te('terms_' + i)}</p>`).join('')}
        ${CONTACT_EMAIL ? `<p>${te('terms_contact', { email: CONTACT_EMAIL })}</p>` : ''}
      </article>`);
    }
  };

  /* ---------- backup ---------- */
  const blobToDataURL = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(b); });
  function dataURLToBlob(u) {
    const [head, data] = u.split(','); const type = (head.match(/^data:([^;,]*)/) || [])[1] || '';
    const bin = atob(data || ''); const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type });
  }
  async function exportData() {
    let recs = []; try { recs = await DB.all(); } catch (e) { }
    const out = { app: 'PaKuGrounding', format: 1, version: APP_VERSION, exported: new Date().toISOString(), settings: S, recordings: [] };
    for (const r of recs) { try { out.recordings.push({ id: r.id, name: r.name, type: r.type, created: r.created, data: await blobToDataURL(r.blob) }); } catch (e) { } }
    const blob = new Blob([JSON.stringify(out)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `pakugrounding-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }
  async function importData(file) {
    try {
      const data = JSON.parse(await file.text());
      if (!data || data.app !== 'PaKuGrounding' || typeof data.settings !== 'object') throw new Error('bad');
      const recs = Array.isArray(data.recordings) ? data.recordings.filter(r => r && typeof r.data === 'string' && r.data.startsWith('data:')) : [];
      const next = normalize(data.settings);
      next.tipDismissed = true;
      try {
        await DB.clear();
        for (const r of recs) await DB.put({ id: String(r.id || uid()).slice(0, 40), name: String(r.name || '').slice(0, 80) || 'Audio', type: String(r.type || ''), created: Number(r.created) || Date.now(), blob: dataURLToBlob(r.data) });
      } catch (e) { }
      S = next; save(); applyLook();
      show('settings', {}, false); toast(t('set_import_ok'));
    } catch (e) { toast(t('set_import_bad')); }
  }

  /* ---------- install & offline ---------- */
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault(); deferredPrompt = e;
    const s = $('#installSec'); if (s && current.screen === 'settings') show('settings', {}, false);
  });
  function setupSW() {
    if (!('serviceWorker' in navigator)) return;
    if (!(location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname))) return;
    let wantReload = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (wantReload) { wantReload = false; location.reload(); } });
    navigator.serviceWorker.register('./sw.js').then(reg => {
      /* on the home screen a new version is applied at once; during an exercise the user decides */
      const offer = w => { if (current.screen === 'home') { wantReload = true; w.postMessage('SKIP_WAITING'); return; } toast(t('update_ready'), t('reload'), () => { wantReload = true; w.postMessage('SKIP_WAITING'); }); };
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => { }); });
      if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing; if (!w) return;
        w.addEventListener('statechange', () => {
          if (w.state !== 'installed') return;
          if (navigator.serviceWorker.controller) offer(w);
          else if (!S.offlineToastShown) { S.offlineToastShown = true; save(); toast(t('offline_ready')); }
        });
      });
    }).catch(() => { });
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => { }); } catch (e) { }
  }

  /* ---------- start ---------- */
  const startSOS = new URLSearchParams(location.search).get('sos') === '1';
  applyLook();
  history.replaceState({ screen: 'home', params: {} }, '', location.pathname);
  show('home', {}, false);
  if (startSOS) show('sos');
  setupSW();
  if (F) F.detect().then(() => F.refresh());
})();
