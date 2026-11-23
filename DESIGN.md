---
name: Fecha Estelar
description: El cielo real de vuestra noche, en una lámina.
colors:
  space-black: "#05070D"
  warm-night: "#15110A"
  starlight-gold: "#D4AF63"
  ivory: "#F3EBD8"
  ivory-soft: "rgba(243, 235, 216, 0.74)"
  ivory-faint: "rgba(243, 235, 216, 0.56)"
  hairline: "rgba(243, 235, 216, 0.12)"
  glass: "rgba(255, 255, 255, 0.06)"
  glass-edge: "rgba(255, 255, 255, 0.12)"
  button-gold: "#D4AF63"
  button-gold-hover: "color-mix(in oklab, #D4AF63 84%, #fff)"
typography:
  display:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "clamp(2.45rem, 6.2vw, 6rem)"
    fontWeight: 300
    lineHeight: 0.98
    letterSpacing: "-0.035em"
  display-italic:
    fontFamily: "Instrument Serif, Georgia, serif"
    fontSize: "1.06em"
    fontWeight: 400
    lineHeight: 0.92
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "clamp(2.2rem, 4.6vw, 4.4rem)"
    fontWeight: 300
    lineHeight: 0.98
    letterSpacing: "-0.035em"
  price:
    fontFamily: "Instrument Serif, Georgia, serif"
    fontSize: "2.6rem"
    fontWeight: 400
    lineHeight: 1
  body:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.86rem"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  pill: "999px"
  input: "14px"
  panel: "18px"
  card: "22px"
  moment: "26px"
  stage: "28px"
spacing:
  gutter: "clamp(20px, 4.2vw, 64px)"
  section: "clamp(96px, 14vh, 160px)"
  stack: "18px"
components:
  button-primary:
    backgroundColor: "{colors.button-gold}"
    textColor: "{colors.space-black}"
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.button-gold-hover}"
  button-primary-lg:
    backgroundColor: "{colors.button-gold}"
    textColor: "{colors.space-black}"
    rounded: "{rounded.pill}"
    padding: "0 30px"
    height: "56px"
  glass-panel:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.ivory}"
    rounded: "{rounded.panel}"
    padding: "16px 20px 18px"
  format-card:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.ivory}"
    rounded: "{rounded.card}"
    padding: "22px"
  input:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.ivory}"
    rounded: "{rounded.input}"
    padding: "0 18px"
    height: "54px"
  nav-pill-active:
    backgroundColor: "{colors.ivory}"
    textColor: "{colors.space-black}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "36px"
---

# Design System: Fecha Estelar

## Overview

**Creative North Star: "La noche exacta"**

Una sola toma de cine que el visitante conduce con el scroll y que acaba convertida en un objeto que se cuelga en la pared. El espacio es casi negro y casi monocromo; el oro no es decoración sino luz (el Sol, las ciudades, las líneas de las constelaciones). La precisión es la de un cartógrafo —cada estrella está calculada para una fecha, una hora y una ciudad— y la emoción, la de una película.

Densidad baja, mucho aire, tipografía grande abajo a la izquierda y cristal esmerilado solo donde hay información que leer sobre la imagen. La técnica de la toma continua viene de la plantilla «Frozen Cave» de motionsites (empuje de cámara hacia un túnel, titular por tramos, paneles de cristal, píldoras); el contenido y el mundo son propios.

**Key Characteristics:**
- Fondo espacial #05070D y noche cálida #15110A; marfil para el texto. Ningún azul en la interfaz.
- Oro #D4AF63 como luz, como estado y como el único botón.
- Titulares en dos líneas: sans fina + serif cursiva.
- Cristal (6 % blanco, blur 18px, borde 12 %) para paneles, píldoras, tarjetas e inputs.
- Un único botón: píldora dorada #D4AF63 con texto #05070D y brillo dorado suave al pulsar.

## Colors

Casi monocromo nocturno, con una luz cálida y un acento frío reservado a la acción.

### Primary
- **Oro de acción** (#D4AF63): el único color de los botones de compra y avance (editable en la cabecera); hover un 16 % más claro; al pulsar, escala .97 y un halo dorado. Texto siempre #05070D (contraste 9,6:1). Foco: anillo marfil.

### Secondary
- **Oro de luz estelar** (#D4AF63): luz en la película, líneas de constelaciones, estrella del logo, etiquetas de formato, estado seleccionado de un formato, iconos de datos.

### Neutral
- **Negro espacial** (#05070D): fondo de página y de la película.
- **Noche cálida** (#15110A): fondos de tarjetas y brillo radial de las secciones. (El azul noche queda solo dentro de la lámina, que es el producto.)
- **Marfil** (#F3EBD8): texto principal; 74 % para secundario, 56 % para notas (ambos ≥ 4.5:1 sobre el negro).
- **Línea fina** (marfil 12 %): separadores y bordes de FAQ.

### Named Rules
**The Gold Is Light Rule.** El oro nunca rellena una superficie grande: aparece como luz, como estado y en el botón de acción.
**The One Button Rule.** Solo existe un estilo de botón de acción (dorado). Todo lo demás son píldoras de cristal o enlaces subrayados.

## Typography

**Display Font:** Geist 300 (con system-ui)
**Italic Display:** Instrument Serif cursiva (con Georgia)
**Body Font:** Geist

**Character:** Una sans fina y técnica que mide, y una serif cursiva que emociona; siempre juntas en dos líneas cortas.

### Hierarchy
- **Display** (300, clamp(2.45rem, 6.2vw, 6rem), 0.98): titular de cada tramo del viaje y del cierre. Segunda línea en Instrument Serif cursiva al 1.06em.
- **Headline** (300, clamp(2.2rem, 4.6vw, 4.4rem), 0.98): titular de cada sección, mismo emparejamiento.
- **Price** (Instrument Serif cursiva 400, 2.6rem): precios de formato y total.
- **Body** (400, 1rem, 1.55): textos, máximo 40ch en entradillas.
- **Label** (400, 0.86rem): etiquetas de campos, notas, datos.

### Named Rules
**The Two Lines Rule.** Todo titular son dos líneas cortas: la primera sans 300, la segunda serif cursiva. Nunca una sola línea ni tres.

## Layout

Cuadrícula de una columna con márgenes laterales iguales (`clamp(20px, 4.2vw, 64px)`, máximo 1400px). El viaje es un escenario fijo de 100svh dentro de una sección de 820svh (720svh en móvil). En escritorio cada sección ocupa al menos una pantalla y se centra en vertical; en móvil crece con su contenido. El texto principal vive abajo a la izquierda; las acciones, abajo a la derecha en escritorio y en la barra fija inferior en móvil.

## Elevation & Depth

Profundidad por atmósfera y por cristal, no por capas de sombras. Las únicas sombras son de objeto (la lámina y las tarjetas de momento), siempre desplazadas y difusas. La profundidad 3D real la dan la película y la inclinación de tarjetas y lámina.

### Shadow Vocabulary
- **Lámina** (`box-shadow: 0 40px 70px -30px rgba(0,0,0,.95), 0 12px 24px -12px rgba(0,0,0,.7)`): la lámina final y la del creador.
- **Mini lámina** (`box-shadow: 0 30px 50px -24px rgba(0,0,0,.9)`): láminas de ejemplo en los momentos.

## Shapes

Píldoras para todo lo que se pulsa (botones, menú, etiquetas, selector de estilo). Rectángulos redondeados escalonados para el cristal: inputs 14px, paneles 18px, formatos 22px, momentos 26px, escenario del creador 28px. La lámina es un rectángulo 3:4 sin redondeo, como el papel.

## Components

### Buttons
- **Shape:** píldora (999px).
- **Primary:** fondo #D4AF63, texto #05070D, 48px de alto (56px en la versión grande), flecha que avanza 3px en hover.
- **Hover / Focus / Press:** oro un 16 % más claro en 200ms; foco con anillo marfil de 2px separado 4px; pulsación scale(.97) con halo dorado en 160–240ms.

### Chips (format tags)
- **Style:** contorno oro al 55 %, texto oro, 0.76rem.
- **State:** solo informativos («Lista para regalar», «La más elegida»).

### Cards / Containers
- **Corner Style:** 22px (formatos), 26px (momentos).
- **Background:** cristal 6 % con blur 18px.
- **Shadow Strategy:** ninguna en reposo; los momentos se inclinan en 3D.
- **Border:** 1px blanco al 12 %; seleccionado: oro al 70 % + fondo oro 7 %.
- **Internal Padding:** 22px.

### Inputs / Fields
- **Style:** cristal 6 %, borde 12 %, 54px, radio 14px.
- **Focus:** borde oro al 75 % y fondo 9 %. Fecha DD/MM/AAAA y hora 24 h escritas a mano (máscara), nunca el selector del navegador.

### Navigation
- Logo «*Fecha* Estelar» a la izquierda; a la derecha una cápsula de cristal con píldoras (activa: fondo marfil, texto negro), precio «Desde 4,95 €» y el botón azul. En móvil: logo + cesta arriba y barra de compra fija abajo.

### Signature: el túnel y la lámina
Una estrella dorada y cristalina en 3D (Three.js, material físico y bloom) que gira despacio y sigue el dedo o el giroscopio; al bajar se convierte en el Sol y la película (88 fotogramas en móvil) recorre la Tierra y el cielo en dos pantallas, con cuatro paradas con titular por tramos, paneles de cristal en las paradas y una lámina final que gira con el dedo con un muelle.

## Do's and Don'ts

### Do:
- **Do** escribir cada titular en dos líneas (sans 300 + serif cursiva).
- **Do** usar el oro solo como luz o estado.
- **Do** mantener precio y envío gratis visibles (cabecera en escritorio, barra fija en móvil).
- **Do** calcular cada lámina de ejemplo con una fecha y una ciudad reales.

### Don't:
- **Don't** añadir un segundo estilo de botón ni usar azul en la interfaz.
- **Don't** usar reseñas, contadores o cifras inventadas.
- **Don't** poner una etiqueta pequeña encima de un titular.
- **Don't** animar con `ease-in` ni por encima de 300ms en interfaz (los titulares de la película son la excepción narrativa).
