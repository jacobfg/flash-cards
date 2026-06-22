# Italian Flash Cards

A tiny PWA for studying Italian vocabulary. Tap to reveal, swipe between cards, tap the speaker to hear the Italian pronunciation (browser `SpeechSynthesis`, no API key).

## Edit your deck

All cards live in [`cards.json`](cards.json). Each entry:

```json
{ "it": "Buongiorno", "en": "Good morning", "hint": "formal, before noon" }
```

`hint` is optional. Order in the file = order in the app (until you tap Shuffle).

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
