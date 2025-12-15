const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const W = canvas.width;
const H = canvas.height;

let running = false;
let paused = false;
let score = 0;
let lives = 3;
let wave = 1;

const keys = new Set();
window.addEventListener('keydown', e => {
  if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space','KeyP'].includes(e.code)) e.preventDefault();
  keys.add(e.code);
  if (e.code === 'KeyP') paused = !paused;
});
window.addEventListener('keyup', e => keys.delete(e.code));

const player = { x: W/2, y: H-60, w:28, h:18, speed:300, fireRate:0.2, fireCooldown:0, alive:true };
const bullets = [];
const eBullets = [];
let enemies = [];

function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function rectsOverlap(a,b){return !(a.x+a.w<b.x||a.x>b.x+b.w||a.y+a.h<b.y||a.y>b.y+b.h);}

// --- ENEMY ENTRY PATHS ---
function spawnEnemyPath(targetX,targetY,type){
  const startSide = Math.random()<0.5?-40:W+40;
  const startY = Math.random()*H*0.5;
  return {
    x:startSide, y:startY, w:24,h:18,hp:type==='boss'?2:1,type,
    state:'entering', // entering -> formation -> diving
    targetX, targetY,
    t:0, // progress along path
    diveTimer:2+Math.random()*4
  };
}

function makeWave(cols=10,rows=5){
  enemies=[];
  const spacingX=48, spacingY=40;
  const startX=(W-(cols-1)*spacingX)/2-16;
  const startY=80;
  for(let r=0;r<rows;r++){
    for(let c=0;c<cols;c++){
      const tx=startX+c*spacingX;
      const ty=startY+r*spacingY;
      const type=r<2?'boss':'grunt';
      enemies.push(spawnEnemyPath(tx,ty,type));
    }
  }
}

// --- UPDATE ---
function updatePlayer(dt){
  if(!player.alive) return;
  let vx=0,vy=0;
  if(keys.has('ArrowLeft'))vx-=1;
  if(keys.has('ArrowRight'))vx+=1;
  if(keys.has('ArrowUp'))vy-=1;
  if(keys.has('ArrowDown'))vy+=1;
  player.x=clamp(player.x+vx*player.speed*dt,20,W-20);
  player.y=clamp(player.y+vy*player.speed*dt,H-160,H-20);
  player.fireCooldown-=dt;
  if(keys.has('Space')&&player.fireCooldown<=0){
    bullets.push({x:player.x,y:player.y-player.h/2,w:4,h:12,vy:-480});
    player.fireCooldown=player.fireRate;
  }
}

function updateEnemies(dt){
  for(const e of enemies){
    if(e.state==='entering'){
      e.t+=dt*0.5; // speed of entry
      const t=e.t;
      // simple bezier curve from start to target
      const cx=(e.x+e.targetX)/2;
      const cy=e.y-100;
      e.x=(1-t)*(1-t)*e.x+2*(1-t)*t*cx+t*t*e.targetX;
      e.y=(1-t)*(1-t)*e.y+2*(1-t)*t*cy+t*t*e.targetY;
      if(t>=1){ e.state='formation'; e.x=e.targetX; e.y=e.targetY; }
    } else if(e.state==='formation'){
      e.diveTimer-=dt;
      if(e.diveTimer<=0){
        e.state='diving';
        e.phase=0;
        e.diveTimer=3+Math.random()*5;
      }
    } else if(e.state==='diving'){
      e.phase+=dt*2;
      e.x+=Math.sin(e.phase*2)*120*dt;
      e.y+=200*dt;
      if(e.y>H){ e.state='formation'; e.x=e.targetX; e.y=e.targetY; }
    }
  }
}

function updateBullets(dt){
  for(const b of bullets) b.y+=b.vy*dt;
  for(const eb of eBullets){ eb.x+=eb.vx*dt; eb.y+=eb.vy*dt; }
  bullets.filter(b=>b.y>-20);
  eBullets.filter(b=>b.y<H+20);
}

function doCollisions(){
  for(let i=bullets.length-1;i>=0;i--){
    const b=bullets[i];
    for(const e of enemies){
      if(rectsOverlap(b,e)){
        e.hp-=1; bullets.splice(i,1); score+=10; break;
      }
    }
  }
}

function checkWave(){
  enemies=enemies.filter(e=>e.hp>0);
  if(enemies.length===0){ wave++; makeWave(10,5); }
}

// --- DRAW ---
function clear(){ ctx.fillStyle='#000'; ctx.fillRect(0,0,W,H); }
function drawPlayer(){
  if(!player.alive) return;
  ctx.fillStyle='#0ff';
  ctx.fillRect(player.x-14,player.y-9,28,18);
}
function drawEnemies(){
  for(const e of enemies){
    ctx.fillStyle=e.type==='boss'?'#f33':'#f6f';
    ctx.fillRect(e.x-12,e.y-9,24,18);
  }
}
function drawBullets(){
  ctx.fillStyle='#0ff';
  for(const b of bullets) ctx.fillRect(b.x-2,b.y-6,4,12);
}

// --- LOOP ---
let last=0;
function loop(ts){
  if(!running){ drawFrame(); return; }
  if(paused){ drawFrame(); requestAnimationFrame(loop); return; }
  const t=ts/1000, dt=Math.min(t-last,0.033); last=t;
  updatePlayer(dt);
  updateEnemies(dt);
  updateBullets(dt);
  doCollisions();
  checkWave();
  drawFrame();
  requestAnimationFrame(loop);
}
function drawFrame(){ clear(); drawEnemies(); drawPlayer(); drawBullets(); }

// --- START ---
function startGame(){ score=0;lives=3;wave=1;bullets.length=0;eBullets.length=0;makeWave();running=true;last=0;requestAnimationFrame(loop); }
startGame();
