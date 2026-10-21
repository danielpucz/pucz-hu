# Homepage photo gallery (Pages CMS)

## Edit the photo pool

Open **Pages CMS → Homepage → Photo gallery**. The gallery is one ordered JSON file at `src/data/homepage-gallery.json`, with repeatable entries:

- **Photo**: select an image or upload a new one. New uploads should go into `public/images/homepage/`.
- **Alternative text**: a concise description of the photo, used by the keyboard- and screen-reader-accessible photo card.

The initial 30 entries are **temporary testing images from the existing site and article archive**. Replace them with your preferred 30–50 photos before considering the gallery final. Their existing site paths are preserved: no copies have been added.

Use JPG, WebP or AVIF wherever possible. Compress photos for the web before uploading (typically at most 1200–1600 pixels wide and ideally under 350 KB each). The page initially loads five images and adds only the images visitors uncover.

## Interaction rules

1. **Each page reload** independently shuffles the complete CMS photo pool and displays five images in the five existing homepage slots.
2. Hovering a photo **on a desktop pointer** triggers one slight wiggle. The wiggle does not loop.
3. When a pointer moves a photo at least **9px** and releases it, a new, previously unused photo is inserted **at the center of the existing collage**, above older photos.
4. This continues until **25 visible photos**, or until the pool is exhausted, whichever happens first. Simply clicking/tapping, or canceling a drag, does not add a photo.
5. Dragging uses immediate pointer positions, a temporary pickup shadow, and **no bounce, wiggle or spring on release**. Phone and tablet touch interactions have no hover wiggle.
6. **C** restores the initial five-photo shuffle and their original positions. The existing canvas code independently clears its drawing on the same key.
7. Keyboard alternative: focus a photo with Tab, use arrow keys to move it (Shift+arrow for bigger steps), or press Enter to reveal another photo. C resets. Keyboard shortcuts are inactive while editing a form field.
8. Photos are not repeated within a session. The photo list is compiled from Pages CMS at build time; editing it on the CMS automatically publishes a new Netlify build.

## Technical boundaries

- CMS source: `src/data/homepage-gallery.json`
- Editor: `.pages.yml`, **Homepage / Photo gallery**
- Static fallback and JSON bootstrap: `src/pages/index.astro`
- Image interaction: `public/homepage-gallery.js` (separate from expanding intro text in `public/homepage.js`)
- Photo visual style and phone/tablet layout: `src/styles/site.css`

Only the homepage photo pool and its interaction styles are touched. The shared site header/footer, articles, recipes, other CMS collections, global random background, and background brush are unchanged.
