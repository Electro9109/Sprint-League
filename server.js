const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT   = Number(process.env.PORT) || 3000;
const ROOT   = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css' : 'text/css; charset=utf-8',
  '.js'  : 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.ico' : 'image/x-icon',
  '.png' : 'image/png',
  '.jpg' : 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg' : 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff' : 'font/woff',
  '.ttf'  : 'font/ttf',
};

function send404(res) { res.writeHead(404); res.end('Not found'); }

const server = http.createServer((req, res) => {
  let urlPath = req.url.split('?')[0];
  try { urlPath = decodeURIComponent(urlPath); } catch {}
  if (urlPath === '/') urlPath = '/index.html';

  // Resolve to absolute path and prevent directory traversal
  const filePath = path.resolve(ROOT, '.' + urlPath);
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end('Forbidden'); return; }

  fs.stat(filePath, (statErr, stat) => {
    if (statErr || !stat.isFile()) { send404(res); return; }

    const ext  = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type'           : mime,
      'Cache-Control'          : ext === '.html' ? 'no-cache' : 'public, max-age=3600',
      'X-Content-Type-Options' : 'nosniff',
    });

    fs.createReadStream(filePath).on('error', () => send404(res)).pipe(res);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n  ⚡ Sprint League → http://localhost:${PORT}\n`);
  console.log(`  Serving: ${ROOT}`);
  console.log(`  Stop:    Ctrl+C\n`);
});

server.on('error', err => {
  if (err.code === 'EADDRINUSE')
    console.error(`\n  ✗ Port ${PORT} busy. Try:  PORT=${PORT + 1} node server.js\n`);
  else
    console.error(err);
  process.exit(1);
});
