(() => {
  const collage = document.querySelector('#homepage-collage');
  if (!collage || collage.dataset.initialized === 'true') return;

  let configuredPhotos;
  try {
    configuredPhotos = JSON.parse(collage.dataset.photoPool || '[]');
  } catch (error) {
    console.warn('Homepage photo pool could not be read.', error);
    return;
  }
  if (!Array.isArray(configuredPhotos)) return;

  // Keep one instance of each image, even if it was entered twice in the CMS.
  const seen = new Set();
  const photos = configuredPhotos.filter((photo) => {
    if (!photo || typeof photo.src !== 'string' || !photo.src.startsWith('/images/')) return false;
    if (seen.has(photo.src)) return false;
    seen.add(photo.src);
    return true;
  }).map((photo) => ({
    src: photo.src,
    alt: typeof photo.alt === 'string' ? photo.alt : '',
  }));
  if (!photos.length) return;
  collage.dataset.initialized = 'true';

  // Shuffle once for this visit. C restores this initial hand, not a new random hand.
  for (let i = photos.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [photos[i], photos[j]] = [photos[j], photos[i]];
  }

  const slots = [
    { name: 'photo-tree', rotation: '-7deg' },
    { name: 'photo-couple', rotation: '7deg' },
    { name: 'photo-hippo', rotation: '-4deg' },
    { name: 'photo-walking', rotation: '-6deg' },
    { name: 'photo-friends', rotation: '6deg' },
  ];
  const initialCount = Math.min(slots.length, photos.length);
  const maxVisible = Math.min(25, photos.length);
  const fineHover = matchMedia('(hover: hover) and (pointer: fine)');
  let nextIndex = initialCount;
  let visibleCount = initialCount;
  let topLayer = 30;
  let nextPreload = null;

  function preloadNext() {
    if (nextIndex >= photos.length || visibleCount >= maxVisible) return;
    // Only preload after the visitor first interacts, not for every casual page view.
    const img = new Image();
    img.src = photos[nextIndex].src;
    nextPreload = img;
  }

  function showNext() {
    if (visibleCount >= maxVisible || nextIndex >= photos.length) return;
    const photo = photos[nextIndex++];
    const rotation = ((Math.random() - 0.5) * 12).toFixed(1) + 'deg';
    const card = buildPhoto(photo, 'photo-new', rotation, true);
    card.style.zIndex = String(++topLayer);
    collage.appendChild(card);
    visibleCount++;
    nextPreload = null;
    preloadNext();
  }

  function buildPhoto(photo, positionClass, rotation, isNew = false) {
    const card = document.createElement('div');
    card.className = 'polaroid draggable-photo ' + positionClass;
    card.style.setProperty('--rot', rotation);
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute(
      'aria-label',
      (photo.alt || 'Gallery photo') +
        '. Drag with a pointer or use the arrow keys to move. Press Enter to reveal another. Press C to reset.'
    );

    const image = document.createElement('img');
    image.src = photo.src;
    // The interactive card already announces the image description.
    image.alt = '';
    image.draggable = false;
    image.loading = isNew ? 'eager' : 'lazy';
    image.decoding = 'async';
    card.appendChild(image);

    let x = 0, y = 0;
    let activePointer = null, pointerStartX = 0, pointerStartY = 0;
    let startX = 0, startY = 0, didDrag = false, keyboardMoving = false;

    function place() {
      card.style.setProperty('--dx', x + 'px');
      card.style.setProperty('--dy', y + 'px');
    }

    function movePointer(event) {
      const dx = event.clientX - pointerStartX;
      const dy = event.clientY - pointerStartY;
      if (!didDrag && Math.hypot(dx, dy) < 9) return;
      if (!didDrag) {
        didDrag = true;
        card.classList.remove('wiggle-once');
        card.classList.add('dragging');
        card.style.zIndex = String(++topLayer);
      }
      x = startX + dx;
      y = startY + dy;
      place();
    }

    function finishPointer(event, cancelled = false) {
      if (event.pointerId !== activePointer) return;
      if (cancelled) {
        x = startX;
        y = startY;
        place();
      } else {
        movePointer(event); // Include the final movement even if events were throttled.
      }
      const completedDrag = didDrag && !cancelled;
      activePointer = null;
      didDrag = false;
      card.classList.remove('dragging', 'wiggle-once');
      card.classList.add('just-dropped');
      if (card.hasPointerCapture?.(event.pointerId)) {
        card.releasePointerCapture(event.pointerId);
      }
      if (completedDrag) showNext();
    }

    card.addEventListener('pointerenter', (event) => {
      if (fineHover.matches && (event.pointerType === 'mouse' || event.pointerType === 'pen') &&
          activePointer === null && !card.classList.contains('just-dropped')) {
        card.classList.add('wiggle-once');
      }
    });
    card.addEventListener('pointerleave', () => {
      if (activePointer === null) card.classList.remove('wiggle-once', 'just-dropped');
    });
    card.addEventListener('pointerdown', (event) => {
      if (activePointer !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
      activePointer = event.pointerId;
      pointerStartX = event.clientX;
      pointerStartY = event.clientY;
      startX = x;
      startY = y;
      didDrag = false;
      card.classList.remove('wiggle-once');
      card.classList.add('just-dropped');
      card.setPointerCapture(event.pointerId);
      preloadNext();
      event.preventDefault();
    });
    card.addEventListener('pointermove', (event) => {
      if (event.pointerId === activePointer) movePointer(event);
    });
    card.addEventListener('pointerup', (event) => finishPointer(event));
    card.addEventListener('pointercancel', (event) => finishPointer(event, true));
    card.addEventListener('lostpointercapture', (event) => finishPointer(event, true));

    const arrows = {
      ArrowUp: [0, -24],
      ArrowDown: [0, 24],
      ArrowLeft: [-24, 0],
      ArrowRight: [24, 0],
    };
    card.addEventListener('keydown', (event) => {
      if (Object.prototype.hasOwnProperty.call(arrows, event.key)) {
        event.preventDefault();
        if (!keyboardMoving) {
          keyboardMoving = true;
          card.classList.remove('wiggle-once');
          card.classList.add('dragging');
          card.style.zIndex = String(++topLayer);
          preloadNext();
        }
        const [dx, dy] = arrows[event.key];
        const scale = event.shiftKey ? 3 : 1;
        x += dx * scale;
        y += dy * scale;
        place();
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        preloadNext();
        showNext();
      }
    });
    card.addEventListener('keyup', (event) => {
      if (Object.prototype.hasOwnProperty.call(arrows, event.key) && keyboardMoving) {
        event.preventDefault();
        keyboardMoving = false;
        card.classList.remove('dragging');
        card.classList.add('just-dropped');
        showNext();
      }
    });
    card.addEventListener('blur', () => {
      if (!keyboardMoving) return;
      keyboardMoving = false;
      card.classList.remove('dragging');
      showNext();
    });
    return card;
  }

  function resetGallery() {
    nextIndex = initialCount;
    visibleCount = initialCount;
    topLayer = 30;
    nextPreload = null;
    collage.querySelectorAll('.draggable-photo').forEach((photo) => photo.remove());
    for (let i = 0; i < initialCount; i++) {
      const slot = slots[i];
      collage.appendChild(buildPhoto(photos[i], slot.name, slot.rotation));
    }
  }

  resetGallery();

  document.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() !== 'c' || event.altKey || event.ctrlKey || event.metaKey ||
        event.repeat) return;
    if (event.target instanceof HTMLElement &&
        (event.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName))) return;
    resetGallery();
  });
})();
