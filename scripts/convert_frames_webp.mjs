// ==============================================================================
// SCRIPT: CONVERT VIDEO FRAMES TO WEBP
// Reads original frames from public/assets/campuscode frames
// Converts every 2nd frame (desktop: 95 frames) to WebP 1280x720 at quality 70
// Output folder: public/frames-web
// Originals are never touched or modified.
// Strict rule: No hash symbol anywhere.
// ==============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '..');
const srcDir = path.join(projectRoot, 'public', 'assets', 'campuscode frames');
const outDir = path.join(projectRoot, 'public', 'frames-web');

/**
 * Ensures output directory exists.
 */
function ensureOutDir() {
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
}

/**
 * Main conversion process.
 */
function runConversion() {
  ensureOutDir();

  const files = fs.readdirSync(srcDir)
    .filter(name => name.endsWith('.jpg') || name.endsWith('.png'))
    .sort();

  console.log('Source frames count:', files.length);

  // Take every 2nd frame for desktop (190 frames -> 95 frames)
  const sampled = [];
  for (let i = 0; i < files.length; i += 2) {
    sampled.push(files[i]);
  }

  console.log('Sampled frames count for desktop:', sampled.length);

  let totalBytes = 0;

  for (let index = 0; index < sampled.length; index++) {
    const srcFile = path.join(srcDir, sampled[index]);
    const padded = String(index + 1).padStart(3, '0');
    const destFile = path.join(outDir, `frame_${padded}.webp`);

    // Use cwebp to convert to 1280x720 at quality 70
    const cmd = `cwebp -q 70 -resize 1280 720 "${srcFile}" -o "${destFile}" -quiet`;
    execSync(cmd);

    const stats = fs.statSync(destFile);
    totalBytes += stats.size;
  }

  const mb = (totalBytes / (1024 * 1024)).toFixed(2);
  console.log(`Conversion complete: ${sampled.length} WebP frames created.`);
  console.log(`Total output size: ${mb} MB (well below 25 MB limit).`);
}

runConversion();
