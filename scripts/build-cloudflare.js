const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'dist');
const copyDirs = ['css', 'js', 'data'];
const copyFiles = ['config.json', 'robots.txt', '_headers', 'favicon.ico'];
const routeAliases = [
  { route: 'login', source: 'login.html' },
  { route: 'auth/callback', source: 'login.html' },
  { route: 'app', source: 'index.html' },
  { route: 'settings', source: 'index.html' },
  { route: 'import', source: 'index.html' },
  { route: 'export', source: 'index.html' },
  { route: 'cloud-sync', source: 'index.html' },
  { route: 'billing', source: 'index.html' },
  { route: 'account', source: 'index.html' },
  { route: 'recovery', source: 'index.html' },
  { route: 'premium', source: 'index.html' },
  { route: 'app/settings', source: 'index.html' },
  { route: 'app/import', source: 'index.html' },
  { route: 'app/export', source: 'index.html' },
  { route: 'app/cloud-sync', source: 'index.html' },
  { route: 'app/billing', source: 'index.html' },
  { route: 'app/account', source: 'index.html' },
  { route: 'app/recovery', source: 'index.html' },
  { route: 'app/premium', source: 'index.html' },
  { route: 'demo', source: 'index.html' },
  { route: 'privacy', source: 'privacypolicy.html' },
  { route: 'terms', source: 'terms.html' },
  { route: 'site-data', source: 'privacypolicy.html' }
];

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

for (const dir of copyDirs) {
  const source = path.join(root, dir);
  if (fs.existsSync(source)) {
    fs.cpSync(source, path.join(outDir, dir), { recursive: true });
  }
}

for (const entry of fs.readdirSync(root)) {
  if (entry.toLowerCase().endsWith('.html')) {
    copyFiles.push(entry);
  }
}

for (const file of copyFiles) {
  const source = path.join(root, file);
  if (fs.existsSync(source)) {
    fs.copyFileSync(source, path.join(outDir, file));
  }
}

for (const alias of routeAliases) {
  const source = path.join(root, alias.source);
  if (!fs.existsSync(source)) continue;
  const routeDir = path.join(outDir, alias.route);
  fs.mkdirSync(routeDir, { recursive: true });
  fs.copyFileSync(source, path.join(routeDir, 'index.html'));
}

console.log(`Built Cloudflare static assets in ${path.relative(root, outDir)}`);
