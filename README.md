# UFC Fight Pass Without Spoilers

A userscript for [UFC Fight Pass](https://www.ufcfightpass.com) that never shows how long a video is or how much is left,
so you can watch old fights and events without knowing whether they ended in a finish or went to the judges.

## What it does

- **Hides the duration everywhere**: the player's total and remaining time, the original seek bar, card durations in the
  catalog, in search ("2h 56m") and in the "Up next" panel, the red "watched" progress bar and the Information panel.
- **Jump buttons**: −5 min, −1 min, −30 s, −10 s, +10 s, +30 s, +1 min, +5 min.
- **Fixed-scale seek bar** (90 min by default; click the scale label to pick 15/30/60/90 min). Its length doesn't depend
  on the video, so it reveals nothing. Past 1:30:00 it moves to the next window on its own; ‹ › look at the previous or
  next window.
- **Thumbnails on hover**, read from the same `.bif` file Fight Pass uses.
  Note: hovering past the end shows "no preview", which tells you the video is over by then.
- **Touch-friendly bar**: on iPhone/iPad dragging previews the thumbnail and releasing jumps there.
- **Keyboard**: ←/→ 10 s · Shift 30 s · Ctrl 1 min · Ctrl+Shift 5 min · `T` shows/hides the elapsed time.
- Hides the "Mini player" button and doesn't pass the duration to the OS media controls (Media Session).

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/) (or Violentmonkey) in Firefox, LibreWolf, Chrome or Edge.
2. Open **[ufcfightpass-withoutspoilers.user.js](https://raw.githubusercontent.com/JoelCohen7/ufcfightpass-withoutspoilers/main/ufcfightpass-withoutspoilers.user.js)**
   and click **Install**. Tampermonkey checks that same link for updates.

LibreWolf needs DRM enabled (Settings → General → "Play DRM-controlled content"), even though the archive videos tested
don't use it.

`serve.py` serves this folder on `http://127.0.0.1:8765` with `charset=utf-8`, to install the script from a local copy.

## API

The script exposes `window.fpnsApi`: `isPlayer()`, `isPaused()`, `jump(sec)`, `togglePlay()`,
`previewMove(sec)` / `previewCommit()` / `previewCancel()` / `inPreview()` (move a thumbnail along the bar and confirm),
`toggleElapsed()` and `wake()` (shows the player controls).

## Don't use

- The browser's Picture-in-Picture: that window has its own seek bar with the time.
- Chromecast/AirPlay: the TV's player shows the duration.

## Tested

LibreWolf 158 on Windows 11 and LibreWolf 156 on Steam Deck, with event replays of UFC 22 (1999), UFC 199 (2016)
and UFC 239 (2019).
