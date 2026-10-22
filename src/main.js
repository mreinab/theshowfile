import './style.css';
import manifest from './looks.manifest.json';
import { lookData } from './looks.js';

const track = document.querySelector('[data-track]');
const details = document.querySelector('[data-details]');
const detailImgs = [...details.children];
const about = document.querySelector('[data-about]');
const lookPanel = document.querySelector('[data-look-panel]');
const selected = document.querySelector('[data-selected]');
const selectedInfo = document.querySelector('[data-selected-info]');
const isMobile = matchMedia('(max-width: 900px)');

// Shared detail images used until a look has its own in assets/details/look-XX.
// The large cell always gets the high-res image; the small ones rotate per look.
const PLACEHOLDER_LARGE = '/details/cq5dam.web.3360.3360 (15).avif';
const PLACEHOLDER_SMALL = ['00005', '00033', '00047', '00151', '00192'].map(
  (n) => `/details/${n}-prada-spring-2027-ready-to-wear-details-credit-gorunway.webp`,
);

function placeholders(index) {
  const small = PLACEHOLDER_SMALL.map(
    (_, i) => PLACEHOLDER_SMALL[(index + i) % PLACEHOLDER_SMALL.length],
  );
  return [PLACEHOLDER_LARGE, ...small];
}

// Grid layouts by image count (see .details[data-count] in style.css).
const LAYOUTS = [5, 3, 2, 1];

function detailImages(look, index) {
  if (look.details.length) {
    const count = LAYOUTS.find((n) => n <= look.details.length);
    return look.details.slice(0, count);
  }
  // No images yet: cycle through the layouts so every one can be previewed.
  return placeholders(index).slice(0, LAYOUTS[index % LAYOUTS.length]);
}

const canHover = matchMedia('(hover: hover) and (pointer: fine)').matches;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Pixels per second. Easing toward the target keeps pauses soft.
const SPEED = reduceMotion ? 6 : 28;
const EASE = 3.5;

const looks = manifest.map((img, i) => ({
  ...img,
  number: String(i + 1).padStart(2, '0'),
  pieces: lookData[img.id]?.pieces ?? [],
}));

function createLook(look, isClone) {
  const fig = document.createElement('figure');
  fig.className = 'look';
  fig.dataset.id = look.id;
  if (isClone) {
    fig.setAttribute('aria-hidden', 'true');
  } else {
    fig.tabIndex = 0;
  }

  const img = document.createElement('img');
  img.src = look.src;
  img.width = look.width;
  img.height = look.height;
  img.alt = isClone ? '' : `Look ${look.number}`;
  img.decoding = 'async';
  img.draggable = false;

  const info = document.createElement('figcaption');
  info.className = 'look__info';
  info.innerHTML = `
    <span class="look__number">Look ${look.number}</span>
    <ul>${look.pieces.map((p) => `<li>${p}</li>`).join('')}</ul>
  `;

  fig.append(img, info);
  return fig;
}

function createSet(isClone) {
  const set = document.createElement('div');
  set.className = 'set';
  looks.forEach((look) => set.append(createLook(look, isClone)));
  return set;
}

// --- Build enough copies of the set to always cover the viewport ---------

let setWidth = 0;

function layout() {
  const first = track.firstElementChild ?? track.appendChild(createSet(false));
  setWidth = first.getBoundingClientRect().width;
  if (!setWidth) return;

  const needed = Math.ceil(window.innerWidth / setWidth) + 1;
  while (track.children.length < needed) track.append(createSet(true));
  while (track.children.length > needed) track.lastElementChild.remove();

  x %= setWidth;
}

// --- Continuous loop -----------------------------------------------------

let x = 0;
let speed = SPEED;
let target = SPEED;
let last = performance.now();

function tick(now) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;

  speed += (target - speed) * (1 - Math.exp(-dt * EASE));
  x -= speed * dt;
  if (x <= -setWidth) x += setWidth;

  track.style.transform = `translate3d(${x}px, 0, 0)`;
  requestAnimationFrame(tick);
}

// --- Active look (hover / tap / keyboard focus) --------------------------

let active = null;

function showDetails(fig) {
  if (fig) {
    const index = looks.findIndex((l) => l.id === fig.dataset.id);
    const look = looks[index];
    const images = detailImages(look, index);
    details.dataset.count = images.length;
    detailImgs.forEach((img, i) => {
      img.hidden = i >= images.length;
      if (!img.hidden) img.src = encodeURI(images[i]);
    });
    const info = `
      <p class="about__lead">Look ${look.number}</p>
      <ul>${look.pieces.map((p) => `<li>${p}</li>`).join('')}</ul>
    `;
    lookPanel.innerHTML = info;
    selectedInfo.innerHTML = info;
  }
  details.classList.toggle('is-visible', Boolean(fig));
  about.classList.toggle('shows-look', Boolean(fig));
  document.body.classList.toggle('grid-open', Boolean(fig));

  // Mobile: the info and images open below the carousel, so bring them up.
  if (fig && isMobile.matches) {
    selected.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }
}

function setActive(fig) {
  if (fig === active) return;
  active?.classList.remove('is-active');
  active = fig;
  active?.classList.add('is-active');
  track.classList.toggle('has-active', Boolean(active));
  showDetails(active);
  target = active ? 0 : SPEED;
}

if (canHover) {
  // While a look is active the others ignore the pointer (they sit hidden
  // under the grid), so leaving the active look is what closes it.
  track.addEventListener('pointerover', (e) => {
    const fig = e.target.closest('.look');
    if (fig) setActive(fig);
  });
  track.addEventListener('pointerout', (e) => {
    if (active && !active.contains(e.relatedTarget)) setActive(null);
  });
} else {
  document.addEventListener('click', (e) => {
    // Taps on the opened info/images below the carousel keep it open.
    if (selected.contains(e.target)) return;
    const fig = e.target.closest('.look');
    setActive(fig && fig !== active ? fig : null);
  });
}

track.addEventListener('focusin', (e) => setActive(e.target.closest('.look')));
track.addEventListener('focusout', (e) => {
  if (!track.contains(e.relatedTarget)) setActive(null);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.activeElement?.blur();
    setActive(null);
  }
});

// --- Start ---------------------------------------------------------------

layout();
window.addEventListener('resize', layout);
window.addEventListener('load', layout);
requestAnimationFrame(tick);
