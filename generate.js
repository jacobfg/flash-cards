#!/usr/bin/env node
// Build cards.json from Duolingo's learned-lexemes export. Audio is
// hot-linked from Duolingo's CloudFront (no MP3s in the repo); the
// service worker pre-caches them on install for offline use. Pron
// respellings come from Claude — cached, so only new words run.
//
// Usage: node generate.js
// Requires: `claude` on PATH.

const fs = require('fs');
const { spawnSync } = require('child_process');

const SOURCE = 'learned-lexemes.json';
const OUT = 'cards.json';
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

async function main() {
  const raw = readJSON(SOURCE, null);
  const lexemes = raw?.learnedLexemes;
  if (!Array.isArray(lexemes)) {
    console.error(`Missing or invalid ${SOURCE} (expected { learnedLexemes: [...] })`);
    process.exit(1);
  }

  const existing = readJSON(OUT, { cards: [] });
  // Tolerate the older flat-array shape from before user metadata existed.
  const existingCards = Array.isArray(existing) ? existing : (existing.cards || []);
  const pronCache = new Map();
  for (const c of existingCards) {
    if (c.it && c.pron) pronCache.set(c.it, c.pron);
  }

  const cards = [];
  const needPron = [];

  for (const lex of lexemes) {
    const it = lex.text;
    const en = (lex.translations || []).join(', ');
    const card = { it, en };
    if (lex.audioURL) card.audioURL = lex.audioURL;
    const cached = pronCache.get(it);
    if (cached) card.pron = cached;
    else needPron.push(it);
    cards.push(card);
  }

  console.log(`${cards.length} cards: ${needPron.length} need pronunciation`);

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

  fs.writeFileSync(OUT, JSON.stringify({ cards }, null, 2) + '\n');
  console.log(`Wrote ${OUT} (${cards.length} cards)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
