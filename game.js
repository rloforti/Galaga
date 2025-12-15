// Galaga-like game: simple enemies in formation, player ship, bullets, collisions.
// Expand as you wish: enemy dive paths, tractor beam, sprites, sound, etc.

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const waveEl = document.getElementById('wave');

const startBtn = document.getElementById('start');
const pauseBtn = document.getElementById('pause');
const resetBtn = document.getElementById('reset');

// Game state
let running = false;
let paused = false;
let score = 0;
let lives = 3;
let wave = 1;

// World
const W = canvas.width;
const H = canvas.height;

// Input
const keys = new Set();
window.addEventListener('keydown', (e) => {
  if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space','KeyP'].includes(e.code)) e.preventDefault();
  keys.add(e.code);
  if (e.code === 'KeyP') togglePause();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));

// Entities
const player = {
  x: W/2, y: H - 60, w: 28, h: 18,
  speed: 300,
  fireRate: 0.2,
  fireCooldown: 0,
  alive: true
};

const bullets = [];   // player bullets
const eBullets = [];  // enemy bullets
let enemies = [];     // current formation

// Utility
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function rand(a, b) { return a + Math.random() * (b - a); }
function rectsOverlap(a, b) {
  return !(a.x + a.w < b.x || a.x > b.x + b.w || a.y + a.h < b.y || a.y > b.y + b.h);
}

// Spawning waves
function makeWave(nCols = 10, nRows = 5) {
  enemies = [];
  const spacingX = 48;
  const spacingY = 40;
  const startX = (W - (nCols - 1) * spacingX) / 2 - 16;
  const startY = 80;
  for (let r = 0; r < nRows; r++) {
    for (let c = 0; c < nCols; c++) {
      enemies.push({
        x: startX + c * spacingX,
        y: startY + r * spacingY,
        w: 24, h: 18,
        hp: r === 0 ? 2 : 1, // tougher top row
        type: r < 2 ? 'boss' : 'grunt',
        shootCooldown: rand(0.5, 2.5),
        diveTimer: rand(2.0, 6.0)
      });
    }
  }
}

// Enemy formation motion
let formation = { dir: 1, speed: 40, offsetX: 0, offsetY: 0 };
function updateFormation(dt) {
  formation.offsetX += formation.dir * formation.speed * dt;
  // bounce horizontally
  const minX = -60, maxX = 60;
  if (formation.offsetX < minX) { formation.offsetX = minX; formation.dir = 1; }
  if (formation.offsetX > maxX) { formation.offsetX = maxX; formation.dir = -1; }
  // gentle vertical bob
  formation.offsetY = Math.sin(perfTime * 0.8) * 6;
}

// Player update
function updatePlayer(dt) {
  if (!player.alive) return;
  let vx = 0, vy = 0;
  if (keys.has('ArrowLeft')) vx -= 1;
  if (keys.has('ArrowRight')) vx += 1;
  if (keys.has('ArrowUp')) vy -= 1;
  if (keys.has('ArrowDown')) vy += 1;

  player.x += vx * player.speed * dt;
  player.y += vy * player.speed * dt;
  player.x = clamp(player.x, 20, W - 20);
  player.y = clamp(player.y, H - 160, H - 20);

  player.fireCooldown -= dt;
  if (keys.has('Space') && player.fireCooldown <= 0) {
    bullets.push({ x: player.x, y: player.y - player.h/2, w: 4, h: 12, vy: -480 });
    player.fireCooldown = player.fireRate;
  }
}

// Enemy update
function updateEnemies(dt) {
  for (const e of enemies) {
    e.x += formation.dir * formation.speed * 0.0 * dt; // movement handled via offset
    // Dive behavior: occasionally swoop down in a sine path
    e.diveTimer -= dt;
    if (e.diveTimer <= 0) {
      e.diveTimer = rand(3.0, 7.0);
      e.vx = rand(-70, 70);
      e.vy = rand(120, 200);
      e.phase = 0;
      e.diving = true;
    }
    if (e.diving) {
      e.phase += dt * 3;
      e.x += e.vx * dt + Math.sin(e.phase * 2.0) * 30 * dt;
      e.y += e.vy * dt;
      if (e.y > H * 0.75) {
        e.diving = false;
        e.y = 80 + formation.offsetY; // return near top
      }
    }
    // Shooting
    e.shootCooldown -= dt;
    const shootChance = e.type === 'boss' ? 0.5 : 0.2;
    if (e.shootCooldown <= 0 && Math.random() < shootChance) {
      const sx = e.x + 0;
      const sy = e.y + e.h/2;
      const speed = 280;
      // aim roughly toward player
      const dx = player.x - sx;
      const dy = player.y - sy;
      const mag = Math.hypot(dx, dy) || 1;
      eBullets.push({ x: sx, y: sy, w: 4, h: 12, vx: (dx/mag)*speed*0.6, vy: (dy/mag)*speed });
      e.shootCooldown = rand(1.1, 3.5);
    }
  }
  // Remove off-screen divers
  enemies = enemies.filter(e => e.hp > 0 && e.y < H - 10);
}

// Bullets update
function updateBullets(dt) {
  for (const b of bullets) b.y += b.vy * dt;
  for (const eb of eBullets) { eb.x += eb.vx * dt; eb.y += eb.vy * dt; }
  // remove off-screen
  for (let i = bullets.length - 1; i >= 0; i--) if (bullets[i].y < -20) bullets.splice(i,1);
  for (let i = eBullets.length - 1; i >= 0; i--) if (eBullets[i].y > H + 20) eBullets.splice(i,1);
}

// Collisions
function doCollisions() {
  // player bullets vs enemies
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    for (const e of enemies) {
      const er = { x: e.x + formation.offsetX, y: e.y + formation.offsetY, w: e.w, h: e.h };
      if (rectsOverlap(b, er)) {
        e.hp -= 1;
        bullets.splice(i,1);
        score += 10;
        break;
      }
    }
  }
  // enemy bullets vs player
  if (player.alive) {
    for (let i = eBullets.length - 1; i >= 0; i--) {
      const eb = eBullets[i];
      const pr = { x: player.x - player.w/2, y: player.y - player.h/2, w: player.w, h: player.h };
      if (rectsOverlap(eb, pr)) {
        eBullets.splice(i,1);
        lives -= 1;
        player.alive = false;
        setTimeout(respawnPlayer, 1200);
        break;
      }
    }
  }
}

// Wave progression
function checkWave() {
  if (enemies.length === 0) {
    wave += 1;
    formation.offsetX = 0; formation.offsetY = 0; formation.dir = 1;
    const cols = 8 + Math.min(6, wave);
    const rows = 4 + Math.min(3, Math.floor(wave/2));
    makeWave(cols, rows);
  }
}

// Respawn
function respawnPlayer() {
  if (lives <= 0) {
    running = false;
    paused = false;
    showGameOver();
    return;
  }
  player.x = W/2; player.y = H - 60;
  player.alive = true;
  player.fireCooldown = 0;
}

// UI
function updateHUD() {
  scoreEl.textContent = score;
  livesEl.textContent = lives;
  waveEl.textContent = wave;
}
function showGameOver() {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0,0,W,H);
  ctx.fillStyle = '#0ff';
  ctx.textAlign = 'center';
  ctx.font = '28px monospace';
  ctx.fillText('GAME OVER', W/2, H/2 - 10);
  ctx.font = '18px monospace';
  ctx.fillText(`Score: ${score}`, W/2, H/2 + 24);
  ctx.restore();
}

// Drawing
function drawPlayer() {
  if (!player.alive) return;
  const px = player.x, py = player.y;
  ctx.save();
  ctx.translate(px, py);
  // retro ship
  ctx.fillStyle = '#0ff';
  ctx.fillRect(-2, -9, 4, 8);
  ctx.fillStyle = '#0f8';
  ctx.fillRect(-14, -1, 28, 10);
  ctx.fillStyle = '#08f';
  ctx.fillRect(-6, -6, 12, 6);
  ctx.restore();
}
function drawEnemies() {
  for (const e of enemies) {
    const x = e.x + formation.offsetX;
    const y = e.y + formation.offsetY;
    ctx.save();
    ctx.translate(x, y);
    if (e.type === 'boss') {
      ctx.fillStyle = '#f33';
      ctx.fillRect(-12, -9, 24, 18);
      ctx.fillStyle = '#ff6';
      ctx.fillRect(-6, -4, 12, 8);
    } else {
      ctx.fillStyle = '#f6f';
      ctx.fillRect(-12, -9, 24, 18);
      ctx.fillStyle = '#fff';
      ctx.fillRect(-4, -3, 8, 6);
    }
    ctx.restore();
  }
}
function drawBullets() {
  ctx.fillStyle = '#0ff';
  for (const b of bullets) ctx.fillRect(b.x - 2, b.y - 6, 4, 12);
  ctx.fillStyle = '#f33';
  for (const eb of eBullets) ctx.fillRect(eb.x - 2, eb.y - 6, 4, 12);
}
function clear() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0,0,W,H);
}
function drawStars() {
  // simple starfield
  ctx.fillStyle = '#045';
  for (let i = 0; i < 150; i++) {
    const x = (i * 53 + Math.floor(perfTime * 30) * 7) % W;
    const y = (i * 97) % H;
    ctx.fillRect(x, y, 1, 1);
  }
}

// Main loop
let last = 0;
let perfTime = 0;
function loop(ts) {
  if (!running) { drawFrame(); return; }
  if (paused) { drawPaused(); requestAnimationFrame(loop); return; }
  const t = ts / 1000;
  const dt = clamp(t - last, 0, 0.033);
  last = t; perfTime = t;

  updateFormation(dt);
  updatePlayer(dt);
  updateEnemies(dt);
  updateBullets(dt);
  doCollisions();
  checkWave();
  updateHUD();

  drawFrame();
  requestAnimationFrame(loop);
}

function drawFrame() {
  clear();
  drawStars();
  drawEnemies();
  drawPlayer();
  drawBullets();
  if (!running && lives <= 0) showGameOver();
}

function drawPaused() {
  drawFrame();
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(0,0,W,H);
  ctx.fillStyle = '#0ff';
  ctx.textAlign = 'center';
  ctx.font = '22px monospace';
  ctx.fillText('PAUSED', W/2, H/2);
  ctx.restore();
}

// Controls
function startGame() {
  if (running) return;
  score = 0; lives = 3; wave = 1;
  bullets.length = 0; eBullets.length = 0;
  formation = { dir: 1, speed: 40, offsetX: 0, offsetY: 0 };
  player.x = W/2; player.y = H - 60; player.alive = true; player.fireCooldown = 0;
  makeWave(10,5);
  running = true; paused = false; last = 0;
  requestAnimationFrame(loop);
}
function togglePause() {
  if (!running) return;
  paused = !paused;
}
function resetGame() {
  running = false; paused = false;
  score = 0; lives = 3; wave = 1;
  bullets.length = 0; eBullets.length = 0;
  enemies = [];
  updateHUD();
  drawFrame();
}

startBtn.addEventListener('click', startGame);
pauseBtn.addEventListener('click', togglePause);
resetBtn.addEventListener('click', resetGame);

// Initial render
resetGame();
requestAnimationFrame(loop);
