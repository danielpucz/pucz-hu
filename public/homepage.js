(() => {
  const intro = document.querySelector('#intro');
  if (!intro) return;

  const stories = JSON.parse(intro.dataset.stories);
  const ending = intro.dataset.ending;
  const first = new Set();
  const second = new Set();

  // Plain text nodes and inline spans form one uninterrupted paragraph.
  // A native <button> is an atomic box even with display:inline and causes
  // oversized gaps whenever an expandable phrase reaches a line ending.
  function text(value, revealed = false) {
    if (!revealed) return document.createTextNode(value);
    const el = document.createElement('span');
    el.textContent = value;
    el.className = 'new-copy';
    return el;
  }

  function link(label, id, level, expanded) {
    const el = document.createElement('span');
    el.className = 'expand-link';
    el.setAttribute('role', 'button');
    el.tabIndex = 0;
    el.textContent = label;
    el.dataset.id = id;
    el.dataset.level = level;
    el.setAttribute('aria-expanded', String(expanded));
    return el;
  }

  function render(focusId) {
    const fragment = document.createDocumentFragment();
    stories.forEach((story, i) => {
      if (i) fragment.append(text(' '));
      fragment.append(text(story.before));
      fragment.append(link(story.link, story.id, 'one', first.has(story.id)));

      if (first.has(story.id)) story.pieces.forEach((piece, j) => {
        fragment.append(text(piece.before, true));
        const id = story.id + ':' + j;
        fragment.append(link(piece.link, id, 'two', second.has(id)));
        if (second.has(id)) fragment.append(text(piece.detail, true));
        if (piece.after) fragment.append(text(piece.after));
      });

      fragment.append(text(story.after));
    });
    fragment.append(text(' ' + ending));
    intro.replaceChildren(fragment);

    if (focusId) {
      intro.querySelectorAll('[role="button"][data-id]').forEach((button) => {
        if (button.dataset.id === focusId) button.focus({ preventScroll: true });
      });
    }
  }

  function activate(target) {
    const id = target.dataset.id;
    if (target.dataset.level === 'one') {
      if (first.has(id)) {
        first.delete(id);
        for (const key of [...second]) if (key.startsWith(id + ':')) second.delete(key);
      } else first.add(id);
    } else {
      second.has(id) ? second.delete(id) : second.add(id);
    }
    render(id);
    const hint = document.querySelector('#intro-hint');
    if (hint) hint.hidden = first.size > 0;
  }

  intro.addEventListener('click', (event) => {
    const target = event.target.closest('[role="button"][data-id]');
    if (target && intro.contains(target)) activate(target);
  });

  // Role=button spans need explicit keyboard activation. The visible text
  // stays truly inline and wraps between words, unlike a button element.
  intro.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const target = event.target.closest('[role="button"][data-id]');
    if (!target || !intro.contains(target)) return;
    event.preventDefault();
    activate(target);
  });

  render();
})();
