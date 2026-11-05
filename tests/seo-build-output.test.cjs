const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const output = 'dist';
const read = (p) => fs.readFileSync(path.join(output, p), 'utf8');
const home = read('index.html');
const article = read('blog/a-better-internet/index.html');
const recipe = read('recipes/the-perfect-ramen-egg/index.html');
const lists = read('list/things-that-sparks-joy/index.html');

test('sitemap and robots.txt are really generated and the 404 is absent', () => {
  const robots = read('robots.txt');
  assert.ok(robots.includes('Sitemap: https://pucz.hu/sitemap-index.xml'));
  const index = read('sitemap-index.xml');
  assert.match(index, /sitemap-0\.xml/);
  const sitemap = read('sitemap-0.xml');
  for (const route of [
    'https://pucz.hu/',
    'https://pucz.hu/blog/a-better-internet/',
    'https://pucz.hu/recipes/the-perfect-ramen-egg/',
    'https://pucz.hu/list/things-that-sparks-joy/',
  ]) assert.ok(sitemap.includes(route), route + ' missing from sitemap');
  assert.ok(!sitemap.includes('https://pucz.hu/404'), 'error route in sitemap');
});

test('real homepage HTML includes title, text, canonical, schema and meta description', () => {
  assert.ok(home.includes('<title>Pucz.hu ~•~ Dani Pucz, internet maker</title>'));
  assert.ok(home.includes('I like making'));
  assert.ok(home.includes('things for the internet'));
  assert.ok(home.includes('Welcome to my little corner of the internet.'));
  assert.ok(home.includes('Try clicking the wavy bits.'));
  assert.ok(home.includes('<link rel="canonical" href="https://pucz.hu/"'));
  assert.ok(home.includes('name="description"'));
  assert.ok(home.includes('property="og:image"'));
  assert.ok(home.includes('content="https://pucz.hu/images/pucz-hu-og.jpg"'));
  assert.ok(home.includes('"@type":"WebSite"'));
  assert.ok(!home.includes('<meta name="robots" content="noindex"'), 'production should be indexable');
});

test('real blog HTML keeps CMS description and OG image with standardized title', () => {
  assert.ok(article.includes('<title>Better Internet, Less Trust Issues ~ Pucz.hu</title>'));
  assert.ok(article.includes('This isn’t about nostalgia'));
  assert.ok(article.includes('content="https://pucz.hu/images/archive/dialup.webp"'));
  assert.ok(article.includes('"@type":"BlogPosting"'));
  assert.ok(article.includes('property="og:description"'));
});

test('real recipe HTML has its own description, title, cover and Recipe JSON-LD', () => {
  assert.ok(recipe.includes('<title>The Perfect Ramen Egg ~ Pucz.hu</title>'));
  assert.ok(recipe.includes('My recipe for a soft ramen egg with soy sauce marinade.'));
  assert.ok(recipe.includes('content="https://pucz.hu/images/ramen-original.jpg"'));
  assert.ok(recipe.includes('"@type":"Recipe"'));
});

test('real list HTML has the site suffix and default social image', () => {
  assert.ok(lists.includes('<title>A List of Things That Sparks Joy ~ Pucz.hu</title>'));
  assert.ok(lists.includes('content="https://pucz.hu/images/pucz-hu-og.jpg"'));
});
