(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const livesEl = document.getElementById('lives');
  const levelEl = document.getElementById('level');
  const msg = document.getElementById('message');
  const startBtn = document.getElementById('startBtn');
  const restartBtn = document.getElementById('restartBtn');
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  const shell = document.getElementById('gameShell');


  function fitGameToScreen() {
    const wrap = shell || document.documentElement;
    const topbar = document.querySelector('.topbar');
    const message = document.getElementById('message');
    const buttons = document.querySelector('.buttons');
    const dpad = document.querySelector('.dpad');
    const styles = getComputedStyle(wrap);
    const gap = parseFloat(styles.rowGap || styles.gap || '0') || 0;
    const reserved = [topbar, message, buttons, dpad]
      .filter(Boolean)
      .reduce((sum, el) => sum + el.getBoundingClientRect().height, 0);
    const verticalGaps = gap * 4;
    const available = Math.max(220, window.innerHeight - reserved - verticalGaps - 18);
    document.documentElement.style.setProperty('--game-max-height', `${available}px`);
  }

  window.addEventListener('resize', fitGameToScreen, {passive:true});
  window.addEventListener('orientationchange', () => setTimeout(fitGameToScreen, 250), {passive:true});
  if (window.visualViewport) window.visualViewport.addEventListener('resize', fitGameToScreen, {passive:true});
  document.addEventListener('fullscreenchange', () => {
    fitGameToScreen();
    fullscreenBtn.textContent = document.fullscreenElement ? 'Exit Fullscreen' : 'Fullscreen';
  });
  document.addEventListener('contextmenu', e => e.preventDefault());

  const TILE = 24;
  const ROWS = 23;
  const COLS = 19;
  const W = COLS * TILE, H = ROWS * TILE;
  canvas.width = W; canvas.height = H;

  const MAZE = [
    '###################',
    '#........#........#',
    '#.###.##.#.##.###.#',
    '#o###.##.#.##.###o#',
    '#.................#',
    '#.###.#.#####.#.###',
    '#.....#...#...#...#',
    '#####.### # ###.###',
    '    #.#       #.#  ',
    '#####.# ##-## #.###',
    '     .  #GGG#  .   ',
    '#####.# ##### #.###',
    '    #.#       #.#  ',
    '#####.# ##### #.###',
    '#........#........#',
    '#.###.##.#.##.###.#',
    '#o..#....P....#..o#',
    '###.#.#.#####.#.#.#',
    '#.....#...#...#...#',
    '#.#######.#.#######',
    '#.................#',
    '#.###############.#',
    '#.................#'
  ];

  const dirs = {left:{x:-1,y:0}, right:{x:1,y:0}, up:{x:0,y:-1}, down:{x:0,y:1}, none:{x:0,y:0}};
  let pellets, powerPellets, score, lives, level, running, gameOver, frightenedUntil, tick;
  let player, ghosts;

  function center(c, r) { return {x:c*TILE+TILE/2, y:r*TILE+TILE/2}; }
  function tileOf(o) { return {c:Math.floor(o.x/TILE), r:Math.floor(o.y/TILE)}; }
  function atCenter(o) { return Math.abs((o.x - TILE/2) % TILE) < 1.6 && Math.abs((o.y - TILE/2) % TILE) < 1.6; }
  function snap(o) { const t=tileOf(o); o.x=t.c*TILE+TILE/2; o.y=t.r*TILE+TILE/2; }
  function wall(c,r) { return r<0||r>=ROWS||c<0||c>=COLS ? true : MAZE[r][c] === '#'; }
  function canMove(o, d) { const t=tileOf(o); return !wall(t.c+d.x,t.r+d.y); }

  function resetAll() { score=0; lives=3; level=1; initLevel(); updateHud(); }
  function initLevel() {
    pellets = new Set(); powerPellets = new Set();
    for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) {
      if (MAZE[r][c] === '.') pellets.add(`${c},${r}`);
      if (MAZE[r][c] === 'o') powerPellets.add(`${c},${r}`);
    }
    player = {...center(9,16), dir:dirs.left, next:dirs.left, speed:2.15 + level*.08, mouth:0};
    ghosts = [
      makeGhost(8,10,'#ff3b3b'), makeGhost(9,10,'#ff93d1'), makeGhost(10,10,'#37d6ff'), makeGhost(9,9,'#ffb347')
    ];
    frightenedUntil = 0; tick = 0; running=false; gameOver=false;
    msg.textContent = 'Press Space or tap Start.'; draw();
  }
  function makeGhost(c,r,color){ return {...center(c,r), dir:dirs.left, color, speed:1.65 + level*.09, eaten:false}; }
  function updateHud(){ scoreEl.textContent=score; livesEl.textContent=lives; levelEl.textContent=level; }

  function setDir(name){ player.next = dirs[name] || player.next; }
  window.addEventListener('keydown', e => {
    const key = e.key.toLowerCase();
    if (['arrowleft','arrowright','arrowup','arrowdown',' '].includes(key)) e.preventDefault();
    if (['arrowleft','a'].includes(key)) setDir('left');
    else if (['arrowright','d'].includes(key)) setDir('right');
    else if (['arrowup','w'].includes(key)) setDir('up');
    else if (['arrowdown','s'].includes(key)) setDir('down');
    else if (key === ' ') toggle();
  });
  document.querySelectorAll('.dpad button').forEach(b => {
    b.addEventListener('pointerdown', e => { e.preventDefault(); setDir(b.dataset.dir); });
  });
  let sx=0, sy=0;
  canvas.addEventListener('touchstart', e => { sx=e.touches[0].clientX; sy=e.touches[0].clientY; }, {passive:false});
  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    const dx=e.touches[0].clientX-sx, dy=e.touches[0].clientY-sy;
    if (Math.hypot(dx,dy)>25) { setDir(Math.abs(dx)>Math.abs(dy) ? (dx>0?'right':'left') : (dy>0?'down':'up')); sx=e.touches[0].clientX; sy=e.touches[0].clientY; }
  }, {passive:false});
  startBtn.onclick = toggle;
  restartBtn.onclick = () => { resetAll(); running=true; msg.textContent=''; fitGameToScreen(); };
  fullscreenBtn.onclick = async () => {
    try {
      if (!document.fullscreenElement) {
        await (shell.requestFullscreen ? shell.requestFullscreen() : document.documentElement.requestFullscreen());
        if (screen.orientation && screen.orientation.lock) screen.orientation.lock('portrait').catch(() => {});
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      msg.textContent = 'Fullscreen is blocked by this browser. Use browser menu if needed.';
    }
    fitGameToScreen();
  };

  function toggle(){ if(gameOver){ resetAll(); running=true; return; } running=!running; msg.textContent = running ? '' : 'Paused'; }

  function step(){
    requestAnimationFrame(step);
    if(!running) { draw(); return; }
    tick++;
    movePlayer(); eatPellet(); moveGhosts(); collide();
    if (pellets.size + powerPellets.size === 0) { level++; initLevel(); running=true; msg.textContent='Level '+level; }
    updateHud(); draw();
  }

  function movePlayer(){
    if(atCenter(player)){ snap(player); if(canMove(player, player.next)) player.dir=player.next; if(!canMove(player, player.dir)) player.dir=dirs.none; }
    player.x += player.dir.x*player.speed; player.y += player.dir.y*player.speed;
    if(player.x < -TILE/2) player.x=W+TILE/2; if(player.x > W+TILE/2) player.x=-TILE/2;
  }
  function eatPellet(){ const t=tileOf(player), k=`${t.c},${t.r}`; if(pellets.delete(k)){score+=10;} if(powerPellets.delete(k)){score+=50; frightenedUntil=tick+420;} }

  function moveGhosts(){
    const frightened = tick < frightenedUntil;
    for (const g of ghosts) {
      if(atCenter(g)){
        snap(g);
        const choices = Object.values(dirs).filter(d => d!==dirs.none && canMove(g,d) && !(d.x===-g.dir.x && d.y===-g.dir.y));
        if(choices.length){
          const pt=tileOf(player), gt=tileOf(g);
          choices.sort((a,b)=>{
            const da=Math.abs(gt.c+a.x-pt.c)+Math.abs(gt.r+a.y-pt.r);
            const db=Math.abs(gt.c+b.x-pt.c)+Math.abs(gt.r+b.y-pt.r);
            return frightened ? db-da : da-db;
          });
          g.dir = Math.random()<0.22 ? choices[Math.floor(Math.random()*choices.length)] : choices[0];
        }
      }
      const sp = frightened ? g.speed*.78 : g.speed;
      g.x += g.dir.x*sp; g.y += g.dir.y*sp;
      if(g.x < -TILE/2) g.x=W+TILE/2; if(g.x > W+TILE/2) g.x=-TILE/2;
    }
  }

  function collide(){
    for (const g of ghosts) {
      if(Math.hypot(player.x-g.x, player.y-g.y) < TILE*.65){
        if(tick < frightenedUntil){ score += 200; Object.assign(g, center(9,10)); }
        else { lives--; if(lives<=0){ gameOver=true; running=false; msg.textContent='Game over. Press Start to play again.'; } else { const oldScore=score; initLevel(); score=oldScore; running=true; msg.textContent=''; } break; }
      }
    }
  }

  function draw(){
    ctx.clearRect(0,0,W,H); ctx.fillStyle='#000'; ctx.fillRect(0,0,W,H);
    for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++) if(MAZE[r][c]==='#') drawWall(c,r);
    ctx.fillStyle='#ffeaa7'; for(const k of pellets){ const [c,r]=k.split(',').map(Number); circle(c*TILE+12,r*TILE+12,2.8); }
    ctx.fillStyle='#fff45f'; for(const k of powerPellets){ const [c,r]=k.split(',').map(Number); circle(c*TILE+12,r*TILE+12,6); }
    drawPlayer(); ghosts.forEach(drawGhost);
    if(!running && !gameOver){ ctx.fillStyle='rgba(0,0,0,.35)'; ctx.fillRect(0,0,W,H); }
  }
  function drawWall(c,r){ ctx.fillStyle='#0717a8'; ctx.fillRect(c*TILE,r*TILE,TILE,TILE); ctx.strokeStyle='#2db7ff'; ctx.lineWidth=2; ctx.strokeRect(c*TILE+1,r*TILE+1,TILE-2,TILE-2); }
  function circle(x,y,rad){ ctx.beginPath(); ctx.arc(x,y,rad,0,Math.PI*2); ctx.fill(); }
  function drawPlayer(){ const m=(Math.sin(tick*.25)+1)*0.24+0.08; let a=0; if(player.dir===dirs.left)a=Math.PI; if(player.dir===dirs.up)a=-Math.PI/2; if(player.dir===dirs.down)a=Math.PI/2; ctx.fillStyle='#ff0'; ctx.beginPath(); ctx.moveTo(player.x,player.y); ctx.arc(player.x,player.y,10,a+m,a+Math.PI*2-m); ctx.closePath(); ctx.fill(); }
  function drawGhost(g){ const scared=tick<frightenedUntil; ctx.fillStyle=scared?'#183cff':g.color; ctx.beginPath(); ctx.arc(g.x,g.y-3,10,Math.PI,0); ctx.lineTo(g.x+10,g.y+10); for(let i=0;i<3;i++){ctx.lineTo(g.x+5-i*7,g.y+5);ctx.lineTo(g.x+1-i*7,g.y+10);} ctx.closePath(); ctx.fill(); ctx.fillStyle='#fff'; circle(g.x-4,g.y-4,2.5); circle(g.x+4,g.y-4,2.5); }

  fitGameToScreen(); resetAll(); step();
})();
