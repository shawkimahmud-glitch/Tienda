// Tiny static server for local preview & offline film rendering.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
const root = normalize(join(new URL('..', import.meta.url).pathname));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.bin': 'application/octet-stream', '.woff2': 'font/woff2' };
const port = +(process.env.PORT || 4173);
createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const f = normalize(join(root, p));
    if (!f.startsWith(root)) throw 0;
    const s = await stat(f);
    if (s.isDirectory()) throw 0;
    res.writeHead(200, { 'content-type': types[extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(await readFile(f));
  } catch { res.writeHead(404); res.end('404'); }
}).listen(port, () => console.log('serving', root, 'on', port));
