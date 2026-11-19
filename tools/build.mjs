// Bundles src/ into theme/assets (flat, as Shopify requires). gl.js + three become a lazy chunk.
import { build } from 'esbuild';
import { readdirSync, rmSync } from 'node:fs';
for (const f of readdirSync('theme/assets')) if (/^fe-(app|chunk|gl).*\.js$/.test(f)) rmSync('theme/assets/' + f);
const r = await build({
  entryPoints: { 'fe-app': 'src/app.js' },
  bundle: true, splitting: true, format: 'esm', minify: true, target: ['es2020', 'safari15'],
  outdir: 'theme/assets', chunkNames: 'fe-chunk-[hash]', entryNames: '[name]',
  legalComments: 'none', external: ['three', 'gsap', 'gsap/ScrollTrigger', 'lenis'], metafile: true, logLevel: 'warning',
});
for (const [k, v] of Object.entries(r.metafile.outputs)) console.log(k, (v.bytes / 1024).toFixed(1) + ' KB');
