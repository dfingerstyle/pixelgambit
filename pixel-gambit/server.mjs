import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.wasm': 'application/wasm' };
const port = process.env.PORT || 4173;

http.createServer((req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(req.url.split('?')[0]); }
  catch { res.writeHead(400); res.end('Bad request'); return; }
  let p = path.resolve(root, '.' + pathname);
  if (p !== root && !p.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
  // Server-side tooling (DB password, secret key) and dotfiles must never be served.
  const rel = path.relative(root, p);
  if (rel.split(path.sep).some((seg) => seg === 'tools' || seg.startsWith('.'))) { res.writeHead(404); res.end('Not found'); return; }
  if (pathname.endsWith('/')) p = path.join(p, 'index.html');
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(port, function () { console.log(`PIXEL GAMBIT → http://localhost:${this.address().port}`); });