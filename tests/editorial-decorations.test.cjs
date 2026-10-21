const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const css = fs.readFileSync('src/styles/site.css', 'utf8');

test('footer chips have 1.5x spacing and slightly larger text only on phones', () => {
  assert.match(css, /\.post-chip\{[^}]*padding:0 8px;margin:0 8px 9px 0/);
  assert.match(css, /\.post-chip\{[^}]*font:500 14px\/25px/);
  assert.match(css, /\.writing-directory\{line-height:2\.6;margin-bottom:60px\}\.post-chip\{font-size:14px\}/);
});

test('editorial highlights get slimmer and CMS lead sizes match regular leads', () => {
  assert.match(css, /\.story-title span\{background:linear-gradient\(to bottom,transparent 6%,var\(--heading-mark\) 6%,var\(--heading-mark\) 94%,transparent 94%\)/);
  assert.match(css, /\.story-title span\{[^}]*box-decoration-break:clone/);
  assert.match(css, /\.story-content p\.lead,\.story-content \.cms-content > p:first-child\{font-size:21px/);
  assert.match(css, /\.story-content p\.lead,\.story-content \.cms-content > p:first-child\{font-size:22px\}/);
  for (const type of ['blog', 'articles', 'meals', 'recipes']) {
    const route = fs.readFileSync('src/pages/' + type + '/[slug].astro', 'utf8');
    assert.doesNotMatch(route, /<style is:global>/, 'duplicate lead style in ' + type);
  }
});

test('dropcap boxes reserve identical width/height independently of glyph', () => {
  assert.match(css, /\.story-content \.dropcap\{[^}]*inline-size:1\.12em;block-size:\.87em/);
  const layout = fs.readFileSync('src/layouts/EditorialLayout.astro', 'utf8');
  assert.match(layout, /src="\/editorial-dropcaps\.js"/);

  class Text {
    constructor(text, parent) { this.nodeValue = text; this.parentNode = parent; }
    splitText(index) {
      const remainder = new Text(this.nodeValue.slice(index), this.parentNode);
      this.nodeValue = this.nodeValue.slice(0, index);
      const siblings = this.parentNode.children;
      siblings.splice(siblings.indexOf(this) + 1, 0, remainder);
      return remainder;
    }
  }
  function para(text) {
    const p = {
      children: [],
      classes: new Set(),
      classList: {
        contains(name) { return p.classes.has(name); },
        add(name) { p.classes.add(name); },
      },
      replaceChild(replacement, previous) {
        this.children.splice(this.children.indexOf(previous), 1, replacement);
      },
    };
    p.children.push(new Text(text, p));
    return p;
  }
  const paragraphs = [para('I love this.'), para('Great ideas.'), para('“Another beginning.”')];
  const document = {
    querySelectorAll: () => paragraphs,
    createTreeWalker: (p) => {
      const nodes = p.children.filter((child) => child instanceof Text);
      let i = 0;
      return { nextNode: () => nodes[i++] || null };
    },
    createElement: () => ({ className: '', textContent: '' }),
  };
  const script = fs.readFileSync('public/editorial-dropcaps.js', 'utf8');
  vm.runInNewContext(script, { document, NodeFilter: { SHOW_TEXT: 4 } });
  assert.deepEqual(paragraphs.map((p) => p.children.find((x) => x.className === 'dropcap').textContent), ['I', 'G', '“A']);
  assert.ok(paragraphs.every((p) => p.classes.has('has-dropcap')));
  assert.deepEqual(paragraphs.map((p) => p.children.map((x) => x.textContent ?? x.nodeValue).join('')),
    ['I love this.', 'Great ideas.', '“Another beginning.”']);
});

function drawHarness() {
  const listeners = new Map();
  const calls = { stamps: 0, clears: 0, strokes: 0, arcs: [], colors: [] };
  const ctx = {
    setTransform() {}, beginPath() {}, moveTo() {}, lineTo() {},
    arc(...args) { calls.arcs.push(args); },
    stroke() { calls.strokes++; },
    fill() { calls.stamps++; calls.colors.push(this.fillStyle); },
    clearRect() { calls.clears++; },
  };
  const canvas = { dataset: {}, getContext: () => ctx, width: 0, height: 0 };
  const dark = { matches: false, addEventListener() {} };
  const reduced = { matches: false, addEventListener() {} };
  let now = 1000;
  const InteractiveElement = class { closest() { return {}; } };
  const window = {
    document: {
      querySelector: () => canvas,
      addEventListener(name, callback) {
        if (!listeners.has(name)) listeners.set(name, []);
        listeners.get(name).push(callback);
      },
    },
    matchMedia: (q) => q.includes('reduced-motion') ? reduced : dark,
    performance: { now: () => now },
    devicePixelRatio: 1,
    innerWidth: 390, innerHeight: 844,
    Math, Element: InteractiveElement,
    HTMLElement: class {},
    requestAnimationFrame() { return 1; },
    addEventListener(name, callback) {
      if (!listeners.has(name)) listeners.set(name, []);
      listeners.get(name).push(callback);
    },
  };
  vm.runInNewContext(fs.readFileSync('public/cursor-drawing.js', 'utf8'), window);
  function emit(name, event = {}) {
    for (const fn of listeners.get(name) || []) fn(event);
  }
  const touch = { pointerType: 'touch', isPrimary: true, pointerId: 1, clientX: 120, clientY: 220, target: {} };
  return { calls, emit, touch, dark, InteractiveElement, advance: (ms) => { now += ms; } };
}

test('touch tapping stamps a mark, but scrolling, cancellations and dragged photos do not', () => {
  const h = drawHarness();
  h.emit('pointerdown', h.touch);
  h.emit('pointerup', h.touch);
  assert.equal(h.calls.stamps, 1);
  assert.equal(h.calls.colors[0], '#FFFFFF');

  h.emit('pointerdown', h.touch);
  h.emit('pointermove', { ...h.touch, clientY: 300 });
  h.emit('pointerup', { ...h.touch, clientY: 300 });
  assert.equal(h.calls.stamps, 1);

  h.emit('pointerdown', h.touch);
  h.emit('pointercancel', h.touch);
  h.emit('pointerup', h.touch);
  assert.equal(h.calls.stamps, 1);

  const interactive = { ...h.touch, target: new h.InteractiveElement() };
  h.emit('pointerdown', interactive);
  h.emit('pointerup', interactive);
  assert.equal(h.calls.stamps, 1, 'tapping a draggable or interactive element must not paint');

  h.dark.matches = true;
  h.emit('pointerdown', h.touch);
  h.emit('pointerup', h.touch);
  assert.equal(h.calls.stamps, 2);
  assert.equal(h.calls.colors[1], '#0F0F0F');
  h.emit('keydown', { key: 'c', altKey: false, ctrlKey: false, metaKey: false, target: {} });
  assert.equal(h.calls.clears, 1);
});

test('touch canvas is not hidden just for coarse pointers', () => {
  const component = fs.readFileSync('src/components/CursorDrawing.astro', 'utf8');
  assert.doesNotMatch(component, /@media[^{]*pointer: coarse/);
  assert.match(component, /prefers-reduced-motion: reduce/);
  assert.match(component, /pointer-events: none/);
});
