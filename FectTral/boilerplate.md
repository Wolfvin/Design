# FectTral Full Boilerplate Reference

This file contains the complete minimal boilerplate for a FectTral cyberpunk UI page. Copy and adapt.

## Minimal Full-Page Shell (no content)

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>FectTral – [Page Name]</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;900&family=Exo+2:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;overflow:hidden}
:root{
  --bg-void:#020408;--bg-deep:#050912;--bg-panel:#0a1428;--bg-card:#0d1a32;
  --blue-core:#00aaff;--blue-bright:#00d4ff;--blue-electric:#0066ff;--blue-dim:#003a8c;
  --glow-sm:0 0 8px rgba(0,170,255,0.4);
  --glow-md:0 0 16px rgba(0,170,255,0.5),0 0 32px rgba(0,102,255,0.2);
  --glow-text:0 0 10px rgba(0,212,255,0.8),0 0 20px rgba(0,170,255,0.4);
  --border-dim:rgba(0,140,255,0.10);--border-mid:rgba(0,170,255,0.22);
  --text-primary:#e8f4ff;--text-secondary:#8ab8d8;--text-muted:#3a5a78;
  --font-display:'Orbitron',monospace;--font-body:'Exo 2',sans-serif;--font-mono:'JetBrains Mono',monospace;
  --sidebar-w:220px;--topbar-h:48px;
}
body{font-family:var(--font-body);background:var(--bg-void);color:var(--text-primary);display:flex;flex-direction:column;height:100vh;cursor:none;overflow:hidden}

/* BG */
.bg-root{position:fixed;inset:0;z-index:0;overflow:hidden}
.bg-space{position:absolute;inset:0;background:radial-gradient(ellipse at 20% 80%,rgba(0,40,120,0.6) 0%,transparent 45%),radial-gradient(ellipse at 80% 10%,rgba(0,20,80,0.5) 0%,transparent 40%),#020408}
.bg-grid{position:absolute;inset:0;background-image:radial-gradient(circle,rgba(0,130,255,0.18) 1px,transparent 1px);background-size:36px 36px;animation:gridDrift 60s linear infinite;mask-image:radial-gradient(ellipse 80% 80% at center,black 30%,transparent 80%)}
@keyframes gridDrift{from{background-position:0 0}to{background-position:36px 36px}}
.bg-floor{position:absolute;bottom:0;left:0;right:0;height:55%;background-image:linear-gradient(rgba(0,100,255,0.07) 1px,transparent 1px),linear-gradient(90deg,rgba(0,100,255,0.07) 1px,transparent 1px);background-size:70px 35px;transform:perspective(500px) rotateX(65deg);transform-origin:bottom center;mask-image:linear-gradient(to bottom,transparent 0%,black 50%);animation:floorScroll 20s linear infinite}
@keyframes floorScroll{from{background-position:0 0}to{background-position:0 35px}}
.orb{position:absolute;border-radius:50%;filter:blur(90px);pointer-events:none}
.orb-1{width:680px;height:680px;background:radial-gradient(circle,rgba(0,50,180,0.55) 0%,transparent 70%);top:-220px;left:-180px;animation:orb1 28s ease-in-out infinite}
.orb-2{width:480px;height:480px;background:radial-gradient(circle,rgba(0,110,255,0.45) 0%,transparent 70%);bottom:-120px;right:-120px;animation:orb2 32s ease-in-out infinite}
@keyframes orb1{0%,100%{transform:translate(0,0)}50%{transform:translate(50px,70px)}}
@keyframes orb2{0%,100%{transform:translate(0,0)}50%{transform:translate(-70px,-55px)}}
#starCanvas{position:absolute;inset:0;pointer-events:none}
.data-stream{position:absolute;width:1px;background:linear-gradient(to bottom,transparent 0%,rgba(0,170,255,0.7) 50%,transparent 100%);animation:streamFall linear infinite;pointer-events:none}
@keyframes streamFall{0%{transform:translateY(-200px);opacity:0}10%{opacity:1}85%{opacity:0.6}100%{transform:translateY(110vh);opacity:0}}
.scan-beam{position:absolute;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,rgba(0,212,255,0.35) 50%,transparent);animation:beamSweep 10s linear infinite}
@keyframes beamSweep{from{top:-2px}to{top:100%}}
.scanlines{position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.06) 3px,rgba(0,0,0,0.06) 4px)}
.vignette{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at center,transparent 45%,rgba(0,0,0,0.75) 100%)}

/* GLITCH */
.glitch-bars{position:fixed;inset:0;z-index:5;pointer-events:none}
.glitch-text{position:relative;display:inline-block}
.glitch-text::before,.glitch-text::after{content:attr(data-text);position:absolute;top:0;left:0;width:100%;height:100%;font-family:inherit;font-size:inherit;font-weight:inherit}
.glitch-text::before{color:#00ffee;animation:gBefore 7s infinite;clip-path:polygon(0 20%,100% 20%,100% 40%,0 40%)}
.glitch-text::after{color:#ff00cc;animation:gAfter 7s infinite;clip-path:polygon(0 65%,100% 65%,100% 80%,0 80%)}
@keyframes gBefore{0%,93%,100%{transform:translateX(0);opacity:0}94%{transform:translateX(-4px);opacity:0.9}}
@keyframes gAfter{0%,95%,100%{transform:translateX(0);opacity:0}96%{transform:translateX(4px);opacity:0.8}}

/* CURSOR */
.cursor-dot{position:fixed;width:6px;height:6px;background:var(--blue-bright);border-radius:50%;transform:translate(-50%,-50%);pointer-events:none;z-index:9999;box-shadow:var(--glow-sm)}
.cursor-ring{position:fixed;width:26px;height:26px;border:1px solid rgba(0,170,255,0.5);border-radius:50%;transform:translate(-50%,-50%);pointer-events:none;z-index:9998;transition:width 0.2s,height 0.2s,border-color 0.2s}

/* LAYOUT */
.app-wrapper{position:relative;z-index:10;display:flex;flex-direction:column;height:100vh}
.topbar{height:var(--topbar-h);background:rgba(5,9,18,0.85);backdrop-filter:blur(12px);border-bottom:1px solid var(--border-mid);display:flex;align-items:center;padding:0 16px;gap:12px;position:relative;z-index:20;flex-shrink:0}
.body-row{display:flex;flex:1;overflow:hidden}
.sidebar{width:var(--sidebar-w);background:linear-gradient(180deg,var(--bg-panel),var(--bg-deep));border-right:1px solid var(--border-mid);display:flex;flex-direction:column;overflow-y:auto;flex-shrink:0}
.content{flex:1;overflow-y:auto;padding:20px}

/* TOPBAR ELEMENTS */
.logo-mark{font-family:var(--font-display);font-size:1.1rem;color:var(--blue-bright);text-shadow:var(--glow-text);letter-spacing:0.05em}
.breadcrumb{font-family:var(--font-mono);font-size:0.65rem;color:var(--text-muted);letter-spacing:0.1em}
.breadcrumb span{color:var(--text-secondary)}
.ai-status{display:flex;align-items:center;gap:6px;margin-left:auto;font-family:var(--font-mono);font-size:0.6rem;color:var(--blue-core);letter-spacing:0.08em}
.pulse-dot{width:6px;height:6px;background:var(--blue-bright);border-radius:50%;box-shadow:0 0 6px var(--blue-bright);animation:pulseDot 2s ease-in-out infinite}
@keyframes pulseDot{0%,100%{opacity:1}50%{opacity:0.3}}

/* NAV */
.nav-section{padding:8px 10px 4px}
.nav-label{font-family:var(--font-mono);font-size:0.55rem;color:var(--text-muted);letter-spacing:0.15em;text-transform:uppercase;padding:4px 4px 6px}
.nav-item{display:flex;align-items:center;gap:9px;padding:8px 10px;font-size:0.78rem;color:var(--text-secondary);border-radius:6px;cursor:pointer;transition:all 0.2s;text-decoration:none;position:relative}
.nav-item:hover,.nav-item.active{background:rgba(0,150,255,0.08);color:var(--text-primary);box-shadow:inset 3px 0 0 var(--blue-core)}
.nav-item.active{box-shadow:var(--glow-sm),inset 3px 0 0 var(--blue-bright)}
.nav-icon{font-size:0.85rem;color:var(--blue-dim);width:16px;text-align:center}
.nav-item.active .nav-icon,.nav-item:hover .nav-icon{color:var(--blue-core)}
.nav-badge{margin-left:auto;font-family:var(--font-mono);font-size:0.55rem;padding:2px 5px;border-radius:3px;background:rgba(0,100,200,0.25);color:var(--blue-core);border:1px solid rgba(0,150,255,0.2)}
.nav-divider{height:1px;background:var(--border-dim);margin:6px 14px}

/* CARD */
.cyber-card{background:var(--bg-card);border:1px solid var(--border-mid);border-radius:8px;padding:24px;position:relative;overflow:hidden}
.cyber-card::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,var(--blue-core),transparent)}
.corner-tr,.corner-bl{position:absolute;width:12px;height:12px;border-color:var(--blue-core);border-style:solid;opacity:0.6}
.corner-tr{top:8px;right:8px;border-width:1px 1px 0 0}
.corner-bl{bottom:8px;left:8px;border-width:0 0 1px 1px}

/* STATS */
.stat-num{font-family:var(--font-display);font-size:1.8rem;font-weight:700;color:var(--blue-bright);text-shadow:var(--glow-text)}
.stat-lbl{font-family:var(--font-mono);font-size:0.6rem;color:var(--text-muted);letter-spacing:0.1em;text-transform:uppercase;margin-top:2px}

/* TERMINAL */
.term-row{font-family:var(--font-mono);font-size:0.7rem;color:var(--blue-core);display:flex;gap:8px;align-items:center;margin-top:12px}
.term-cursor{display:inline-block;width:6px;height:11px;background:var(--blue-bright);animation:blink 1s step-end infinite}
@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
@keyframes screenShake{0%,100%{transform:translate(0)}25%{transform:translate(-1px,1px)}75%{transform:translate(1px,-1px)}}
</style>
</head>
<body>

<div class="bg-root">
  <div class="bg-space"></div>
  <div class="bg-grid"></div>
  <div class="bg-floor"></div>
  <div class="orb orb-1"></div>
  <div class="orb orb-2"></div>
  <canvas id="starCanvas" style="position:absolute;inset:0;pointer-events:none"></canvas>
  <div id="dataStreams"></div>
  <div class="scan-beam"></div>
  <div class="scanlines"></div>
  <div class="vignette"></div>
</div>

<div id="glitchBars" class="glitch-bars"></div>
<div id="cursor" class="cursor-dot"></div>
<div id="cursor-ring" class="cursor-ring"></div>

<div id="app" class="app-wrapper">

  <header class="topbar">
    <div class="logo-mark">⬡ FECTTRAL</div>
    <div class="breadcrumb">/ <span id="breadCrumb">dashboard</span></div>
    <div class="ai-status">
      <div class="pulse-dot"></div>
      AI ACTIVE
    </div>
  </header>

  <div class="body-row">
    <aside class="sidebar">
      <div class="nav-section">
        <div class="nav-label">Workspace</div>
        <a class="nav-item active" href="#">
          <span class="nav-icon">◈</span><span>Dashboard</span>
        </a>
        <a class="nav-item" href="#">
          <span class="nav-icon">⬡</span><span>Projects</span>
          <span class="nav-badge">4</span>
        </a>
      </div>
      <div class="nav-divider"></div>
      <div class="nav-section">
        <div class="nav-label">System</div>
        <a class="nav-item" href="#">
          <span class="nav-icon">⚙</span><span>Settings</span>
        </a>
      </div>
    </aside>

    <main class="content">
      <!-- YOUR CONTENT HERE -->
      <div class="cyber-card" style="max-width:480px;margin:40px auto;text-align:center">
        <div class="corner-tr"></div>
        <div class="corner-bl"></div>
        <div style="font-size:2rem;color:var(--blue-core);margin-bottom:12px">⬡</div>
        <div class="glitch-text" data-text="SYSTEM ONLINE" style="font-family:var(--font-display);font-size:1.4rem;font-weight:700;letter-spacing:0.12em;text-shadow:var(--glow-text)">SYSTEM ONLINE</div>
        <p style="color:var(--text-secondary);font-size:0.85rem;margin-top:12px;line-height:1.6">Layout shell initialized and operational.<br>Replace this card with your page content.</p>
        <div class="term-row" style="justify-content:center">
          <span style="color:var(--blue-electric)">$</span>
          <span>fecttral --boot --status ok</span>
          <span class="term-cursor"></span>
        </div>
      </div>
    </main>
  </div>

</div>

<script>
/* STARS */
const canvas=document.getElementById('starCanvas');
const ctx=canvas.getContext('2d');
function resize(){canvas.width=window.innerWidth;canvas.height=window.innerHeight}
resize();window.addEventListener('resize',resize);
const stars=Array.from({length:220},()=>({x:Math.random()*window.innerWidth,y:Math.random()*window.innerHeight,r:Math.random()*1.3,o:Math.random(),tw:Math.random()*Math.PI*2,sp:Math.random()*0.4+0.05}));
function drawStars(){ctx.clearRect(0,0,canvas.width,canvas.height);stars.forEach(s=>{s.tw+=s.sp*0.018;const op=s.o*(0.35+0.65*Math.abs(Math.sin(s.tw)));ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fillStyle=`rgba(160,215,255,${op})`;ctx.fill()});requestAnimationFrame(drawStars)}
drawStars();

/* DATA STREAMS */
const se=document.getElementById('dataStreams');
for(let i=0;i<20;i++){const el=document.createElement('div');el.className='data-stream';el.style.cssText=`left:${Math.random()*100}%;height:${Math.random()*130+50}px;animation-duration:${Math.random()*5+3}s;animation-delay:${Math.random()*10}s;`;se.appendChild(el)}

/* GLITCH */
const gb=document.getElementById('glitchBars');
const appEl=document.getElementById('app');
function triggerGlitch(intensity='low'){
  const count=intensity==='boot'?8:Math.floor(Math.random()*4)+2;
  for(let i=0;i<count;i++){
    const bar=document.createElement('div');
    const top=Math.random()*100;const h=Math.random()*(intensity==='boot'?8:4)+1;
    const tx=(Math.random()-0.5)*(intensity==='boot'?30:14);
    bar.style.cssText=`position:absolute;left:0;right:0;top:${top}%;height:${h}px;background:rgba(${Math.random()>0.5?'0,210,255':'255,0,200'},0.08);transform:translateX(${tx}px);mix-blend-mode:screen;`;
    gb.appendChild(bar);setTimeout(()=>bar.remove(),Math.random()*80+100);
  }
  if(Math.random()>0.5){appEl.style.animation=`screenShake ${60+Math.random()*80}ms ease both`;setTimeout(()=>{appEl.style.animation=''},200)}
}
window.addEventListener('load',()=>{let n=0;const b=()=>{if(n++>5)return;triggerGlitch('boot');setTimeout(b,110)};setTimeout(b,500)});
(function sched(){setTimeout(()=>{triggerGlitch('low');sched()},Math.random()*9000+5000)})();

/* CURSOR */
const cursor=document.getElementById('cursor'),ring=document.getElementById('cursor-ring');
let mx=0,my=0,rx=0,ry=0;
document.addEventListener('mousemove',e=>{mx=e.clientX;my=e.clientY;cursor.style.left=mx+'px';cursor.style.top=my+'px'});
(function a(){rx+=(mx-rx)*0.1;ry+=(my-ry)*0.1;ring.style.left=rx+'px';ring.style.top=ry+'px';requestAnimationFrame(a)})();
document.querySelectorAll('a,.cyber-card').forEach(el=>{
  el.addEventListener('mouseenter',()=>{ring.style.width='36px';ring.style.height='36px'});
  el.addEventListener('mouseleave',()=>{ring.style.width='26px';ring.style.height='26px'});
});

/* NAV */
document.querySelectorAll('.nav-item').forEach(item=>{
  item.addEventListener('click',e=>{
    e.preventDefault();
    document.querySelectorAll('.nav-item').forEach(i=>i.classList.remove('active'));
    item.classList.add('active');
    document.getElementById('breadCrumb').textContent=item.querySelector('span:nth-child(2)').textContent.toLowerCase().replace(/\s+/g,'-');
    triggerGlitch('low');
  });
});
</script>
</body>
</html>
```

## Color Variant Swaps

To change the theme color from blue to another hue, replace only these values:

| Theme | `--blue-core` | `--blue-bright` | `--blue-electric` | orb colors |
|-------|--------------|-----------------|-------------------|-----------|
| **Blue** (default) | `#00aaff` | `#00d4ff` | `#0066ff` | `rgba(0,40,120,...)` |
| **Green** (matrix) | `#00ff88` | `#00ffaa` | `#00cc44` | `rgba(0,80,40,...)` |
| **Purple** (synthwave) | `#aa00ff` | `#cc44ff` | `#6600cc` | `rgba(60,0,120,...)` |
| **Amber** (retro) | `#ffaa00` | `#ffcc44` | `#cc6600` | `rgba(80,40,0,...)` |
| **Red** (danger) | `#ff2244` | `#ff4466` | `#cc0022` | `rgba(80,0,20,...)` |
