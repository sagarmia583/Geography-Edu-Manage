const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;
const START_PORT = Number(process.env.PORT || 3000);
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.gs': 'text/plain; charset=utf-8'
};

function makeServer() {
  return http.createServer((req, res) => {
    let url;
    try {
      url = decodeURIComponent(req.url.split('?')[0]);
    } catch (err) {
      res.writeHead(400, {'Content-Type': 'text/plain; charset=utf-8'});
      return res.end('Bad request');
    }
    if (url === '/') url = '/index.html';
    const file = path.normalize(path.join(ROOT, url));
    if (file !== ROOT && !file.startsWith(ROOT + path.sep)) {
      res.writeHead(403, {'Content-Type': 'text/plain; charset=utf-8'});
      return res.end('Forbidden');
    }
    fs.stat(file, (err, stat) => {
      if (err || !stat.isFile()) {
        res.writeHead(404, {'Content-Type': 'text/plain; charset=utf-8'});
        return res.end('Not found');
      }
      const ext = path.extname(file).toLowerCase();
      const headers = {'Content-Type': MIME[ext] || 'application/octet-stream'};
      if (ext === '.css' || ext === '.js') headers['Cache-Control'] = 'public, max-age=300';
      res.writeHead(200, headers);
      fs.createReadStream(file).pipe(res);
    });
  });
}

function listen(port, attempt = 0) {
  const server = makeServer();
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && attempt < 10) {
      console.log(`Port ${port} busy. Trying ${port + 1}...`);
      listen(port + 1, attempt + 1);
    } else {
      console.error(err.message);
      process.exit(1);
    }
  });
  server.listen(port, () => {
    console.log(`Geography portal running: http://localhost:${port}`);
    console.log('Press Ctrl+C to stop the server');
  });
}

listen(START_PORT);

// Keep the process alive
setInterval(() => {}, 1000);

process.on('SIGINT', () => {
  console.log('\nServer shutting down...');
  process.exit(0);
});
