const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const script = fs.readFileSync('public/homepage-gallery.js', 'utf8');

class Element {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.className = '';
    this.style = {
      properties: {},
      setProperty(key, value) { this.properties[key] = value; },
    };
    this.attributes = {};
    this.children = [];
    this.listeners = new Map();
    this.dataset = {};
    this.parent = null;
    this.pointer = null;
    this.complete = false;
    this.naturalWidth = 0;
    this.naturalHeight = 0;
    this.classList = {
      contains: (name) => this.className.split(/\s+/).includes(name),
      add: (...names) => {
        this.className = [...new Set([...this.className.split(/\s+/).filter(Boolean), ...names])].join(' ');
      },
      remove: (...names) => {
        this.className = this.className.split(/\s+/).filter((x) => x && !names.includes(x)).join(' ');
      },
    };
  }
  appendChild(element) {
    this.children.push(element);
    element.parent = this;
    return element;
  }
  remove() {
    if (this.parent) this.parent.children = this.parent.children.filter((item) => item !== this);
    this.parent = null;
  }
  addEventListener(name, listener) {
    if (!this.listeners.has(name)) this.listeners.set(name, []);
    this.listeners.get(name).push(listener);
  }
  emit(name, props = {}) {
    const event = {
      pointerId: 1, pointerType: 'mouse', clientX: 0, clientY: 0,
      button: 0, repeat: false, altKey: false, ctrlKey: false, metaKey: false,
      target: this,
      preventDefault() { this.defaultPrevented = true; },
      ...props,
    };
    for (const listener of this.listeners.get(name) || []) listener(event);
    return event;
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  setPointerCapture(id) { this.pointer = id; }
  hasPointerCapture(id) { return this.pointer === id; }
  releasePointerCapture(id) { if (this.pointer === id) this.pointer = null; }
  querySelectorAll(selector) {
    if (selector !== '.draggable-photo') throw Error('Unexpected selector: ' + selector);
    return this.children.filter((item) => item.classList.contains('draggable-photo'));
  }
}

function setup(options = {}) {
  const { poolCount = 30, random = 0.31, hover = true } = options;
  const collage = new Element('section');
  collage.dataset.photoPool = JSON.stringify(
    Array.from({ length: poolCount }, (_, i) => ({
      src: '/images/photo-' + i + '.jpg',
      alt: 'Test photo ' + i,
    }))
  );
  const document = new Element('document');
  document.querySelector = (selector) => selector === '#homepage-collage' ? collage : null;
  document.createElement = (tag) => new Element(tag);
  const context = {
    document,
    HTMLElement: Element,
    Image: class { constructor() { this.src = ''; } },
    matchMedia: () => ({ matches: hover }),
    Math: Object.assign(Object.create(Math), { random: () => random }),
    console,
  };
  vm.runInNewContext(script, context);
  return { collage, document, cards: () => collage.querySelectorAll('.draggable-photo') };
}

function drag(card, id = 1, dx = 35, dy = 18, pointerType = 'mouse') {
  const common = { pointerId: id, pointerType };
  card.emit('pointerdown', { ...common, clientX: 20, clientY: 20 });
  card.emit('pointermove', { ...common, clientX: 20 + dx, clientY: 20 + dy });
  card.emit('pointerup', { ...common, clientX: 20 + dx, clientY: 20 + dy });
}

test('five randomized photos start at the original slot positions, with unique sources', () => {
  const { cards } = setup();
  const first = cards();
  assert.equal(first.length, 5);
  assert.deepEqual(first.map((c) => c.className.split(' ').at(-1)),
    ['photo-tree', 'photo-couple', 'photo-hippo', 'photo-walking', 'photo-friends']);
  assert.equal(new Set(first.map((c) => c.children[0].src)).size, 5);
  assert.notDeepEqual(
    first.map((c) => c.children[0].src),
    setup({ random: 0.71 }).cards().map((c) => c.children[0].src)
  );
});

test('tap or click does not spawn; dropping after actual drag spawns one centered photo', () => {
  const { cards } = setup();
  const card = cards()[0];
  card.emit('pointerdown', { pointerId: 4 });
  card.emit('pointerup', { pointerId: 4 });
  assert.equal(cards().length, 5);
  drag(card, 5, 24, 40);
  assert.equal(cards().length, 6);
  assert.ok(cards()[5].classList.contains('photo-new'));
  assert.equal(card.classList.contains('wiggle-once'), false);
  assert.equal(card.classList.contains('dragging'), false);
});

test('no duplicate images appear in the first 25; the ceiling stays at 25', () => {
  const { cards } = setup();
  const card = cards()[0];
  for (let i = 0; i < 28; i++) drag(card, i + 1, 14, 16);
  assert.equal(cards().length, 25);
  assert.equal(new Set(cards().map((x) => x.children[0].src)).size, 25);
});

test('smaller pools stop when exhausted', () => {
  const { cards } = setup({ poolCount: 7 });
  for (let i = 0; i < 5; i++) drag(cards()[0], i + 1, 20, 20);
  assert.equal(cards().length, 7);
});

test('C restores initial five, their positions, and their exact initial shuffled photos', () => {
  const { cards, document } = setup();
  const original = cards().map((c) => c.children[0].src);
  drag(cards()[0]);
  drag(cards()[2], 2);
  assert.equal(cards().length, 7);
  document.emit('keydown', { key: 'c' });
  assert.equal(cards().length, 5);
  assert.deepEqual(cards().map((c) => c.children[0].src), original);
  assert.ok(cards().every((card) => !card.style.properties['--dx']));
  drag(cards()[0], 3);
  assert.equal(cards().length, 6);
});

test('C ignores active editing inputs', () => {
  const { cards, document } = setup();
  drag(cards()[0]);
  document.emit('keydown', { key: 'c', target: new Element('input') });
  assert.equal(cards().length, 6);
  document.emit('keydown', { key: 'c', ctrlKey: true });
  assert.equal(cards().length, 6);
});

test('canceling a touch drag neither spawns nor leaves moved coordinates', () => {
  const { cards } = setup();
  const card = cards()[0];
  card.emit('pointerenter', { pointerType: 'touch' });
  assert.equal(card.classList.contains('wiggle-once'), false);
  card.emit('pointerdown', { pointerId: 8, pointerType: 'touch', clientX: 10, clientY: 10 });
  card.emit('pointermove', { pointerId: 8, pointerType: 'touch', clientX: 45, clientY: 40 });
  card.emit('pointercancel', { pointerId: 8, pointerType: 'touch' });
  assert.equal(cards().length, 5);
  assert.equal(card.style.properties['--dx'], '0px');
});

test('hover only wiggles once before a drag, never after release until pointer leaves', () => {
  const { cards } = setup();
  const card = cards()[0];
  card.emit('pointerenter');
  assert.equal(card.classList.contains('wiggle-once'), true);
  drag(card);
  card.emit('pointerenter');
  assert.equal(card.classList.contains('wiggle-once'), false);
  card.emit('pointerleave');
  card.emit('pointerenter');
  assert.equal(card.classList.contains('wiggle-once'), true);
});

test('focused photographs support keyboard movement and revealing another', () => {
  const { cards } = setup();
  const card = cards()[0];
  card.emit('keydown', { key: 'ArrowRight' });
  assert.equal(card.style.properties['--dx'], '24px');
  card.emit('keyup', { key: 'ArrowRight' });
  assert.equal(cards().length, 6);
  card.emit('keydown', { key: 'Enter' });
  assert.equal(cards().length, 7);
});

test('the CMS gallery source has at least five distinct, existing image files', () => {
  const { images } = JSON.parse(fs.readFileSync('src/data/homepage-gallery.json', 'utf8'));
  assert.ok(Array.isArray(images) && images.length >= 5);
  const seen = new Set();
  for (const image of images) {
    assert.ok(typeof image.src === 'string' && image.src.startsWith('/images/'), image.src);
    assert.ok(!seen.has(image.src), 'Duplicate CMS image: ' + image.src);
    seen.add(image.src);
    assert.ok(fs.existsSync('public' + decodeURIComponent(image.src)), 'Missing image: ' + image.src);
    assert.ok(typeof image.alt === 'string' && image.alt.trim().length > 0,
      'Missing alternative text for ' + image.src);
  }
});


test('uploaded photo frames keep intrinsic aspect ratio without cropping', () => {
  const css = fs.readFileSync('src/styles/site.css', 'utf8');
  assert.match(css, /\.polaroid\{[^}]*height:auto/);
  assert.match(css, /\.polaroid img\{[^}]*height:auto/);
  assert.match(css, /\.polaroid img\{[^}]*object-fit:contain/);
  assert.doesNotMatch(css, /\.polaroid img\{[^}]*object-fit:cover/);
  assert.doesNotMatch(css, /\.polaroid\{[^}]*height:var\(--h\)/);
});

test('no-JavaScript homepage fallback uses supplied gallery photos', () => {
  const page = fs.readFileSync('src/pages/index.astro', 'utf8');
  assert.match(page, /src="\/images\/homepage\/photo-001\.jpg"/);
  for (const src of ['tree.jpg', 'couple.jpg', 'hippo.jpg', 'walking.jpg', 'friends.jpg']) {
    assert.ok(!page.includes('src="/images/' + src + '"'), src);
  }
});

test('portrait and landscape cards normalize visual area while preserving image ratios', () => {
  const { cards } = setup();
  const portrait = cards()[0];
  const landscape = cards()[1];
  const portraitImg = portrait.children[0];
  const landscapeImg = landscape.children[0];
  portraitImg.naturalWidth = 750;
  portraitImg.naturalHeight = 1000;
  landscapeImg.naturalWidth = 1333;
  landscapeImg.naturalHeight = 1000;
  portraitImg.emit('load');
  landscapeImg.emit('load');
  const portraitScale = Number(portrait.style.properties['--photo-scale']);
  const landscapeScale = Number(landscape.style.properties['--photo-scale']);
  assert.ok(portraitScale < landscapeScale, 'portrait should be narrower');
  // Compare areas at the same CSS base width: width² / aspect ratio.
  const portraitArea = portraitScale ** 2 / (750 / 1000);
  const landscapeArea = landscapeScale ** 2 / (1333 / 1000);
  assert.ok(Math.abs(portraitArea / landscapeArea - 1) < 0.015,
    'both image orientations should occupy nearly equal area');
  const styles = fs.readFileSync('src/styles/site.css', 'utf8');
  assert.match(styles, /width:calc\(var\(--w\) \* var\(--photo-scale,1\)\)/);
  assert.match(styles, /\.polaroid img\{[^}]*height:auto/);
});

test('the five photos sit in a scattered horizontal row and are slightly larger', () => {
  const css = fs.readFileSync('src/styles/site.css', 'utf8');
  const desktop = css.split('@media(max-width:700px)')[0];
  const slots = ['photo-tree', 'photo-couple', 'photo-hippo', 'photo-walking', 'photo-friends'];
  const positions = slots.map((slot) => {
    const match = desktop.match(new RegExp('\\.' + slot + '\\{--w:(\\d+)%;left:(\\d+)%;top:(\\d+)%'));
    assert.ok(match, 'Missing desktop position for ' + slot);
    return { width: Number(match[1]), left: Number(match[2]), top: Number(match[3]) };
  });
  assert.deepEqual(positions.map((p) => p.left), [0, 20, 40, 60, 79]);
  assert.ok(positions.every((p) => p.top >= 40 && p.top <= 60));
  assert.ok(positions.every((p, i) => p.width > [19, 21, 22, 20, 19][i]));
  assert.match(css, /translateY\(-50%\) rotate\(var\(--rot\)\)/);
});

test('each newly revealed photo briefly lands, then remains freely draggable', () => {
  const { cards } = setup();
  drag(cards()[0]);
  const newCard = cards()[5];
  assert.ok(newCard.classList.contains('photo-enter'));
  newCard.emit('animationend', { animationName: 'photo-drop' });
  assert.ok(!newCard.classList.contains('photo-enter'));
  drag(newCard, 2);
  assert.equal(cards().length, 7);

  const css = fs.readFileSync('src/styles/site.css', 'utf8');
  assert.match(css, /\.polaroid\.photo-new\.photo-enter\{animation:photo-drop/);
  assert.match(css, /@keyframes photo-drop\{/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
});
