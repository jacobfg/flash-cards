const state = {
  cards: [],
  enLabels: [],  // parallel to cards: disambiguated English-front label
  order: [],
  index: 0,
  flipped: false,
  mode: null, // 'it' = Italian front, 'en' = English front
};

const el = {
  home: document.getElementById('home'),
  deck: document.getElementById('deck'),
  card: document.getElementById('card'),
  term: document.getElementById('term'),
  translation: document.getElementById('translation'),
  hint: document.getElementById('hint'),
  sub: document.getElementById('sub'),
  subBack: document.getElementById('sub-back'),
  sheet: document.getElementById('sheet'),
  sheetBackdrop: document.getElementById('sheet-backdrop'),
  sheetClose: document.getElementById('sheet-close'),
  wordList: document.getElementById('word-list'),
  progressEls: document.querySelectorAll('.face .progress'),
  swipeHint: document.getElementById('swipe-hint'),
  themeColor: document.querySelector('meta[name="theme-color"]'),
};

const IDLE_MS = 3000;
let idleTimer = null;

function bumpIdle() {
  el.card.classList.remove('idle');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (!el.deck.hidden) el.card.classList.add('idle');
  }, IDLE_MS);
}

const PROGRESS_DOTS = 10;

// Render 10 dots as a fill-ratio bar across both faces' progress containers.
// Total progress is (index+1)/length, split across 10 slices.
function renderProgress() {
  const total = state.order.length;
  const progress = total ? (state.index + 1) / total : 0;
  const filled = progress * PROGRESS_DOTS;
  el.progressEls.forEach((container) => {
    if (container.children.length !== PROGRESS_DOTS) {
      container.innerHTML = '';
      for (let i = 0; i < PROGRESS_DOTS; i++) {
        const dot = document.createElement('span');
        dot.className = 'dot';
        container.appendChild(dot);
      }
    }
    for (let i = 0; i < PROGRESS_DOTS; i++) {
      const fillAmount = Math.max(0, Math.min(1, filled - i));
      container.children[i].style.setProperty('--fill', fillAmount);
    }
  });
}

function dismissSwipeHint() {
  el.swipeHint.hidden = true;
}

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

// When two Italian words share the same English first translation (e.g.
// figlia → "child, girl…" and figlio → "child, son…"), we need to
// disambiguate the English-front display. Append the next translation in
// brackets — "child (girl)", "child (son)" — so it's still recognisable.
function buildEnLabels(cards) {
  const counts = new Map();
  for (const c of cards) {
    const f = splitEn(c.en).first;
    counts.set(f, (counts.get(f) || 0) + 1);
  }
  return cards.map((c) => {
    const parts = (c.en || '').split(',').map((s) => s.trim()).filter(Boolean);
    const [first, ...rest] = parts;
    if (!first || counts.get(first) < 2) return first || '';
    return rest.length ? `${first} (${rest[0]})` : first;
  });
}

function currentCard() {
  return state.cards[state.order[state.index]];
}

function render() {
  const card = currentCard();
  if (!card) return;

  // Front always shows the language the user chose; back shows the other side.
  // The Italian side carries the pronunciation; the English side carries any
  // alternate translations. Use the disambiguated English label so two cards
  // with the same first translation are still distinguishable.
  const cardIdx = state.order[state.index];
  const enLabel = state.enLabels[cardIdx];
  const en = splitEn(card.en);
  if (state.mode === 'it') {
    el.term.textContent = card.it;
    el.sub.textContent = card.pron || '';
    el.translation.textContent = enLabel;
    el.subBack.textContent = en.rest;
  } else {
    el.term.textContent = enLabel;
    el.sub.textContent = en.rest;
    el.translation.textContent = card.it;
    el.subBack.textContent = card.pron || '';
  }
  el.hint.textContent = card.hint || '';
  renderProgress();
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
  el.swipeHint.hidden = false;
  render();
  bumpIdle();
}

function goHome() {
  state.mode = null;
  el.deck.hidden = true;
  el.home.hidden = false;
  el.card.classList.remove('flipped');
  el.card.classList.remove('idle');
  clearTimeout(idleTimer);
  document.body.classList.remove('revealed');
  closeSheet();
  setThemeColor(FRONT_COLOR);
  audioPlayer.pause();
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

function openSheet() {
  // Sort entries alphabetically by what's shown (Italian or English).
  // Tapping jumps to that card; the deck's shuffle order is unaffected.
  el.wordList.innerHTML = '';
  const collator = new Intl.Collator(state.mode === 'it' ? 'it' : 'en', { sensitivity: 'base' });
  const labelFor = (cardIdx) =>
    state.mode === 'it' ? state.cards[cardIdx].it : state.enLabels[cardIdx];
  const currentCardIdx = state.order[state.index];

  const entries = state.order.map((cardIdx, listIdx) => ({ cardIdx, listIdx }))
    .sort((a, b) => collator.compare(labelFor(a.cardIdx), labelFor(b.cardIdx)));

  for (const { cardIdx, listIdx } of entries) {
    const li = document.createElement('li');
    li.textContent = labelFor(cardIdx);
    if (cardIdx === currentCardIdx) li.classList.add('current');
    li.addEventListener('click', () => {
      state.index = listIdx;
      render();
      closeSheet();
    });
    el.wordList.appendChild(li);
  }
  el.sheet.hidden = false;
  requestAnimationFrame(() => {
    const current = el.wordList.querySelector('.current');
    current?.scrollIntoView({ block: 'center' });
  });
}

function closeSheet() {
  el.sheet.hidden = true;
}

document.querySelectorAll('.mode').forEach((btn) => {
  btn.addEventListener('click', () => startMode(btn.dataset.mode));
});

// The card-header / card-footer controls are duplicated on each face so
// they animate with the flip — wire every instance to the same handler.
document.querySelectorAll('.home-btn').forEach((btn) => {
  btn.addEventListener('click', (e) => { e.stopPropagation(); goHome(); });
});
document.querySelectorAll('.card-footer .speak').forEach((btn) => {
  btn.addEventListener('click', (e) => { e.stopPropagation(); speak(); });
});
document.querySelectorAll('.card-footer .word-list').forEach((btn) => {
  btn.addEventListener('click', (e) => { e.stopPropagation(); openSheet(); });
});

el.card.addEventListener('click', (e) => {
  if (e.target.closest('.speak, .word-list, .home-btn')) return;
  setFlipped(!state.flipped);
});

el.sheetBackdrop.addEventListener('click', closeSheet);
el.sheetClose.addEventListener('click', closeSheet);

document.addEventListener('keydown', (e) => {
  if (el.deck.hidden) return;
  if (e.key === 'Escape' && !el.sheet.hidden) { closeSheet(); return; }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') dismissSwipeHint();
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
    dismissSwipeHint();
    if (dx < 0) go(1);
    else go(-1);
  }
}, { passive: true });

// Any pointer or key activity wakes the controls. Bound on capture so we
// catch taps before they trigger flips/swipes.
['pointerdown', 'pointermove', 'keydown'].forEach((evt) => {
  document.addEventListener(evt, () => {
    if (!el.deck.hidden) bumpIdle();
  }, { passive: true });
});

async function load() {
  const res = await fetch('cards.json', { cache: 'no-cache' });
  const data = await res.json();
  // Tolerate the older flat-array shape so existing installs don't break
  // before the SW updates.
  state.cards = Array.isArray(data) ? data : (data.cards || []);
  state.enLabels = buildEnLabels(state.cards);
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

load();
