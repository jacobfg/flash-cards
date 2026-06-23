#!/usr/bin/env node
// Generate cards.json from cards-basic.json using the `claude` CLI.
// Reuses already-translated entries to avoid re-asking Claude on every run.
//
// Usage: node generate.js
// Requires: `claude` on PATH (Claude Code CLI).

const fs = require('fs');
const { spawnSync } = require('child_process');
const yaml = require('js-yaml');

const BASIC = 'cards-basic.yaml';
const OUT = 'cards.json';
const BATCH = 20;

function readJSON(path, fallback) {
  try { return JSON.parse(fs.readFileSync(path, 'utf8')); }
  catch { return fallback; }
}

function readYAML(path) {
  return yaml.load(fs.readFileSync(path, 'utf8'));
}

function callClaude(prompt) {
  const res = spawnSync('claude', ['-p', prompt], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  if (res.status !== 0) throw new Error(`claude failed: ${res.stderr || res.stdout}`);
  return res.stdout;
}

function extractJSON(text) {
  // Claude sometimes wraps JSON in ```json fences or prose. Pull the first [...] or {...} block.
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1];
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1) throw new Error(`No JSON array in response:\n${text}`);
  return JSON.parse(text.slice(start, end + 1));
}

function buildPrompt(items) {
  const list = items.map((it, i) => {
    const hintNote = it.hint ? ` (context: ${it.hint})` : '';
    return `${i + 1}. ${it.en}${hintNote}`;
  }).join('\n');

  return `Translate each English phrase below to Italian and provide a simple English-style pronunciation respelling (NOT IPA). Capitalize the stressed syllable. Examples: Buongiorno → "bwon-JOR-no", Grazie → "GRAH-tsyeh", Ciao → "CHOW".

For each numbered item, return one JSON object with keys: "it" (Italian translation), "pron" (respelled pronunciation). Preserve any meaning hints in the original English.

Phrases:
${list}

Respond with ONLY a JSON array of ${items.length} objects, in the same order. No prose, no markdown fences.`;
}

async function main() {
  const basic = readYAML(BASIC);
  if (!Array.isArray(basic)) {
    console.error(`Missing or invalid ${BASIC}`);
    process.exit(1);
  }

  const existing = readJSON(OUT, []);
  const cache = new Map();
  for (const c of existing) {
    if (c.en && c.it && c.pron) cache.set(cacheKey(c), c);
  }

  const result = new Array(basic.length);
  const toFetch = [];
  basic.forEach((b, i) => {
    const cached = cache.get(cacheKey(b));
    if (cached) result[i] = { ...cached, ...b };
    else toFetch.push({ index: i, item: b });
  });

  console.log(`${basic.length} cards: ${basic.length - toFetch.length} cached, ${toFetch.length} to fetch`);

  for (let i = 0; i < toFetch.length; i += BATCH) {
    const chunk = toFetch.slice(i, i + BATCH);
    const items = chunk.map(c => c.item);
    console.log(`Fetching ${i + 1}-${i + chunk.length}…`);
    const raw = callClaude(buildPrompt(items));
    const parsed = extractJSON(raw);
    if (parsed.length !== chunk.length) {
      throw new Error(`Expected ${chunk.length} items back, got ${parsed.length}`);
    }
    chunk.forEach(({ index, item }, k) => {
      const { it, pron } = parsed[k];
      result[index] = { it, pron, en: item.en, ...(item.hint ? { hint: item.hint } : {}) };
    });
  }

  fs.writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n');
  console.log(`Wrote ${OUT} (${result.length} cards)`);
}

function cacheKey(c) {
  return `${c.en}\x00${c.hint || ''}`;
}

main().catch(e => { console.error(e); process.exit(1); });
