(() => {
  const rail = document.querySelector('.project-year-rail');
  const yearLinks = [...document.querySelectorAll('.project-year-link')];
  const yearSections = [...document.querySelectorAll('.project-year-section')];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  // iPhone Contacts-style year scrub. The links remain usable without JS.
  if (rail && yearLinks.length) {
    let scrubbing = false;
    let activePointer = null;
    let frame = 0;
    const activate = (year) => {
      yearLinks.forEach(link => {
        const active = link.dataset.year === String(year);
        link.classList.toggle('is-active', active);
        if (active) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    };
    const jump = (year) => {
      const section = document.getElementById('year-' + year);
      if (!section) return;
      activate(year);
      section.scrollIntoView({ behavior: 'instant', block: 'start' });
    };
    const scrubAt = (clientY) => {
      const links = yearLinks.map(link => ({ link, rect: link.getBoundingClientRect() }));
      const closest = links.reduce((a, b) =>
        Math.abs(clientY - (a.rect.top + a.rect.height / 2)) <
        Math.abs(clientY - (b.rect.top + b.rect.height / 2)) ? a : b
      );
      jump(closest.link.dataset.year);
    };
    rail.addEventListener('pointerdown', event => {
      if (event.button !== 0 && event.pointerType === 'mouse') return;
      activePointer = event.pointerId;
      scrubbing = true;
      rail.setPointerCapture(event.pointerId);
      scrubAt(event.clientY);
      event.preventDefault();
    });
    rail.addEventListener('pointermove', event => {
      if (scrubbing && event.pointerId === activePointer) {
        if (frame) cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => scrubAt(event.clientY));
      }
    });
    const stopScrub = event => {
      if (event.pointerId !== activePointer) return;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      scrubbing = false;
      activePointer = null;
      if (rail.hasPointerCapture(event.pointerId)) rail.releasePointerCapture(event.pointerId);
    };
    rail.addEventListener('pointerup', stopScrub);
    rail.addEventListener('pointercancel', stopScrub);
    rail.addEventListener('click', event => {
      const anchor = event.target.closest('a[data-year]');
      if (!anchor) return;
      activate(anchor.dataset.year);
    });

    // Lightweight active-year tracking, never fights a deliberate scrub.
    let ticking = false;
    const updateFromScroll = () => {
      ticking = false;
      if (scrubbing) return;
      let visible = yearSections[0];
      for (const section of yearSections) {
        if (section.getBoundingClientRect().top <= 95) visible = section;
        else break;
      }
      if (visible) activate(visible.dataset.projectYear);
    };
    addEventListener('scroll', () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(updateFromScroll);
      }
    }, { passive: true });
    updateFromScroll();
  }

  let topLayer = 50;
  let lastTap = null;
  let activePeek = null;
  function endPeek() {
    if (!activePeek) return;
    const peek = activePeek;
    activePeek = null;
    clearTimeout(peek.timer);
    clearTimeout(peek.cleanup);
    peek.clone.remove();
    peek.card.classList.remove('is-peeking');
  }
  function enlarge(card) {
    if (activePeek) endPeek();
    const rect = card.getBoundingClientRect();
    const width = card.offsetWidth;
    const height = card.offsetHeight;
    if (!width || !height) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const clone = card.cloneNode(true);
    clone.removeAttribute('role');
    clone.removeAttribute('tabindex');
    clone.setAttribute('aria-hidden', 'true');
    clone.classList.remove('is-dragging');
    clone.classList.add('project-photo-peek');
    clone.style.left = (cx - width / 2) + 'px';
    clone.style.top = (cy - height / 2) + 'px';
    clone.style.width = width + 'px';
    clone.style.height = height + 'px';
    clone.style.transform = 'rotate(' + (getComputedStyle(card).getPropertyValue('--angle') || '0deg') + ')';
    document.body.appendChild(clone);
    card.classList.add('is-peeking');
    const scale = Math.min(3.5, innerWidth * .86 / width, innerHeight * .76 / height);
    const focus = 'translate(' + (innerWidth / 2 - cx) + 'px,' +
      (innerHeight / 2 - cy) + 'px) rotate(0deg) scale(' + scale + ')';
    const peek = { card, clone, timer: 0, cleanup: 0 };
    activePeek = peek;
    requestAnimationFrame(() => { if (activePeek === peek) clone.style.transform = focus; });
    const duration = reducedMotion.matches ? 0 : 420;
    peek.timer = setTimeout(() => {
      if (activePeek !== peek) return;
      const current = card.getBoundingClientRect();
      const angle = getComputedStyle(card).getPropertyValue('--angle') || '0deg';
      clone.style.transform = 'translate(' +
        (current.left + current.width / 2 - cx) + 'px,' +
        (current.top + current.height / 2 - cy) + 'px) rotate(' + angle + ')';
      peek.cleanup = setTimeout(endPeek, duration + 35);
    }, duration + 2000);
  }

  for (const card of document.querySelectorAll('.project-photo')) {
    let x = 0, y = 0, pointerId = null, start = null, dragged = false;
    const moveTo = () => {
      card.style.setProperty('--move-x', x + 'px');
      card.style.setProperty('--move-y', y + 'px');
    };
    card.addEventListener('pointerdown', event => {
      if (activePeek?.card === card || pointerId !== null ||
          (event.pointerType === 'mouse' && event.button !== 0)) return;
      pointerId = event.pointerId;
      start = { pointerX: event.clientX, pointerY: event.clientY, x, y };
      dragged = false;
      card.setPointerCapture(pointerId);
      event.preventDefault();
    });
    card.addEventListener('pointermove', event => {
      if (pointerId !== event.pointerId || !start) return;
      const dx = event.clientX - start.pointerX;
      const dy = event.clientY - start.pointerY;
      if (!dragged && Math.hypot(dx, dy) < 9) return;
      dragged = true;
      card.classList.add('is-dragging');
      card.style.zIndex = String(++topLayer);
      x = start.x + dx;
      y = start.y + dy;
      moveTo();
    });
    const finish = (event, cancelled) => {
      if (pointerId !== event.pointerId || !start) return;
      const dx = event.clientX - start.pointerX;
      const dy = event.clientY - start.pointerY;
      if (cancelled) { x = start.x; y = start.y; moveTo(); }
      else if (Math.hypot(dx, dy) > 9) {
        dragged = true;
        x = start.x + dx; y = start.y + dy; moveTo();
      }
      if (!cancelled && !dragged) {
        const now = Date.now();
        if (lastTap && lastTap.card === card &&
            lastTap.pointerType === event.pointerType &&
            now - lastTap.time < 550 &&
            Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) < 44) {
          lastTap = null;
          enlarge(card);
        } else {
          lastTap = { card, time: now, pointerType: event.pointerType, x: event.clientX, y: event.clientY };
        }
      } else lastTap = null;
      card.classList.remove('is-dragging');
      if (card.hasPointerCapture(pointerId)) card.releasePointerCapture(pointerId);
      pointerId = null;
      start = null;
      dragged = false;
    };
    card.addEventListener('pointerup', event => finish(event, false));
    card.addEventListener('pointercancel', event => finish(event, true));
    card.addEventListener('keydown', event => {
      const movement = { ArrowLeft: [-12,0], ArrowRight: [12,0], ArrowUp: [0,-12], ArrowDown: [0,12] }[event.key];
      if (movement) {
        event.preventDefault();
        x += movement[0]; y += movement[1]; moveTo();
        card.style.zIndex = String(++topLayer);
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        enlarge(card);
      }
    });
  }
  addEventListener('pagehide', endPeek);
})();
