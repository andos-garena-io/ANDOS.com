/* ---- keep --u locked to the real measured width (iframe/preview safe) ---- */
function fitScreen(){
  const el = document.querySelector('#yuvaGate .screen');
  if(!el) return;
  const w = Math.min(el.parentElement.clientWidth || el.clientWidth || window.innerWidth, 520);
  if(w > 0){
    const u = (w / 843) + 'px';
    el.style.setProperty('--u', u);
    document.documentElement.style.setProperty('--u', u);
  }
}
fitScreen();
addEventListener('resize', fitScreen);
addEventListener('orientationchange', fitScreen);
if (window.ResizeObserver) new ResizeObserver(fitScreen).observe(document.getElementById('yuvaGate'));
(function(){
  /* ---------- background: plain black, only an occasional shooting star ---------- */
  var c=document.querySelector('#yuvaGate #space');
  if(c && !window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    var x=c.getContext('2d'),W=0,H=0,dpr=1;
    var star=null, next=4+Math.random()*4;

    function size(){
      dpr=Math.min(window.devicePixelRatio||1,2);
      W=c.clientWidth;H=c.clientHeight;
      c.width=W*dpr;c.height=H*dpr;
      x.setTransform(dpr,0,0,dpr,0,0);
    }
    size();
    var rt;window.addEventListener('resize',function(){clearTimeout(rt);rt=setTimeout(size,180);});

    function spawn(){
      var fromLeft=Math.random()<0.5;
      var ang=(fromLeft?0.30:0.70)*Math.PI+(Math.random()-0.5)*0.16;
      var ux=Math.cos(ang), uy=Math.abs(Math.sin(ang));
      var span=Math.hypot(W,H);
      var sx=fromLeft? Math.random()*W*0.45 : W*0.55+Math.random()*W*0.45;
      star={ x:sx, y:-H*0.12,
             vx:ux*span*0.5, vy:uy*span*0.5,
             life:0, max:1.05+Math.random()*0.3,
             w:1.0+Math.random()*0.5, tail:0.075 };
    }

    var last=performance.now();
    function draw(now){
      var dt=(now-last)/1000; last=now;
      if(dt>0.1)dt=0.016;

      x.setTransform(1,0,0,1,0,0);
      x.clearRect(0,0,c.width,c.height);
      x.setTransform(dpr,0,0,dpr,0,0);

      if(!star){
        next-=dt;
        if(next<=0){ spawn(); next=8+Math.random()*10; }   /* every 8-18s */
      } else {
        star.life+=dt;
        if(star.life>=star.max){ star=null; }
        else{
          var k=star.life/star.max;
          var hx=star.x+star.vx*star.life, hy=star.y+star.vy*star.life;
          var tx=hx-star.vx*star.tail,     ty=hy-star.vy*star.tail;
          var a=Math.sin(Math.PI*k);

          var g=x.createLinearGradient(tx,ty,hx,hy);
          g.addColorStop(0,'rgba(255,255,255,0)');
          g.addColorStop(0.7,'rgba(205,225,255,'+(a*0.32).toFixed(3)+')');
          g.addColorStop(1,'rgba(255,255,255,'+(a*0.88).toFixed(3)+')');
          x.strokeStyle=g; x.lineWidth=star.w; x.lineCap='round';
          x.beginPath(); x.moveTo(tx,ty); x.lineTo(hx,hy); x.stroke();

          var hg=x.createRadialGradient(hx,hy,0,hx,hy,star.w*5);
          hg.addColorStop(0,'rgba(255,255,255,'+(a*0.7).toFixed(3)+')');
          hg.addColorStop(1,'rgba(255,255,255,0)');
          x.fillStyle=hg; x.beginPath(); x.arc(hx,hy,star.w*5,0,6.2832); x.fill();
        }
      }
      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
  }

  /* --- one-shot tap animation on the Google icon --- */
  var b=document.querySelector('#yuvaGate .gbtn');
  if(b){
    var box=b.parentNode;
    b.addEventListener('pointerdown',function(e){
      if(e.button&&e.button!==0)return;
      var r=b.getBoundingClientRect();
      b.style.setProperty('--rx',((e.clientX-r.left)/r.width*100)+'%');
      b.style.setProperty('--ry',((e.clientY-r.top)/r.height*100)+'%');
      b.classList.remove('tapped');box.classList.remove('tapped');
      void b.offsetWidth;
      b.classList.add('tapped');box.classList.add('tapped');
      armSafety();
      if(navigator.vibrate){try{navigator.vibrate([8,20,10]);}catch(err){}}
    });
    var clearTap;
    function endTap(){
      clearTimeout(clearTap);
      b.classList.remove('tapped');
      box.classList.remove('tapped');
    }
    b.addEventListener('animationend',function(e){
      if(e.animationName==='btnIn'){b.classList.add('shown');}
      if(e.animationName==='gpop'){endTap();}           /* longest tap anim */
    });
    /* safety net: if any animationend is missed (backgrounded tab,
       interrupted gesture) the state is still cleared */
    function armSafety(){clearTimeout(clearTap);clearTap=setTimeout(endTap,1000);}
  }
  /* hard guarantee: button is visible after the entrance window */
  setTimeout(function(){ if(b) b.classList.add('shown'); }, 2600);
})();
