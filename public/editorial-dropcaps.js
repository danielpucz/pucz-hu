(() => {
  // A fixed box makes narrow I and wide G reserve the same text flow space.
  // ::first-letter alone cannot provide reliable fixed dimensions.
  const leads = document.querySelectorAll(
    '.story-content p.lead, .story-content .cms-content > p:first-child'
  );
  for (const paragraph of leads) {
    if (paragraph.classList.contains('has-dropcap')) continue;
    const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const value = node.nodeValue || '';
      if (!value.trim()) continue;
      // Opening quotation marks belong to the initial too.
      const first = value.match(/^(\s*)([“‘"'(\[]*)(\p{L})/u);
      if (!first) break; // Keep native first-letter styling for unusual starts.
      const start = node.splitText(first[1].length);
      start.splitText(first[2].length + first[3].length);
      const cap = document.createElement('span');
      cap.className = 'dropcap';
      cap.textContent = start.nodeValue;
      start.parentNode.replaceChild(cap, start);
      paragraph.classList.add('has-dropcap');
      break;
    }
  }
})();
