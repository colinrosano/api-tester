#!/usr/bin/env node
// Bundles server.js + public/* into a single self-contained `osano-api-tester.js`.
// Reads the real server.js and patches the static-serving bits to use embedded
// assets instead of the filesystem. Run: node build-bundle.js

const fs = require('fs');
const path = require('path');

const root = __dirname;
const pub  = path.join(root, 'public');

const assets = {
  '/index.html':   fs.readFileSync(path.join(pub, 'index.html'), 'utf8'),
  '/styles.css':   fs.readFileSync(path.join(pub, 'styles.css'), 'utf8'),
  '/app.js':       fs.readFileSync(path.join(pub, 'app.js'),     'utf8'),
  '/endpoints.js': fs.readFileSync(path.join(pub, 'endpoints.js'), 'utf8'),
};

const encoded = {};
for (const [k, v] of Object.entries(assets)) {
  encoded[k] = Buffer.from(v, 'utf8').toString('base64');
}

let server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');

// Strip fs + path requires and PUBLIC_DIR — bundle doesn't touch disk.
server = server
  .replace(/^const fs = require\('fs'\);\n/m, '')
  .replace(/^const path = require\('path'\);\n/m, '')
  .replace(/^const PUBLIC_DIR = .*\n/m, '');

// Replace the filesystem-based serveStatic with an embedded-assets version.
const newServeStatic = `function serveStatic(req, res) {
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') urlPath = '/index.html';
  const data = ASSETS[urlPath];
  if (!data) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
    return;
  }
  const ext = urlPath.slice(urlPath.lastIndexOf('.'));
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  res.end(data);
}`;

server = server.replace(
  /function serveStatic\(req, res\) \{[\s\S]*?^\}/m,
  newServeStatic
);

const header = `#!/usr/bin/env node
// Osano API Tester — self-contained bundle.
// Run:  node osano-api-tester.js     (then open http://localhost:4173)
// No dependencies. Requires Node 14+.

const ASSETS_B64 = ${JSON.stringify(encoded, null, 2)};
const ASSETS = {};
for (const [k, v] of Object.entries(ASSETS_B64)) {
  ASSETS[k] = Buffer.from(v, 'base64');
}

`;

// Strip any pre-existing shebang on server.js so we don't get two.
server = server.replace(/^#![^\n]*\n/, '');

const bundle = header + server;
const outPath = path.join(root, 'osano-api-tester.js');
fs.writeFileSync(outPath, bundle, 'utf8');
const sizeKb = (Buffer.byteLength(bundle, 'utf8') / 1024).toFixed(1);
console.log(`Wrote ${outPath} (${sizeKb} KB)`);
