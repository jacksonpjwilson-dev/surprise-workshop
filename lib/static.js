'use strict';
// Minimal static file server bound to 127.0.0.1 only (preview and tests; never public).
const http = require('http'), fs = require('fs'), path = require('path');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.txt': 'text/plain' };
function serve(root, port = 0, mounts = {}) {
  const server = http.createServer((req, res) => {
    let url = decodeURIComponent(req.url.split('?')[0]);
    let base = root;
    for (const [prefix, dir] of Object.entries(mounts)) if (url.startsWith(prefix)) { base = dir; url = url.slice(prefix.length - 1); }
    let f = path.join(base, url);
    if (!f.startsWith(path.resolve(base))) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) { if (!url.endsWith('/')) { res.writeHead(301, { Location: req.url.split('?')[0] + '/' }); return res.end(); } f = path.join(f, 'index.html'); }
    fs.readFile(f, (err, data) => {
      if (err) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('Not found'); }
      res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(data);
    });
  });
  return new Promise(r => server.listen(port, '127.0.0.1', () => r({ server, port: server.address().port, close: () => new Promise(c => server.close(c)) })));
}
module.exports = { serve };
