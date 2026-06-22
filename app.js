const state = {
  cards: [],
  order: [],
  index: 0,
  flipped: false,
};

const el = {
  card: document.getElementById('card'),
  term: document.getElementById('term'),
  translation: document.getElementById('translation'),
  hint: document.getElementById('hint'),
  counter: document.getElementById('counter'),
  prev: document.getElementById('prev'),
  next: document.getElementById('next'),
  flip: document.getElementById('flip'),
  speak: document.getElementById('speak'),
  shuffle: document.getElementById('shuffle'),
  reset: document.getElementById('reset'),
};

function currentCard() {
  return state.cards[state.order[state.index]];
}

function render() {
  const card = currentCard();
  if (!card) return;
  el.term.textContent = card.it;
  el.translation.textContent = card.en;
  el.hint.textContent = card.hint || '';
  el.counter.textContent = `${state.index + 1} / ${state.order.length}`;
  setFlipped(false);
}

function setFlipped(value) {
  state.flipped = value;
  el.card.classList.toggle('flipped', value);
  el.flip.textContent = value ? 'Hide' : 'Reveal';
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

function shuffle() {
  for (let i = state.order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [state.order[i], state.order[j]] = [state.order[j], state.order[i]];
  }
  state.index = 0;
  render();
}

function resetOrder() {
  state.order = state.cards.map((_, i) => i);
  state.index = 0;
  render();
}

el.card.addEventListener('click', (e) => {
  if (e.target.closest('.speak')) return;
  setFlipped(!state.flipped);
});

el.flip.addEventListener('click', () => setFlipped(!state.flipped));
el.prev.addEventListener('click', () => go(-1));
el.next.addEventListener('click', () => go(1));
el.speak.addEventListener('click', (e) => { e.stopPropagation(); speak(); });
el.shuffle.addEventListener('click', shuffle);
el.reset.addEventListener('click', resetOrder);

document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') go(-1);
  else if (e.key === 'ArrowRight') go(1);
  else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setFlipped(!state.flipped); }
  else if (e.key.toLowerCase() === 's') speak();
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
  resetOrder();
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

load();
