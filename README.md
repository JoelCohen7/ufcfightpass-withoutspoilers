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
- **iPhone and iPad**: its own touch controls (tap, double tap to jump, hold for 2x, a full screen that never
  uses Apple's player). See below.
- **YouTube-style clicks**: a short click on the video (or Space / K) plays or pauses with a brief icon in the middle,
  without bringing up the controls or the bar (moving the mouse does). Holding the click (or Space / K) plays at 2x
  until you let go.
- **Keyboard**: ←/→ 10 s · Shift 30 s · Ctrl 1 min · Ctrl+Shift 5 min · `T` shows/hides the elapsed time.
- Hides the "Mini player" button and doesn't pass the duration to the OS media controls (Media Session).

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/) (or Violentmonkey) in Firefox, LibreWolf, Chrome or Edge.
2. Open **[ufcfightpass-withoutspoilers.user.js](https://raw.githubusercontent.com/JoelCohen7/ufcfightpass-withoutspoilers/ios/ufcfightpass-withoutspoilers.user.js)**
   and click **Install**. Tampermonkey checks that same link for updates.

LibreWolf needs DRM enabled (Settings → General → "Play DRM-controlled content"), even though the archive videos tested
don't use it.

`serve.py` serves this folder on `http://127.0.0.1:8765` with `charset=utf-8`, to install the script from a local copy.

## iPhone and iPad

Use **Safari** with the free **[Userscripts](https://apps.apple.com/app/userscripts/id1463298887)** app (open source,
by quoid). iOS 15.1 or later.

1. Install Userscripts from the App Store and open it once (it picks a folder for the scripts on its own).
2. Settings → Apps → Safari → Extensions → **Userscripts**: turn it on and set **All Websites → Allow**.
3. In Safari open **[ufcfightpass-withoutspoilers.user.js](https://raw.githubusercontent.com/JoelCohen7/ufcfightpass-withoutspoilers/ios/ufcfightpass-withoutspoilers.user.js)**, tap the **puzzle piece / AA** button in the address bar → **Userscripts** →
   **Tap to install** → **Install**.
4. Open [ufcfightpass.com](https://www.ufcfightpass.com), sign in and play a video.

Userscripts checks the same link for updates (open its popup → **Check for updates**).

On a touch screen the player gets its own controls instead of the site's:

- **Tap** shows/hides them. While the video plays they hide by themselves after a few seconds.
- **Double tap** the left or right third: −10 s / +10 s. Keep tapping to add 10 s more each time (−20 s, −30 s…).
- **Hold** a finger on the video: 2x until you let go.
- **The bar**: drag your finger to see the thumbnail and the time; let go to jump there.
- **⛶** fills the screen. On iPhone, turning it sideways does that too (and upright again goes back). It is a full
  screen inside Safari, never Apple's own video player, which would show the duration. On iPhone Safari only hides its
  bars when the page scrolls, so **swipe up on the video** once to hide them (a hint says so while they show).
- **Two fingers** (full screen): pinch to zoom, drag to move the picture anywhere. Pinch below the original size to put
  it back as it was. The zoom and position are remembered.
- **⋯** brings back the site's own controls (settings, audio, etc.), still without any times. Tap it again to go back.
- **‹** goes back.
- On iPhone held upright only the bar and the time are shown; the jump buttons show up in full screen.

Safari's own full-screen player, Picture in Picture and AirPlay are blocked, because they show the duration. Safari's
"Open in the app" banner is not shown either. The lock
screen / Control Center "Now Playing" widget is told every video is 10 hours long, so its bar means nothing.

On an iPad with a keyboard the keyboard shortcuts work too; with a trackpad it behaves like a computer.

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

The iPhone/iPad controls were tested in WebKit (Safari's engine) emulating an iPhone 14 and an iPad Pro 11, on pages
that copy the player's structure; not yet on a real device.
