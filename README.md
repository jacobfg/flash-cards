# Italian Flash Cards

A tiny PWA for studying Italian vocabulary, built on top of your Duolingo "learned words" list. Tap to reveal, swipe between cards, tap the speaker to hear Duolingo's native Italian audio. Installs to the iOS home screen, works offline.

Live at: <https://jacobfg.github.io/flash-cards/>

## How it works

The deck is built from Duolingo's "learned lexemes" — every Italian word you've completed in your course. `cards.json` is the only data file the PWA reads. It looks like:

```json
{
  "user": { "avatarURL": "https://simg-ssl.duolingo.com/.../xxlarge" },
  "cards": [
    {
      "it": "buongiorno",
      "en": "good morning",
      "audioURL": "https://d1vq87e9lcf771.cloudfront.net/anita/...",
      "pron": "bwon-JOR-no"
    }
  ]
}
```

Audio and avatar stream straight from Duolingo's CDN — nothing copyrighted is committed to this repo. The service worker pre-caches both on install so the app keeps working offline.

## Update your deck

Credentials go in a local `.env` (gitignored):

```sh
DUOLINGO_JWT=eyJ...
DUOLINGO_USER_ID=164045293072623
```

Then:

```sh
npm run update      # = npm run fetch + npm run generate
# or run the halves individually:
npm run fetch       # write learned-lexemes.json + user.json + update manifest
npm run generate    # turn learned-lexemes.json into cards.json
```

`npm run fetch` loads `.env` via Node's built-in `--env-file`. The fetch step:

1. Calls Duolingo's user-profile endpoint to read the full course tree.
2. Builds a `progressedSkills` list from every completed level.
3. POSTs that list to `learned-lexemes` (paginated) — the same endpoint Duolingo's own client uses — and writes the response to `learned-lexemes.json` (gitignored).
4. Writes `user.json` with your `xxlarge` avatar URL (1000×1000), and bakes that URL into `manifest.webmanifest`.

`npm run generate` reads `learned-lexemes.json` + `user.json`, asks the local `claude` CLI for an English-style pronunciation respelling for every word it hasn't seen before (cached, so reruns are free), and writes `cards.json`.

### Getting your DUOLINGO_JWT

1. Log into duolingo.com in a browser.
2. Open DevTools → **Network** tab.
3. Click around — any API call to `duolingo.com/2017-06-30/...` works.
4. Copy the `Authorization: Bearer eyJ...` header value (everything after `Bearer `).
5. Paste into `.env` as `DUOLINGO_JWT=...`.

The token lasts a few weeks. When fetches start returning HTTP 401, refresh it the same way.

## Run locally

Service workers need HTTP, so don't open `index.html` directly:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## Deploy to GitHub Pages

1. Push this repo to GitHub.
2. **Settings → Pages → Build and deployment** → Source: *Deploy from a branch*, Branch: `main`, Folder: `/ (root)`.
3. Your URL: `https://<user>.github.io/<repo>/`.

## Install on iPhone

Open the Pages URL in Safari → Share → **Add to Home Screen**. The PWA launches fullscreen, picks up your Duolingo avatar as the app icon, and works offline.

## Controls

- Tap card / Space → flip
- Swipe / arrow keys → previous / next
- 🔊 / `S` → speak Italian
- ← / Escape → back to language picker (shuffles a fresh deck each time)

## Requirements (dev)

- Node 26+ (for `--env-file`)
- `claude` CLI on PATH (Claude Code) — only used for pronunciation respellings
