# Italian Flash Cards

A tiny PWA for studying Italian vocabulary. Tap to reveal, swipe between cards, tap the speaker to hear the Italian pronunciation (browser `SpeechSynthesis`, no API key).

## Edit your deck

Edit [`cards-basic.json`](cards-basic.json) — just English (and an optional hint):

```json
{ "en": "Good morning", "hint": "formal, before noon" }
```

Then regenerate the full deck:

```sh
node generate.js
```

This calls the local `claude` CLI to translate to Italian and produce a pronunciation respelling, writing [`cards.json`](cards.json) (the file the app actually reads). Existing entries are cached by `en` + `hint`, so reruns only fetch new ones.

Order in `cards-basic.json` = order in the app (until you tap Shuffle).

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
