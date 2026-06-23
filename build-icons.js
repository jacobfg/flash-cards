#!/usr/bin/env node
// Build icon-192.png and icon-512.png by squircling the committed
// avatar.png. Run after `npm run fetch` if you want the homescreen
// icon to match your current Duolingo avatar.
//
// Usage: node build-icons.js  (or `npm run icons`)
// Requires: `magick` on PATH (brew install imagemagick).

const { spawnSync } = require('child_process');
const fs = require('fs');

const SOURCE = 'avatar.png';
const SIZES = [192, 512];
const CORNER_RATIO = 0.22;

function magick(args) {
  const r = spawnSync('magick', args, { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`magick failed: ${args.join(' ')}`);
}

function squircle(srcPath, size, outPath) {
  const radius = Math.round(size * CORNER_RATIO);
  magick([
    srcPath, '-resize', `${size}x${size}`,
    '(', '+clone', '-alpha', 'extract',
      '-draw', `fill black polygon 0,0 0,${radius} ${radius},0 fill white circle ${radius},${radius} ${radius},0`,
      '(', '+clone', '-flip', ')', '-compose', 'Multiply', '-composite',
      '(', '+clone', '-flop', ')', '-compose', 'Multiply', '-composite',
    ')',
    '-alpha', 'off', '-compose', 'CopyOpacity', '-composite',
    outPath,
  ]);
}

function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error(`Missing ${SOURCE}. Run \`npm run fetch\` first.`);
    process.exit(1);
  }
  if (spawnSync('which', ['magick']).status !== 0) {
    console.error('Missing `magick` CLI. Install with: brew install imagemagick');
    process.exit(1);
  }
  for (const size of SIZES) {
    const out = `icon-${size}.png`;
    console.log(`Building ${out} from ${SOURCE}…`);
    squircle(SOURCE, size, out);
  }
  console.log('Done.');
}

main();
