const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const script = fs.readFileSync('public/homepage.js', 'utf8');
const introData = JSON.parse(fs.readFileSync('src/data/intro.json', 'utf8'));

class FakeNode {
  constructor(tagName = '') {
    this.tagName = tagName.toUpperCase();
    this.nodeType = tagName === '#text' ? 3 : 1;
    this.children = [];
    this.listeners = new Map();
    this.dataset = {};
    this.attributes = {};
    this.className = '';
    this.tabIndex = -1;
    this.parent = null;
    this._text = '';
    this.focused = false;
    this.hidden = false;
  }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return this.children.length ? this.children.map((x) => x.textContent).join('') : this._text; }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  getAttribute(key) { return this.attributes[key]; }
  append(node) { this.children.push(node); node.parent = this; }
  replaceChildren(fragment) {
    this.children = [];
    for (const child of fragment.children) this.append(child);
  }
  addEventListener(event, fn) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(fn);
  }
  closest(selector) {
    if (selector !== '[role="button"][data-id]') throw Error('Unexpected selector: ' + selector);
    return this.attributes.role === 'button' && this.dataset.id ? this : null;
  }
  contains(node) { return this.children.some((c) => c === node || c.contains(node)); }
  querySelectorAll(selector) {
    if (selector !== '[role="button"][data-id]') throw Error('Unexpected selector: ' + selector);
    return this.children.filter((c) => c.attributes.role === 'button' && c.dataset.id);
  }
  focus() { this.focused = true; }
  emit(event, target, key = null) {
    const e = {
      target, key,
      preventDefault() { this.defaultPrevented = true; },
    };
    for (const fn of this.listeners.get(event) || []) fn(e);
    return e;
  }
}

function setup() {
  const intro = new FakeNode('h1');
  intro.dataset.stories = JSON.stringify(introData.stories);
  intro.dataset.ending = introData.ending;
  const hint = new FakeNode('p');
  const document = {
    querySelector: (selector) => selector === '#intro' ? intro
      : selector === '#intro-hint' ? hint : null,
    createElement: (name) => new FakeNode(name),
    createTextNode: (value) => {
      const node = new FakeNode('#text');
      node.textContent = value;
      return node;
    },
    createDocumentFragment: () => new FakeNode('#fragment'),
  };
  vm.runInNewContext(script, { document });
  return { intro, hint };
}

test('expandable phrases wrap as true inline spans instead of atomic button boxes', () => {
  const { intro } = setup();
  const roles = intro.querySelectorAll('[role="button"][data-id]');
  assert.equal(roles.length, introData.stories.length);
  assert.ok(roles.every((node) => node.tagName === 'SPAN'), 'all interactive text should be splittable across words');
  assert.ok(roles.every((node) => node.tabIndex === 0 && node.getAttribute('role') === 'button'));
  assert.ok(intro.children.some((node) => node.nodeType === 3), 'ordinary words should be unwrapped text nodes');
  assert.equal(intro.children.filter((node) => node.tagName === 'BUTTON').length, 0);

  const expected = introData.stories.map((story) => story.before + story.link + story.after).join(' ')
    + ' ' + introData.ending;
  assert.equal(intro.textContent, expected, 'keep exactly the same copy and punctuation');
  const css = fs.readFileSync('src/styles/site.css', 'utf8');
  assert.match(css, /\.expand-link\{display:inline;/);
  const linkRule = css.slice(css.indexOf('.expand-link{'), css.indexOf('}', css.indexOf('.expand-link{'))); 
  assert.doesNotMatch(linkRule, /white-space:\s*nowrap/);
});

test('clicks still reveal/hide nested copy and focus the same phrase', () => {
  const { intro, hint } = setup();
  const first = intro.querySelectorAll('[role="button"][data-id]')[0];
  assert.equal(first.getAttribute('aria-expanded'), 'false');
  intro.emit('click', first);
  const expandedFirst = intro.querySelectorAll('[role="button"][data-id]')[0];
  assert.equal(expandedFirst.getAttribute('aria-expanded'), 'true');
  assert.equal(expandedFirst.focused, true);
  assert.equal(hint.hidden, true);
  assert.ok(intro.textContent.includes(introData.stories[0].pieces[0].link));
  intro.emit('click', expandedFirst);
  const collapsedFirst = intro.querySelectorAll('[role="button"][data-id]')[0];
  assert.equal(collapsedFirst.getAttribute('aria-expanded'), 'false');
  assert.equal(hint.hidden, false);
});

test('keyboard activation supports Enter and Space like a native button', () => {
  const { intro } = setup();
  const first = intro.querySelectorAll('[role="button"][data-id]')[0];
  const enter = intro.emit('keydown', first, 'Enter');
  assert.equal(enter.defaultPrevented, true);
  const expanded = intro.querySelectorAll('[role="button"][data-id]')[0];
  assert.equal(expanded.getAttribute('aria-expanded'), 'true');

  const space = intro.emit('keydown', expanded, ' ');
  assert.equal(space.defaultPrevented, true, 'Space must not scroll the page');
  const collapsed = intro.querySelectorAll('[role="button"][data-id]')[0];
  assert.equal(collapsed.getAttribute('aria-expanded'), 'false');

  const other = intro.emit('keydown', collapsed, 'ArrowDown');
  assert.equal(other.defaultPrevented, undefined);
});

test('intro hint has no decorative arrow', () => {
  const page = fs.readFileSync('src/pages/index.astro', 'utf8');
  assert.match(page, /id="intro-hint">Try clicking the wavy bits\.<\/p>/);
  assert.ok(!page.includes('↗ Try clicking the wavy bits.'));
});
