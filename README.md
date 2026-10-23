# Fight Pass sin spoilers

Userscript para [UFC Fight Pass](https://www.ufcfightpass.com) que nunca muestra cuánto dura un video ni cuánto falta,
para ver peleas y eventos viejos sin saber si terminaron por finish o por decisión.

## Qué hace

- **Oculta la duración** en todos lados: tiempo total y restante del reproductor, barra de progreso original,
  duración de las tarjetas del catálogo, de la búsqueda ("2h 56m") y del panel "Up next", barrita roja de "ya visto"
  y panel de Información.
- **Botones de salto**: −5 min, −1 min, −30 s, −10 s, +10 s, +30 s, +1 min, +5 min.
- **Barra de escala fija** (90 min por defecto; click en la escala para elegir 15/30/60/90 min). Como el largo de la
  barra no depende del video, no revela nada. Al pasar 1:30:00 pasa sola a la ventana siguiente; con ‹ › se puede mirar
  la anterior o la siguiente.
- **Barra táctil**: en iPhone/iPad (o con el control de la tele) arrastrar muestra la miniatura y al soltar salta ahí.
- **Miniaturas al pasar el mouse** sobre la barra, leídas del mismo archivo `.bif` que usa Fight Pass.
  Ojo: si el mouse está más allá del final aparece "sin imagen", y eso indica que el video ya terminó.
- **Teclado**: ←/→ 10 s · Shift 30 s · Ctrl 1 min · Ctrl+Shift 5 min · `T` muestra/oculta el tiempo transcurrido.
- Esconde el botón de "Mini player" y no le pasa la duración al sistema (Media Session).

## Instalación

1. Instalar [Tampermonkey](https://www.tampermonkey.net/) (o Violentmonkey) en Firefox, LibreWolf, Chrome o Edge.
2. Abrir **[https://raw.githubusercontent.com/JoelCohen7/ufcfightpass-withoutspoilers/main/fightpass-sin-spoilers.user.js](https://raw.githubusercontent.com/JoelCohen7/ufcfightpass-withoutspoilers/main/fightpass-sin-spoilers.user.js)** y tocar **Install**.
   Tampermonkey revisa ese mismo link para actualizarse solo.

En LibreWolf hay que tener activado el DRM (Ajustes → General → "Reproducir contenido controlado por DRM"),
aunque los videos de archivo probados no lo usan.

`serve.py` sirve la carpeta en `http://127.0.0.1:8765` con `charset=utf-8`, para instalar el script desde una copia local.

## Para otras apps (la de la tele)

El script expone `window.fpnsApi`: `isPlayer()`, `isPaused()`, `jump(seg)`, `togglePlay()`,
`previewMove(seg)` / `previewCommit()` / `previewCancel()` / `inPreview()` (mover una miniatura por la barra y confirmar),
`toggleElapsed()` y `wake()` (muestra los controles).

## No usar

- El Picture-in-Picture del navegador: esa ventana tiene su propia barra con el tiempo.
- Chromecast/AirPlay: el reproductor de la tele muestra la duración.

## Probado

LibreWolf 158 en Windows 11 y LibreWolf 156 en Steam Deck, con event replays de UFC 22 (1999), UFC 199 (2016) y UFC 239 (2019).
