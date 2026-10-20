(() => {
  const canvas = document.querySelector('#cursor-drawing');
  if (!canvas || canvas.dataset.initialized) return;
  canvas.dataset.initialized = 'true';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = matchMedia('(pointer: coarse)');
  if (reduced.matches || coarse.matches) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  let last = null, lastTime = performance.now(), start = performance.now();
  let pending = null, raf = 0, count = 0;
  const lightColors = ['#FFFFFF','#FFFFFF','#868E80','#4ba8c2','#A7EBCA','#FFFFFF','#D8EBA7'];
  const darkColors = ['#30223B','#392946','#26363F','#40324E','#283D43','#4A3450','#303948'];
  const darkTheme = matchMedia('(prefers-color-scheme: dark)');
  function resize() {
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.ceil(innerWidth * ratio);
    canvas.height = Math.ceil(innerHeight * ratio);
    ctx.setTransform(ratio,0,0,ratio,0,0);
    last = null;
  }
  function draw(e) {
    if (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
    const point = {x:e.clientX,y:e.clientY};
    if (last) {
      const dist = Math.hypot(point.x-last.x,point.y-last.y);
      if (dist > .5 && dist < 150 && performance.now()-lastTime < 250) {
        ctx.beginPath();
        ctx.moveTo(last.x,last.y);
        ctx.lineTo(point.x,point.y);
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        const colors = darkTheme.matches ? darkColors : lightColors;
        ctx.strokeStyle = colors[Math.floor(count/12) % colors.length];
        // A wider, translucent marker; tint stays behind the content.
        ctx.globalAlpha = darkTheme.matches ? 0.27 : 0.30;
        ctx.lineWidth = 7 + Math.abs(Math.sin((performance.now()-start)*.003))*9;
        ctx.stroke(); ctx.globalAlpha = 1; count++;
      }
    }
    last = point; lastTime = performance.now();
  }
  function move(e) {
    pending = e;
    if (!raf) raf = requestAnimationFrame(() => {
      raf=0; if (pending) draw(pending); pending=null;
    });
  }
  const reset=()=>{last=null;};
  resize();
  addEventListener('resize',resize,{passive:true});
  addEventListener('pointermove',move,{passive:true});
  addEventListener('pointerleave',reset);
  addEventListener('blur',reset);
  document.addEventListener('visibilitychange',reset);
  addEventListener('keydown',e=>{
    if(e.key.toLowerCase()!=='c'||e.altKey||e.ctrlKey||e.metaKey)return;
    if(e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)))return;
    ctx.clearRect(0,0,canvas.width,canvas.height);reset();
  });
  darkTheme.addEventListener('change',()=>{ctx.clearRect(0,0,canvas.width,canvas.height);reset()});
  reduced.addEventListener('change',()=>{if(reduced.matches)ctx.clearRect(0,0,canvas.width,canvas.height)});
})();
