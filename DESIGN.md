# Fecha Estelar · Design system — «El túnel de estrellas»

Scope: Shopify home (`theme/templates/index.json`, layout `fe-cosmos`, `fe-*` sections) and the cart upsell. Product and cart pages keep the Horizon layout.

## World
One continuous cinematic shot driven by the scroll: a gold point → a nebula tunnel → the sun → Earth at night (Spain) → the real sky of one night → the lámina floating in 3D. Near-monochrome deep space; gold exists only as light. Technique borrowed (not content) from motionsites «Frozen Cave»: full-bleed tunnel push-in, two-line headline bottom-left that changes per stretch, frosted panels at stops, pill nav in a glass capsule, one small pale-blue button.

## Tokens (theme/assets/fe.css :root)
| Token | Value | Role |
|---|---|---|
| --ink | #05070D | page, film ground |
| --night | #0B1426 | lámina ground, section glow |
| --gold | #D4AF63 | light only: sun, city lights, constellation lines, format tags, selected state |
| --ivory | #F3EBD8 | text |
| --ivory-2 / -3 | 74 % / 56 % ivory | secondary text (≥ 4.5:1 on ink) |
| --glass | rgba(255,255,255,.06) + blur(18px) saturate(140%) + 1px rgba(255,255,255,.12) | panels, pills, cards, inputs |
| --blue | #A9C2EE (header setting) | the single CTA fill; text --on-blue #05070D |

## Type
- Inter Tight (variable, self-hosted via jsDelivr) — line 1 of every headline at weight 300, tracking −0.035em; UI at 400/500.
- Instrument Serif italic — line 2 of every headline, 1.06em, tracking −0.01em; prices; logo «Fecha».
- Headline scale: `.hl` clamp(2.45rem, 6.2vw, 6rem)/0.98; `.hl--md` clamp(2.2rem, 4.6vw, 4.4rem). Body 1rem/1.55; labels 0.86rem.

## Shape and depth
Pills 999px (buttons, nav, tags, segmented control). Glass radius: panels 18px, inputs 14px, format cards 22px, moment cards 26px, creator stage 28px. Shadows always offset + soft (`0 40px 70px -30px`).

## Motion (Emil Kowalski rules)
- Curves: `--ease-out` cubic-bezier(.23,1,.32,1), `--ease-in-out` (.77,0,.175,1).
- Headline per stretch: enter 900ms ease-out with blur 12px→0 and 0.18em rise, second line +90ms; exit 360ms (faster than enter).
- Panels: 700ms in, scale .97→1; out 300ms.
- Buttons: press scale .97 in 160ms; hover colour 200ms; arrow nudges 3px; hover gated to fine pointers.
- Format cards lift 2px on hover; selected = gold border + 7 % gold tint + dot.
- Moments lean toward the pointer with a spring (k 170, d 18), fine pointers only.
- Final lámina: drag-to-turn spring (k 120, d 14), idle sway ±3°, sheen follows rotation.
- Reduced motion: still frame of stretch 5 + its text; everything visible, no blur/rise.

## Film
- Desktop: live Three.js (`src/scene/tunnel.js`), camera on a CatmullRom path, lerped scroll; falls back to frames if the GPU averages > 28 ms/frame. `?fe=live` / `?fe=film` force a mode.
- Mobile: 180 frames 1080×1920 WebP in a progressive pack (`fe-seq-m.bin`), desktop fallback 150 frames 1600×900 (`fe-seq-d.bin`).
- Lámina layout shared by scene, frames and DOM: mobile h .50 · cy .42 · cx .50; desktop h .62 · cy .47 · cx .64 (fractions of the viewport).

## Content rules
No invented proof. Placeholders stay: [RAZÓN SOCIAL], [NIF], [EMAIL DE CONTACTO], [FECHA LÍMITE NAVIDAD].
