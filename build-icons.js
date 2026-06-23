#!/usr/bin/env node
// Build icon-192.png and icon-512.png from a Duolingo character SVG on
// design.duolingo.com. Rasterizes with magick, applies a squircle mask.
// Run when you want to refresh the homescreen icon.
//
// Usage: node build-icons.js  (or `npm run icons`)
// Requires: `magick` on PATH (brew install imagemagick).

const { spawnSync } = require('child_process');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const zlib = require('zlib');

const SOURCE_URL = 'https://fronted.familypro.io/familypro/resource/blog/duolingo-oscar.webp';
const SIZES = [192, 512];
const CORNER_RATIO = 0.22;

function magick(args) {
  const r = spawnSync('magick', args, { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`magick failed: ${args.join(' ')}`);
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'Accept-Encoding': 'gzip' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return download(res.headers.location, dest).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const stream = res.headers['content-encoding'] === 'gzip' ? res.pipe(zlib.createGunzip()) : res;
      const file = fs.createWriteStream(dest);
      stream.pipe(file);
      file.on('finish', () => file.close(resolve));
      file.on('error', reject);
      stream.on('error', reject);
    }).on('error', reject);
  });
}

function squircle(srcPath, size, outPath) {
  const radius = Math.round(size * CORNER_RATIO);
  magick([
    '-background', 'none', srcPath, '-resize', `${size}x${size}`,
    '(', '+clone', '-alpha', 'extract',
      '-draw', `fill black polygon 0,0 0,${radius} ${radius},0 fill white circle ${radius},${radius} ${radius},0`,
      '(', '+clone', '-flip', ')', '-compose', 'Multiply', '-composite',
      '(', '+clone', '-flop', ')', '-compose', 'Multiply', '-composite',
    ')',
    '-alpha', 'off', '-compose', 'CopyOpacity', '-composite',
    outPath,
  ]);
}

async function main() {
  if (spawnSync('which', ['magick']).status !== 0) {
    console.error('Missing `magick` CLI. Install with: brew install imagemagick');
    process.exit(1);
  }
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'icons-'));
  const src = path.join(tmpDir, 'source' + path.extname(new URL(SOURCE_URL).pathname));
  try {
    console.log(`Fetching ${SOURCE_URL}…`);
    await download(SOURCE_URL, src);
    for (const size of SIZES) {
      const out = `icon-${size}.png`;
      console.log(`Building ${out}…`);
      squircle(src, size, out);
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
  console.log('Done.');
}

main().catch((e) => { console.error(e.message); process.exit(1); });
