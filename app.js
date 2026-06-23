const state = {
  cards: [],
  order: [],
  index: 0,
  flipped: false,
  mode: null, // 'it' = Italian front, 'en' = English front
};

const el = {
  home: document.getElementById('home'),
  deck: document.getElementById('deck'),
  homeBtn: document.getElementById('home-btn'),
  card: document.getElementById('card'),
  term: document.getElementById('term'),
  translation: document.getElementById('translation'),
  hint: document.getElementById('hint'),
  sub: document.getElementById('sub'),
  subBack: document.getElementById('sub-back'),
  counter: document.getElementById('counter'),
  counterBack: document.getElementById('counter-back'),
  homeBtnBack: document.getElementById('home-btn-back'),
  speak: document.getElementById('speak'),
  themeColor: document.querySelector('meta[name="theme-color"]'),
};

// iOS paints the safe-area strip above the web view with theme-color.
// Match it to the visible face so the strip blends with the card.
const FRONT_COLOR = '#ffffff';
const BACK_COLOR = '#fef9e7';
function setThemeColor(color) {
  if (el.themeColor) el.themeColor.setAttribute('content', color);
}

// English translations come comma-joined; first one is the headline,
// the rest sit on a sub line.
function splitEn(en) {
  const parts = (en || '').split(',').map((s) => s.trim()).filter(Boolean);
  return { first: parts[0] || '', rest: parts.slice(1).join(', ') };
}

function currentCard() {
  return state.cards[state.order[state.index]];
}

function render() {
  const card = currentCard();
  if (!card) return;

  // Front always shows the language the user chose; back shows the other side.
  // The Italian side carries the pronunciation; the English side carries any
  // alternate translations.
  const en = splitEn(card.en);
  if (state.mode === 'it') {
    el.term.textContent = card.it;
    el.sub.textContent = card.pron || '';
    el.translation.textContent = en.first;
    el.subBack.textContent = en.rest;
  } else {
    el.term.textContent = en.first;
    el.sub.textContent = en.rest;
    el.translation.textContent = card.it;
    el.subBack.textContent = card.pron || '';
  }
  el.hint.textContent = card.hint || '';
  const counterText = `${state.index + 1} / ${state.order.length}`;
  el.counter.textContent = counterText;
  el.counterBack.textContent = counterText;
  setFlipped(false);
}

function setFlipped(value) {
  state.flipped = value;
  el.card.classList.toggle('flipped', value);
  document.body.classList.toggle('revealed', value);
  setThemeColor(value ? BACK_COLOR : FRONT_COLOR);
}

function go(delta) {
  const next = state.index + delta;
  if (next < 0 || next >= state.order.length) return;
  state.index = next;
  render();
}

// Reuse a single Audio element so consecutive taps interrupt cleanly.
const audioPlayer = new Audio();

function speak() {
  const card = currentCard();
  if (!card) return;
  if (card.audioURL) {
    audioPlayer.src = card.audioURL;
    audioPlayer.currentTime = 0;
    audioPlayer.play().catch(() => {});
    return;
  }
  if ('speechSynthesis' in window) {
    speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(card.it);
    utter.lang = 'it-IT';
    utter.rate = 0.9;
    speechSynthesis.speak(utter);
  }
}

function shuffleOrder() {
  state.order = state.cards.map((_, i) => i);
  for (let i = state.order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [state.order[i], state.order[j]] = [state.order[j], state.order[i]];
  }
  state.index = 0;
}

function startMode(mode) {
  state.mode = mode;
  shuffleOrder();
  el.home.hidden = true;
  el.deck.hidden = false;
  render();
}

function goHome() {
  state.mode = null;
  el.deck.hidden = true;
  el.home.hidden = false;
  el.card.classList.remove('flipped');
  document.body.classList.remove('revealed');
  setThemeColor(FRONT_COLOR);
  audioPlayer.pause();
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

document.querySelectorAll('.mode').forEach((btn) => {
  btn.addEventListener('click', () => startMode(btn.dataset.mode));
});

el.homeBtn.addEventListener('click', (e) => { e.stopPropagation(); goHome(); });
el.homeBtnBack.addEventListener('click', (e) => { e.stopPropagation(); goHome(); });

el.card.addEventListener('click', (e) => {
  if (e.target.closest('.speak')) return;
  setFlipped(!state.flipped);
});

el.speak.addEventListener('click', (e) => { e.stopPropagation(); speak(); });

document.addEventListener('keydown', (e) => {
  if (el.deck.hidden) return;
  if (e.key === 'ArrowLeft') go(-1);
  else if (e.key === 'ArrowRight') go(1);
  else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setFlipped(!state.flipped); }
  else if (e.key.toLowerCase() === 's') speak();
  else if (e.key === 'Escape') goHome();
});

let touchStartX = 0;
let touchStartY = 0;
el.card.addEventListener('touchstart', (e) => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });

el.card.addEventListener('touchend', (e) => {
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
    if (dx < 0) go(1);
    else go(-1);
  }
}, { passive: true });

async function load() {
  const res = await fetch('cards.json', { cache: 'no-cache' });
  const data = await res.json();
  // Tolerate the older flat-array shape so existing installs don't break
  // before the SW updates.
  state.cards = Array.isArray(data) ? data : (data.cards || []);
  const avatarURL = !Array.isArray(data) && data.user?.avatarURL;
  if (avatarURL) {
    const img = document.getElementById('avatar');
    if (img) img.src = avatarURL;
    const appleIcon = document.getElementById('apple-icon');
    if (appleIcon) appleIcon.href = avatarURL;
  }
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

load();
