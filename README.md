# Pucz.hu — V5.1 frontend

A static Astro 5 frontend with homepage, article, recipe, and 404 templates. Built against the supplied Pucz.hu screenshots, color decisions, original exported article assets, and the 21 exact fortune-cookie messages.

## Run

```bash
npm install
npm run dev
```

Open `/`, `/articles/keep-the-tiny-detectives-busy/`, `/recipes/the-perfect-ramen-egg/`, or `/404`. All routes render through one `BaseLayout.astro` with one `SiteFooter.astro`, which includes the identical article directory and fortune cookie.

## Without Astro

Open `preview/index.html`, `preview/article.html`, `preview/recipe.html`, or `preview/404.html` as standalone demos. For best results, serve the `preview` directory from a local static web server. All illustrations, photos, and scripts are included. Offline previews have filled SVG backups for Ionicons.

## Site details

- Light background is randomly selected once from the 15 original Pucz.hu pastels; dark mode follows `prefers-color-scheme` and uses midnight purple.
- Homepage's clickable writing is `#008EB3` in both color modes. Chips' hover and active states use `#008EB3` with white text.
- Header and back-home handwritten labels + icons use `#3D0396` (light) and `#ADD8E6` (dark). Ionicons use their **filled** names (`send`, `home`, `information-circle`), and the icon is not underlined.
- The fortune uses the provided two **transparent 300 × 300 PNGs**. All 21 original messages live at `src/data/fortune-messages.json`, with matching public script data. On click it shows a fortune *above* the cookie and briefly changes to the broken state.
- Article / recipe cover assets are taken **directly from the Webflow export**, not screenshot crops, and use a `15 / 8` cover frame with `object-fit:cover`.
- The original Webflow 404 ASCII illustration is preserved. **About Ren & Stimpy** opens the exact Internet Archive style guide in a new tab.
- Cursor drawing uses the original site's light palette and muted dark-mode tones, behind page content; it respects reduced motion and coarse pointers.
- Photos are draggable, have a subtle hover/drag wiggle and retain their dropped position until reload.

## Fonts

The user-supplied Infini / Infini Picto fonts and their licensed binaries are **not redistributed in this ZIP**. To obtain precise typography, place your own licensed copies at:

- `public/fonts/Infini-Regular.otf`
- `public/fonts/Infini-Bold.otf`
- `public/fonts/InfiniPicto-Regular.otf`

Proza Libre and Gloria Hallelujah are requested through Google Fonts, with local fallbacks.

## CMS-readiness

The article / recipe data boundary is in `src/layouts/EditorialLayout.astro`: `title`, `description`, `category`, `image`, `imageAlt`, `publishedAt`, `draft`, and `type`. Content is an Astro slot and can later become a Markdown/MDX collection for GitHub/Pages CMS, without changing the CSS. This release intentionally excludes collection/list templates and backend work. The full writing directory includes inert chips for posts not yet implemented, rather than routing them to nonexistent pages.

## Limits

No production deployment was performed. The standalone HTML pages and their shared UI underwent browser interaction and responsive checks. An Astro build requires installing the package dependencies in an environment with registry access.


## V5.2 refinements

- The 404 uses the **exact** attached Ren & Stimpy ASCII artwork, read from `src/data/ren-and-stimpy-ascii.txt` by the Astro template (`?raw`). The standalone preview shows the same art.
- The background cursor canvas draws with a **7–16px** marker at **30% opacity on light backgrounds / 27% on dark**, rather than the previous 2–7px opaque stroke. Canvas remains behind content and respects reduced-motion preferences.
- Handwritten links in the header, back-home action, and 404 navigation no longer rise on hover. Instead they use clickable-surface highlights from the existing token colors, preserving wavy underlines **only on the words**.
- The ornamental separator repeats across the full available footer width on **all pages**, using one `SiteFooter.astro`.
- Updated all standalone previews (`preview/index.html`, `article.html`, `recipe.html`, `404.html`) and their matching drawing script.

No content, CMS contract, cookie messages, or other layout changes in V5.2.


### V5.4 focused refinements

- Handwritten-link hover now uses the **same 11% teal text-only highlight as the homepage expandable links**, without a white fill, border, outline, glow, or movement on hover. Filled Ionicons are not highlighted. Keyboard focus retains its accessible focus indicator.
- All writing-directory chips on all templates use **16pt** Proza Libre (about 21.3 CSS px), including mobile; the old 10px mobile override was removed.
- Corrected a previous discrepancy: all four standalone HTML previews now embed the **current** shared stylesheet instead of an older hover treatment. The Astro source and preview CSS are synchronized.


### V5.5 · Footer chip typography adjustment only

Restored chip typography near its earlier size and increased by just 1 CSS pixel: **12px desktop** (previously 11px) and **11px mobile** (previously 10px). All other styles, markup, content, assets and behavior remain as V5.4, including the corrected handwritten link hover. Synced the source CSS with all four standalone previews.


### V5.6 · Footer chip typography only

Footer chip text is now **14px desktop** and **13px mobile**, consistently across homepage, article, recipe, and 404. Everything else remains identical to V5.5.
