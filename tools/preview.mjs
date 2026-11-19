// Renders the theme's index (custom layout + sections) to dist/index.html with liquidjs and
// Shopify-like stubs, so the real Liquid can be tested in Playwright without a store.
import { Liquid, Tag } from 'liquidjs';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const T = 'theme';
const engine = new Liquid({ root: [`${T}/snippets`], extname: '.liquid', strictFilters: false, jsTruthy: false });
const money = (c) => (c / 100).toFixed(2).replace('.', ',') + ' €';
const stub = { asset_url: (x) => `/theme/assets/${x}`, file_url: (x) => `/theme/media/${x}`, stylesheet_tag: (u) => `<link rel="stylesheet" href="${u}">`, money, json: (v) => JSON.stringify(v ?? null), font_modify: () => null, font_face: () => '', font_url: () => '', image_url: (x) => x, image_tag: () => '', t: (x) => x };
for (const [k, f] of Object.entries(stub)) engine.registerFilter(k, f);
const stripSchema = (src) => src.replace(/{%-?\s*schema\s*-?%}[\s\S]*?{%-?\s*endschema\s*-?%}/, '');
const schemaOf = (src) => JSON.parse((src.match(/{%-?\s*schema\s*-?%}([\s\S]*?){%-?\s*endschema\s*-?%}/) || [, '{}'])[1]);
const ctxBase = { shop: { name: 'Fecha Estelar', policies: [{ title: 'Política de privacidad', url: '#' }, { title: 'Política de envíos', url: '#' }, { title: 'Términos del servicio', url: '#' }] }, routes: { root_url: '/', cart_url: '/cart' }, cart: { item_count: 0 }, request: { locale: { iso_code: 'es' } }, settings: {}, all_products: {}, page_title: 'Fecha Estelar · El cielo de vuestra noche, en una lámina', page_description: 'Láminas con el mapa de estrellas real de vuestra fecha y vuestro lugar. Desde 39,95 €. Envío gratis a toda España.', canonical_url: 'http://localhost:4173/', content_for_header: '' };
async function renderSection(type, id, conf = {}) {
  const src = readFileSync(`${T}/sections/${type}.liquid`, 'utf8');
  const schema = schemaOf(src);
  const settings = {};
  for (const s of schema.settings || []) if ('default' in s) settings[s.id] = s.default;
  Object.assign(settings, conf.settings || {});
  const defs = Object.fromEntries((schema.blocks || []).map((b) => [b.type, b]));
  const blocks = (conf.block_order || []).map((bid) => {
    const b = conf.blocks[bid], st = {};
    for (const s of defs[b.type]?.settings || []) if ('default' in s) st[s.id] = s.default;
    return { id: bid, type: b.type, settings: Object.assign(st, b.settings), shopify_attributes: '' };
  });
  const html = await engine.parseAndRender(stripSchema(src), { ...ctxBase, section: { id, settings, blocks } });
  return `<div id="shopify-section-${id}" class="shopify-section">${html}</div>`;
}
class SectionTag extends Tag {
  constructor(token, remain, liquid) { super(token, remain, liquid); this.name = token.args.trim().replace(/['"]/g, ''); }
  async render() { return renderSection(this.name, this.name); }
}
engine.registerTag('section', SectionTag);
const tpl = JSON.parse(readFileSync(`${T}/templates/index.json`, 'utf8'));
let body = '';
for (const id of tpl.order) body += await renderSection(tpl.sections[id].type, id, tpl.sections[id]);
let page = await engine.parseAndRender(readFileSync(`${T}/layout/${tpl.layout}.liquid`, 'utf8'), { ...ctxBase, content_for_layout: body });
// local stand-ins for the CDN and the store's fonts
// minified ESM stand-ins for jsDelivr's +esm bundles
const { build } = await import('esbuild');
const vendor = { gsap: 'node_modules/gsap/index.js', scrolltrigger: 'node_modules/gsap/ScrollTrigger.js', lenis: 'node_modules/lenis/dist/lenis.mjs' };
for (const [k, e] of Object.entries(vendor)) await build({ entryPoints: [e], bundle: true, minify: true, format: 'esm', outfile: `dist/vendor/${k}.mjs`, logLevel: 'error' });
page = page.replaceAll('https://cdn.jsdelivr.net/npm/three@0.170.0/', '/node_modules/three/').replaceAll('https://cdn.jsdelivr.net/npm/gsap@3.12.5/ScrollTrigger.js/+esm', '/dist/vendor/scrolltrigger.mjs').replaceAll('https://cdn.jsdelivr.net/npm/gsap@3.12.5/+esm', '/dist/vendor/gsap.mjs').replaceAll('https://cdn.jsdelivr.net/npm/lenis@1.1.13/+esm', '/dist/vendor/lenis.mjs');
const ff = (fam, file, w, st) => `@font-face{font-family:'${fam}';src:url(${file}) format('woff2');font-weight:${w};font-style:${st};font-display:swap}`;
const B = '/node_modules/@fontsource/bodoni-moda/files/bodoni-moda-latin-', M = '/node_modules/@fontsource/manrope/files/manrope-latin-';
const faces = [ff('Bodoni Moda', B + '400-normal.woff2', 400, 'normal'), ff('Bodoni Moda', B + '500-normal.woff2', 500, 'normal'), ff('Bodoni Moda', B + '400-italic.woff2', 400, 'italic'), ...[400, 500, 600, 700].map((w) => ff('Manrope', `${M}${w}-normal.woff2`, w, 'normal'))].join('');
page = page.replace('</head>', `<link rel="preload" as="font" type="font/woff2" crossorigin href="${B}400-normal.woff2"><style>${faces}</style></head>`);
mkdirSync('dist', { recursive: true });
writeFileSync('dist/index.html', page);
console.log('dist/index.html', (page.length / 1024).toFixed(1) + ' KB');
