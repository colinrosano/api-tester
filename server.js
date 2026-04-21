#!/usr/bin/env node
// Osano API Tester - local static server + proxy to api.osano.com.
// Run: node server.js   (then open http://localhost:4173)

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = Number(process.env.PORT) || 4173;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
};

function serveStatic(req, res) {
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(PUBLIC_DIR, urlPath);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function maskSecrets(headers) {
  const out = {};
  for (const [k, v] of Object.entries(headers)) {
    if (/api-key|authorization|token/i.test(k) && typeof v === 'string' && v.length > 8) {
      out[k] = v.slice(0, 4) + '…' + v.slice(-4);
    } else {
      out[k] = v;
    }
  }
  return out;
}

async function handleProxy(req, res) {
  let payload;
  try {
    payload = await readBody(req);
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid JSON in proxy request' }));
    return;
  }

  const { method = 'GET', baseUrl = 'https://api.osano.com', apiPath = '', body = null, headers: customHeaders = {} } = payload;

  let target;
  try {
    target = new URL(apiPath, baseUrl);
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid base URL or path: ' + e.message }));
    return;
  }

  const client = target.protocol === 'http:' ? http : https;
  const bodyStr = body && (typeof body === 'string' ? body : JSON.stringify(body));
  const hasBody = !!bodyStr && bodyStr.trim().length > 0;

  const headers = {
    'Accept': 'application/json',
    'User-Agent': 'osano-api-tester-ui/1.0',
    ...customHeaders,
  };
  if (hasBody) {
    headers['Content-Type'] = 'application/json';
    headers['Content-Length'] = Buffer.byteLength(bodyStr);
  }

  const started = Date.now();
  const proxyReq = client.request({
    method: method.toUpperCase(),
    hostname: target.hostname,
    port: target.port || (target.protocol === 'http:' ? 80 : 443),
    path: target.pathname + target.search,
    headers,
  }, proxyRes => {
    const chunks = [];
    proxyRes.on('data', c => chunks.push(c));
    proxyRes.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      let parsed = null;
      try { parsed = raw ? JSON.parse(raw) : null; } catch (e) { /* leave raw */ }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ok: true,
        status: proxyRes.statusCode,
        statusText: proxyRes.statusMessage,
        durationMs: Date.now() - started,
        url: target.toString(),
        requestMethod: method.toUpperCase(),
        requestHeaders: maskSecrets(headers),
        requestBody: hasBody ? bodyStr : null,
        responseHeaders: proxyRes.headers,
        responseBody: parsed !== null ? parsed : raw,
        responseIsJson: parsed !== null,
      }));
    });
  });

  proxyReq.on('error', err => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: false,
      error: err.message,
      url: target.toString(),
      durationMs: Date.now() - started,
    }));
  });

  if (hasBody) proxyReq.write(bodyStr);
  proxyReq.end();
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/proxy') {
    return handleProxy(req, res);
  }
  if (req.method === 'GET') {
    return serveStatic(req, res);
  }
  res.writeHead(405); res.end('Method not allowed');
});

server.listen(PORT, () => {
  console.log(`\n  Osano API Tester running at http://localhost:${PORT}\n`);
});
