#!/usr/bin/env node
// Two-call automated pull from Duolingo:
//   1. GET the user's currentCourse to find every completed skill.
//   2. POST those skill IDs to learned-lexemes — Duolingo returns every
//      word those skills taught, with audio URLs.
//
// Usage:
//   echo 'DUOLINGO_JWT=eyJ...'        >  .env
//   echo 'DUOLINGO_USER_ID=164045...' >> .env
//   node fetch-lexemes.js

const fs = require('fs');
const https = require('https');
const zlib = require('zlib');

const JWT = process.env.DUOLINGO_JWT;
const USER_ID = process.env.DUOLINGO_USER_ID;
const PAGE_SIZE = 50;
const OUT = 'learned-lexemes.json';

if (!JWT || !USER_ID) {
  console.error('Missing DUOLINGO_JWT or DUOLINGO_USER_ID. Run via `npm run fetch` so .env is loaded.');
  process.exit(1);
}

function request(url, { method = 'GET', body = null } = {}) {
  const headers = {
    Authorization: `Bearer ${JWT}`,
    Accept: 'application/json; charset=UTF-8',
    'Accept-Encoding': 'gzip',
  };
  if (body) {
    headers['Content-Type'] = 'application/json; charset=UTF-8';
    headers['Content-Length'] = Buffer.byteLength(body);
  }
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method, headers }, (res) => {
      const chunks = [];
      const stream = res.headers['content-encoding'] === 'gzip' ? res.pipe(zlib.createGunzip()) : res;
      stream.on('data', (c) => chunks.push(c));
      stream.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}: ${text.slice(0, 200)}`));
        try { resolve(JSON.parse(text)); }
        catch (e) { reject(e); }
      });
      stream.on('error', reject);
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// Walk currentCourse → every path level that has been touched → dedup by skillId.
function collectProgressedSkills(course) {
  const seen = new Set();
  const out = [];
  for (const section of course.pathSectioned || []) {
    for (const unit of section.units || []) {
      for (const lvl of unit.levels || []) {
        const sid = lvl.pathLevelMetadata?.skillId;
        if (!sid || seen.has(sid)) continue;
        const finishedSessions = lvl.finishedSessions || 0;
        const finishedLevels = lvl.pathLevelMetadata?.crownLevelIndex || 0;
        const completed = finishedSessions > 0 || ['passed', 'legendary', 'completed'].includes(lvl.state);
        if (!completed) continue;
        seen.add(sid);
        out.push({ finishedLevels, finishedSessions, skillId: { id: sid } });
      }
    }
  }
  return out;
}

async function main() {
  console.log('Fetching course progress…');
  const profile = await request(
    `https://www.duolingo.com/2023-05-23/users/${USER_ID}?fields=courses,currentCourse,currentCourseId,picture`
  );
  const course = profile.currentCourse;
  if (!course) throw new Error('User profile has no currentCourse');
  const learning = course.trackingProperties?.course_topic_id;
  const from = profile.courses?.[0]?.fromLanguage || 'en';
  const courseId = profile.currentCourseId;
  console.log(`Course: ${courseId} (${learning} for ${from})`);

  const progressedSkills = collectProgressedSkills(course);
  console.log(`Completed skills: ${progressedSkills.length}`);
  if (!progressedSkills.length) {
    throw new Error('No completed skills found in currentCourse — nothing to ask for');
  }

  const allLexemes = [];
  let startIndex = 0;
  let totalLexemes = null;
  while (true) {
    const body = JSON.stringify({ lastTotalLexemeCount: 0, progressedSkills });
    const url = `https://www.duolingo.com/2017-06-30/users/${USER_ID}/courses/${learning}/${from}/learned-lexemes?limit=${PAGE_SIZE}&sortBy=LEARNED_DATE&startIndex=${startIndex}`;
    const page = await request(url, { method: 'POST', body });
    const batch = page.learnedLexemes || [];
    allLexemes.push(...batch);
    totalLexemes = page.pagination?.totalLexemes ?? totalLexemes;
    const next = page.pagination?.nextStartIndex;
    console.log(`Fetched ${allLexemes.length}${totalLexemes ? ` / ${totalLexemes}` : ''}`);
    if (next == null) break;
    startIndex = next;
  }

  fs.writeFileSync(
    OUT,
    JSON.stringify({
      learnedLexemes: allLexemes,
      pagination: { totalLexemes: allLexemes.length, pageSize: allLexemes.length },
    }) + '\n'
  );
  console.log(`Wrote ${OUT} (${allLexemes.length} lexemes)`);

  // Write user metadata to a sidecar file so generate.js can fold it into
  // cards.json without downloading anything.
  if (profile.picture) {
    const base = profile.picture.startsWith('http') ? profile.picture : `https:${profile.picture}`;
    const avatarURL = `${base}/xxlarge`;
    fs.writeFileSync('user.json', JSON.stringify({ avatarURL }) + '\n');
    console.log(`Avatar: ${avatarURL}`);
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
