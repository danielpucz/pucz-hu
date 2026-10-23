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
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let nextIndex = initialCount;
  let visibleCount = initialCount;
  let topLayer = 30;
  let nextPreload = null;
  let previousNewAngle = null;
  let lastTap = null;
  let activePeek = null;

  function finishPeek() {
    if (!activePeek) return;
    const peek = activePeek;
    activePeek = null;
    peek.timers.forEach(clearTimeout);
    if (peek.frame) cancelAnimationFrame(peek.frame);
    peek.clone.remove();
    peek.card.classList.remove('photo-peeking');
  }

  function showPeek(card) {
    if (activePeek) return;
    const rect = card.getBoundingClientRect();
    // offsetWidth/Height are the unrotated photo frame dimensions.
    const width = card.offsetWidth;
    const height = card.offsetHeight;
    if (!width || !height) return;

    // Animate a visual copy so the real photo never loses its position
    // in the draggable pile. Put it on body, outside the page-shell stacking context.
    const clone = card.cloneNode(true);
    clone.classList.remove('wiggle-once', 'just-dropped', 'dragging', 'photo-enter');
    clone.classList.add('photo-peek-clone');
    clone.setAttribute('aria-hidden', 'true');
    clone.removeAttribute('role');
    clone.removeAttribute('tabindex');
    const angle = Number.parseFloat(card.style.getPropertyValue('--rot')) || 0;
    const sourceX = rect.left + rect.width / 2;
    const sourceY = rect.top + rect.height / 2;
    clone.style.position = 'fixed';
    clone.style.left = (sourceX - width / 2) + 'px';
    clone.style.top = (sourceY - height / 2) + 'px';
    clone.style.width = width + 'px';
    clone.style.height = height + 'px';
    clone.style.transform = 'rotate(' + angle + 'deg)';
    clone.style.zIndex = '10000';

    // Desktop feels like holding up a photograph ~3.5x bigger;
    // on phones, the viewport's width/height set the maximum size.
    const mobile = innerWidth <= 700;
    const scale = Math.min(3.5, innerWidth * (mobile ? .86 : .76) / width,
      innerHeight * .76 / height);
    const focusedTransform =
      'translate(' + (innerWidth / 2 - sourceX).toFixed(1) + 'px,' +
      (innerHeight / 2 - sourceY).toFixed(1) + 'px) rotate(0deg) scale(' +
      scale.toFixed(3) + ')';
    const peek = { card, clone, timers: [], frame: 0 };
    activePeek = peek;
    document.body.appendChild(clone);
    card.classList.add('photo-peeking');
    const duration = reducedMotion.matches ? 0 : 420;
    peek.frame = requestAnimationFrame(() => {
      if (activePeek === peek) clone.style.transform = focusedTransform;
    });
    // Keep the image centered for roughly two seconds once the animation completes.
    peek.timers.push(setTimeout(() => {
      if (activePeek !== peek) return;
      const current = card.getBoundingClientRect();
      clone.style.transform =
        'translate(' + (current.left + current.width / 2 - sourceX).toFixed(1) + 'px,' +
        (current.top + current.height / 2 - sourceY).toFixed(1) + 'px) rotate(' +
        angle + 'deg)';
      peek.timers.push(setTimeout(finishPeek, duration + 30));
    }, duration + 2000));
  }

  function handleTap(card, event) {
    const now = Date.now();
    if (lastTap && lastTap.card === card &&
        lastTap.pointerType === event.pointerType &&
        now - lastTap.time <= 420 &&
        Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) < 30) {
      lastTap = null;
      showPeek(card);
    } else {
      lastTap = {
        card, pointerType: event.pointerType, time: now,
        x: event.clientX, y: event.clientY,
      };
    }
  }

  function nextLandingRotation() {
    // Tilt each incoming snapshot a little differently, without making the pile look chaotic.
    // Avoid near-identical angles on consecutive drops, including if randomness repeats.
    let angle = 0;
    for (let attempt = 0; attempt < 6; attempt++) {
      angle = (Math.random() < .5 ? -1 : 1) * (3 + Math.random() * 11);
      if (previousNewAngle === null || Math.abs(angle - previousNewAngle) >= 5) break;
    }
    if (previousNewAngle !== null && Math.abs(angle - previousNewAngle) < 5) {
      angle = previousNewAngle > 0 ? -8 : 8;
    }
    previousNewAngle = angle;
    return angle.toFixed(1) + 'deg';
  }

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
    const rotation = nextLandingRotation();
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
    if (isNew) {
      card.classList.add('photo-enter');
      card.addEventListener('animationend', (event) => {
        if (event.animationName === 'photo-drop') card.classList.remove('photo-enter');
      });
    }
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute(
      'aria-label',
      (photo.alt || 'Gallery photo') +
        '. Drag with a pointer or use the arrow keys to move. Press Enter to reveal another. Press C to reset.'
    );

    const image = document.createElement('img');
    // Match perceived size by photo area, not by equal widths. A 3:4 portrait
    // takes roughly 75% of the width of a 4:3 landscape at the same area.
    // The image and its white frame keep their natural, uncropped proportions.
    function balancePhotoSize() {
      if (!image.naturalWidth || !image.naturalHeight) return;
      const aspectRatio = image.naturalWidth / image.naturalHeight;
      const scale = Math.max(0.68, Math.min(1.12, Math.sqrt(aspectRatio / (4 / 3))));
      card.style.setProperty('--photo-scale', scale.toFixed(3));
    }
    image.addEventListener('load', balancePhotoSize);
    // The interactive card already announces the image description.
    image.alt = '';
    image.draggable = false;
    image.loading = isNew ? 'eager' : 'lazy';
    image.decoding = 'async';
    image.src = photo.src;
    card.appendChild(image);
    if (image.complete) balancePhotoSize();

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
      const completedTap = !didDrag && !cancelled;
      activePointer = null;
      didDrag = false;
      card.classList.remove('dragging', 'wiggle-once');
      card.classList.add('just-dropped');
      if (card.hasPointerCapture?.(event.pointerId)) {
        card.releasePointerCapture(event.pointerId);
      }
      if (completedDrag) {
        lastTap = null;
        showNext();
      } else if (completedTap) {
        handleTap(card, event);
      }
    }

    card.addEventListener('pointerenter', (event) => {
      if (fineHover.matches && (event.pointerType === 'mouse' || event.pointerType === 'pen') &&
          activePointer === null && !card.classList.contains('just-dropped') &&
          !card.classList.contains('photo-enter')) {
        card.classList.add('wiggle-once');
      }
    });
    card.addEventListener('pointerleave', () => {
      if (activePointer === null) card.classList.remove('wiggle-once', 'just-dropped');
    });
    card.addEventListener('pointerdown', (event) => {
      if (activePointer !== null || activePeek?.card === card ||
          (event.pointerType === 'mouse' && event.button !== 0)) return;
      activePointer = event.pointerId;
      card.classList.remove('photo-enter'); // Never let the landing animation fight a drag.
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
    card.addEventListener('dblclick', (event) => {
      event.preventDefault();
      if (!didDrag) showPeek(card);
    });
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
          card.classList.remove('wiggle-once', 'photo-enter');
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
        card.classList.remove('photo-enter');
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
    finishPeek();
    lastTap = null;
    nextIndex = initialCount;
    visibleCount = initialCount;
    topLayer = 30;
    nextPreload = null;
    previousNewAngle = null;
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
