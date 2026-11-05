const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const read = (path) => fs.readFileSync(path, 'utf8');
const base = 'src/content/fun-lists/';
const lists = [
  { file: 'incredible-people.md', slug: 'incredible-people', type: 'people', count: 45 },
  { file: 'things-that-sparks-joy.md', slug: 'things-that-sparks-joy', type: 'joy', count: 134 },
  { file: 'list-of-songs-that-doesnt-end-but-fade-out.md', slug: 'list-of-songs-that-doesnt-end-but-fade-out', type: 'songs', count: 41 },
];

test('all three fun lists publish the complete migrated original items at unchanged URLs', () => {
  for (const { file, slug, type, count } of lists) {
    const content = read(base + file);
    const original = read('src/data/archive-lists/' + file.replace('.md', '.html'));
    assert.match(content, /^published: true$/m, file);
    assert.ok(content.includes('legacyPath: /list/' + slug + '/'), file);
    assert.ok(content.includes('listType: ' + type), file);
    const items = content.match(/^[ \t]*- _block: /gm) || [];
    const archivedCards = original.match(/class="draggable\b/g) || [];
    assert.equal(items.length, count, file + ' item count');
    assert.equal(archivedCards.length, count, file + ' archive count');
    assert.equal(items.length, archivedCards.length, file + ' must contain every original card');
  }
});

test('original introductions and full song links are retained, without invented placeholder text', () => {
  const joy = read(base + 'things-that-sparks-joy.md');
  const people = read(base + 'incredible-people.md');
  const songs = read(base + 'list-of-songs-that-doesnt-end-but-fade-out.md');
  assert.ok(joy.includes('Sometimes, joy sneaks in quietly'));
  assert.ok(joy.includes('This list is my gratitude:'));
  assert.ok(joy.includes('Let\'s begin.'));
  assert.ok(people.includes('Here’s my growing list of people'));
  assert.ok(songs.includes('Some songs don’t stop; they dissolve like a sunset'));
  assert.ok(songs.includes('displayTitle: List of Songs that doesn’t End'));
  assert.equal((songs.match(/^  url: https:\/\/(?:www\.youtube\.com|music\.youtube\.com)\//gm) || []).length, 41);
  assert.ok(people.includes('name: Helga Eisenbeck'));
  assert.ok(joy.includes('text: randomly found live music'));
});

test('the list route uses the CMS records, preserves legacy path, and includes shared site chrome', () => {
  const route = read('src/pages/list/[slug].astro');
  assert.ok(route.includes("getCollection('funLists', ({ data }) => data.published)"));
  assert.ok(route.includes("entry.data.legacyPath?.split('/')"));
  assert.ok(route.includes("import BaseLayout"));
  assert.ok(route.includes('<Content />'), 'original markdown intro must be rendered');
  for (const block of ['joy', 'person']) assert.ok(route.includes("item._block === '" + block + "'"));
  assert.ok(route.includes('fun-list-card-song'), 'song entries use the remaining discriminated union branch');
  assert.ok(route.includes('entry.data.items.map'), 'render the entire CMS collection');
  assert.ok(route.includes('class="back-home fun-list-back"'));
  assert.ok(route.includes('src="/fun-list-cards.js"'), 'list interactions only load on the list routes');
  assert.ok(route.includes('target="_blank" rel="noopener noreferrer"'));
});

test('links to all published fun lists appear within the existing footer directory', () => {
  const footer = read('src/components/ArticleDirectory.astro');
  assert.ok(footer.includes("getCollection('funLists', ({ data }) => data.published)"));
  assert.ok(footer.includes("href: data.legacyPath || '/list/'"));
  assert.ok(footer.includes('title: data.navigationTitle || data.title'));
  assert.ok(footer.includes("category: data.category || 'Very Good Lists I’ve Made'"));
});

test('responsive list pages preserve Figma card styling, dark-theme paper, and wrapping', () => {
  const css = read('src/styles/site.css');
  assert.match(css, /\.fun-list-grid\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css, /\.fun-list-card\{[^}]*background:var\(--postit-color,#F4FF8F\);color:#381652/);
  assert.match(css, /\.fun-list-card-person\{[^}]*min-height:/);
  assert.match(css, /\.fun-list-card-joy\{[^}]*min-height:/);
  assert.match(css, /\.fun-list-card-song\{[^}]*min-height:/);
  assert.match(css, /\.fun-list-joy-text\{[^}]*var\(--font-hand\)/);
  assert.match(css, /\.fun-list-person-note\{[^}]*var\(--font-hand\)/);
  assert.match(css, /\.fun-list-song-title\{[^}]*var\(--font-display\)/);
  assert.match(css, /@media\(max-width:700px\)\{[^]*?\.fun-list-grid\{grid-template-columns:minmax\(0,1fr\)/);
});

test('list title can be shortened in CMS while archival title remains unchanged', () => {
  const schema = read('src/content.config.ts');
  const cms = read('.pages.yml');
  assert.match(schema, /const funLists = defineCollection\(\{[^]*?displayTitle: z\.string\(\)\.optional\(\)/);
  const listSettings = cms.slice(cms.indexOf('  - name: fun_lists'), cms.indexOf('  # Events:'));
  assert.match(listSettings, /- name: displayTitle/);
  assert.match(listSettings, /- name: published/);
  assert.ok(!listSettings.includes('keep off until visual design is approved'));
});
