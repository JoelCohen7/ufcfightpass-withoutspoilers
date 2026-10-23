// ==UserScript==
// @name         UFC Fight Pass Without Spoilers
// @namespace    joel.fightpass.nospoilers
// @version      1.2.0
// @description  Hides the duration and time remaining on UFC Fight Pass. Adds ±10 s / 30 s / 1 min / 5 min jumps and a fixed-scale seek bar with thumbnails.
// @match        https://www.ufcfightpass.com/*
// @match        https://ufcfightpass.com/*
// @homepageURL  https://github.com/JoelCohen7/ufcfightpass-withoutspoilers
// @updateURL    https://raw.githubusercontent.com/JoelCohen7/ufcfightpass-withoutspoilers/main/ufcfightpass-withoutspoilers.user.js
// @downloadURL  https://raw.githubusercontent.com/JoelCohen7/ufcfightpass-withoutspoilers/main/ufcfightpass-withoutspoilers.user.js
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
  `;
  const addStyle = () => {
    if (document.getElementById('fpns-style')) return;
    const s = document.createElement('style');
    s.id = 'fpns-style';
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
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
  try {
    if (navigator.mediaSession && navigator.mediaSession.setPositionState) {
      navigator.mediaSession.setPositionState = function () {};
    }
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

  function toast(text) {
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
    toastTimer = setTimeout(() => el.classList.remove('on'), 650);
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
    // Finger (iPhone/iPad, TV): dragging only previews; releasing jumps there.
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
    tip.style.left = Math.min(1, Math.max(0, t / windowSec - curPage())) * 100 + '%';
    tip.style.display = 'block';
  }
  function hideTip() {
    if (panel) panel.querySelector('.fpns-tip').style.display = 'none';
  }

  // ---------- Preview mode (for a remote control): move the thumbnail, then confirm ----------
  let previewT = null;
  function previewMove(sec) {
    if (!video) return;
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
    return true;
  }
  function previewCancel() {
    if (previewT === null) return false;
    previewT = null;
    hideTip();
    manualPage = null;
    render();
    return true;
  }

  // Shows the player controls as if the mouse had moved.
  function wake() {
    const host = document.querySelector('.dice-player-background');
    if (!host) return;
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
        try { video.disablePictureInPicture = true; } catch {}
        ['timeupdate', 'seeked', 'loadedmetadata', 'emptied'].forEach((ev) => video.addEventListener(ev, render));
      }
    }
    const control = document.querySelector('.dice-player-control');
    if (control && (!panel || !control.contains(panel))) {
      panel = panel || buildPanel();
      control.insertBefore(panel, control.firstChild);
      render();
    }
  }

  // For the TV app (or any other controller): window.fpnsApi
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
