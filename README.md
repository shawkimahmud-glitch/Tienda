# Fecha Estelar · "El viaje cósmico"

Portada de la tienda Shopify **Fecha Estelar** (tema borrador *Fecha Estelar · Viaje Cósmico (borrador)*, sin publicar).

## Estructura
- `theme/` — archivos que viven en el tema de Shopify (layout `fe-cosmos`, secciones `fe-*`, assets, `templates/index.json`, `DESIGN.md`).
- `theme/media/fe-seq-m.bin`, `fe-seq-d.bin` — película pre-renderizada (móvil 720×1280, 120 fotogramas · escritorio 1600×900, 150), en paquete progresivo. **Hay que subirlos a Shopify › Contenido › Archivos** con ese nombre exacto.
- `src/` — código fuente JS (cálculo astronómico real, image-sequence scrubbing, WebGL de partículas). `node tools/build.mjs` lo compila a `theme/assets`.
- `film/` — la escena Three.js que se renderiza a fotogramas (`node tools/render-film.mjs …` + `node tools/pack.mjs …`).
- `tools/` — build, vista previa local con el Liquid real (`node tools/preview.mjs`, `node tools/serve.mjs` → http://localhost:4173/dist/), capturas Playwright (`tools/shots.mjs`) y medición de rendimiento (`tools/perf.mjs`).
- `.claude/skills/` — skills de diseño usadas: Impeccable, Emil Kowalski (animate, apple-design, gestures, improve-animations) y Taste (sin sus assets pesados).

## Créditos de datos
Estrellas y constelaciones: d3-celestial (BSD-3, © Olaf Frohn; Hipparcos / Yale BSC). Ciudades y luces de la Tierra: GeoNames vía `cities.json` (CC BY 4.0). Costas: Natural Earth vía `world-atlas` (dominio público).
