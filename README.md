# Italian Flash Cards

A tiny PWA for studying Italian vocabulary. Tap to reveal, swipe between cards, tap the speaker to hear the Italian pronunciation (browser `SpeechSynthesis`, no API key).

## Update your deck

The deck is built from Duolingo's "learned lexemes" — every word you've completed in a course.

Put your credentials in `.env` (gitignored):

```sh
DUOLINGO_JWT=eyJ...
DUOLINGO_USER_ID=164045293072623
```

Then:

```sh
npm run update      # fetch + regenerate in one go
# or run the halves individually:
npm run fetch       # pull learned-lexemes.json from Duolingo
npm run generate    # turn it into cards.json + audio/
```

`npm run fetch` loads `.env` via Node's built-in `--env-file=.env`. Running `node fetch-lexemes.js` directly will only work if those vars are already exported in your shell.

`update` is shorthand for `node fetch-lexemes.js && node generate.js`:

1. **fetch** paginates the Duolingo API, writing `learned-lexemes.json`.
2. **generate** reads it, downloads audio MP3s to `audio/`, asks Claude for an English-style pronunciation respelling for any *new* word, and writes `cards.json` (the file the PWA loads). Existing words skip both audio download and Claude.

### Getting your DUOLINGO_JWT

1. Log into duolingo.com in a browser.
2. Open DevTools → **Network** tab.
3. Click around — any API call to `duolingo.com/2017-06-30/...` will work.
4. In the request headers, copy the `Authorization: Bearer eyJ...` value (everything after `Bearer `).
5. Paste it into `.env` as `DUOLINGO_JWT=...`.

The token typically lasts a few weeks; refresh it the same way when fetches start returning HTTP 401.

The PWA shuffles the deck every session, so order in the source doesn't matter.

## Run locally

Service workers need HTTP, so don't open `index.html` directly:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## Deploy to GitHub Pages

1. Push this repo to GitHub.
2. Repo **Settings → Pages → Build and deployment**: Source = `Deploy from a branch`, Branch = `main`, Folder = `/ (root)`.
3. Wait ~1 minute. Your URL: `https://<user>.github.io/<repo>/`.

## Install on iPhone

Open the GitHub Pages URL in **Safari** → Share → **Add to Home Screen**. It launches fullscreen, works offline, and remembers nothing — every load fetches the latest `cards.json`.

## Controls

- Tap card / Reveal button / Space → flip
- Swipe / arrows / ‹ › → previous / next
- 🔊 / `S` → speak Italian
- Shuffle / Reset → reorder

## Icons

The manifest references `icon-192.png` and `icon-512.png`. Drop your own PNGs in the root with those names before deploying — without them the install prompt may fall back to a default icon.
