const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('public/fun-list-cards.js', 'utf8');

class Card {
  constructor() {
    this.listeners = new Map();
    this.values = {};
    this.style = {
      setProperty: (key, value) => { this.values[key] = value; },
      zIndex: '',
    };
    this.classes = new Set(['fun-list-card']);
    this.classList = {
      add: (...names) => names.forEach(name => this.classes.add(name)),
      remove: (...names) => names.forEach(name => this.classes.delete(name)),
      contains: name => this.classes.has(name),
    };
    this.captured = null;
  }
  addEventListener(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(callback);
  }
  setPointerCapture(id) { this.captured = id; }
  hasPointerCapture(id) { return this.captured === id; }
  releasePointerCapture(id) { if (this.captured === id) this.captured = null; }
  emit(type, values = {}) {
    const event = {
      pointerId: 1, pointerType: 'mouse', button: 0,
      clientX: 0, clientY: 0, cancelable: true,
      touches: [], changedTouches: [],
      preventDefault() { this.defaultPrevented = true; },
      stopPropagation() { this.stopped = true; },
      ...values,
    };
    for (const callback of this.listeners.get(type) || []) callback(event);
    return event;
  }
}

function setup({ count = 8, touch = false, random = 0.23, randomSequence = null } = {}) {
  const cards = Array.from({ length: count }, () => new Card());
  let now = 0;
  let currentId = 0;
  const timers = new Map();
  function setFakeTimeout(callback, delay) {
    const id = ++currentId;
    timers.set(id, { callback, due: now + delay });
    return id;
  }
  function advance(ms) {
    const end = now + ms;
    while (true) {
      const pending = [...timers].filter(([,t]) => t.due <= end)
        .sort((a,b) => a[1].due - b[1].due)[0];
      if (!pending) break;
      const [id,timer] = pending;
      timers.delete(id);
      now = timer.due;
      timer.callback();
    }
    now = end;
  }
  let randomIndex = 0;
  const context = {
    document: { querySelectorAll: () => cards },
    window: touch ? { ontouchstart: null } : {},
    Math: Object.assign(Object.create(Math), { random: () =>
      randomSequence ? randomSequence[(randomIndex++) % randomSequence.length] : random }),
    setTimeout: setFakeTimeout,
    clearTimeout: (id) => timers.delete(id),
  };
  vm.runInNewContext(source, context);
  return { cards, advance };
}

test('every card receives a shuffled light-neon paper color, even in dark mode', () => {
  const { cards } = setup({ count: 30 });
  const colors = cards.map(card => card.values['--postit-color']);
  assert.equal(colors.length, 30);
  assert.ok(colors.every(color => /^#[0-9A-F]{6}$/.test(color)));
  assert.ok(new Set(colors).size >= 4);
  assert.ok(colors.every((color, i) => i === 0 || color !== colors[i - 1]));
  assert.notEqual(setup({ random: 0.03 }).cards[0].values['--postit-color'],
    setup({ random: 0.88 }).cards[0].values['--postit-color']);
  const css = fs.readFileSync('src/styles/site.css','utf8');
  assert.match(css, /\.fun-list-card\{[^}]*background:var\(--postit-color,#FAFFC7\)/);
  assert.match(css, /\.fun-list-card\{[^}]*box-shadow:0 3px 10px var\(--shadow\)/);
  assert.match(css, /\.fun-list-card\.postit-dragging\{[^}]*box-shadow:0 14px 24px var\(--shadow\)/);
  assert.match(css, /\.fun-list-card\{[^}]*touch-action:pan-y/);
});


test('paper shades are notably more white than highlighter neon and stay the same across themes', () => {
  const { cards } = setup({ count: 40 });
  const colors = [...new Set(cards.map(card => card.values['--postit-color']))];
  assert.ok(colors.length >= 4);
  for (const color of colors) {
    const channels = color.match(/[A-F\d]{2}/gi).map(channel => parseInt(channel,16));
    assert.ok(Math.min(...channels) >= 195, color + ' should be very light pastel');
    assert.ok(Math.max(...channels) === 255 || Math.max(...channels) >= 250);
  }
  const css = fs.readFileSync('src/styles/site.css', 'utf8');
  const paperRule = css.slice(css.indexOf('.fun-list-card{'),css.indexOf('}',css.indexOf('.fun-list-card{')));
  assert.ok(paperRule.includes('background:var(--postit-color,#FAFFC7)'), 'inline background is not dark-mode-dependent');
});

test('random notes are subtly tilted, occasionally straight, and slightly offset from the grid', () => {
  // Program the paper geometry: first and last notes straight, middle notes tilting opposite ways.
  const randomSequence = [
    .21, .02, .45, .55,
    .31, .92, .80, .10, .85,
    .44, .96, .15, .86, .14,
    .27, .04, .37, .63,
  ];
  const { cards } = setup({ count: 4, randomSequence });
  const angles = cards.map(card => parseFloat(card.values['--postit-rotation']));
  assert.equal(angles[0],0);
  assert.ok(angles[1] > 0 && angles[1] < 3.4);
  assert.ok(angles[2] < 0 && angles[2] > -3.4);
  assert.equal(angles[3],0);
  assert.ok(cards.every(card => Math.abs(parseFloat(card.values['--postit-scatter-x'])) <= 5));
  assert.ok(cards.every(card => Math.abs(parseFloat(card.values['--postit-scatter-y'])) <= 4));
  assert.ok(cards.some(card => parseFloat(card.values['--postit-scatter-x']) !== 0));
  const css = fs.readFileSync('src/styles/site.css', 'utf8');
  assert.match(css, /rotate\(var\(--postit-rotation,0deg\)\)/);
  assert.match(css, /var\(--postit-scatter-x,0px\)/);
  assert.match(css, /var\(--postit-scatter-y,0px\)/);
});

test('a photo-like hover wiggle runs once per pointer entry but never interrupts dragging', () => {
  const { cards } = setup();
  const card = cards[0];
  const css = fs.readFileSync('src/styles/site.css', 'utf8');
  assert.match(css, /@keyframes postit-wiggle\{/);
  assert.match(css, /@media\(hover:hover\) and \(pointer:fine\)/);
  assert.match(css, /\.fun-list-card\.postit-wiggle-once:not\(\.postit-dragging\)/);
  card.emit('pointerenter', { pointerType: 'touch' });
  assert.equal(card.classList.contains('postit-wiggle-once'),false);
  card.emit('pointerenter', { pointerType: 'mouse' });
  assert.equal(card.classList.contains('postit-wiggle-once'),true);
  // An animation ending doesn't re-arm wiggle while the pointer stays inside.
  card.classList.remove('postit-wiggle-once');
  card.emit('pointerenter', { pointerType: 'mouse' });
  assert.equal(card.classList.contains('postit-wiggle-once'),false);
  card.emit('pointerleave', { pointerType: 'mouse' });
  card.emit('pointerenter', { pointerType: 'mouse' });
  assert.equal(card.classList.contains('postit-wiggle-once'),true);
  card.emit('pointerdown',{pointerId:12,pointerType:'mouse',clientX:10,clientY:10});
  card.emit('pointermove',{pointerId:12,pointerType:'mouse',clientX:50,clientY:40});
  assert.equal(card.classList.contains('postit-wiggle-once'),false);
  assert.equal(card.classList.contains('postit-dragging'),true);
  card.emit('pointerup',{pointerId:12,pointerType:'mouse',clientX:50,clientY:40});
  card.emit('pointerenter', { pointerType: 'mouse' });
  assert.equal(card.classList.contains('postit-wiggle-once'),false);
  card.emit('pointerleave', { pointerType: 'mouse' });
  card.emit('pointerenter', { pointerType: 'mouse' });
  assert.equal(card.classList.contains('postit-wiggle-once'),true);
});

test('clickable post-it links still work without a drag', () => {
  const { cards } = setup();
  const card = cards[0];
  card.emit('pointerdown', { pointerId: 7, clientX: 30, clientY: 40 });
  assert.equal(card.captured, null, 'do not capture a link until an actual drag begins');
  card.emit('pointerup', { pointerId: 7, clientX: 32, clientY: 42 });
  const click = card.emit('click');
  assert.equal(click.defaultPrevented, undefined);
  assert.equal(click.stopped, undefined);
  assert.equal(card.values['--postit-x'], undefined);
});

test('mouse can freely drag a post-it without reordering its grid or opening a link', () => {
  const { cards, advance } = setup();
  const card = cards[1];
  card.emit('pointerdown', { pointerId: 4, clientX: 100, clientY: 130 });
  card.emit('pointermove', { pointerId: 4, clientX: 104, clientY: 133 });
  assert.equal(card.captured, null, 'minor pointer jitter is not a drag');
  card.emit('pointermove', { pointerId: 4, clientX: 142, clientY: 169 });
  assert.equal(card.captured, 4);
  assert.ok(card.classList.contains('postit-dragging'));
  assert.equal(card.values['--postit-x'], '42px');
  assert.equal(card.values['--postit-y'], '39px');
  card.emit('pointerup', { pointerId: 4, clientX: 144, clientY: 170 });
  assert.equal(card.values['--postit-x'], '44px');
  assert.equal(card.values['--postit-y'], '40px');
  assert.equal(card.captured, null);
  assert.equal(card.classList.contains('postit-dragging'), false);
  assert.equal(cards.length, 8, 'dragging must not clone, remove, or reorder cards');
  const ghost = card.emit('click');
  assert.equal(ghost.defaultPrevented, true, 'a dragged link must not navigate');
  assert.equal(ghost.stopped, true);
  advance(400);
  const realClick = card.emit('click');
  assert.equal(realClick.defaultPrevented, undefined);
});

test('mouse pointer cancellation restores the original post-it position', () => {
  const { cards } = setup();
  const card = cards[0];
  card.emit('pointerdown', { pointerId: 15, clientX: 0, clientY: 0 });
  card.emit('pointermove', { pointerId: 15, clientX: 30, clientY: 12 });
  card.emit('pointercancel', { pointerId: 15 });
  assert.equal(card.values['--postit-x'], '0px');
  assert.equal(card.values['--postit-y'], '0px');
  assert.equal(card.classList.contains('postit-dragging'), false);
});

test('a normal mobile tap works and a swipe can still scroll the page', () => {
  const { cards, advance } = setup({ touch: true });
  const card = cards[0];
  const point = { identifier: 1, clientX: 120, clientY: 240 };
  card.emit('touchstart', { touches: [point] });
  card.emit('touchend', { changedTouches: [point] });
  assert.equal(card.emit('click').defaultPrevented, undefined);
  advance(300);
  card.emit('touchstart', { touches: [point] });
  const scroll = card.emit('touchmove', {
    touches: [{ ...point, clientY: 285 }],
  });
  assert.equal(scroll.defaultPrevented, undefined);
  advance(400);
  assert.equal(card.classList.contains('postit-dragging'), false);
  assert.equal(card.values['--postit-y'], undefined);
  card.emit('touchend', { changedTouches: [{ ...point, clientY: 285 }] });
  assert.equal(card.emit('click').defaultPrevented, undefined);
});

test('on mobile, long-press arms touch dragging and prevents only the actual drag gesture', () => {
  const { cards, advance } = setup({ touch: true });
  const card = cards[2];
  const start = { identifier: 9, clientX: 70, clientY: 80 };
  card.emit('touchstart', { touches: [start] });
  advance(239);
  assert.equal(card.classList.contains('postit-dragging'), false);
  advance(1);
  assert.equal(card.classList.contains('postit-dragging'), true);
  const move = card.emit('touchmove', {
    touches: [{ ...start, clientX: 117, clientY: 124 }],
  });
  assert.equal(move.defaultPrevented, true);
  assert.equal(card.values['--postit-x'], '47px');
  assert.equal(card.values['--postit-y'], '44px');
  const end = card.emit('touchend', {
    changedTouches: [{ ...start, clientX: 117, clientY: 124 }],
  });
  assert.equal(end.defaultPrevented, true);
  assert.equal(card.classList.contains('postit-dragging'), false);
  assert.equal(card.emit('click').defaultPrevented, true);
  advance(400);
  assert.equal(card.emit('click').defaultPrevented, undefined);
});

test('touch pointer events are ignored if native Touch Events are present', () => {
  const { cards } = setup({ touch: true });
  const card = cards[0];
  card.emit('pointerdown', { pointerId: 3, pointerType:'touch', clientX: 10, clientY: 10 });
  card.emit('pointermove', { pointerId: 3, pointerType:'touch', clientX: 80, clientY: 70 });
  card.emit('pointerup', { pointerId: 3, pointerType:'touch', clientX: 80, clientY: 70 });
  assert.equal(card.values['--postit-x'], undefined);
});

test('all three list types retain their content, CMS links and independent post-its', () => {
  const route=fs.readFileSync('src/pages/list/[slug].astro','utf8');
  assert.ok(route.includes('src="/fun-list-cards.js"'));
  for (const name of ['fun-list-card-joy', 'fun-list-card-person', 'fun-list-card-song'])
    assert.ok(route.includes(name));
  assert.ok(route.includes('entry.data.items.map'));
});
