(() => {
  const canvas = document.querySelector('#cursor-drawing');
  if (!canvas || canvas.dataset.initialized) return;
  canvas.dataset.initialized = 'true';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = matchMedia('(pointer: coarse)');
  if (reduced.matches || coarse.matches) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  let last = null, lastTime = performance.now();
  let pending = null, raf = 0;
  const darkTheme = matchMedia('(prefers-color-scheme: dark)');
  const MIN_WIDTH = 70, MAX_WIDTH = 160;
  let brushWidth = 110; // About 10× the former 7–16px marker.
  let distanceTravelled = 0;
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
      const elapsed = performance.now() - lastTime;
      if (dist > .5 && dist < 150 && elapsed < 250) {
        // A slower hand leaves a wider stroke; faster motion tapers the brush.
        // Subtle travel-based variation gives a natural bristle-like rhythm.
        const speed = dist / Math.max(elapsed, 8);
        distanceTravelled += dist;
        const motionWidth = MAX_WIDTH - Math.min(speed / 2, 1) * (MAX_WIDTH - MIN_WIDTH);
        const variation = Math.sin(distanceTravelled * .018) * 9;
        const targetWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, motionWidth + variation));
        brushWidth += (targetWidth - brushWidth) * .18;
        ctx.beginPath();
        ctx.moveTo(last.x,last.y);
        ctx.lineTo(point.x,point.y);
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.strokeStyle = darkTheme.matches ? '#0F0F0F' : '#FFFFFF';
        ctx.globalAlpha = 1;
        ctx.lineWidth = brushWidth;
        ctx.stroke();
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
  const reset=()=>{last=null;brushWidth=110;distanceTravelled=0;};
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
