const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'dist');
const copyDirs = ['css', 'js', 'data'];
const copyFiles = ['config.json', 'robots.txt'];

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

console.log(`Built Cloudflare static assets in ${path.relative(root, outDir)}`);
