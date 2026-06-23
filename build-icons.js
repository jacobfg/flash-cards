#!/usr/bin/env node
// Build icon-192.png and icon-512.png from avatar.png with an
// Italian-flag badge in the bottom-right corner. Squircle mask via
// ImageMagick — assumes `magick` is on PATH (brew install imagemagick).
//
// Usage: node build-icons.js  (or `npm run icons`)

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const AVATAR = 'avatar.png';
const SIZES = [192, 512];
const CORNER_RATIO = 0.22;   // squircle radius as fraction of icon size
const BADGE_RATIO = 0.36;    // flag diameter as fraction of icon size

function magick(args) {
  const r = spawnSync('magick', args, { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`magick failed: ${args.join(' ')}`);
}

function buildIcon(size, outPath, tmpDir) {
  const radius = Math.round(size * CORNER_RATIO);
  const badge = Math.round(size * BADGE_RATIO);
  const squircled = path.join(tmpDir, `avatar-${size}.png`);
  const flag = path.join(tmpDir, `flag-${size}.png`);

  // Apply squircle mask to the resized avatar.
  magick([
    AVATAR, '-resize', `${size}x${size}`,
    '(', '+clone', '-alpha', 'extract',
      '-draw', `fill black polygon 0,0 0,${radius} ${radius},0 fill white circle ${radius},${radius} ${radius},0`,
      '(', '+clone', '-flip', ')', '-compose', 'Multiply', '-composite',
      '(', '+clone', '-flop', ')', '-compose', 'Multiply', '-composite',
    ')',
    '-alpha', 'off', '-compose', 'CopyOpacity', '-composite',
    squircled,
  ]);

  // Italian tricolore inside a circular badge.
  const third = Math.round(badge / 3);
  const twoThirds = Math.round((badge * 2) / 3);
  const half = Math.round(badge / 2);
  magick([
    '-size', `${badge}x${badge}`, 'xc:none',
    '-draw', `fill #008C45 rectangle 0,0 ${third},${badge}`,
    '-draw', `fill #F4F5F0 rectangle ${third},0 ${twoThirds},${badge}`,
    '-draw', `fill #CD212A rectangle ${twoThirds},0 ${badge},${badge}`,
    '(', '+clone', '-alpha', 'extract',
      '-draw', `fill black rectangle 0,0 ${badge},${badge} fill white circle ${half},${half} ${half},0`,
    ')',
    '-alpha', 'off', '-compose', 'CopyOpacity', '-composite',
    flag,
  ]);

  // Drop the flag flush into the bottom-right corner.
  magick([
    squircled, flag,
    '-gravity', 'southeast', '-geometry', '+0+0',
    '-compose', 'Over', '-composite',
    outPath,
  ]);

  fs.unlinkSync(squircled);
  fs.unlinkSync(flag);
}

function main() {
  if (!fs.existsSync(AVATAR)) {
    console.error(`Missing ${AVATAR}. Run \`npm run fetch\` first.`);
    process.exit(1);
  }
  const which = spawnSync('which', ['magick']);
  if (which.status !== 0) {
    console.error('Missing `magick` CLI. Install with: brew install imagemagick');
    process.exit(1);
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'icons-'));
  try {
    for (const size of SIZES) {
      const out = `icon-${size}.png`;
      console.log(`Building ${out}…`);
      buildIcon(size, out, tmpDir);
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
  console.log('Done.');
}

main();
