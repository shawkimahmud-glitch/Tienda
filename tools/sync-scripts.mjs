// Writes theme_bash scripts (quoted heredocs) that recreate our theme files in the Shopify theme.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
const [outDir, cssMin] = process.argv.slice(2);
const groups = [
  ['layout/fe-cosmos.liquid', 'snippets/fe-icon.liquid', 'snippets/fe-price.liquid', 'sections/fe-header.liquid', 'sections/fe-journey.liquid', 'sections/fe-instant.liquid', 'sections/fe-creator.liquid', 'sections/fe-ribbon.liquid', 'sections/fe-stories.liquid'],
  ['sections/fe-steps.liquid', 'sections/fe-faq.liquid', 'sections/fe-finale.liquid', 'sections/fe-footer.liquid', 'templates/index.json', 'DESIGN.md', ['assets/fe.css', cssMin]],
  ['assets/fe-app.js', ...readdirSync('theme/assets').filter((f) => f.startsWith('fe-chunk') && readFileSync('theme/assets/' + f).length < 15000).map((f) => 'assets/' + f)],
  readdirSync('theme/assets').filter((f) => f.startsWith('fe-chunk') && readFileSync('theme/assets/' + f).length >= 15000).map((f) => 'assets/' + f),
];
groups.forEach((g, i) => {
  let sh = '';
  for (const item of g) {
    const [dest, src] = Array.isArray(item) ? item : [item, 'theme/' + item];
    const body = readFileSync(src, 'utf8');
    if (body.includes('FE_EOF_7Q')) throw new Error('delimiter clash in ' + src);
    sh += `cat > ${dest} <<'FE_EOF_7Q'\n${body.replace(/\n$/, '')}\nFE_EOF_7Q\n`;
  }
  sh += `wc -c ${g.map((x) => (Array.isArray(x) ? x[0] : x)).join(' ')}\n`;
  writeFileSync(`${outDir}/sync-${i + 1}.sh`, sh);
  console.log(`sync-${i + 1}.sh`, sh.length);
});
