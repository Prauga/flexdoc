#!/usr/bin/env node

import http from 'node:http';

const port = Number(process.env.FLEXDOC_BENCH_TARGET_PORT || 5899);
const okBody = '{"ok":true,"target":"external"}';
const notFoundBody = 'Not Found';

const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/target') {
    res.writeHead(200, {
      'content-type': 'application/json',
      'content-length': String(Buffer.byteLength(okBody)),
    });
    res.end(okBody);
    return;
  }
  res.writeHead(404, {
    'content-type': 'text/plain',
    'content-length': String(Buffer.byteLength(notFoundBody)),
  });
  res.end(notFoundBody);
});

server.listen(port, '127.0.0.1');
const shutdown = () => server.close(() => process.exit(0));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
