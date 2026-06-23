#!/usr/bin/env node
// Build cards.json (+ audio/) from Duolingo's learned-lexemes export.
// Caches: any (it, en, hint) match keeps its cached pron + audio; only
// new words go to Claude and CloudFront.
//
// Usage: node generate.js
// Requires: `claude` on PATH.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const https = require('https');

const SOURCE = 'learned-lexemes.json';
const OUT = 'cards.json';
const AUDIO_DIR = 'audio';
const BATCH = 20;

function readJSON(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return fallback; }
}

function callClaude(prompt) {
  const res = spawnSync('claude', ['-p', prompt], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  if (res.status !== 0) throw new Error(`claude failed: ${res.stderr || res.stdout}`);
  return res.stdout;
}

function extractJSON(text) {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1];
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1) throw new Error(`No JSON array in response:\n${text}`);
  return JSON.parse(text.slice(start, end + 1));
}

function buildPronPrompt(words) {
  const list = words.map((it, i) => `${i + 1}. ${it}`).join('\n');
  return `For each Italian word or phrase, write a simple English-style pronunciation respelling (NOT IPA). Capitalize the stressed syllable. Examples: Buongiorno → "bwon-JOR-no", Grazie → "GRAH-tsyeh", Ciao → "CHOW".

Phrases:
${list}

Respond with ONLY a JSON array of ${words.length} strings, in the same order. No prose, no markdown fences.`;
}

function downloadAudio(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
      file.on('error', reject);
    }).on('error', reject);
  });
}

function audioFilename(url) {
  return path.basename(new URL(url).pathname) + '.mp3';
}

async function main() {
  const raw = readJSON(SOURCE, null);
  const lexemes = raw?.learnedLexemes;
  if (!Array.isArray(lexemes)) {
    console.error(`Missing or invalid ${SOURCE} (expected { learnedLexemes: [...] })`);
    process.exit(1);
  }

  const existing = readJSON(OUT, []);
  const pronCache = new Map();
  for (const c of existing) {
    if (c.it && c.pron) pronCache.set(c.it, c.pron);
  }

  if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR);

  const cards = [];
  const audioJobs = [];
  const needPron = [];

  for (const lex of lexemes) {
    const it = lex.text;
    const en = (lex.translations || []).join(', ');
    const card = { it, en };
    if (lex.audioURL) {
      const file = audioFilename(lex.audioURL);
      card.audio = `${AUDIO_DIR}/${file}`;
      const dest = path.join(AUDIO_DIR, file);
      if (!fs.existsSync(dest)) audioJobs.push({ url: lex.audioURL, dest });
    }
    const cached = pronCache.get(it);
    if (cached) card.pron = cached;
    else needPron.push(it);
    cards.push(card);
  }

  console.log(`${cards.length} cards: ${needPron.length} need pronunciation, ${audioJobs.length} need audio download`);

  for (let i = 0; i < needPron.length; i += BATCH) {
    const chunk = needPron.slice(i, i + BATCH);
    console.log(`Pronunciation ${i + 1}-${i + chunk.length}…`);
    const out = extractJSON(callClaude(buildPronPrompt(chunk)));
    if (out.length !== chunk.length) {
      throw new Error(`Expected ${chunk.length} pronunciations, got ${out.length}`);
    }
    chunk.forEach((it, k) => pronCache.set(it, out[k]));
  }
  for (const card of cards) {
    if (!card.pron) card.pron = pronCache.get(card.it);
  }

  for (let i = 0; i < audioJobs.length; i++) {
    const { url, dest } = audioJobs[i];
    process.stdout.write(`Audio ${i + 1}/${audioJobs.length}: ${path.basename(dest)}\r`);
    await downloadAudio(url, dest);
  }
  if (audioJobs.length) process.stdout.write('\n');

  fs.writeFileSync(OUT, JSON.stringify(cards, null, 2) + '\n');
  console.log(`Wrote ${OUT} (${cards.length} cards)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
