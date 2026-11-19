# Fecha Estelar · design contract

Scope: the home page (`templates/index.json`, layout `fe-cosmos`) and everything prefixed `fe-`.
Product, cart and other templates still use the base theme (Horizon) layout.

## World
Luxury, mystery, emotion. A night sky made exact. Dark by use scene: the product is a night.

## Tokens (assets/fe.css :root)
- Black space `#05070D` (page), night blue `#0B1426` (alternate sections, lámina), gold `#D4AF63` (accents, CTAs, constellation lines), ivory `#F3EBD8` (text).
- Secondary text: ivory at 74% / 50%. Hairlines: gold at 28%.
- Type: Bodoni Moda (display, names, prices) + Manrope (body, labels). Fonts come from the theme's
  heading/body font settings (Shopify font library).
- Display ≤ 6rem except the "El instante" date (brief: giant editorial date). Labels: 0.72rem, 0.2em tracking, uppercase.
- Buttons: pill, gold fill, black text, 56px min height. Ghost variant for the header.
- Motion: `--fe-ease` cubic-bezier(.23,1,.32,1), `--fe-ease-io` cubic-bezier(.77,0,.175,1). Hover only on fine pointers.
  Reduced motion → static first screen with the lámina, no pinning, no marquee.

## Structure
- `fe-journey`: scroll film. Image sequence (Files: fe-seq-m.bin / fe-seq-d.bin, progressive packs) for scenes 1–4,
  WebGL (three.js, lazy) for the real sky, constellations and particle morph into the lámina.
- `fe-creator`: live mock of the personaliser. Add the Customall app block here; it replaces the mock.
- Price + free shipping always visible: header pill (desktop) and buy bar (mobile).

## Rules
No invented reviews, client counts, press logos or discounts. Placeholders in brackets: [RAZÓN SOCIAL], [NIF],
[FECHA LÍMITE NAVIDAD], [PLAZO DE ENTREGA], [EMAIL DE CONTACTO], [POLÍTICA DE REPOSICIÓN].
