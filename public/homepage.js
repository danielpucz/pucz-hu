(() => {
  const intro = document.querySelector('#intro');
  if (intro) {
    const stories=JSON.parse(intro.dataset.stories), ending=intro.dataset.ending;
    const first=new Set(),second=new Set();
    function text(value,revealed=false){const el=document.createElement('span');el.textContent=value;if(revealed)el.className='new-copy';return el}
    function link(label,id,level,expanded){const el=document.createElement('button');el.type='button';el.className='expand-link';el.textContent=label;el.dataset.id=id;el.dataset.level=level;el.setAttribute('aria-expanded',String(expanded));return el}
    function render(focusId){const fragment=document.createDocumentFragment();stories.forEach((story,i)=>{
      if(i)fragment.append(text(' '));fragment.append(text(story.before));fragment.append(link(story.link,story.id,'one',first.has(story.id)));
      if(first.has(story.id))story.pieces.forEach((piece,j)=>{fragment.append(text(piece.before,true));const id=story.id+':'+j;fragment.append(link(piece.link,id,'two',second.has(id)));if(second.has(id))fragment.append(text(piece.detail,true));if(piece.after)fragment.append(text(piece.after))});
      fragment.append(text(story.after));
    });fragment.append(text(' '+ending));intro.replaceChildren(fragment);
      if(focusId)intro.querySelectorAll('button').forEach(button=>{if(button.dataset.id===focusId)button.focus({preventScroll:true})});
    }
    intro.addEventListener('click',e=>{const target=e.target.closest('button[data-id]');if(!target)return;const id=target.dataset.id;
      if(target.dataset.level==='one'){
        if(first.has(id)){first.delete(id);for(const key of [...second])if(key.startsWith(id+':'))second.delete(key)}else first.add(id);
      }else{second.has(id)?second.delete(id):second.add(id)}
      render(id);document.querySelector('#intro-hint').hidden=first.size>0;
    });render();
  }
})();
