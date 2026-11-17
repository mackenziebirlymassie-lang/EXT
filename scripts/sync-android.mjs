import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const targetDir = path.join(rootDir, 'android', 'app', 'src', 'main', 'assets', 'www');

const topLevelFiles = ['index.html', 'style.css', 'favicon.svg'];
const jsSourceDir = path.join(rootDir, 'js');
const jsTargetDir = path.join(targetDir, 'js');

fs.rmSync(targetDir, { recursive: true, force: true });
fs.mkdirSync(jsTargetDir, { recursive: true });

let copiedCount = 0;
let totalBytes = 0;

for (const file of topLevelFiles) {
    const src = path.join(rootDir, file);
    if (!fs.existsSync(src)) {
        throw new Error(`Missing required web asset: ${src}`);
    }
    const dest = path.join(targetDir, file);
    fs.copyFileSync(src, dest);
    copiedCount++;
    totalBytes += fs.statSync(dest).size;
}

const jsFiles = fs.readdirSync(jsSourceDir).filter(name => name.endsWith('.js')).sort();
for (const file of jsFiles) {
    const src = path.join(jsSourceDir, file);
    const dest = path.join(jsTargetDir, file);
    fs.copyFileSync(src, dest);
    copiedCount++;
    totalBytes += fs.statSync(dest).size;
}

console.log(`Synced ${copiedCount} web assets (${(totalBytes / 1024).toFixed(1)} KB) -> ${path.relative(rootDir, targetDir)}`);
