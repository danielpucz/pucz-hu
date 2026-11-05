/* Pucz.hu Fun Lists: physical, shuffle-colored post-it notes.
   Pointer drag on desktop; long-press to drag on touch so lists remain scrollable. */
(() => {
  const cards = [...document.querySelectorAll('.fun-list-card')];
  if (!cards.length) return;

  const colors = [
    '#F4FF8F', // highlighter yellow
    '#FFB9E5', // candy pink
    '#ACFFD3', // mint
    '#A7E9FF', // light cyan
    '#E2C2FF', // lilac
    '#FFCEA0', // peach
    '#D2FF9C', // lime
    '#FFB6BA', // coral pink
  ];
  const hasTouchEvents = 'ontouchstart' in window;
  let previousColor = -1;
  let topLayer = 10;

  cards.forEach((card) => {
    // Choose a fresh color per page view. Inline style keeps it identical
    // in both themes; consecutive cards shouldn't share the same color.
    const offset = Math.floor(Math.random() * (colors.length - 1));
    const colorIndex = (previousColor + 1 + offset) % colors.length;
    card.style.setProperty('--postit-color', colors[colorIndex]);
    previousColor = colorIndex;

    let x = 0;
    let y = 0;
    let tracking = null;
    let touch = null;
    let suppressClick = false;
    let clickTimer = null;

    const position = () => {
      card.style.setProperty('--postit-x', x + 'px');
      card.style.setProperty('--postit-y', y + 'px');
    };
    const lift = () => {
      card.classList.add('postit-dragging');
      card.style.zIndex = String(++topLayer);
    };
    const lower = () => card.classList.remove('postit-dragging');
    const blockAccidentalClick = () => {
      suppressClick = true;
      clearTimeout(clickTimer);
      clickTimer = setTimeout(() => { suppressClick = false; }, 350);
    };

    // Capture phase: a drag must never activate a link, but ordinary
    // clicks/taps on names and songs continue to open their original URL.
    card.addEventListener('click', (event) => {
      if (!suppressClick) return;
      event.preventDefault();
      event.stopPropagation();
      suppressClick = false;
      clearTimeout(clickTimer);
    }, true);
    card.addEventListener('dragstart', (event) => event.preventDefault());

    // Desktop mouse and pen. Capture only *after* movement begins; capturing
    // on pointerdown would steal ordinary clicks away from links inside cards.
    card.addEventListener('pointerdown', (event) => {
      if ((event.pointerType === 'touch' && hasTouchEvents) ||
          event.button !== 0 || tracking) return;
      tracking = {
        id: event.pointerId, px: event.clientX, py: event.clientY,
        x, y, dragged: false,
      };
    });
    const pointerMove = (event) => {
      if (!tracking || tracking.id !== event.pointerId) return;
      const dx = event.clientX - tracking.px;
      const dy = event.clientY - tracking.py;
      if (!tracking.dragged && Math.hypot(dx, dy) < 8) return;
      if (!tracking.dragged) {
        tracking.dragged = true;
        lift();
        card.setPointerCapture?.(tracking.id);
      }
      x = tracking.x + dx;
      y = tracking.y + dy;
      position();
      if (event.cancelable) event.preventDefault();
    };
    card.addEventListener('pointermove', pointerMove);
    const pointerFinish = (event, cancelled = false) => {
      if (!tracking || tracking.id !== event.pointerId) return;
      if (!cancelled) pointerMove(event);
      const wasDragged = tracking.dragged;
      if (cancelled) {
        x = tracking.x;
        y = tracking.y;
        position();
      }
      tracking = null;
      lower();
      if (card.hasPointerCapture?.(event.pointerId)) {
        card.releasePointerCapture(event.pointerId);
      }
      if (wasDragged && !cancelled) blockAccidentalClick();
    };
    card.addEventListener('pointerup', (event) => pointerFinish(event));
    card.addEventListener('pointercancel', (event) => pointerFinish(event, true));
    card.addEventListener('lostpointercapture', (event) => pointerFinish(event, true));

    if (!hasTouchEvents) return;

    // On phones the page must still scroll when swiping the cards.
    // Only a deliberate short hold arms the native-touch drag.
    card.addEventListener('touchstart', (event) => {
      if (touch || event.touches.length !== 1) return;
      const point = event.touches[0];
      const state = {
        id: point.identifier, px: point.clientX, py: point.clientY,
        x, y, armed: false, moved: false, timer: null,
      };
      touch = state;
      state.timer = setTimeout(() => {
        if (touch !== state) return;
        state.armed = true;
        lift();
      }, 240);
    }, { passive: true });

    const matchingTouch = (touches, id) =>
      Array.from(touches).find((point) => point.identifier === id);

    card.addEventListener('touchmove', (event) => {
      if (!touch) return;
      const point = matchingTouch(event.touches, touch.id);
      if (!point) return;
      const dx = point.clientX - touch.px;
      const dy = point.clientY - touch.py;
      if (!touch.armed) {
        if (Math.hypot(dx, dy) > 9 || event.touches.length !== 1) {
          clearTimeout(touch.timer);
          touch = null; // Native vertical scrolling wins, never grab the card.
        }
        return;
      }
      if (event.cancelable) event.preventDefault();
      touch.moved = true;
      x = touch.x + dx;
      y = touch.y + dy;
      position();
    }, { passive: false });

    const finishTouch = (event, cancelled = false) => {
      if (!touch) return;
      const point = matchingTouch(event.changedTouches, touch.id);
      if (!point && !cancelled) return;
      const state = touch;
      touch = null;
      clearTimeout(state.timer);
      if (cancelled && state.moved) {
        x = state.x;
        y = state.y;
        position();
      }
      lower();
      if (state.armed && state.moved && !cancelled) {
        if (event.cancelable) event.preventDefault();
        blockAccidentalClick();
      }
    };
    card.addEventListener('touchend', (event) => finishTouch(event), { passive: false });
    card.addEventListener('touchcancel', (event) => finishTouch(event, true), { passive: true });
    card.addEventListener('contextmenu', (event) => {
      if (touch?.armed) event.preventDefault();
    });
  });
})();
