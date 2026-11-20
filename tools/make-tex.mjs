import { chromium } from 'playwright';
import sharp from 'sharp';
const b = await chromium.launch(); const p = await b.newPage();
await p.goto('http://localhost:4173/film/tex/iberia.html'); await p.waitForFunction(() => window.out, null, { timeout: 120000 });
const url = await p.evaluate(() => window.out); await b.close();
await sharp(Buffer.from(url.split(',')[1], 'base64')).jpeg({ quality: 86, mozjpeg: true }).toFile('theme/media/iberia_2048.jpg');
await sharp('theme/media/earth_lights_2048.png').greyscale().jpeg({ quality: 88, mozjpeg: true }).toFile('theme/media/earth_lights_2048.jpg');
await sharp('theme/media/earth_atmos_2048.jpg').jpeg({ quality: 84, mozjpeg: true }).toFile('theme/media/earth_day_2048.jpg');
console.log('ok');
