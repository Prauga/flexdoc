#!/usr/bin/env node

import http from 'node:http';

const port = Number(process.env.FLEXDOC_BENCH_TARGET_PORT || 5899);
const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/target') {
    res.writeHead(200, { 'content-type': 'application/json', 'content-length': '29' });
    res.end('{"ok":true,"target":"external"}');
    return;
  }
  res.writeHead(404, { 'content-type': 'text/plain', 'content-length': '9' });
  res.end('Not Found');
});

server.listen(port, '127.0.0.1');
const shutdown = () => server.close(() => process.exit(0));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
