(() => {
  for (const root of document.querySelectorAll('.fortune')) {
    if (root.dataset.initialized) continue;
    root.dataset.initialized = 'true';
    const messages = JSON.parse(root.dataset.fortunes || '[]');
    const button = root.querySelector('.cookie-button');
    const image = root.querySelector('.cookie-image');
    const output = root.querySelector('.fortune-message');
    if (!button || !image || !output || messages.length === 0) continue;
    let last = -1;
    let resetImageTimer, hideTimer;
    const openFortune = () => {
      let index = Math.floor(Math.random() * messages.length);
      if (messages.length > 1 && index === last) index = (index + 1) % messages.length;
      last = index;
      window.clearTimeout(resetImageTimer); window.clearTimeout(hideTimer);
      output.textContent = messages[index];
      output.hidden = false;
      output.classList.remove('fortune-enter'); void output.offsetWidth;
      output.classList.add('fortune-enter');
      image.src = image.dataset.broken;
      button.classList.add('is-cracked');
      resetImageTimer = window.setTimeout(() => {image.src = image.dataset.full;button.classList.remove('is-cracked')}, 1450);
      hideTimer = window.setTimeout(() => {output.hidden = true;output.classList.remove('fortune-enter')}, 6000);
    };
    button.addEventListener('click',openFortune);
  }
})();
