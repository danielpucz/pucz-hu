const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const read = (path) => fs.readFileSync(path, 'utf8');
const base = read('src/layouts/BaseLayout.astro');
const editorial = read('src/layouts/EditorialLayout.astro');

test('the shared layout publishes absolute OG and Twitter card metadata with the supplied fallback image', () => {
  const asset = 'public/images/pucz-hu-og.jpg';
  assert.ok(fs.existsSync(asset), 'the actual uploaded social preview artwork must be in public/images');
  const bytes = fs.readFileSync(asset);
  assert.equal(bytes[0], 0xff, 'fallback must be a real JPEG, not a placeholder');
  assert.equal(bytes[1], 0xd8);
  assert.ok(bytes.length > 5000, 'do not substitute a one-pixel placeholder');
  assert.match(base, /const defaultOgImage = '\/images\/pucz-hu-og\.jpg'/);
  assert.match(base, /const ogImageUrl = new URL\(chosenOgImage, siteOrigin\)\.href/);
  assert.match(base, /content=\{ogImageUrl\}/);
  for (const meta of ['og:type','og:site_name','og:title','og:description','og:url','og:image','og:image:alt'])
    assert.ok(base.includes('property="' + meta + '"'), meta);
  for (const name of ['twitter:card','twitter:title','twitter:description','twitter:image','twitter:image:alt'])
    assert.ok(base.includes('name="' + name + '"'), name);
  assert.ok(base.includes('summary_large_image'));
});

test('blog, article, recipe and meal routes pass their own editorial cover to the shared metadata', () => {
  assert.ok(editorial.includes('ogImage={image}'), 'the exact CMS cover should be selected');
  assert.ok(editorial.includes('ogImageAlt={imageAlt}'));
  assert.ok(editorial.includes('ogType="article"'));
  const layouts = [
    'src/layouts/ArticleLayout.astro',
    'src/layouts/RecipeLayout.astro',
  ];
  for (const path of layouts) assert.ok(read(path).includes('EditorialLayout'));
  for (const path of [
    'src/pages/articles/[slug].astro',
    'src/pages/blog/[slug].astro',
    'src/pages/recipes/[slug].astro',
    'src/pages/meals/[slug].astro',
  ]) assert.ok(read(path).includes('image={entry.data.image}'), path);
});

test('default fallback covers homepage, lists and non-editorial routes', () => {
  assert.match(base, /const chosenOgImage = ogImage\?\.trim\(\) \|\| defaultOgImage/);
  for (const path of ['src/pages/index.astro', 'src/pages/list/[slug].astro', 'src/pages/404.astro']) {
    const page = read(path);
    assert.ok(page.includes('BaseLayout'), path);
    assert.ok(!page.includes('ogImage={'), path);
  }
  assert.ok(base.includes('new URL(Astro.url.pathname, siteOrigin).href'), 'canonical OG URL uses real page path');
});
