import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const outDir = resolve(root, 'dist');

const filesToCopy = [
  'index.html',
  'styles.css',
  'app.js',
  'favicon.svg',
  'staticwebapp.config.json',
  'web.config'
];

if (existsSync(outDir)) {
  rmSync(outDir, { recursive: true, force: true });
}
mkdirSync(outDir, { recursive: true });

for (const file of filesToCopy) {
  const source = resolve(root, file);
  const destination = resolve(outDir, file);
  cpSync(source, destination, { recursive: true });
}

console.log('Build complete. Output written to ./dist');
