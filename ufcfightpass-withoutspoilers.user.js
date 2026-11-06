// ==UserScript==
// @name         UFC Fight Pass Without Spoilers
// @namespace    joel.fightpass.nospoilers
// @version      1.4.8
// @description  Hides the duration and time remaining on UFC Fight Pass. Adds ±10 s / 30 s / 1 min / 5 min jumps and a fixed-scale seek bar with thumbnails. Works on computers and on iPhone/iPad (Safari + Userscripts).
// @match        https://www.ufcfightpass.com/*
// @match        https://ufcfightpass.com/*
// @homepageURL  https://github.com/JoelCohen7/ufcfightpass-withoutspoilers
// @updateURL    https://raw.githubusercontent.com/JoelCohen7/ufcfightpass-withoutspoilers/ios/ufcfightpass-withoutspoilers.user.js
// @downloadURL  https://raw.githubusercontent.com/JoelCohen7/ufcfightpass-withoutspoilers/ios/ufcfightpass-withoutspoilers.user.js
// @run-at       document-start
// @grant        none
// @noframes
// ==/UserScript==

(() => {
  'use strict';
  if (window.__fpns) return;
  window.__fpns = true;

  // ---------- Settings ----------
  const WINDOWS_MIN = [15, 30, 60, 90];          // possible bar scales (minutes); click the scale label to cycle
  const DEFAULT_WINDOW_MIN = 90;
  const JUMPS = [-300, -60, -30, -10, 10, 30, 60, 300];
  const LS_WIN = 'fpns:windowMin';
  const LS_SHOWTIME = 'fpns:showElapsed';

  const lsGet = (k, def) => { try { const v = localStorage.getItem(k); return v === null ? def : JSON.parse(v); } catch { return def; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

  let windowSec = (WINDOWS_MIN.includes(lsGet(LS_WIN, DEFAULT_WINDOW_MIN)) ? lsGet(LS_WIN, DEFAULT_WINDOW_MIN) : DEFAULT_WINDOW_MIN) * 60;
  let showElapsed = lsGet(LS_SHOWTIME, true);

  // ---------- 1) Hide everything that shows a duration ----------
  const css = `
    .dice-player-control .ds-seek-bar,
    .dice-player-control .time,
    .dice-player-control .time-edges,
    .card-meta__duration,
    .card-progress,
    .fpns-hidden-time { display: none !important; }
    .btn-picture-in-picture { display: none !important; }
    /* Keep the player controls visible while a remote is driving them (no mouse to wake them up) */
    html.fpns-show .dice-player-control { opacity: 1 !important; pointer-events: auto !important; }

    #fpns-panel { position: absolute; left: 0; right: 0; bottom: 100%; padding: 0 16px 2px; box-sizing: border-box; z-index: 5;
      font: 13px/1.2 Roboto, Arial, sans-serif; color: #fff; user-select: none; }
    #fpns-panel * { box-sizing: border-box; }
    .fpns-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .fpns-btn { background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.25); color: #fff;
      border-radius: 4px; padding: 4px 9px; cursor: pointer; font: inherit; min-width: 46px; }
    .fpns-btn:hover { background: rgba(210,10,10,.85); border-color: rgba(210,10,10,1); }
    .fpns-spacer { flex: 1; }
    .fpns-elapsed { font-variant-numeric: tabular-nums; min-width: 64px; text-align: right; cursor: pointer; opacity: .9; }
    .fpns-barwrap { display: flex; align-items: center; gap: 8px; margin: 6px 0 4px; }
    .fpns-edge { font-variant-numeric: tabular-nums; opacity: .75; min-width: 52px; text-align: center; }
    .fpns-scale { cursor: pointer; text-decoration: underline dotted; }
    .fpns-page { background: none; border: none; color: #fff; cursor: pointer; font-size: 16px; padding: 0 4px; opacity: .8; }
    .fpns-page:hover { opacity: 1; }
    .fpns-bar { position: relative; flex: 1; height: 18px; cursor: pointer; touch-action: none; }
    .fpns-track { position: absolute; left: 0; right: 0; top: 7px; height: 4px; background: rgba(255,255,255,.3); border-radius: 2px; }
    .fpns-bar:hover .fpns-track { top: 6px; height: 6px; }
    .fpns-fill { position: absolute; left: 0; top: 0; bottom: 0; background: #d20a0a; border-radius: 2px; }
    .fpns-knob { position: absolute; top: 50%; width: 12px; height: 12px; margin: -6px 0 0 -6px; border-radius: 50%; background: #d20a0a; }
    .fpns-ticks { position: absolute; inset: 0; pointer-events: none; }
    .fpns-tick { position: absolute; top: 5px; bottom: 5px; width: 1px; background: rgba(255,255,255,.35); }
    .fpns-tip { position: absolute; bottom: 26px; transform: translateX(-50%); display: none; pointer-events: none;
      background: #000; border: 2px solid #fff; border-radius: 4px; overflow: hidden; text-align: center; }
    .fpns-tip img { display: block; width: 240px; height: auto; }
    .fpns-tip .fpns-noimg { width: 240px; height: 135px; display: flex; align-items: center; justify-content: center; opacity: .6; }
    .fpns-tip span { display: block; padding: 3px 0; font-variant-numeric: tabular-nums; }
    .fpns-toast { position: absolute; left: 50%; top: 40%; transform: translate(-50%,-50%); z-index: 50; pointer-events: none;
      background: rgba(0,0,0,.65); color: #fff; font: 600 28px/1 Roboto, Arial, sans-serif; padding: 14px 22px; border-radius: 8px;
      opacity: 0; transition: opacity .25s; }
    .fpns-toast.on { opacity: 1; transition: none; }
    /* Pausing with a click / Space doesn't bring up the controls (moving the mouse does); a TV remote (fpns-show) still wins */
    html.fpns-hideui:not(.fpns-show) .dice-player-control,
    html.fpns-hideui:not(.fpns-show) .dice-player-topbar,
    html.fpns-hideui:not(.fpns-show) .center-play-button,
    html.fpns-hideui:not(.fpns-show) .discovery,
    html.fpns-hideui:not(.fpns-show) .dice-player-sidebar,
    html.fpns-hideui:not(.fpns-show) .dice-player-hotkey-feedback { opacity: 0 !important; pointer-events: none !important; transition: none !important; }
    .fpns-bezel { position: absolute; left: 50%; top: 50%; width: 76px; height: 76px; margin: -38px 0 0 -38px; border-radius: 50%;
      background: rgba(0,0,0,.55); display: flex; align-items: center; justify-content: center; opacity: 0; pointer-events: none; z-index: 60; }
    .fpns-bezel.on { animation: fpns-bezel .55s ease-out forwards; }
    @keyframes fpns-bezel { from { opacity: 1; transform: scale(1); } to { opacity: 0; transform: scale(1.6); } }
    .fpns-speed { position: absolute; top: 72px; left: 50%; transform: translateX(-50%); display: none; align-items: center; gap: 6px;
      background: rgba(0,0,0,.6); color: #fff; font: 600 16px/1 Arial, sans-serif; padding: 8px 14px; border-radius: 18px; pointer-events: none; z-index: 60; }
    .fpns-speed.on { display: flex; }
    /* Touch screens: the site's controls give way to our own overlay (its ⋯ button brings them back) */
    html.fpns-touch:not(.fpns-siteui) .dice-player-control,
    html.fpns-touch:not(.fpns-siteui) .dice-player-topbar,
    html.fpns-touch:not(.fpns-siteui) .center-play-button,
    html.fpns-touch:not(.fpns-siteui) .discovery,
    html.fpns-touch:not(.fpns-siteui) .dice-player-sidebar,
    html.fpns-touch:not(.fpns-siteui) .dice-player-hotkey-feedback { opacity: 0 !important; pointer-events: none !important; }
    /* ⋯ on a touch screen: the site's own controls, really shown (they hide themselves when idle) */
    html.fpns-touch.fpns-siteui .dice-player-control,
    html.fpns-touch.fpns-siteui .dice-player-topbar { opacity: 1 !important; visibility: visible !important; pointer-events: auto !important; }
  `;
  const addStyle = () => {
    if (document.getElementById('fpns-style')) return;
    const s = document.createElement('style');
    s.id = 'fpns-style';
    s.textContent = css;
    const parent = document.head || document.documentElement;
    if (parent) parent.appendChild(s);    // too early (no <html> yet): attach() adds it later
  };
  addStyle();

  // Any text that is only a duration, outside our own panel, gets hidden:
  // "08:05", "02:34:10", "-7:46" (cards and player) or "9m 26s", "2h 56m", "15m" (search).
  const TIME_RE = /^\s*(-?\d{1,2}:\d{2}(:\d{2})?|(\d+\s*(h|hr|hrs|m|min|mins|s|sec|secs)\.?\s*){1,3})\s*$/i;
  const scrubText = (root) => {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      if (!TIME_RE.test(n.nodeValue)) continue;
      const el = n.parentElement;
      if (!el || el.closest('#fpns-panel, .fpns-toast, script, style')) continue;
      el.classList.add('fpns-hidden-time');
    }
  };

  // ---------- 2) Don't hand the duration to the OS media controls ----------
  // The site's calls are dropped; section 8 tells the OS a fake length instead.
  const origSetPositionState = (() => {
    try {
      const ms = navigator.mediaSession;
      return ms && ms.setPositionState ? ms.setPositionState.bind(ms) : null;
    } catch { return null; }
  })();
  try {
    if (origSetPositionState) navigator.mediaSession.setPositionState = function () {};
  } catch {}

  // ---------- 3) Thumbnails (.bif file) ----------
  let bifUrl = null;
  let bif = null;           // { interval, frames: [{t, start, end}], buf }
  const imgCache = new Map();

  const noteResource = (name) => {
    if (/\.bif(\?|$)/i.test(name) && name !== bifUrl) {
      bifUrl = name;
      loadBif(name);
    }
  };
  try {
    new PerformanceObserver((list) => list.getEntries().forEach((e) => noteResource(e.name)))
      .observe({ type: 'resource', buffered: true });
  } catch {}
  try { performance.getEntriesByType('resource').forEach((e) => noteResource(e.name)); } catch {}

  // On a touch screen the player may never ask for the .bif (it only uses it on hover): look for its address
  // in the site's own API answers too.
  const BIF_IN_TEXT = /https?:(?:\\?\/){2}[^"'\s<>]+?\.bif(?:\?[^"'\s<>]*)?/i;
  const scanForBif = (text) => {
    const m = typeof text === 'string' && BIF_IN_TEXT.exec(text);
    if (m) noteResource(m[0].replace(/\\\//g, '/'));
  };
  try {
    const origFetch = window.fetch;
    window.fetch = function () {
      const p = origFetch.apply(this, arguments);
      p.then((r) => {
        if (!bif && /json|text/i.test(r.headers.get('content-type') || '')) r.clone().text().then(scanForBif, () => {});
      }, () => {});
      return p;
    };
    const origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function () {
      this.addEventListener('load', () => {
        try { if (!bif && (this.responseType === '' || this.responseType === 'text')) scanForBif(this.responseText); } catch {}
      });
      return origSend.apply(this, arguments);
    };
  } catch {}

  async function loadBif(url) {
    try {
      const buf = await (await fetch(url)).arrayBuffer();
      if (url !== bifUrl) return;
      const dv = new DataView(buf);
      const sig = [0x89, 0x42, 0x49, 0x46, 0x0d, 0x0a, 0x1a, 0x0a];
      if (!sig.every((b, i) => dv.getUint8(i) === b)) return;
      const count = dv.getUint32(12, true);
      const interval = (dv.getUint32(16, true) || 1000) / 1000;
      const frames = [];
      for (let i = 0; i < count; i++) {
        const t = dv.getUint32(64 + i * 8, true);
        const start = dv.getUint32(68 + i * 8, true);
        const end = dv.getUint32(68 + (i + 1) * 8, true);
        if (t === 0xffffffff) break;
        frames.push({ t: t * interval, start, end });
      }
      imgCache.forEach((u) => URL.revokeObjectURL(u));
      imgCache.clear();
      bif = { interval, frames, buf };
    } catch {}
  }

  // Returns the thumbnail URL for second t, or null if there is none.
  function thumbAt(t) {
    if (!bif || !bif.frames.length) return null;
    const i = Math.floor(t / bif.interval);
    const f = bif.frames[i];
    if (!f || t < 0) return null;
    if (!imgCache.has(i)) {
      imgCache.set(i, URL.createObjectURL(new Blob([bif.buf.slice(f.start, f.end)], { type: 'image/jpeg' })));
    }
    return imgCache.get(i);
  }

  // ---------- 4) Our own panel ----------
  const fmt = (s) => {
    s = Math.max(0, Math.floor(s));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(x).padStart(2, '0');
  };
  const jumpLabel = (j) => (j < 0 ? '\u2212' : '+') + (Math.abs(j) >= 60 ? Math.abs(j) / 60 + ' min' : Math.abs(j) + ' s');

  let video = null;
  let panel = null;
  let manualPage = null;    // null = the current time decides the page
  let toastTimer = null;

  const getVideo = () => document.querySelector('#dice-player video') || document.querySelector('video');
  const curPage = () => (manualPage !== null ? manualPage : Math.floor((video ? video.currentTime : 0) / windowSec));

  function seekTo(t) {
    if (!video) return;
    let target = Math.max(0, t);
    if (isFinite(video.duration) && target > video.duration - 1) target = Math.max(0, video.duration - 1);
    video.currentTime = target;
    manualPage = null;
  }

  function toast(text, ms) {
    const host = document.querySelector('.dice-player-background') || document.body;
    let el = host.querySelector(':scope > .fpns-toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'fpns-toast';
      host.appendChild(el);
    }
    el.textContent = text;
    el.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('on'), ms || 650);
  }

  function jump(sec) {
    if (!video) return;
    seekTo(video.currentTime + sec);
    toast(jumpLabel(sec));
  }

  function buildPanel() {
    const p = document.createElement('div');
    p.id = 'fpns-panel';
    p.className = 'keep-overlay-on-hover';
    p.innerHTML = `
      <div class="fpns-row keep-overlay-on-hover">
        ${JUMPS.map((j) => `<button class="fpns-btn" data-jump="${j}">${jumpLabel(j)}</button>`).join('')}
        <span class="fpns-spacer"></span>
        <span class="fpns-elapsed" title="Elapsed time (click or T to show/hide)"></span>
      </div>
      <div class="fpns-barwrap keep-overlay-on-hover">
        <button class="fpns-page" data-page="-1" title="Previous window">&lsaquo;</button>
        <span class="fpns-edge fpns-edge-l"></span>
        <div class="fpns-bar keep-overlay-on-hover">
          <div class="fpns-track"><div class="fpns-fill"></div></div>
          <div class="fpns-ticks"></div>
          <div class="fpns-knob"></div>
          <div class="fpns-tip"><img alt=""><div class="fpns-noimg">no preview</div><span></span></div>
        </div>
        <span class="fpns-edge fpns-edge-r"></span>
        <button class="fpns-page" data-page="1" title="Next window">&rsaquo;</button>
        <span class="fpns-edge fpns-scale" title="Bar scale (click to change)"></span>
      </div>`;

    // Keep panel clicks away from the player (it would pause)
    ['click', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'dblclick', 'touchstart', 'touchend'].forEach((ev) =>
      p.addEventListener(ev, (e) => e.stopPropagation()));

    p.querySelectorAll('[data-jump]').forEach((b) =>
      b.addEventListener('click', () => jump(+b.dataset.jump)));
    p.querySelectorAll('[data-page]').forEach((b) =>
      b.addEventListener('click', () => { manualPage = Math.max(0, curPage() + +b.dataset.page); render(); }));
    p.querySelector('.fpns-scale').addEventListener('click', () => {
      const i = WINDOWS_MIN.indexOf(windowSec / 60);
      windowSec = WINDOWS_MIN[(i + 1) % WINDOWS_MIN.length] * 60;
      lsSet(LS_WIN, windowSec / 60);
      manualPage = null;
      render();
    });
    p.querySelector('.fpns-elapsed').addEventListener('click', () => toggleElapsed());

    // Mouse: the thumbnail follows the pointer and dragging scrubs the video.
    // Finger (iPhone/iPad): dragging only previews; releasing jumps there.
    const bar = p.querySelector('.fpns-bar');
    const timeAtX = (clientX) => {
      const r = bar.getBoundingClientRect();
      return (curPage() + Math.min(1, Math.max(0, (clientX - r.left) / r.width))) * windowSec;
    };
    let drag = null;               // { type, page } while a button/finger is down
    bar.addEventListener('pointermove', (e) => {
      const t = timeAtX(e.clientX);
      showTip(t);
      if (drag && drag.type === 'mouse') { seekTo(t); manualPage = drag.page; }
    });
    bar.addEventListener('pointerleave', () => { if (!drag) hideTip(); });
    bar.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      drag = { type: e.pointerType, page: curPage() };   // the window doesn't change while dragging
      try { bar.setPointerCapture(e.pointerId); } catch {}
      const t = timeAtX(e.clientX);
      showTip(t);
      if (drag.type === 'mouse') { seekTo(t); manualPage = drag.page; }
    });
    const endDrag = (e, commit) => {
      if (!drag) return;
      const touch = drag.type !== 'mouse';
      drag = null;
      manualPage = null;
      if (touch) {
        if (commit) seekTo(timeAtX(e.clientX));
        hideTip();
      }
      render();
    };
    bar.addEventListener('pointerup', (e) => endDrag(e, true));
    bar.addEventListener('pointercancel', (e) => endDrag(e, false));
    return p;
  }

  // Thumbnail and timestamp above the bar for second t.
  function showTip(t) {
    if (!panel) return;
    const tip = panel.querySelector('.fpns-tip');
    const img = tip.querySelector('img');
    const noImg = tip.querySelector('.fpns-noimg');
    const u = thumbAt(t);
    if (u) { img.src = u; img.style.display = ''; noImg.style.display = 'none'; }
    else { img.style.display = 'none'; noImg.style.display = ''; }
    tip.querySelector('span').textContent = fmt(t);
    tip.style.display = 'block';
    // Keep the thumbnail on screen near the ends of the bar
    const bw = tip.parentNode.clientWidth;
    const half = tip.offsetWidth / 2;
    const x = Math.min(1, Math.max(0, t / windowSec - curPage())) * bw;
    tip.style.left = Math.min(Math.max(x, half - 40), bw - half + 40) + 'px';
  }
  function hideTip() {
    if (panel) panel.querySelector('.fpns-tip').style.display = 'none';
  }

  // ---------- Preview mode (for a remote control): move the thumbnail, then confirm ----------
  let previewT = null;
  let peekTimer = null;
  // Shows the player controls for ms milliseconds (0 = until preview mode ends).
  function peek(ms) {
    document.documentElement.classList.add('fpns-show');
    clearTimeout(peekTimer);
    if (ms) peekTimer = setTimeout(() => { if (previewT === null) document.documentElement.classList.remove('fpns-show'); }, ms);
  }
  function previewMove(sec) {
    if (!video) return;
    peek(0);
    if (previewT === null) previewT = video.currentTime;
    previewT = Math.max(0, previewT + sec);
    manualPage = Math.floor(previewT / windowSec);
    render();
    showTip(previewT);
  }
  function previewCommit() {
    if (previewT === null) return false;
    const t = previewT;
    previewT = null;
    hideTip();
    seekTo(t);
    render();
    peek(2500);
    return true;
  }
  function previewCancel() {
    if (previewT === null) return false;
    previewT = null;
    hideTip();
    manualPage = null;
    render();
    peek(2500);
    return true;
  }

  // Shows the player controls as if the mouse had moved.
  function wake() {
    const host = document.querySelector('.dice-player-background');
    if (!host) return;
    if (previewT === null) peek(3000);
    const r = host.getBoundingClientRect();
    host.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
  }

  function render() {
    if (!panel || !video) return;
    const page = curPage();
    const from = page * windowSec;
    const f = Math.min(1, Math.max(0, (video.currentTime - from) / windowSec));
    const inPage = video.currentTime >= from && video.currentTime < from + windowSec;
    panel.querySelector('.fpns-fill').style.width = (inPage ? f * 100 : video.currentTime >= from + windowSec ? 100 : 0) + '%';
    const knob = panel.querySelector('.fpns-knob');
    knob.style.display = inPage ? '' : 'none';
    knob.style.left = f * 100 + '%';
    panel.querySelector('.fpns-edge-l').textContent = fmt(from);
    panel.querySelector('.fpns-edge-r').textContent = fmt(from + windowSec);
    panel.querySelector('.fpns-scale').textContent = windowSec / 60 + ' min';
    panel.querySelector('[data-page="-1"]').style.visibility = page > 0 ? '' : 'hidden';
    const el = panel.querySelector('.fpns-elapsed');
    el.textContent = showElapsed ? fmt(video.currentTime) : '\u2022\u2022\u2022';
    // ticks every 15 min (every 5 on small scales)
    const ticks = panel.querySelector('.fpns-ticks');
    const step = windowSec > 1800 ? 900 : 300;
    const key = windowSec + ':' + step;
    if (ticks.dataset.key !== key) {
      ticks.dataset.key = key;
      ticks.innerHTML = '';
      for (let s = step; s < windowSec; s += step) {
        const t = document.createElement('div');
        t.className = 'fpns-tick';
        t.style.left = (s / windowSec) * 100 + '%';
        ticks.appendChild(t);
      }
    }
  }

  function toggleElapsed() {
    showElapsed = !showElapsed;
    lsSet(LS_SHOWTIME, showElapsed);
    render();
  }

  function attach() {
    addStyle();
    const v = getVideo();
    if (v !== video) {
      video = v;
      manualPage = null;
      if (video) {
        ['timeupdate', 'seeked', 'loadedmetadata', 'emptied'].forEach((ev) => video.addEventListener(ev, render));
      }
    }
    document.querySelectorAll('video').forEach(watchVideo);
    // With a mouse the panel sits on top of the site's controls; on a touch screen, in our own overlay.
    const slot = touchSlot();
    const control = document.querySelector('.dice-player-control');
    if (slot && (!panel || panel.parentNode !== slot)) {
      panel = panel || buildPanel();
      slot.appendChild(panel);
      render();
    } else if (!slot && control && (!panel || !control.contains(panel))) {
      panel = panel || buildPanel();
      control.insertBefore(panel, control.firstChild);
      render();
    }
  }

  // For other controllers (e.g. a TV remote wrapper): window.fpnsApi
  window.fpnsApi = {
    isPlayer: () => !!(getVideo() && document.querySelector('.dice-player-control')),
    isPaused: () => { const v = getVideo(); return !v || v.paused; },
    jump: (sec) => { wake(); jump(sec); },
    togglePlay: () => { const v = getVideo(); if (!v) return; wake(); if (v.paused) v.play(); else v.pause(); },
    previewMove: (sec) => { wake(); previewMove(sec); },
    previewCommit: () => { wake(); return previewCommit(); },
    previewCancel: () => previewCancel(),
    inPreview: () => previewT !== null,
    toggleElapsed: () => { wake(); toggleElapsed(); },
    wake,
  };

  // ---------- 5) Keyboard ----------
  // ←/→ 10 s · Shift 30 s · Ctrl 1 min · Ctrl+Shift 5 min · T shows/hides the elapsed time
  window.addEventListener('keydown', (e) => {
    if (!video || !document.querySelector('.dice-player-control')) return;
    const tag = (e.target && e.target.tagName) || '';
    if (/INPUT|TEXTAREA|SELECT/.test(tag) || (e.target && e.target.isContentEditable)) return;
    if (e.altKey || e.metaKey) return;
    let dir = 0;
    if (e.key === 'ArrowLeft') dir = -1;
    else if (e.key === 'ArrowRight') dir = 1;
    if (dir) {
      const amount = e.ctrlKey && e.shiftKey ? 300 : e.ctrlKey ? 60 : e.shiftKey ? 30 : 10;
      e.preventDefault();
      e.stopImmediatePropagation();
      jump(dir * amount);
      return;
    }
    if ((e.key === 't' || e.key === 'T') && !e.ctrlKey) {
      e.preventDefault();
      e.stopImmediatePropagation();
      toggleElapsed();
    }
  }, true);

  const YT = {
    prefix: 'fpns-',
    host: '.dice-player-background',
    // clicks on these keep their normal behavior
    exclude: '.dice-player-control, .dice-player-topbar, .discovery, .dice-player-sidebar, #fpns-panel, .preferences-panel',
    video: () => getVideo(),
    ready: () => !!(getVideo() && document.querySelector('.dice-player-control')),
  };
  // ---------- 7) YouTube-style click: tap = play/pause with a brief icon, hold = 2x ----------
  // A short click (or Space/K) toggles play/pause, shows a quick icon in the middle and does NOT bring up the controls
  // (they come back when the mouse moves). Holding the button plays at 2x until it's released.
  const HOLD_MS = 350;
  const ICON_PLAY = '<svg viewBox="0 0 24 24" width="40" height="40"><path fill="#fff" d="M8 5v14l11-7z"/></svg>';
  const ICON_PAUSE = '<svg viewBox="0 0 24 24" width="40" height="40"><path fill="#fff" d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>';
  const ICON_FAST = '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="#fff" d="M4 6v12l8.5-6zm9 0v12l8.5-6z"/></svg>';
  let hold = null;          // { timer, active, prevRate, wasPaused }
  let swallow = false;      // the rest of an intercepted mouse press (up/click) must not reach the player
  let hideUiFrom = null;    // mouse position when the UI was hidden; moving away from it shows the controls again
  let lastMouse = null;

  const yt = (cls) => YT.prefix + cls;
  const ytHost = () => document.querySelector(YT.host);

  function hideUi() {
    document.documentElement.classList.add(yt('hideui'));
  }
  window.addEventListener('mousemove', (e) => {
    lastMouse = { x: e.clientX, y: e.clientY };
    if (!hideUiFrom) return;
    if (Math.abs(e.clientX - hideUiFrom.x) + Math.abs(e.clientY - hideUiFrom.y) > 4) {
      hideUiFrom = null;
      document.documentElement.classList.remove(yt('hideui'));
    }
  }, true);

  function bezel(svg) {
    const host = ytHost();
    if (!host) return null;
    let el = host.querySelector(':scope > .' + yt('bezel'));
    if (!el) {
      el = document.createElement('div');
      el.className = yt('bezel');
      host.appendChild(el);
    }
    el.innerHTML = svg;
    el.classList.remove('on');
    void el.offsetWidth;    // restart the animation
    el.classList.add('on');
    return el;
  }

  function speedBadge(show) {
    const host = ytHost();
    if (!host) return;
    let el = host.querySelector(':scope > .' + yt('speed'));
    if (!el) {
      el = document.createElement('div');
      el.className = yt('speed');
      el.innerHTML = '2x ' + ICON_FAST;
      host.appendChild(el);
    }
    el.classList.toggle('on', show);
  }

  function togglePlayback(pos) {
    const v = YT.video();
    if (!v) return;
    if (v.paused) v.play(); else v.pause();
    hideUiFrom = pos || lastMouse || { x: -1e6, y: -1e6 };
    hideUi();
    bezel(v.paused ? ICON_PAUSE : ICON_PLAY);
  }

  function holdStart(pos) {
    const v = YT.video();
    if (!v) return;
    hold = { timer: setTimeout(() => {
      hold.active = true;
      hold.prevRate = v.playbackRate;
      hold.wasPaused = v.paused;
      v.playbackRate = 2;
      if (v.paused) v.play();
      hideUiFrom = pos || lastMouse || { x: -1e6, y: -1e6 };
      hideUi();
      speedBadge(true);
    }, HOLD_MS) };
  }
  // Returns true if the press was a hold (so it must not toggle).
  function holdEnd() {
    if (!hold) return false;
    clearTimeout(hold.timer);
    const h = hold;
    hold = null;
    if (!h.active) return false;
    const v = YT.video();
    if (v) {
      v.playbackRate = h.prevRate || 1;
      if (h.wasPaused) v.pause();
    }
    speedBadge(false);
    return true;
  }

  const onSurface = (e) => {
    const host = ytHost();
    return host && e.target instanceof Element && host.contains(e.target) && !e.target.closest(YT.exclude) && YT.ready();
  };

  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || !onSurface(e)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    swallow = true;
    holdStart({ x: e.clientX, y: e.clientY });
  }, true);
  ['mousedown', 'mouseup', 'click'].forEach((type) => window.addEventListener(type, (e) => {
    if (!swallow) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (type === 'click') swallow = false;
  }, true));
  window.addEventListener('pointerup', (e) => {
    if (!swallow || e.pointerType !== 'mouse') return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (!holdEnd()) togglePlayback({ x: e.clientX, y: e.clientY });
    setTimeout(() => { swallow = false; }, 0);   // in case no click event follows
  }, true);

  // Space / K behave the same: tap toggles, hold plays at 2x.
  const isPauseKey = (e) => (e.key === ' ' || e.key === 'k' || e.key === 'K') && !e.ctrlKey && !e.altKey && !e.metaKey;
  const typing = (e) => {
    const t = e.target;
    return t && ((/INPUT|TEXTAREA|SELECT/.test(t.tagName || '') && !(t.classList && t.classList.contains('seek-bar-range-input'))) || t.isContentEditable);
  };
  window.addEventListener('keydown', (e) => {
    if (!isPauseKey(e) || typing(e) || !ytHost() || !YT.ready()) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (!e.repeat && !hold) holdStart(null);
  }, true);
  window.addEventListener('keyup', (e) => {
    if (!isPauseKey(e) || typing(e) || !ytHost() || !YT.ready()) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (!holdEnd()) togglePlayback(null);
  }, true);
  window.addEventListener('keypress', (e) => {
    if (isPauseKey(e) && !typing(e) && ytHost() && YT.ready()) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);

  const TL = {
    host: () => document.querySelector(YT.host),
    video: () => getVideo(),
    scope: () => true,                 // the page is one where Safari's own player must never show
    active: () => YT.ready(),
    exclude: '.preferences-panel',     // taps here keep their normal behavior (simple controls)
    excludeSite: YT.exclude,           // ... and with the site's controls brought back
  };
  // ---------- 8) iPhone / iPad (touch screens) ----------
  // On a touch screen the player gets its own overlay instead of the site's controls (which are hidden):
  //   tap = show/hide the controls · double tap on the left/right third = −10/+10 s (keep tapping to add more)
  //   hold = 2x until you let go · ⛶ = full screen (on iPhone it fills the screen inside Safari, never Apple's player)
  //   ⋯ = bring back the site's own controls (settings, audio, etc.), still without times.
  // Safari's own full-screen player, Picture in Picture and AirPlay show the duration, so they are blocked.
  // (decided once the page exists: at document-start Safari can't answer media queries yet)
  let touchDevice = null;
  const TOUCH = () => {
    if (touchDevice === null && document.documentElement && document.body) {
      touchDevice = navigator.maxTouchPoints > 0 && matchMedia('(pointer: coarse)').matches;
    }
    return !!touchDevice;
  };
  const IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  const TAP_ZONE = 0.35;        // left/right share of the player width for double-tap jumps
  const DOUBLE_TAP_MS = 350;
  const STREAK_MS = 800;        // after a double tap, more taps on the same side keep adding 10 s
  const UI_HIDE_MS = 3500;

  const ICON_BACK = '<svg viewBox="0 0 24 24" width="28" height="28"><path fill="#fff" d="M15.4 7.4 14 6l-6 6 6 6 1.4-1.4L10.8 12z"/></svg>';
  const ICON_MORE = '<svg viewBox="0 0 24 24" width="28" height="28"><path fill="#fff" d="M6 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4m6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4m6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4"/></svg>';
  const ICON_FS = '<svg viewBox="0 0 24 24" width="28" height="28"><path fill="#fff" d="M7 14H5v5h5v-2H7zm-2-4h2V7h3V5H5zm12 7h-3v2h5v-5h-2zM14 5v2h3v3h2V5z"/></svg>';
  const ICON_FS_EXIT = '<svg viewBox="0 0 24 24" width="28" height="28"><path fill="#fff" d="M5 16h3v3h2v-5H5zm3-8H5v2h5V5H8zm6 11h2v-3h3v-2h-5zm2-11V5h-2v5h5V8z"/></svg>';
  const ICON_BIG_PLAY = '<svg viewBox="0 0 24 24" width="60" height="60"><path fill="#fff" d="M8 5v14l11-7z"/></svg>';
  const ICON_BIG_PAUSE = '<svg viewBox="0 0 24 24" width="60" height="60"><path fill="#fff" d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>';
  const skipIcon = (dir) => '<svg viewBox="0 0 24 24" width="44" height="44"><path fill="#fff" d="' + (dir < 0
    ? 'M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z'
    : 'M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z') +
    '"/><text x="12" y="16.3" text-anchor="middle" font-size="6.5" font-weight="700" font-family="Arial, sans-serif" fill="#fff">10</text></svg>';

  const touchCss = `
    #fpns-touch { position: absolute; inset: 0; z-index: 2147483647; display: none; pointer-events: none; color: #fff;
      font: 14px/1.2 -apple-system, "Helvetica Neue", Arial, sans-serif; -webkit-tap-highlight-color: transparent;
      -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
    html.fpns-touch #fpns-touch { display: block; }
    html.fpns-touch [data-fpns-surface], html.fpns-touch [data-fpns-surface] * { touch-action: pan-y; -webkit-user-select: none; user-select: none;
      -webkit-touch-callout: none; }
    html.fpns-touch #fpns-touch button, html.fpns-touch #fpns-touch .fpns-btn { touch-action: manipulation; }
    html.fpns-touch #fpns-touch .fpns-bar { touch-action: none; }
    #fpns-touch .fpns-t-layer { position: absolute; inset: 0; opacity: 0; transition: opacity .2s; pointer-events: none; }
    html.fpns-tui #fpns-touch .fpns-t-layer { opacity: 1; }
    html.fpns-tui #fpns-touch button, html.fpns-tui #fpns-touch .fpns-t-bot { pointer-events: auto; }
    #fpns-touch .fpns-t-shade { position: absolute; inset: 0;
      background: linear-gradient(rgba(0,0,0,.6), rgba(0,0,0,0) 25%, rgba(0,0,0,0) 55%, rgba(0,0,0,.75)); }
    #fpns-touch .fpns-t-top { position: absolute; left: 0; right: 0; top: 0; display: flex; align-items: center;
      padding: max(4px, env(safe-area-inset-top)) max(6px, env(safe-area-inset-right)) 0 max(6px, env(safe-area-inset-left)); }
    #fpns-touch .fpns-t-flex { flex: 1; }
    #fpns-touch .fpns-t-mid { position: absolute; left: 50%; top: 45%; transform: translate(-50%, -50%); display: flex;
      align-items: center; gap: min(12vw, 90px); }
    #fpns-touch .fpns-t-bot { position: absolute; left: 0; right: 0; bottom: 0;
      padding: 0 max(10px, env(safe-area-inset-right)) max(4px, env(safe-area-inset-bottom)) max(10px, env(safe-area-inset-left)); }
    #fpns-touch button { background: none !important; border: 0 !important; margin: 0; padding: 8px !important; color: #fff;
      touch-action: manipulation; -webkit-appearance: none; appearance: none; cursor: pointer; line-height: 0; min-width: 0; }
    #fpns-touch button svg { display: block; filter: drop-shadow(0 0 3px rgba(0,0,0,.6)); }
    #fpns-touch button:active { opacity: .6; }
    #fpns-touch .fpns-t-play { padding: 4px !important; border-radius: 50%; }
    #fpns-touch #fpns-panel { position: static !important; width: auto !important; padding: 0 !important; margin: 0 !important; touch-action: none; }
    #fpns-touch #fpns-panel .fpns-row { flex-wrap: nowrap; gap: 4px; }
    #fpns-touch #fpns-panel .fpns-btn { flex: 1 1 0; min-width: 0 !important; padding: 8px 0 !important; font-size: 13px !important;
      line-height: 1 !important; text-align: center; white-space: nowrap; touch-action: manipulation; }
    #fpns-touch .fpns-elapsed { min-width: 58px; padding: 8px 0 8px 6px; }
    #fpns-touch .fpns-barwrap { margin: 2px 0 0; gap: 6px; }
    #fpns-touch .fpns-page { padding: 6px 8px !important; font-size: 22px !important; line-height: 1 !important; }
    #fpns-touch .fpns-edge { min-width: 44px; font-size: 12px; }
    #fpns-touch .fpns-scale { padding: 8px 0; }
    #fpns-touch .fpns-bar { height: 36px; }
    #fpns-touch .fpns-track, #fpns-touch .fpns-bar:hover .fpns-track { top: 16px; height: 4px; }
    #fpns-touch .fpns-knob { width: 16px; height: 16px; margin: -8px 0 0 -8px; }
    #fpns-touch .fpns-tick { top: 12px; bottom: 12px; }
    #fpns-touch .fpns-tip { bottom: 40px; }
    #fpns-touch .fpns-tip img, #fpns-touch .fpns-tip .fpns-img, #fpns-touch .fpns-tip .fpns-noimg { width: 200px; height: 112px; }
    /* iPhone upright: the small player only gets the bar (the jumps come back in full screen) */
    @media (max-width: 500px) {
      html:not(.fpns-pfs-on) #fpns-touch #fpns-panel .fpns-btn { display: none !important; }
      html:not(.fpns-pfs-on) #fpns-touch .fpns-elapsed { padding: 4px 0 0; }
      html.fpns-pfs-on #fpns-touch #fpns-panel .fpns-row { flex-wrap: wrap; }
      html.fpns-pfs-on #fpns-touch #fpns-panel .fpns-btn { flex: 1 1 22%; }
      html.fpns-pfs-on #fpns-touch .fpns-elapsed { flex: 1 1 100%; text-align: center; padding: 4px 0 0; }
      html.fpns-pfs-on #fpns-touch .fpns-t-bot { padding-bottom: max(24px, env(safe-area-inset-bottom)); }
    }
    /* Full screen inside the page (iPhone has no real full screen for anything but Safari's own player).
       Data attributes, not classes: React rewrites the class of its elements on every render. */
    [data-fpns-pfs] { position: fixed !important; left: var(--fpns-vl, 0px) !important; top: var(--fpns-vt, 0px) !important;
      right: auto !important; bottom: auto !important; width: var(--fpns-vw, 100vw) !important; height: var(--fpns-vh, 100dvh) !important;
      max-width: none !important; max-height: none !important;
      min-height: 0 !important; margin: 0 !important; padding: 0 !important; z-index: 2147483600 !important; background: #000 !important;
      transform: none !important; border-radius: 0 !important; aspect-ratio: auto !important; }
    [data-fpns-pfs] video { object-fit: contain !important; }
    /* the video and the boxes around it fill the player (the site sizes them for the old, smaller area) */
    [data-fpns-pfs-fill] { position: absolute !important; top: 0 !important; left: 0 !important; right: auto !important; bottom: auto !important;
      width: 100% !important; height: 100% !important; max-width: none !important; max-height: none !important; min-height: 0 !important;
      margin: 0 !important; transform: none !important; }
    /* In full screen the video and our controls are pinned to the visible area themselves, whatever the site's boxes do:
       nothing is left under Safari's old bars, and the time bar stays at the bottom of the screen. */
    html.fpns-pfs-on [data-fpns-pfs] video[data-fpns-pfs-fill], html.fpns-pfs-on #fpns-touch {
      position: fixed !important; left: var(--fpns-vl, 0px) !important; top: var(--fpns-vt, 0px) !important; right: auto !important;
      bottom: auto !important; width: var(--fpns-vw, 100vw) !important; height: var(--fpns-vh, 100dvh) !important; }
    #fpns-diag { position: absolute; left: 8px; top: 52px; z-index: 5; background: rgba(0,0,0,.8); color: #0f0; pointer-events: auto;
      font: 11px/1.35 ui-monospace, Menlo, monospace; padding: 6px 8px; border-radius: 6px; white-space: pre; }
    /* two fingers in full screen: zoom and move the picture freely */
    html.fpns-pfs-on [data-fpns-pfs] video, html [data-fpns-surface]:fullscreen video, html [data-fpns-surface]:-webkit-full-screen video {
      transform: translate(var(--fpns-zx, 0px), var(--fpns-zy, 0px)) scale(var(--fpns-zs, 1)) !important; transform-origin: 50% 50% !important;
      transition: none !important; }
    html.fpns-siteui #fpns-touch .fpns-t-bot, html.fpns-siteui #fpns-touch .fpns-t-mid, html.fpns-siteui #fpns-touch .fpns-t-shade,
    html.fpns-siteui #fpns-touch [data-act="back"], html.fpns-siteui #fpns-touch [data-act="fs"],
    html.fpns-siteui #fpns-touch .fpns-t-ver { display: none !important; }
    #fpns-touch .fpns-t-ver { font: 11px/1 -apple-system, Arial, sans-serif !important; opacity: .45; padding: 10px 6px !important; color: #fff; }
    [data-fpns-pfs-anc] { transform: none !important; filter: none !important; contain: none !important; will-change: auto !important;
      perspective: none !important; backdrop-filter: none !important; -webkit-backdrop-filter: none !important;
      container-type: normal !important; z-index: 2147483600 !important;
      overflow: visible !important; clip-path: none !important; -webkit-mask: none !important; mask: none !important; }
    /* fixed boxes of the site around the player keep the size of the screen with Safari's bars: they take the visible area */
    [data-fpns-pfs-box] { position: fixed !important; left: var(--fpns-vl, 0px) !important; top: var(--fpns-vt, 0px) !important;
      right: auto !important; bottom: auto !important; width: var(--fpns-vw, 100vw) !important; height: var(--fpns-vh, 100dvh) !important;
      max-height: none !important; min-height: 0 !important; }
    /* iPhone: Safari only hides its bars when the page scrolls, so in full screen the page gets room to scroll
       (the player stays fixed on top) and a swipe up on the video scrolls it */
    html.fpns-pfs-on, html.fpns-pfs-on body { overflow: visible !important; }
    #fpns-scrollroom { height: 100vh; pointer-events: none; }
  `;
  const addTouchStyle = () => {
    if (document.getElementById('fpns-tstyle')) return;
    const s = document.createElement('style');
    s.id = 'fpns-tstyle';
    s.textContent = touchCss;
    (document.head || document.documentElement).appendChild(s);
  };

  let touchEl = null;
  // Zoom of the picture in full screen (always centred), set with two fingers; remembered.
  let view = { s: Math.min(4, Math.max(1, +((lsGet('fpns:view', null) || {}).s) || 1)), x: 0, y: 0 };
  // After one of our buttons acted, Safari's own click for that touch is dropped wherever it lands
  // (the layout may have changed under the finger, e.g. leaving full screen).
  let nativeClickOff = 0;
  window.addEventListener('click', (e) => {
    if (e.isTrusted && Date.now() < nativeClickOff) { e.stopImmediatePropagation(); e.preventDefault(); }
  }, true);
  let uiOn = true;
  let uiTimer = null;
  let pfsOn = false;            // full screen inside the page wanted
  let pfsAuto = false;          // full screen entered by turning the iPhone sideways
  const touchOn = () => document.documentElement.classList.contains('fpns-touch');

  // The element that holds both the video and the controls (what goes full screen).
  function playerRoot() {
    const h = TL.host();
    const v = TL.video();
    if (!h) return null;
    let r = h;
    while (v && r && !r.contains(v)) r = r.parentElement;
    return r || h;
  }
  // Videos we look after: every video on the page (ads may play in their own <video>, outside the player).
  const owns = (v) => !!v && TL.scope();

  // Every video of the player: plays inside the page, no Picture in Picture, no AirPlay, no native controls.
  function prepVideo(v) {
    if (v.dataset.fpnsPrep) return;
    v.dataset.fpnsPrep = '1';
    try {
      v.playsInline = true;
      v.setAttribute('playsinline', '');
      v.setAttribute('webkit-playsinline', '');
      v.disablePictureInPicture = true;
      v.disableRemotePlayback = true;
      v.setAttribute('x-webkit-airplay', 'deny');
      v.setAttribute('disablepictureinpicture', '');
      v.setAttribute('disableremoteplayback', '');
    } catch {}
    if (TOUCH() || IOS) {
      new MutationObserver(() => { if (v.controls && owns(v)) v.controls = false; }).observe(v, { attributes: true, attributeFilter: ['controls'] });
      if (v.controls && owns(v)) v.controls = false;
    }
  }

  // ---- full screen ----
  const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;
  const fsApi = () => !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
  const isFs = () => pfsOn || !!fsElement();

  // Puts the full-screen marks on the current player (or takes them off). Called again on every change of the page,
  // in case the site replaced the player's elements.
  function applyPfs() {
    const r = pfsOn ? playerRoot() : null;
    const anc = new Set();
    for (let a = r && r.parentElement; a && a !== document.documentElement; a = a.parentElement) anc.add(a);
    document.querySelectorAll('[data-fpns-pfs]').forEach((el) => { if (el !== r) el.removeAttribute('data-fpns-pfs'); });
    if (r && !r.hasAttribute('data-fpns-pfs')) r.setAttribute('data-fpns-pfs', '');
    const fill = new Set();
    const v = r && TL.video();
    for (let e = v; r && e && e !== r && r.contains(e); e = e.parentElement) fill.add(e);
    fill.forEach((e) => { if (e !== v) anc.add(e); });
    document.querySelectorAll('[data-fpns-pfs-fill]').forEach((el) => { if (!fill.has(el)) el.removeAttribute('data-fpns-pfs-fill'); });
    fill.forEach((e) => { if (!e.hasAttribute('data-fpns-pfs-fill')) e.setAttribute('data-fpns-pfs-fill', ''); });
    document.querySelectorAll('[data-fpns-pfs-anc]').forEach((el) => { if (!anc.has(el)) el.removeAttribute('data-fpns-pfs-anc'); });
    anc.forEach((a) => { if (!a.hasAttribute('data-fpns-pfs-anc')) a.setAttribute('data-fpns-pfs-anc', ''); });
    const boxes = new Set();
    for (let a = r && r.parentElement; a && a !== document.body && a !== document.documentElement; a = a.parentElement) {
      if (a.hasAttribute('data-fpns-pfs-box') || getComputedStyle(a).position === 'fixed') boxes.add(a);
    }
    document.querySelectorAll('[data-fpns-pfs-box]').forEach((el) => { if (!boxes.has(el)) el.removeAttribute('data-fpns-pfs-box'); });
    boxes.forEach((a) => { if (!a.hasAttribute('data-fpns-pfs-box')) a.setAttribute('data-fpns-pfs-box', ''); });
    document.documentElement.classList.toggle('fpns-pfs-on', !!r);
    fitToScreen();
    let room = document.getElementById('fpns-scrollroom');
    if (r && document.body && (!room || room.parentNode !== document.body || document.body.lastElementChild !== room)) {
      room = room || Object.assign(document.createElement('div'), { id: 'fpns-scrollroom' });
      document.body.appendChild(room);
    } else if (!r && room) {
      room.remove();
    }
  }
  // The player takes exactly the visible area, which grows when Safari hides its bars.
  function fitToScreen() {
    const st = document.documentElement.style;
    if (!pfsOn) {
      ['vl', 'vt', 'vw', 'vh'].forEach((k) => st.removeProperty('--fpns-' + k));
      return;
    }
    const vv = window.visualViewport;
    st.setProperty('--fpns-vl', (vv ? vv.offsetLeft : 0) + 'px');
    st.setProperty('--fpns-vt', (vv ? vv.offsetTop : 0) + 'px');
    st.setProperty('--fpns-vw', (vv ? vv.width : innerWidth) + 'px');
    st.setProperty('--fpns-vh', (vv ? vv.height : innerHeight) + 'px');
    applyView();
  }
  function applyView() {
    const st = document.documentElement.style;
    const vv = window.visualViewport;
    st.setProperty('--fpns-zs', String(view.s));
    st.setProperty('--fpns-zx', Math.round(view.x * (vv ? vv.width : innerWidth)) + 'px');
    st.setProperty('--fpns-zy', Math.round(view.y * (vv ? vv.height : innerHeight)) + 'px');
  }
  ['resize', 'scroll', 'orientationchange'].forEach((ev) => window.addEventListener(ev, fitToScreen, { passive: true }));
  try { ['resize', 'scroll'].forEach((ev) => window.visualViewport.addEventListener(ev, fitToScreen, { passive: true })); } catch {}

  // Diagnostics (tap the version): the real sizes on the device, to fix layout problems from a screenshot.
  let diagTimer = null;
  function toggleDiag() {
    const old = document.getElementById('fpns-diag');
    if (old) { old.remove(); clearInterval(diagTimer); return; }
    const d = document.createElement('div');
    d.id = 'fpns-diag';
    touchEl.appendChild(d);
    const probe = (h) => {
      const e = document.createElement('div');
      e.style.cssText = 'position:fixed;top:0;left:0;width:1px;visibility:hidden;height:' + h;
      document.body.appendChild(e);
      const v = Math.round(e.getBoundingClientRect().height);
      e.remove();
      return v;
    };
    const box = (el) => {
      if (!el) return '-';
      const r = el.getBoundingClientRect();
      return Math.round(r.left) + ',' + Math.round(r.top) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height);
    };
    // boxes around the video shorter than the visible area that could cut it (name, size, position, overflow)
    const clippers = (v) => {
      const out = [];
      const vh = window.visualViewport ? window.visualViewport.height : innerHeight;
      for (let e = v && v.parentElement; e; e = e.parentElement) {
        const cs = getComputedStyle(e);
        const h = Math.round(e.getBoundingClientRect().height);
        if (h < vh - 4 && (cs.overflow !== 'visible' || cs.position === 'fixed' || cs.clipPath !== 'none')) {
          const name = e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/)[0] : '');
          out.push('cut? ' + name + ' h' + h + ' ' + cs.position + ' ov:' + cs.overflow + (cs.clipPath !== 'none' ? ' clip' : ''));
        }
        if (out.length >= 4) break;
      }
      return out.length ? out : ['cut? none'];
    };
    const fill = () => {
      const vv = window.visualViewport;
      const v = TL.video();
      const ver = (/OS (\d+[_\d]*)/.exec(navigator.userAgent) || [])[1] || '?';
      d.textContent = [
        'v1.4.8  iOS ' + ver.replace(/_/g, '.') + '  fs=' + pfsOn + ' real=' + !!fsElement(),
        'screen ' + screen.width + 'x' + screen.height + '  dpr ' + devicePixelRatio,
        'inner ' + innerWidth + 'x' + innerHeight + '  scrollY ' + Math.round(scrollY) + '  docH ' + document.documentElement.scrollHeight,
        'vv ' + (vv ? Math.round(vv.width) + 'x' + Math.round(vv.height) + ' top ' + Math.round(vv.offsetTop) + ' pageTop ' + Math.round(vv.pageTop) : '-'),
        'svh ' + probe('100svh') + '  dvh ' + probe('100dvh') + '  lvh ' + probe('100lvh') + '  vh ' + probe('100vh'),
        'player ' + box(playerRoot()),
        'video  ' + box(v) + (v ? '  ' + v.videoWidth + 'x' + v.videoHeight : ''),
        'overlay ' + box(touchEl) + '  bar ' + box(touchEl.querySelector('.fpns-t-bot')),
        'view ' + view.s.toFixed(2) + 'x ' + view.x.toFixed(2) + ',' + view.y.toFixed(2) + '  banner ' + document.querySelectorAll('meta[name="apple-itunes-app"]').length,
        ...clippers(v),
      ].join('\n');
    };
    fill();
    diagTimer = setInterval(fill, 500);
  }

  // Safari's bars still showing? (the visible height is clearly less than the screen's)
  const safariBarsShown = () => {
    const landscape = innerWidth > innerHeight;
    const full = landscape ? Math.min(screen.width, screen.height) : Math.max(screen.width, screen.height);
    return innerHeight < full - (landscape ? 24 : 120);
  };
  function hideBarsHint() {
    if (!IOS || fsElement()) return;
    try { window.scrollTo(0, 1); } catch {}
    setTimeout(() => { if (pfsOn && safariBarsShown()) toast('Swipe up to hide Safari\'s bar', 2500); }, 400);
  }
  function enterPfs(r) {
    if (!r || pfsOn) return;
    pfsOn = true;
    pfsAuto = false;
    applyPfs();
    window.dispatchEvent(new Event('resize'));
    touchIcons();
    hideBarsHint();
  }
  function exitPfs() {
    if (!pfsOn) return;
    pfsOn = false;
    applyPfs();
    try { window.scrollTo(0, 0); } catch {}
    window.dispatchEvent(new Event('resize'));
    touchIcons();
  }
  function enterFs() {
    const r = playerRoot();
    if (!r) return;
    if (fsApi() && (r.requestFullscreen || r.webkitRequestFullscreen)) {
      try {
        const p = r.requestFullscreen ? r.requestFullscreen() : r.webkitRequestFullscreen();
        if (p && p.catch) p.catch(() => enterPfs(r));
        return;
      } catch {}
    }
    enterPfs(r);
  }
  function exitFs() {
    if (pfsOn) exitPfs();
    if (fsElement()) {
      try { (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch {}
    }
  }
  const toggleFs = () => (isFs() ? exitFs() : enterFs());

  // iPhone turned sideways while watching: fill the screen, like the apps do; upright again: back to the page.
  const phoneLandscape = matchMedia('(orientation: landscape) and (max-height: 500px)');
  const onRotate = () => {
    if (!touchOn()) return;
    if (phoneLandscape.matches && !isFs()) {
      enterPfs(playerRoot());
      pfsAuto = true;
    } else if (!phoneLandscape.matches && pfsOn && pfsAuto) {
      exitPfs();
    }
  };
  try { phoneLandscape.addEventListener('change', onRotate); } catch { try { phoneLandscape.addListener(onRotate); } catch {} }

  if (IOS) {
    // Safari's "Open in the app" banner takes screen space: the site's meta tag for it gets another name.
    try {
      const origSetAttribute = Element.prototype.setAttribute;
      Element.prototype.setAttribute = function (name, value) {
        if (this.tagName === 'META' && String(name).toLowerCase() === 'name' && String(value).toLowerCase() === 'apple-itunes-app') {
          value = 'apple-itunes-app-off';
        }
        return origSetAttribute.call(this, name, value);
      };
    } catch {}
    // The site asks Safari for its own full-screen player (or a full-screen <video>): give it ours instead.
    const VP = HTMLVideoElement.prototype;
    ['webkitEnterFullscreen', 'webkitEnterFullScreen', 'requestFullscreen', 'webkitRequestFullscreen', 'webkitRequestFullScreen'].forEach((name) => {
      const orig = VP[name];
      if (typeof orig !== 'function') return;
      try {
        VP[name] = function () {
          if (owns(this)) {
            enterFs();
            return name === 'requestFullscreen' ? Promise.resolve() : undefined;
          }
          return orig.apply(this, arguments);
        };
      } catch {}
    });
    // In case it gets there anyway: leave it at once and fill the screen with our player.
    document.addEventListener('webkitbeginfullscreen', (e) => {
      const v = e.target;
      if (!(v instanceof HTMLVideoElement) || !owns(v)) return;
      try { v.webkitExitFullscreen(); } catch {}
      setTimeout(() => enterPfs(playerRoot()), 50);
    }, true);
    document.addEventListener('webkitpresentationmodechanged', (e) => {
      const v = e.target;
      if (v instanceof HTMLVideoElement && v.webkitPresentationMode && v.webkitPresentationMode !== 'inline' && owns(v)) {
        try { v.webkitSetPresentationMode('inline'); } catch {}
      }
    }, true);
  }
  ['fullscreenchange', 'webkitfullscreenchange'].forEach((type) => document.addEventListener(type, () => {
    const el = fsElement();
    if (el && el.tagName === 'VIDEO' && owns(el)) {
      exitFs();
      setTimeout(() => enterPfs(playerRoot()), 50);
    }
    touchIcons();
  }));

  // ---- overlay ----
  function buildTouch() {
    const t = document.createElement('div');
    t.id = 'fpns-touch';
    t.innerHTML = `
      <div class="fpns-t-layer">
        <div class="fpns-t-shade"></div>
        <div class="fpns-t-top">
          <button data-act="back" aria-label="Back">${ICON_BACK}</button>
          <span class="fpns-t-flex"></span>
          <button data-act="info" class="fpns-t-ver" aria-label="Version and diagnostics">v1.4.8</button>
          <button data-act="site" aria-label="Site controls">${ICON_MORE}</button>
          <button data-act="fs" aria-label="Full screen">${ICON_FS}</button>
        </div>
        <div class="fpns-t-mid">
          <button data-act="rw" aria-label="Back 10 seconds">${skipIcon(-1)}</button>
          <button data-act="play" class="fpns-t-play" aria-label="Play / pause">${ICON_BIG_PLAY}</button>
          <button data-act="fw" aria-label="Forward 10 seconds">${skipIcon(1)}</button>
        </div>
        <div class="fpns-t-bot"></div>
      </div>`;
    // Anything touched inside the overlay keeps it on screen, and never reaches the site's player.
    ['pointerdown', 'pointermove'].forEach((ev) => t.addEventListener(ev, (e) => { if (uiOn && e.pointerType !== 'mouse') setUi(true); }, true));
    ['click', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'touchstart', 'touchend', 'dblclick'].forEach((ev) =>
      t.addEventListener(ev, (e) => { if (e.target.closest('button, .fpns-t-bot')) e.stopPropagation(); }));
    // A finger on a button acts when it lifts, through a click of our own: the site may cancel the click Safari
    // would make from the touch. Safari's own click (if it still comes) is then ignored.
    const TAPPABLE = 'button, .fpns-scale, .fpns-elapsed';
    let pressed = null;
    t.addEventListener('pointerdown', (e) => {
      pressed = e.pointerType !== 'mouse' ? e.target.closest(TAPPABLE) : null;
    }, true);
    t.addEventListener('pointerup', (e) => {
      const el = pressed;
      pressed = null;
      if (!el || e.pointerType === 'mouse' || e.target.closest(TAPPABLE) !== el) return;
      nativeClickOff = Date.now() + 800;
      el.click();
    }, true);
    t.addEventListener('pointercancel', () => { pressed = null; }, true);

    t.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', (e) => {
      e.preventDefault();
      const v = TL.video();
      switch (b.dataset.act) {
        case 'play': if (v) { if (v.paused) v.play(); else v.pause(); } break;
        case 'rw': jump(-10); break;
        case 'fw': jump(10); break;
        case 'fs': toggleFs(); break;
        case 'site': {
          const on = document.documentElement.classList.toggle('fpns-siteui');
          toast(on ? 'Site controls' : 'Simple controls');
          if (on) wakeSite();
          break;
        }
        case 'back': if (isFs()) exitFs(); else history.back(); break;
        case 'info': toggleDiag(); break;
      }
      setUi(true);
    }));
    return t;
  }

  function wakeSite() {
    const h = TL.host();
    if (!h) return;
    const r = h.getBoundingClientRect();
    h.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
  }

  function touchIcons() {
    if (!touchEl) return;
    const v = TL.video();
    const play = touchEl.querySelector('[data-act="play"]');
    const paused = !v || v.paused;
    if (play.dataset.state !== String(paused)) {
      play.dataset.state = String(paused);
      play.innerHTML = paused ? ICON_BIG_PLAY : ICON_BIG_PAUSE;
    }
    const fs = touchEl.querySelector('[data-act="fs"]');
    const full = isFs();
    if (fs.dataset.state !== String(full)) {
      fs.dataset.state = String(full);
      fs.innerHTML = full ? ICON_FS_EXIT : ICON_FS;
    }
  }

  // Shows (or hides) the overlay; while the video plays it hides itself after a few seconds.
  function setUi(on) {
    uiOn = on;
    document.documentElement.classList.toggle('fpns-tui', on);
    clearTimeout(uiTimer);
    const v = TL.video();
    if (on && v && !v.paused) uiTimer = setTimeout(() => { if (!tp) setUi(false); }, UI_HIDE_MS);
    if (on && document.documentElement.classList.contains('fpns-siteui')) wakeSite();
  }

  let touchVideo = null;
  function touchUpdate() {
    const on = TOUCH() && TL.active();
    if (pfsOn) {
      if (!TL.host()) exitPfs();      // left the player
      else applyPfs();
    }
    if (!on) {
      if (touchOn()) document.documentElement.classList.remove('fpns-touch');
      return;
    }
    addTouchStyle();
    if (!document.documentElement.style.getPropertyValue('--fpns-zs')) applyView();
    if (IOS) document.querySelectorAll('meta[name="apple-itunes-app"]').forEach((m) => m.setAttribute('name', 'apple-itunes-app-off'));
    const h = playerRoot();
    if (!touchEl) touchEl = buildTouch();
    // Always the last child: the site's own layers may sit at the same (maximum) z-index, and the last one wins.
    if (touchEl.parentNode !== h || h.lastElementChild !== touchEl) {
      if (getComputedStyle(h).position === 'static') h.style.position = 'relative';
      h.appendChild(touchEl);
    }
    if (!h.hasAttribute('data-fpns-surface')) h.setAttribute('data-fpns-surface', '');
    if (!touchOn()) {
      document.documentElement.classList.add('fpns-touch');
      setUi(true);
      onRotate();
    }
    const v = TL.video();
    if (v && v !== touchVideo) {
      touchVideo = v;
      v.addEventListener('play', () => { touchIcons(); if (uiOn) setUi(true); });
      v.addEventListener('pause', () => { touchIcons(); setUi(true); });
    }
    touchIcons();
  }
  // Where the panel goes on a touch screen (null = in the site's controls, as with a mouse).
  function touchSlot() {
    touchUpdate();
    return touchOn() && touchEl ? touchEl.querySelector('.fpns-t-bot') : null;
  }
  if (navigator.maxTouchPoints > 0) setInterval(touchUpdate, 1000);

  // ---- gestures on the video ----
  let tp = null;            // finger down on the video: { id, x, y, moved, hold, timer }
  let tHold = null;         // { prevRate, wasPaused } while holding for 2x
  let lastTap = null;       // { t, zone }
  let streak = null;        // { dir, sum, t } double-tap jumps in a row
  let touchSwallow = 0;     // until then, the emulated mouse events / clicks of a touch don't reach the site

  const onTouchSurface = (e) => {
    if (!touchOn() || !(e.target instanceof Element)) return false;
    const h = TL.host();
    const r = playerRoot();
    if (!h || !r || !r.contains(e.target)) return false;
    if (e.target.closest('#fpns-touch button, #fpns-touch .fpns-t-bot')) return false;
    return !e.target.closest(document.documentElement.classList.contains('fpns-siteui') ? TL.excludeSite : TL.exclude);
  };
  const inOurUi = (el) => el instanceof Element && !!el.closest('#fpns-touch button, #fpns-touch .fpns-t-bot');
  const swallowEvent = (e) => {
    e.stopImmediatePropagation();
    if (e.cancelable) e.preventDefault();
  };

  function touchHoldStart() {
    const v = TL.video();
    if (!v) return;
    tHold = { prevRate: v.playbackRate, wasPaused: v.paused };
    v.playbackRate = 2;
    if (v.paused) v.play();
    speedBadge(true);
  }
  function touchHoldEnd() {
    if (!tHold) return;
    const v = TL.video();
    if (v) {
      v.playbackRate = tHold.prevRate || 1;
      if (tHold.wasPaused) v.pause();
    }
    tHold = null;
    speedBadge(false);
  }

  function onTap(x) {
    const h = TL.host();
    const r = h.getBoundingClientRect();
    const f = (x - r.left) / r.width;
    const zone = f < TAP_ZONE ? -1 : f > 1 - TAP_ZONE ? 1 : 0;
    const now = Date.now();
    const add = () => {
      streak.sum += 10;
      streak.t = now;
      if (video) seekTo(video.currentTime + zone * 10);
      toast((zone < 0 ? '−' : '+') + streak.sum + ' s');
    };
    if (zone && streak && streak.dir === zone && now - streak.t < STREAK_MS) return add();
    if (zone && lastTap && lastTap.zone === zone && now - lastTap.t < DOUBLE_TAP_MS) {
      setUi(false);            // like YouTube: no controls while jumping, so more taps don't land on buttons
      lastTap = null;
      streak = { dir: zone, sum: 0, t: now };
      return add();
    }
    streak = null;
    lastTap = { t: now, zone };
    setUi(!uiOn);
  }

  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' || !onTouchSurface(e)) return;
    swallowEvent(e);
    touchSwallow = Date.now() + 1000;
    if (tp) return;
    tp = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, hold: false };
    tp.timer = setTimeout(() => {
      if (tp && !tp.moved) { tp.hold = true; touchHoldStart(); }
    }, HOLD_MS + 100);
  }, true);
  window.addEventListener('pointermove', (e) => {
    if (!tp || e.pointerId !== tp.id) return;
    swallowEvent(e);
    if (Math.abs(e.clientX - tp.x) + Math.abs(e.clientY - tp.y) > 14) {
      tp.moved = true;
      clearTimeout(tp.timer);
    }
  }, true);
  const fingerUp = (e, cancel) => {
    if (!tp || e.pointerId !== tp.id) return;
    swallowEvent(e);
    touchSwallow = Date.now() + 700;
    clearTimeout(tp.timer);
    const t = tp;
    tp = null;
    if (t.hold) { touchHoldEnd(); setUi(uiOn); return; }
    if (!cancel && !t.moved) onTap(e.clientX);
  };
  window.addEventListener('pointerup', (e) => fingerUp(e, false), true);
  window.addEventListener('pointercancel', (e) => fingerUp(e, true), true);
  // Two fingers on the video (full screen): pinch = zoom (centred). Pinching below the original size puts it back.
  let pinch = null;
  const fingerGap = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  window.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 2 || !touchOn() || !isFs() || inOurUi(e.target)) return;
    const r = playerRoot();
    if (!r || !r.contains(e.target)) return;
    if (e.cancelable) e.preventDefault();            // no page scroll / zoom with two fingers
    pinch = { gap: fingerGap(e.touches) || 1, s: view.s, small: false };
    if (tp) { clearTimeout(tp.timer); tp.moved = true; }
  }, { capture: true, passive: false });
  window.addEventListener('touchmove', (e) => {
    if (!pinch || e.touches.length !== 2) return;
    if (e.cancelable) e.preventDefault();
    const s = pinch.s * fingerGap(e.touches) / pinch.gap;
    pinch.small = s < 0.92;
    view.s = clamp(s, 1, 4);
    applyView();
  }, { capture: true, passive: false });
  ['touchend', 'touchcancel'].forEach((type) => window.addEventListener(type, (e) => {
    if (!pinch || e.touches.length >= 2) return;
    if (pinch.small) {
      view = { s: 1, x: 0, y: 0 };
      applyView();
      toast('Original view');
    }
    pinch = null;
    lsSet('fpns:view', view);
  }, { capture: true }));

  // Outside full screen the page can still be scrolled with a finger on the video (touch-action: pan-y);
  // ending the touch is cancelled, so Safari doesn't turn it into a click for the site.
  ['touchstart', 'touchmove', 'touchend', 'touchcancel'].forEach((type) => window.addEventListener(type, (e) => {
    const r = playerRoot();
    if (inOurUi(e.target)) return;
    if (!(onTouchSurface(e) || (type !== 'touchstart' && (tp || Date.now() < touchSwallow) && r && r.contains(e.target)))) return;
    e.stopImmediatePropagation();
    if (e.cancelable && type === 'touchend') e.preventDefault();
  }, { capture: true, passive: false }));
  ['mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu'].forEach((type) => window.addEventListener(type, (e) => {
    if (Date.now() < touchSwallow && onTouchSurface(e)) swallowEvent(e);
  }, true));

  // ---- the OS "Now Playing" controls (lock screen, Control Center) ----
  // They would show the real length, so they are told every video is 10 hours long.
  const FAKE_DURATION = 10 * 3600;
  let lastFake = 0;
  function fakePosition(force) {
    if (!origSetPositionState || !video || !TL.active()) return;
    const now = Date.now();
    if (!force && now - lastFake < 5000) return;
    lastFake = now;
    try {
      origSetPositionState({ duration: FAKE_DURATION, position: Math.min(FAKE_DURATION, Math.max(0, video.currentTime || 0)),
        playbackRate: video.playbackRate || 1 });
    } catch {}
  }
  const watchVideo = (v) => {
    prepVideo(v);
    if (v.dataset.fpnsFake) return;
    v.dataset.fpnsFake = '1';
    v.addEventListener('timeupdate', () => { if (v === video) fakePosition(false); });
    ['play', 'pause', 'seeked', 'ratechange', 'loadedmetadata'].forEach((ev) => v.addEventListener(ev, () => { if (v === video) fakePosition(true); }));
  };

  // ---------- Start ----------
  const start = () => {
    scrubText(document.body);
    attach();
    new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === 'characterData') {
          const el = m.target.parentElement;
          if (el && TIME_RE.test(m.target.nodeValue) && !el.closest('#fpns-panel, .fpns-toast')) el.classList.add('fpns-hidden-time');
        } else {
          m.addedNodes.forEach((n) => {
            if (n.nodeType === 1) scrubText(n);
            else if (n.nodeType === 3 && TIME_RE.test(n.nodeValue) && n.parentElement && !n.parentElement.closest('#fpns-panel, .fpns-toast')) n.parentElement.classList.add('fpns-hidden-time');
          });
        }
      }
      attach();
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  };
  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });
})();
