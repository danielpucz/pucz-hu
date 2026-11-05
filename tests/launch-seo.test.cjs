const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const read = (path) => fs.readFileSync(path, 'utf8');

test('homepage uses the exact custom Pucz title and server-renders its entire default introduction', () => {
  const home = read('src/pages/index.astro');
  const intro = JSON.parse(read('src/data/intro.json'));
  assert.ok(home.includes('title="Pucz.hu ~•~ Dani Pucz, internet maker"'));
  assert.match(home, /\{intro\.stories\.map\(\(story, i\) =>/);
  assert.match(home, /\{story\.before\}/);
  assert.match(home, /\{story\.link\}/);
  assert.match(home, /\{story\.after\}/);
  assert.match(home, /\{intro\.ending\}/);
  assert.match(home, /role="button" tabindex="0" data-id=\{story\.id\}/);
  assert.ok(intro.stories.length > 0);
  assert.ok(!home.includes('data-ending={intro.ending}></h1>'),
    'the initial HTML must not rely on JavaScript for visible text');
  const js = read('public/homepage.js');
  assert.match(js, /intro\.replaceChildren\(fragment\)/);
  assert.match(js, /intro\.addEventListener\('keydown'/);
});

test('every endpage title follows the Page title ~ Pucz.hu pattern', () => {
  const editorial = read('src/layouts/EditorialLayout.astro');
  const lists = read('src/pages/list/[slug].astro');
  const notFound = read('src/pages/404.astro');
  assert.ok(editorial.includes('title={\`\${title} ~ Pucz.hu\`}'));
  assert.ok(lists.includes("title={displayTitle + ' ~ Pucz.hu'}"));
  assert.ok(notFound.includes('title="404 ~ Pucz.hu"'));
  assert.ok(!editorial.includes('Little Corner of the Internet\`'));
});

test('article and recipe meta descriptions are the original CMS descriptions', () => {
  const editorial = read('src/layouts/EditorialLayout.astro');
  assert.match(editorial, /description=\{description\}/);
  for (const kind of ['articles', 'blog', 'recipes', 'meals']) {
    const page = read('src/pages/' + kind + '/[slug].astro');
    assert.ok(page.includes('description={entry.data.description}'), kind);
    assert.ok(page.includes('image={entry.data.image}'), kind);
  }
  const base = read('src/layouts/BaseLayout.astro');
  assert.match(base, /<meta name="description" content=\{description\}/);
  assert.match(base, /<meta property="og:description" content=\{description\}/);
});

test('published static routes are exposed through Astro sitemap and robots.txt', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.ok(pkg.dependencies['@astrojs/sitemap']);
  const config = read('astro.config.mjs');
  assert.match(config, /import sitemap from '@astrojs\/sitemap'/);
  assert.match(config, /site: 'https:\/\/pucz\.hu'/);
  assert.match(config, /integrations: \[/);
  assert.match(config, /sitemap\(\{/);
  assert.ok(config.includes('pathname.startsWith(\'/404\')'), 'never add 404 to the sitemap');
  const robots = read('public/robots.txt');
  assert.match(robots, /^User-agent: \*$/m);
  assert.match(robots, /^Allow: \/$/m);
  assert.match(robots, /^Sitemap: https:\/\/pucz\.hu\/sitemap-index\.xml$/m);
  const base = read('src/layouts/BaseLayout.astro');
  assert.ok(base.includes('<link rel="sitemap" href="/sitemap-index.xml" />'));
  for (const kind of ['articles', 'recipes', 'funLists']) {
    const file = kind === 'funLists' ? 'src/pages/list/[slug].astro'
      : 'src/pages/' + (kind === 'articles' ? 'blog' : 'recipes') + '/[slug].astro';
    assert.ok(read(file).includes('data.published'), kind + ' sitemap only contains published routes');
  }
});

test('canonical Open Graph URLs and JSON-LD describe existing page content', () => {
  const base = read('src/layouts/BaseLayout.astro');
  const editorial = read('src/layouts/EditorialLayout.astro');
  assert.match(base, /new URL\(Astro\.url\.pathname, siteOrigin\)\.href/);
  assert.ok(base.includes('rel="canonical" href={canonicalUrl}'));
  assert.ok(base.includes('og:url" content={canonicalUrl}'));
  assert.ok(base.includes('og:title" content={title}'));
  assert.ok(base.includes('og:image" content={ogImageUrl}'));
  assert.ok(base.includes("type=\"application/ld+json\" set:html={jsonLd}"));
  assert.ok(base.includes("'@type': 'WebSite'"));
  assert.ok(base.includes("name: 'Dani Pucz'"));
  assert.ok(editorial.includes("type === 'recipe' ? 'Recipe' : 'BlogPosting'"));
  assert.ok(editorial.includes('structuredData={structuredData}'));
  assert.ok(editorial.includes('datePublished: publishedAt'));
  assert.ok(!editorial.includes('aggregateRating'), 'never invent popularity metrics');
  assert.ok(!editorial.includes('recipeIngredient'), 'do not fabricate recipe ingredients');
  assert.ok(!editorial.includes('recipeInstructions'), 'do not fabricate preparation steps');
});

test('404 and Netlify deploy previews are non-indexable', () => {
  assert.ok(read('src/pages/404.astro').includes('noindex={true}'));
  const base = read('src/layouts/BaseLayout.astro');
  assert.ok(base.includes("['deploy-preview', 'branch-deploy'].includes(process.env.CONTEXT || '')"));
  assert.ok(base.includes('(noindex || isPreview) && <meta name="robots" content="noindex" />'));
});
