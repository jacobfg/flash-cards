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
  pron: document.getElementById('pron'),
  pronBack: document.getElementById('pron-back'),
  counter: document.getElementById('counter'),
  speak: document.getElementById('speak'),
  speakBack: document.getElementById('speak-back'),
};

function currentCard() {
  return state.cards[state.order[state.index]];
}

function render() {
  const card = currentCard();
  if (!card) return;

  // Front always shows the language the user chose; back shows the other side.
  // Italian side carries the pronunciation regardless of which side it's on.
  if (state.mode === 'it') {
    el.term.textContent = card.it;
    el.pron.textContent = card.pron || '';
    el.translation.textContent = card.en;
    el.pronBack.textContent = '';
  } else {
    el.term.textContent = card.en;
    el.pron.textContent = '';
    el.translation.textContent = card.it;
    el.pronBack.textContent = card.pron || '';
  }
  el.hint.textContent = card.hint || '';
  el.counter.textContent = `${state.index + 1} / ${state.order.length}`;
  setFlipped(false);
}

function setFlipped(value) {
  state.flipped = value;
  el.card.classList.toggle('flipped', value);
}

function go(delta) {
  const next = state.index + delta;
  if (next < 0 || next >= state.order.length) return;
  state.index = next;
  render();
}

function speak() {
  const card = currentCard();
  if (!card || !('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(card.it);
  utter.lang = 'it-IT';
  utter.rate = 0.9;
  speechSynthesis.speak(utter);
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
  speechSynthesis?.cancel?.();
}

document.querySelectorAll('.mode').forEach((btn) => {
  btn.addEventListener('click', () => startMode(btn.dataset.mode));
});

el.homeBtn.addEventListener('click', goHome);

el.card.addEventListener('click', (e) => {
  if (e.target.closest('.speak')) return;
  setFlipped(!state.flipped);
});

el.speak.addEventListener('click', (e) => { e.stopPropagation(); speak(); });
el.speakBack.addEventListener('click', (e) => { e.stopPropagation(); speak(); });

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
  state.cards = await res.json();
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

load();
