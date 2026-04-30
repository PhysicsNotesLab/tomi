/* ═══════════════════════════════════════════════════════════
   GAMES ENGINE — Lab Física UNAL
   Archivo: assets/js/games.js
   Inyecta automáticamente el tab "Juego" en cada asignatura.
   No requiere cambios en app.js ni en Firebase.
   ═══════════════════════════════════════════════════════════ */
'use strict';

const GamesEngine = (() => {

  /* ── Catálogo de juegos ───────────────────────────────────── */
  const GAMES = [
    { id:'tetris',    emoji:'🧱', name:'TETRIS',         desc:'Clásico de bloques caídos',     hint:'← → mover · ↑ rotar · ↓ bajar · Espacio: caída' },
    { id:'snake',     emoji:'🐍', name:'SNAKE',           desc:'Come y crece sin parar',        hint:'← → ↑ ↓ · Desliza en móvil' },
    { id:'breakout',  emoji:'🎯', name:'BREAKOUT',        desc:'Rompe todos los ladrillos',     hint:'← → mover paleta · Mouse / toque' },
    { id:'flappy',    emoji:'🚀', name:'FLAPPY GALAXY',   desc:'Esquiva los asteroides',        hint:'Espacio / Toque para impulsar' },
    { id:'asteroids', emoji:'💥', name:'ASTEROIDS',       desc:'Destruye la roca espacial',    hint:'← → rotar · ↑ impulso · Espacio: disparar' },
    { id:'pong',      emoji:'🏓', name:'PONG',            desc:'Paletas contra la IA',          hint:'↑ ↓ mover · Toca arriba/abajo en móvil' },
    { id:'sudoku',    emoji:'🔢', name:'SUDOKU 4×4',      desc:'Despeja la mente con lógica',   hint:'Toca celda y elige número' },
  ];

  /* Asignación determinista por ID de materia */
  function featuredIndex(subjectId) {
    let h = 0, s = String(subjectId || '');
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffff;
    return h % GAMES.length;
  }

  /* ── Estado interno ───────────────────────────────────────── */
  let overlayEl   = null;
  let gameBodyEl  = null;
  let animFrame   = null;
  let currentImpl = null;
  let currentSubjectId = '';

  /* ── Inicialización: MutationObserver sobre #appContent ───── */
  function init() {
    createOverlay();
    const target = document.getElementById('appContent');
    if (!target) return;
    const obs = new MutationObserver(() => tryInjectTab());
    obs.observe(target, { childList: true, subtree: true });
    tryInjectTab();
  }

  /* ── Inyección del tab "Juego" ───────────────────────────── */
  function tryInjectTab() {
    const content = document.getElementById('appContent');
    if (!content) return;

    /* Buscar el botón "Pomodoro" — es el ancla del tab bar */
    const allBtns = [...content.querySelectorAll('button')];
    const pomBtn  = allBtns.find(b => /pomodoro/i.test(b.textContent));
    if (!pomBtn) return;

    const tabBar = pomBtn.parentElement;
    if (!tabBar || tabBar.querySelector('[data-game-tab]')) return;

    /* ID de la materia actual (desde hash o data-attr más cercano) */
    const hash = window.location.hash || '';
    currentSubjectId = hash.split('/').pop() || hash;

    /* Crear el tab con el mismo estilo que Pomodoro */
    const tab = document.createElement('button');
    tab.setAttribute('data-game-tab', 'true');
    tab.className = pomBtn.className.replace(/\bactive\b/g, '').trim();
    tab.innerHTML = '<i class="fa-solid fa-gamepad"></i> Juego';

    /* Cuando se haga clic en otros tabs → cerrar overlay */
    tabBar.querySelectorAll('button:not([data-game-tab])').forEach(btn => {
      btn.addEventListener('click', () => {
        tab.classList.remove('active');
        hideOverlay();
      }, true);
    });

    tab.addEventListener('click', () => {
      tabBar.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      tab.classList.add('active');
      showSelection();
    });

    tabBar.appendChild(tab);
  }

  /* ── Overlay ─────────────────────────────────────────────── */
  function createOverlay() {
    if (document.getElementById('gamesOverlay')) return;

    overlayEl = document.createElement('div');
    overlayEl.id = 'gamesOverlay';
    overlayEl.className = 'game-overlay';
    overlayEl.innerHTML = `
      <div class="game-overlay-header">
        <span class="game-overlay-title" id="gOverlayTitle">🎮 ARCADE</span>
        <span class="game-overlay-score" id="gOverlayScore"></span>
        <button class="game-overlay-close" id="gOverlayClose">✕ CERRAR</button>
      </div>
      <div id="gameBody"></div>
    `;
    document.body.appendChild(overlayEl);
    gameBodyEl = overlayEl.querySelector('#gameBody');

    document.getElementById('gOverlayClose').addEventListener('click', () => {
      hideOverlay();
      /* Restaurar tab activo anterior */
      const content = document.getElementById('appContent');
      if (content) {
        const gameTab = content.querySelector('[data-game-tab]');
        if (gameTab) {
          gameTab.classList.remove('active');
          const firstTab = content.querySelector('button:not([data-game-tab])');
          if (firstTab) firstTab.click();
        }
      }
    });
  }

  function showOverlay() { if (overlayEl) overlayEl.classList.add('active'); }

  function hideOverlay() {
    stopGame();
    if (overlayEl) overlayEl.classList.remove('active');
  }

  /* ── Pantalla de selección ───────────────────────────────── */
  function showSelection() {
    stopGame();
    showOverlay();
    setTitle('🎮 ARCADE');
    setScore('');

    const fi = featuredIndex(currentSubjectId);

    gameBodyEl.innerHTML = `
      <div class="games-select-header">
        <h2>ELIGE TU JUEGO</h2>
        <p>Tómate un descanso merecido</p>
        <div class="games-featured-badge">
          <i class="fa-solid fa-star"></i>
          Juego del día: ${GAMES[fi].emoji} ${GAMES[fi].name}
        </div>
      </div>
      <div class="games-grid">
        ${GAMES.map((g,i) => `
          <div class="game-card${i===fi?' featured':''}"
               onclick="GamesEngine.launch('${g.id}')">
            <span class="game-card-emoji">${g.emoji}</span>
            <div class="game-card-name">${g.name}</div>
            <div class="game-card-desc">${g.desc}</div>
            <button class="game-card-playbtn">▶ JUGAR</button>
          </div>
        `).join('')}
      </div>
    `;
  }

  /* ── Lanzar juego ────────────────────────────────────────── */
  function launch(gameId) {
    const g = GAMES.find(x => x.id === gameId);
    if (!g) return;
    stopGame();
    setTitle(`${g.emoji} ${g.name}`);
    setScore('');

    if (gameId === 'sudoku') {
      gameBodyEl.innerHTML = '';
      Impls.sudoku.init(gameBodyEl);
      currentImpl = Impls.sudoku;
      return;
    }

    const W = Math.min(400, window.innerWidth - 32);
    const H = Math.min(560, window.innerHeight - 130);

    gameBodyEl.innerHTML = `
      <div class="game-canvas-wrap" id="gameCanvasWrap">
        <canvas id="gameCanvas" class="game-canvas" width="${W}" height="${H}"></canvas>
        <div class="game-controls-hint">${g.hint}</div>
        ${needsDpad(gameId) ? buildDpad(gameId) : ''}
        <div class="game-msg-overlay" id="gameMsgOverlay" style="display:none">
          <h2 id="gameMsgTitle">GAME OVER</h2>
          <p id="gameMsgBody">Puntuación: 0</p>
          <button class="game-restart-btn" onclick="GamesEngine.launch('${gameId}')">↺ REINICIAR</button>
          <br>
          <button class="game-back-btn" onclick="GamesEngine.showSelection()">◀ SELECCIÓN</button>
        </div>
      </div>
    `;

    const canvas = document.getElementById('gameCanvas');
    const impl   = Impls[gameId];
    if (impl) {
      currentImpl = impl;
      impl.init(canvas);
      if (needsDpad(gameId)) attachDpad(gameId);
    }
  }

  function needsDpad(id) { return id === 'tetris' || id === 'asteroids'; }

  function buildDpad(gameId) {
    if (gameId === 'tetris') return `
      <div class="game-dpad" id="gameDpad">
        <div class="game-dpad-row">
          <div class="dpad-spacer"></div>
          <button class="dpad-btn" data-dir="up">↑</button>
          <div class="dpad-spacer"></div>
        </div>
        <div class="game-dpad-row">
          <button class="dpad-btn" data-dir="left">←</button>
          <button class="dpad-btn" data-dir="down">↓</button>
          <button class="dpad-btn" data-dir="right">→</button>
        </div>
      </div>`;
    if (gameId === 'asteroids') return `
      <div class="game-dpad" id="gameDpad">
        <div class="game-dpad-row">
          <div class="dpad-spacer"></div>
          <button class="dpad-btn" data-dir="up">↑</button>
          <button class="dpad-btn dpad-shoot" data-dir="shoot">FUEGO</button>
        </div>
        <div class="game-dpad-row">
          <button class="dpad-btn" data-dir="left">←</button>
          <div class="dpad-spacer"></div>
          <button class="dpad-btn" data-dir="right">→</button>
        </div>
      </div>`;
    return '';
  }

  function attachDpad(gameId) {
    const dpad = document.getElementById('gameDpad');
    if (!dpad) return;
    dpad.querySelectorAll('.dpad-btn').forEach(btn => {
      const dir = btn.dataset.dir;
      const keyMap = {
        left:'ArrowLeft', right:'ArrowRight', up:'ArrowUp', down:'ArrowDown', shoot:' '
      };
      const k = keyMap[dir];
      if (!k) return;
      const down = () => document.dispatchEvent(new KeyboardEvent('keydown',{key:k,bubbles:true}));
      const up   = () => document.dispatchEvent(new KeyboardEvent('keyup',  {key:k,bubbles:true}));
      btn.addEventListener('touchstart', e => { e.preventDefault(); down(); }, {passive:false});
      btn.addEventListener('touchend',   e => { e.preventDefault(); up(); },   {passive:false});
      btn.addEventListener('mousedown',  down);
      btn.addEventListener('mouseup',    up);
    });
  }

  /* ── Helpers ─────────────────────────────────────────────── */
  function stopGame() {
    if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
    if (currentImpl?.cleanup) currentImpl.cleanup();
    currentImpl = null;
  }
  function setTitle(t)  { const el = document.getElementById('gOverlayTitle'); if(el) el.textContent = t; }
  function setScore(v)  { const el = document.getElementById('gOverlayScore'); if(el) el.textContent = v; }
  function showGameMsg(title, body, gameId) {
    stopGame();
    const el = document.getElementById('gameMsgOverlay');
    if (!el) return;
    document.getElementById('gameMsgTitle').textContent = title;
    document.getElementById('gameMsgBody').textContent  = body;
    el.style.display = 'block';
  }
  function gameOver(score, won = false) {
    showGameMsg(won ? '🏆 ¡VICTORIA!' : 'GAME OVER', `Puntuación: ${score}`);
  }
  function updateScore(v) { setScore(`SCORE: ${v}`); }

  /* ══════════════════════════════════════════════════════════
     IMPLEMENTACIONES DE JUEGOS
  ══════════════════════════════════════════════════════════ */
  const Impls = {};

  /* ─────────────────── TETRIS ──────────────────────────────── */
  Impls.tetris = (() => {
    let cv, ctx, S, kh;
    const COLS=10, ROWS=20;
    const COLORS=['','#d4a017','#00ffa8','#ef5350','#42a5f5','#ab47bc','#ff7043','#66bb6a'];
    const SHAPES=[null,
      [[1,1,1,1]],
      [[2,2],[2,2]],
      [[0,3,0],[3,3,3]],
      [[4,0],[4,0],[4,4]],
      [[0,5],[0,5],[5,5]],
      [[0,6,6],[6,6,0]],
      [[7,7,0],[0,7,7]],
    ];
    const rnd = () => { const id=Math.floor(Math.random()*7)+1; return {id,shape:SHAPES[id].map(r=>[...r]),x:Math.floor(COLS/2)-1,y:0}; };
    const collide = (b,p,dx=0,dy=0,ns=null) => {
      const s=ns||p.shape;
      return s.some((row,r)=>row.some((v,c)=>{
        if(!v) return false;
        const nx=p.x+c+dx, ny=p.y+r+dy;
        return nx<0||nx>=COLS||ny>=ROWS||(ny>=0&&b[ny][nx]);
      }));
    };
    const rotate = s => s[0].map((_,i)=>s.map(r=>r[i]).reverse());
    const lock = (b,p) => p.shape.forEach((row,r)=>row.forEach((v,c)=>{ if(v) b[p.y+r][p.x+c]=v; }));
    const clearLines = b => {
      let n=0;
      for(let r=ROWS-1;r>=0;r--) {
        if(b[r].every(v=>v)) { b.splice(r,1); b.unshift(new Array(COLS).fill(0)); n++; r++; }
      }
      return n;
    };
    const cw=()=>cv.width/COLS, ch=()=>cv.height/ROWS;
    const drawCell=(x,y,col)=>{
      ctx.fillStyle=col;
      ctx.fillRect(x*cw()+1,y*ch()+1,cw()-2,ch()-2);
      ctx.fillStyle='rgba(255,255,255,0.12)';
      ctx.fillRect(x*cw()+1,y*ch()+1,cw()-2,4);
    };
    function draw() {
      ctx.fillStyle='#020b10';
      ctx.fillRect(0,0,cv.width,cv.height);
      ctx.strokeStyle='rgba(11,59,70,0.45)'; ctx.lineWidth=0.5;
      for(let r=0;r<ROWS;r++){ctx.beginPath();ctx.moveTo(0,r*ch());ctx.lineTo(cv.width,r*ch());ctx.stroke();}
      for(let c=0;c<COLS;c++){ctx.beginPath();ctx.moveTo(c*cw(),0);ctx.lineTo(c*cw(),cv.height);ctx.stroke();}
      S.board.forEach((row,r)=>row.forEach((v,c)=>{ if(v) drawCell(c,r,COLORS[v]); }));
      if(S.piece) S.piece.shape.forEach((row,r)=>row.forEach((v,c)=>{ if(v) drawCell(S.piece.x+c,S.piece.y+r,COLORS[v]); }));
      /* Ghost piece */
      if(S.piece) {
        let gy=S.piece.y;
        while(!collide(S.board,S.piece,0,gy-S.piece.y+1)) gy++;
        S.piece.shape.forEach((row,r)=>row.forEach((v,c)=>{
          if(!v) return;
          ctx.fillStyle='rgba(255,255,255,0.07)';
          ctx.fillRect((S.piece.x+c)*cw()+1,(gy+r)*ch()+1,cw()-2,ch()-2);
        }));
      }
      ctx.fillStyle='rgba(212,160,23,0.9)'; ctx.font=`bold ${Math.max(11,cv.width/35)}px monospace`;
      ctx.fillText(`SCORE ${S.score}  LÍNEAS ${S.lines}  NIV ${S.level}`,8,16);
    }
    function loop(ts) {
      if(S.over) return;
      animFrame=requestAnimationFrame(loop);
      if(ts-S.lastDrop>S.speed) {
        S.lastDrop=ts;
        if(!collide(S.board,S.piece,0,1)) { S.piece.y++; }
        else {
          lock(S.board,S.piece);
          const n=clearLines(S.board);
          if(n){S.lines+=n;S.score+=n*100*S.level;S.level=Math.floor(S.lines/10)+1;S.speed=Math.max(80,850-S.level*75);updateScore(S.score);}
          S.piece=S.next; S.next=rnd();
          if(collide(S.board,S.piece)){S.over=true;draw();gameOver(S.score);return;}
        }
      }
      draw();
    }
    return {
      init(c) {
        cv=c; ctx=c.getContext('2d');
        S={board:Array.from({length:ROWS},()=>new Array(COLS).fill(0)),piece:rnd(),next:rnd(),score:0,lines:0,level:1,speed:850,lastDrop:0,over:false};
        kh=e=>{
          if(S.over) return;
          if(e.key==='ArrowLeft'&&!collide(S.board,S.piece,-1)) S.piece.x--;
          if(e.key==='ArrowRight'&&!collide(S.board,S.piece,1)) S.piece.x++;
          if(e.key==='ArrowDown'&&!collide(S.board,S.piece,0,1)) S.piece.y++;
          if(e.key==='ArrowUp'||e.key==='z') {const r=rotate(S.piece.shape);if(!collide(S.board,S.piece,0,0,r))S.piece.shape=r;}
          if(e.key===' '){while(!collide(S.board,S.piece,0,1))S.piece.y++;} // hard drop
          draw();
        };
        document.addEventListener('keydown',kh);
        /* Touch swipe */
        let tx,ty;
        c.addEventListener('touchstart',e=>{tx=e.touches[0].clientX;ty=e.touches[0].clientY;},{passive:true});
        c.addEventListener('touchend',e=>{
          const dx=e.changedTouches[0].clientX-tx, dy=e.changedTouches[0].clientY-ty;
          if(Math.abs(dx)>Math.abs(dy)&&Math.abs(dx)>15){
            if(dx<0&&!collide(S.board,S.piece,-1))S.piece.x--;
            if(dx>0&&!collide(S.board,S.piece,1))S.piece.x++;
          } else if(dy>20&&!collide(S.board,S.piece,0,1)){S.piece.y++;}
          else if(dy<-20){const r=rotate(S.piece.shape);if(!collide(S.board,S.piece,0,0,r))S.piece.shape=r;}
          draw();
        },{passive:true});
        animFrame=requestAnimationFrame(loop);
      },
      cleanup() { if(kh) document.removeEventListener('keydown',kh); }
    };
  })();

  /* ─────────────────── SNAKE ──────────────────────────────── */
  Impls.snake = (() => {
    let cv, ctx, S, kh, iv;
    const CELL=20;
    function spawnFood() {
      let p;
      do { p={x:Math.floor(Math.random()*S.cols),y:Math.floor(Math.random()*S.rows)}; }
      while(S.snake.some(s=>s.x===p.x&&s.y===p.y));
      S.food=p;
    }
    function tick() {
      if(S.over) return;
      S.dir=S.nd;
      const h={x:S.snake[0].x+S.dir.x,y:S.snake[0].y+S.dir.y};
      if(h.x<0||h.x>=S.cols||h.y<0||h.y>=S.rows||S.snake.some(s=>s.x===h.x&&s.y===h.y)){
        S.over=true; draw(); gameOver(S.score); return;
      }
      S.snake.unshift(h);
      if(h.x===S.food.x&&h.y===S.food.y){S.score+=10;updateScore(S.score);spawnFood();}
      else S.snake.pop();
      draw();
    }
    function draw() {
      ctx.fillStyle='#020b10'; ctx.fillRect(0,0,cv.width,cv.height);
      ctx.strokeStyle='rgba(11,59,70,0.35)'; ctx.lineWidth=0.5;
      for(let x=0;x<cv.width;x+=CELL){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,cv.height);ctx.stroke();}
      for(let y=0;y<cv.height;y+=CELL){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(cv.width,y);ctx.stroke();}
      /* Pulsing food */
      const pulse=0.75+0.25*Math.sin(Date.now()/200);
      ctx.fillStyle=`rgba(239,83,80,${pulse})`;
      ctx.beginPath(); ctx.arc(S.food.x*CELL+CELL/2,S.food.y*CELL+CELL/2,CELL/2-2,0,Math.PI*2); ctx.fill();
      /* Snake */
      S.snake.forEach((s,i)=>{
        const t=i/Math.max(1,S.snake.length-1);
        ctx.fillStyle=`hsl(${155-t*30},75%,${48-t*18}%)`;
        ctx.fillRect(s.x*CELL+1,s.y*CELL+1,CELL-2,CELL-2);
        if(i===0){
          ctx.fillStyle='#020b10';
          const ex=S.dir.x===0?3:CELL-6, ey=S.dir.y===0?3:CELL-6;
          ctx.fillRect(s.x*CELL+ex,s.y*CELL+ey,3,3);
          ctx.fillRect(s.x*CELL+ex+(S.dir.y!==0?6:0),s.y*CELL+ey+(S.dir.x!==0?6:0),3,3);
        }
      });
      ctx.fillStyle='rgba(212,160,23,0.9)'; ctx.font='bold 13px monospace';
      ctx.fillText(`SCORE ${S.score}  LARGO ${S.snake.length}`,8,16);
    }
    return {
      init(c) {
        cv=c; ctx=c.getContext('2d');
        const cols=Math.floor(c.width/CELL), rows=Math.floor(c.height/CELL);
        S={snake:[{x:Math.floor(cols/2),y:Math.floor(rows/2)}],dir:{x:1,y:0},nd:{x:1,y:0},food:null,score:0,cols,rows,over:false};
        spawnFood();
        const D={ArrowUp:{x:0,y:-1},ArrowDown:{x:0,y:1},ArrowLeft:{x:-1,y:0},ArrowRight:{x:1,y:0}};
        kh=e=>{const d=D[e.key];if(d&&(d.x!=-S.dir.x||d.y!=-S.dir.y))S.nd=d;};
        document.addEventListener('keydown',kh);
        let tx,ty;
        c.addEventListener('touchstart',e=>{tx=e.touches[0].clientX;ty=e.touches[0].clientY;},{passive:true});
        c.addEventListener('touchend',e=>{
          const dx=e.changedTouches[0].clientX-tx, dy=e.changedTouches[0].clientY-ty;
          let d;
          if(Math.abs(dx)>Math.abs(dy)) d=dx>0?{x:1,y:0}:{x:-1,y:0};
          else d=dy>0?{x:0,y:1}:{x:0,y:-1};
          if(d.x!=-S.dir.x||d.y!=-S.dir.y) S.nd=d;
        },{passive:true});
        iv=setInterval(tick,115);
      },
      cleanup() { if(kh) document.removeEventListener('keydown',kh); if(iv){clearInterval(iv);iv=null;} }
    };
  })();

  /* ─────────────────── BREAKOUT ───────────────────────────── */
  Impls.breakout = (() => {
    let cv, ctx, S, kh, mh, th;
    function init(c) {
      cv=c; ctx=c.getContext('2d');
      const bCols=8, bRows=5, bW=(c.width-32)/bCols, bH=22, gap=4;
      const bricks=[];
      for(let r=0;r<bRows;r++) for(let col=0;col<bCols;col++) {
        const hue=190+r*22;
        bricks.push({x:16+col*bW,y:50+r*(bH+gap),w:bW-gap,h:bH,alive:true,col:`hsl(${hue},65%,52%)`});
      }
      S={paddle:{x:c.width/2-44,y:c.height-28,w:88,h:12},
         ball:{x:c.width/2,y:c.height-60,vx:3.2,vy:-3.6,r:8},
         bricks,score:0,lives:3,over:false,win:false};
      kh=e=>{
        if(e.key==='ArrowLeft')  S.paddle.x=Math.max(0,S.paddle.x-22);
        if(e.key==='ArrowRight') S.paddle.x=Math.min(c.width-S.paddle.w,S.paddle.x+22);
      };
      mh=e=>{const r=c.getBoundingClientRect();S.paddle.x=Math.min(Math.max(e.clientX-r.left-S.paddle.w/2,0),c.width-S.paddle.w);};
      th=e=>{e.preventDefault();const r=c.getBoundingClientRect();S.paddle.x=Math.min(Math.max(e.touches[0].clientX-r.left-S.paddle.w/2,0),c.width-S.paddle.w);};
      document.addEventListener('keydown',kh);
      c.addEventListener('mousemove',mh);
      c.addEventListener('touchmove',th,{passive:false});
      animFrame=requestAnimationFrame(loop);
    }
    function loop() {
      if(S.over||S.win) return;
      animFrame=requestAnimationFrame(loop);
      update(); draw();
    }
    function update() {
      const b=S.ball, p=S.paddle;
      b.x+=b.vx; b.y+=b.vy;
      if(b.x-b.r<0){b.x=b.r;b.vx*=-1;}
      if(b.x+b.r>cv.width){b.x=cv.width-b.r;b.vx*=-1;}
      if(b.y-b.r<0){b.y=b.r;b.vy*=-1;}
      /* Paddle */
      if(b.y+b.r>=p.y&&b.y+b.r<=p.y+p.h+4&&b.x>=p.x-4&&b.x<=p.x+p.w+4&&b.vy>0){
        b.vy=-Math.abs(b.vy); b.vx=(b.x-(p.x+p.w/2))/p.w*9; b.y=p.y-b.r;
      }
      /* Out */
      if(b.y-b.r>cv.height){
        S.lives--;updateScore(`${S.score} ♥${S.lives}`);
        if(S.lives<=0){S.over=true;draw();gameOver(S.score);return;}
        b.x=cv.width/2;b.y=cv.height-80;b.vx=3.2;b.vy=-3.6;
      }
      /* Bricks */
      for(const br of S.bricks){
        if(!br.alive)continue;
        if(b.x+b.r>br.x&&b.x-b.r<br.x+br.w&&b.y+b.r>br.y&&b.y-b.r<br.y+br.h){
          br.alive=false;S.score+=10;updateScore(`${S.score} ♥${S.lives}`);
          const oL=b.x+b.r-br.x,oR=br.x+br.w-(b.x-b.r),oT=b.y+b.r-br.y,oB=br.y+br.h-(b.y-b.r);
          if(Math.min(oL,oR)<Math.min(oT,oB))b.vx*=-1;else b.vy*=-1;
          b.vx=Math.max(-8,Math.min(8,b.vx));
        }
      }
      if(S.bricks.every(br=>!br.alive)){S.win=true;draw();gameOver(S.score,true);}
    }
    function draw() {
      ctx.fillStyle='#020b10';ctx.fillRect(0,0,cv.width,cv.height);
      S.bricks.forEach(br=>{
        if(!br.alive)return;
        ctx.fillStyle=br.col;
        ctx.beginPath();if(ctx.roundRect)ctx.roundRect(br.x,br.y,br.w,br.h,3);else ctx.rect(br.x,br.y,br.w,br.h);ctx.fill();
        ctx.fillStyle='rgba(255,255,255,0.1)';ctx.fillRect(br.x+2,br.y+2,br.w-4,4);
      });
      /* Paddle */
      const pg=ctx.createLinearGradient(S.paddle.x,0,S.paddle.x+S.paddle.w,0);
      pg.addColorStop(0,'#d4a017');pg.addColorStop(1,'#c25b12');
      ctx.fillStyle=pg;
      ctx.beginPath();if(ctx.roundRect)ctx.roundRect(S.paddle.x,S.paddle.y,S.paddle.w,S.paddle.h,6);else ctx.rect(S.paddle.x,S.paddle.y,S.paddle.w,S.paddle.h);ctx.fill();
      /* Ball glow */
      const bg=ctx.createRadialGradient(S.ball.x-2,S.ball.y-2,1,S.ball.x,S.ball.y,S.ball.r);
      bg.addColorStop(0,'#fff');bg.addColorStop(1,'#00ffa8');
      ctx.fillStyle=bg;
      ctx.beginPath();ctx.arc(S.ball.x,S.ball.y,S.ball.r,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='rgba(212,160,23,0.9)';ctx.font='bold 13px monospace';
      ctx.fillText(`SCORE ${S.score}  ♥ ${S.lives}`,8,20);
    }
    return {
      init,
      cleanup(){
        if(kh)document.removeEventListener('keydown',kh);
        if(cv){cv.removeEventListener('mousemove',mh);cv.removeEventListener('touchmove',th);}
      }
    };
  })();

  /* ─────────────────── FLAPPY GALAXY ─────────────────────── */
  Impls.flappy = (() => {
    let cv,ctx,S,kh,ch,STARS=[];
    const GRAVITY=0.38,FLAP=-7,PIPE_W=38,GAP=155,SPEED=2.4;
    function init(c){
      cv=c;ctx=c.getContext('2d');
      STARS=Array.from({length:90},()=>({x:Math.random()*c.width,y:Math.random()*c.height,r:Math.random()*1.5+0.3,b:Math.random()}));
      S={ship:{x:80,y:c.height/2,vy:0},pipes:[],score:0,frame:0,over:false,started:false};
      const flap=()=>{if(!S.started)S.started=true;if(!S.over)S.ship.vy=FLAP;};
      kh=e=>{if(e.key===' '||e.key==='ArrowUp')flap();};
      ch=()=>flap();
      document.addEventListener('keydown',kh);
      c.addEventListener('click',ch);
      c.addEventListener('touchstart',ch,{passive:true});
      animFrame=requestAnimationFrame(loop);
    }
    function loop(){
      if(S.over)return;
      animFrame=requestAnimationFrame(loop);
      if(!S.started){draw();return;}
      S.frame++;
      if(S.frame%95===0){
        const top=50+Math.random()*(cv.height-GAP-80);
        S.pipes.push({x:cv.width,top,bot:top+GAP,scored:false});
      }
      S.pipes.forEach(p=>{
        p.x-=SPEED;
        if(!p.scored&&p.x+PIPE_W<S.ship.x){p.scored=true;S.score++;updateScore(S.score);}
      });
      S.pipes=S.pipes.filter(p=>p.x+PIPE_W>0);
      S.ship.vy+=GRAVITY;S.ship.y+=S.ship.vy;
      const s=S.ship;
      if(s.y-12<0||s.y+12>cv.height){S.over=true;draw();gameOver(S.score);return;}
      for(const p of S.pipes){
        if(s.x+10>p.x&&s.x-10<p.x+PIPE_W){
          if(s.y-10<p.top||s.y+10>p.bot){S.over=true;draw();gameOver(S.score);return;}
        }
      }
      draw();
    }
    function draw(){
      ctx.fillStyle='#020b10';ctx.fillRect(0,0,cv.width,cv.height);
      /* Stars */
      STARS.forEach(s=>{
        ctx.fillStyle=`rgba(255,255,255,${0.25+s.b*0.75})`;
        ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill();
      });
      /* Pipes as asteroid walls */
      S.pipes.forEach(p=>{
        const g1=ctx.createLinearGradient(p.x,0,p.x+PIPE_W,0);
        g1.addColorStop(0,'#0d2a36');g1.addColorStop(1,'#183848');
        ctx.fillStyle=g1;
        ctx.fillRect(p.x,0,PIPE_W,p.top);
        ctx.fillRect(p.x,p.bot,PIPE_W,cv.height-p.bot);
        ctx.fillStyle='rgba(0,255,168,0.25)';
        ctx.fillRect(p.x+PIPE_W-3,0,3,p.top);
        ctx.fillRect(p.x+PIPE_W-3,p.bot,3,cv.height-p.bot);
      });
      /* Ship */
      const s=S.ship;
      ctx.save();ctx.translate(s.x,s.y);ctx.rotate(Math.max(-0.5,Math.min(0.5,s.vy*0.055)));
      ctx.fillStyle='#d4a017';
      ctx.beginPath();ctx.moveTo(14,0);ctx.lineTo(-10,-8);ctx.lineTo(-5,0);ctx.lineTo(-10,8);ctx.closePath();ctx.fill();
      ctx.fillStyle='rgba(0,255,168,0.55)';
      ctx.beginPath();ctx.moveTo(-5,0);ctx.lineTo(-16,-4);ctx.lineTo(-16,4);ctx.closePath();ctx.fill();
      ctx.restore();
      ctx.fillStyle='rgba(212,160,23,0.9)';ctx.font='bold 14px monospace';
      ctx.fillText(`SCORE ${S.score}`,8,22);
      if(!S.started){
        ctx.fillStyle='rgba(212,160,23,0.7)';ctx.font='bold 15px monospace';
        ctx.textAlign='center';ctx.fillText('TOCA PARA COMENZAR',cv.width/2,cv.height/2+4);ctx.textAlign='left';
      }
    }
    return{
      init,
      cleanup(){
        if(kh)document.removeEventListener('keydown',kh);
        if(cv){cv.removeEventListener('click',ch);cv.removeEventListener('touchstart',ch);}
      }
    };
  })();

  /* ─────────────────── ASTEROIDS ──────────────────────────── */
  Impls.asteroids = (() => {
    let cv,ctx,S,kh,ku,keys={};
    const rnd=(a,b)=>a+Math.random()*(b-a);
    function mkAsteroid(cx,cy,r=null){
      let x,y;
      do{x=Math.random()*cv.width;y=Math.random()*cv.height;}
      while(Math.hypot(x-cx,y-cy)<140);
      const angle=Math.random()*Math.PI*2, speed=rnd(0.6,1.6), radius=r||rnd(26,42);
      const pts=Array.from({length:9},(_,i)=>{const a=i/9*Math.PI*2;return{x:Math.cos(a)*(radius+rnd(-6,6)),y:Math.sin(a)*(radius+rnd(-6,6))};});
      return{x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,radius,pts,rot:0,rotSpeed:rnd(-0.02,0.02)};
    }
    function init(c){
      cv=c;ctx=c.getContext('2d');keys={};
      const cx=c.width/2,cy=c.height/2;
      S={ship:{x:cx,y:cy,vx:0,vy:0,angle:-Math.PI/2,cooldown:0},
         asteroids:Array.from({length:5},()=>mkAsteroid(cx,cy)),
         bullets:[],score:0,lives:3,over:false};
      kh=e=>{keys[e.key]=true;e.key===' '&&e.preventDefault();};
      ku=e=>{delete keys[e.key];};
      document.addEventListener('keydown',kh);document.addEventListener('keyup',ku);
      animFrame=requestAnimationFrame(loop);
    }
    function loop(){if(S.over)return;animFrame=requestAnimationFrame(loop);update();draw();}
    function update(){
      const s=S.ship;
      if(keys['ArrowLeft'])s.angle-=0.055;
      if(keys['ArrowRight'])s.angle+=0.055;
      if(keys['ArrowUp']){s.vx+=Math.cos(s.angle)*0.22;s.vy+=Math.sin(s.angle)*0.22;}
      s.vx*=0.985;s.vy*=0.985;
      s.x=(s.x+s.vx+cv.width)%cv.width;s.y=(s.y+s.vy+cv.height)%cv.height;
      if(keys[' ']&&s.cooldown<=0){
        S.bullets.push({x:s.x+Math.cos(s.angle)*18,y:s.y+Math.sin(s.angle)*18,vx:Math.cos(s.angle)*9,vy:Math.sin(s.angle)*9,life:55});
        s.cooldown=14;
      }
      if(s.cooldown>0)s.cooldown--;
      S.bullets.forEach(b=>{b.x=(b.x+b.vx+cv.width)%cv.width;b.y=(b.y+b.vy+cv.height)%cv.height;b.life--;});
      S.bullets=S.bullets.filter(b=>b.life>0);
      S.asteroids.forEach(a=>{a.x=(a.x+a.vx+cv.width)%cv.width;a.y=(a.y+a.vy+cv.height)%cv.height;a.rot+=a.rotSpeed;});
      /* Bullet-asteroid */
      for(let bi=S.bullets.length-1;bi>=0;bi--){
        for(let ai=S.asteroids.length-1;ai>=0;ai--){
          const b=S.bullets[bi],a=S.asteroids[ai];
          if(!b||!a)continue;
          if(Math.hypot(b.x-a.x,b.y-a.y)<a.radius){
            S.bullets.splice(bi,1);
            S.score+=a.radius>28?10:20;updateScore(`${S.score} ♥${S.lives}`);
            if(a.radius>18){S.asteroids.push(mkAsteroid(a.x,a.y,a.radius*0.55));S.asteroids.push(mkAsteroid(a.x,a.y,a.radius*0.55));}
            S.asteroids.splice(ai,1);break;
          }
        }
      }
      /* Ship-asteroid */
      S.asteroids.forEach(a=>{
        if(Math.hypot(s.x-a.x,s.y-a.y)<a.radius+10){
          S.lives--;updateScore(`${S.score} ♥${S.lives}`);
          if(S.lives<=0){S.over=true;draw();gameOver(S.score);return;}
          s.x=cv.width/2;s.y=cv.height/2;s.vx=0;s.vy=0;
        }
      });
      if(S.asteroids.length===0)
        for(let i=0;i<5+Math.floor(S.score/60);i++)S.asteroids.push(mkAsteroid(s.x,s.y));
    }
    function draw(){
      ctx.fillStyle='#020b10';ctx.fillRect(0,0,cv.width,cv.height);
      S.asteroids.forEach(a=>{
        ctx.save();ctx.translate(a.x,a.y);ctx.rotate(a.rot);
        ctx.strokeStyle='#3a7a88';ctx.lineWidth=2;
        ctx.beginPath();a.pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.stroke();
        ctx.restore();
      });
      ctx.fillStyle='#00ffa8';
      S.bullets.forEach(b=>{ctx.beginPath();ctx.arc(b.x,b.y,3,0,Math.PI*2);ctx.fill();});
      const s=S.ship;
      ctx.save();ctx.translate(s.x,s.y);ctx.rotate(s.angle);
      ctx.strokeStyle='#d4a017';ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(16,0);ctx.lineTo(-10,-8);ctx.lineTo(-5,0);ctx.lineTo(-10,8);ctx.closePath();ctx.stroke();
      if(keys['ArrowUp']){
        ctx.strokeStyle='#ef5350';ctx.lineWidth=2;
        ctx.beginPath();ctx.moveTo(-5,0);ctx.lineTo(-16,0);ctx.stroke();
      }
      ctx.restore();
      ctx.fillStyle='rgba(212,160,23,0.9)';ctx.font='bold 13px monospace';
      ctx.fillText(`SCORE ${S.score}  ♥ ${S.lives}`,8,20);
    }
    return{
      init,
      cleanup(){if(kh){document.removeEventListener('keydown',kh);document.removeEventListener('keyup',ku);}}
    };
  })();

  /* ─────────────────── PONG ───────────────────────────────── */
  Impls.pong = (() => {
    let cv,ctx,S,kh,iv;
    function reset(){
      S.ball.x=cv.width/2;S.ball.y=cv.height/2;
      S.ball.vx=(Math.random()>0.5?1:-1)*3.5;S.ball.vy=(Math.random()*2-1)*2.5;
    }
    function tick(){
      if(S.over)return;
      const b=S.ball,p1=S.p1,p2=S.p2;
      b.x+=b.vx;b.y+=b.vy;
      if(b.y-b.r<0){b.y=b.r;b.vy*=-1;}
      if(b.y+b.r>cv.height){b.y=cv.height-b.r;b.vy*=-1;}
      /* AI */
      const ac=p2.y+p2.h/2;
      if(ac<b.y-4)p2.y=Math.min(cv.height-p2.h,p2.y+3.2);
      if(ac>b.y+4)p2.y=Math.max(0,p2.y-3.2);
      /* Player paddle */
      if(b.x-b.r<=p1.x+p1.w&&b.y>=p1.y-4&&b.y<=p1.y+p1.h+4&&b.vx<0){
        b.vx=Math.abs(b.vx)*1.06;b.vy+=(b.y-(p1.y+p1.h/2))*0.12;b.x=p1.x+p1.w+b.r;
      }
      if(b.x+b.r>=p2.x&&b.y>=p2.y-4&&b.y<=p2.y+p2.h+4&&b.vx>0){
        b.vx=-Math.abs(b.vx)*1.06;b.vy+=(b.y-(p2.y+p2.h/2))*0.12;b.x=p2.x-b.r;
      }
      b.vx=Math.max(-9,Math.min(9,b.vx));b.vy=Math.max(-7,Math.min(7,b.vy));
      if(b.x-b.r<0){p2.score++;reset();updateScore(`${p1.score} — ${p2.score}`);}
      if(b.x+b.r>cv.width){p1.score++;reset();updateScore(`${p1.score} — ${p2.score}`);}
      if(p1.score>=7||p2.score>=7){S.over=true;draw();gameOver(p1.score*10,p1.score>=7);return;}
      draw();
    }
    function draw(){
      ctx.fillStyle='#020b10';ctx.fillRect(0,0,cv.width,cv.height);
      ctx.setLineDash([8,10]);ctx.strokeStyle='rgba(11,59,70,0.7)';ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(cv.width/2,0);ctx.lineTo(cv.width/2,cv.height);ctx.stroke();ctx.setLineDash([]);
      const g=ctx.createLinearGradient(S.p1.x,0,S.p1.x+S.p1.w,0);g.addColorStop(0,'#d4a017');g.addColorStop(1,'#c25b12');
      ctx.fillStyle=g;
      ctx.beginPath();if(ctx.roundRect)ctx.roundRect(S.p1.x,S.p1.y,S.p1.w,S.p1.h,6);else ctx.rect(S.p1.x,S.p1.y,S.p1.w,S.p1.h);ctx.fill();
      ctx.fillStyle='#4a8a99';
      ctx.beginPath();if(ctx.roundRect)ctx.roundRect(S.p2.x,S.p2.y,S.p2.w,S.p2.h,6);else ctx.rect(S.p2.x,S.p2.y,S.p2.w,S.p2.h);ctx.fill();
      const bg=ctx.createRadialGradient(S.ball.x,S.ball.y,1,S.ball.x,S.ball.y,S.ball.r);
      bg.addColorStop(0,'#fff');bg.addColorStop(1,'#00ffa8');
      ctx.fillStyle=bg;ctx.beginPath();ctx.arc(S.ball.x,S.ball.y,S.ball.r,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='rgba(212,160,23,0.6)';ctx.font='bold 36px monospace';ctx.textAlign='center';
      ctx.fillText(S.p1.score,cv.width/4,54);ctx.fillText(S.p2.score,3*cv.width/4,54);ctx.textAlign='left';
      ctx.fillStyle='rgba(74,106,114,0.6)';ctx.font='10px monospace';ctx.textAlign='center';
      ctx.fillText('TÚ',cv.width/4,cv.height-8);ctx.fillText('CPU',3*cv.width/4,cv.height-8);ctx.textAlign='left';
    }
    return{
      init(c){
        cv=c;ctx=c.getContext('2d');
        S={ball:{x:c.width/2,y:c.height/2,vx:3.5,vy:2,r:8},
           p1:{x:12,y:c.height/2-44,w:13,h:88,score:0},
           p2:{x:c.width-25,y:c.height/2-44,w:13,h:88,score:0},over:false};
        kh=e=>{
          if(e.key==='ArrowUp')  S.p1.y=Math.max(0,S.p1.y-22);
          if(e.key==='ArrowDown')S.p1.y=Math.min(c.height-S.p1.h,S.p1.y+22);
        };
        document.addEventListener('keydown',kh);
        c.addEventListener('touchstart',e=>{
          const r=c.getBoundingClientRect(),y=e.touches[0].clientY-r.top;
          if(y<c.height/2)S.p1.y=Math.max(0,S.p1.y-32);
          else S.p1.y=Math.min(c.height-S.p1.h,S.p1.y+32);
        },{passive:true});
        iv=setInterval(tick,16);
      },
      cleanup(){if(kh)document.removeEventListener('keydown',kh);if(iv){clearInterval(iv);iv=null;}}
    };
  })();

  /* ─────────────────── SUDOKU 4×4 ────────────────────────── */
  Impls.sudoku = (() => {
    /* 5 puzzles verificados con solución única */
    const PUZZLES=[
      {b:[[1,0,3,0],[0,4,0,2],[2,0,4,0],[0,3,0,1]],s:[[1,2,3,4],[3,4,1,2],[2,1,4,3],[4,3,2,1]]},
      {b:[[0,1,4,0],[4,0,0,1],[1,0,0,4],[0,4,1,0]],s:[[2,1,4,3],[4,3,2,1],[1,2,3,4],[3,4,1,2]]},
      {b:[[3,0,1,0],[0,2,0,4],[4,0,2,0],[0,1,0,3]],s:[[3,4,1,2],[1,2,3,4],[4,3,2,1],[2,1,4,3]]},
      {b:[[1,0,2,0],[0,4,0,3],[3,0,4,0],[0,2,0,1]],s:[[1,3,2,4],[2,4,1,3],[3,1,4,2],[4,2,3,1]]},
      {b:[[0,3,0,1],[4,0,2,0],[0,4,0,2],[1,0,3,0]],s:[[2,3,4,1],[4,1,2,3],[3,4,1,2],[1,2,3,4]]},
    ];
    let pz,selected=null,completed=false;
    function init(container){
      const p=PUZZLES[Math.floor(Math.random()*PUZZLES.length)];
      pz={board:p.b.map(r=>[...r]),sol:p.s,given:p.b.map(r=>r.map(v=>v!==0))};
      selected=null;completed=false;
      render(container);
    }
    function render(container){
      container.innerHTML=`
        <div class="sudoku-container">
          <div class="sudoku-status" id="sudokuStatus">Completa el puzzle — cada fila, columna y cuadro 2×2</div>
          <div class="sudoku-grid" id="sudokuGrid">
            ${pz.board.map((row,r)=>row.map((v,c)=>{
              const isGiven=pz.given[r][c];
              const cls=['sudoku-cell',isGiven?'given':''].join(' ');
              return `<div class="${cls}" data-r="${r}" data-c="${c}">${v||''}</div>`;
            }).join('')).join('')}
          </div>
          <div class="sudoku-numpad" id="sudokuNumpad">
            ${[1,2,3,4].map(n=>`<div class="sudoku-num" data-n="${n}">${n}</div>`).join('')}
            <div class="sudoku-num sudoku-erase" data-n="0">⌫</div>
          </div>
        </div>`;
      /* Events */
      container.querySelectorAll('.sudoku-cell').forEach(el=>{
        el.addEventListener('click',()=>{
          if(pz.given[+el.dataset.r][+el.dataset.c])return;
          container.querySelectorAll('.sudoku-cell').forEach(e=>e.classList.remove('selected'));
          el.classList.add('selected');
          selected={r:+el.dataset.r,c:+el.dataset.c};
        });
      });
      container.querySelectorAll('.sudoku-num').forEach(el=>{
        el.addEventListener('click',()=>{
          if(!selected)return;
          const v=+el.dataset.n;
          pz.board[selected.r][selected.c]=v;
          const cell=container.querySelector(`.sudoku-cell[data-r="${selected.r}"][data-c="${selected.c}"]`);
          cell.textContent=v||'';
          cell.classList.remove('error','correct');
          if(v!==0){
            if(v===pz.sol[selected.r][selected.c])cell.classList.add('correct');
            else cell.classList.add('error');
          }
          checkWin(container);
        });
      });
    }
    function checkWin(container){
      const ok=pz.board.every((row,r)=>row.every((v,c)=>v===pz.sol[r][c]));
      if(ok){
        document.getElementById('sudokuStatus').textContent='🏆 ¡Resuelto! Excelente lógica.';
        document.getElementById('sudokuStatus').style.color='#00ffa8';
        updateScore('¡COMPLETADO!');
      }
    }
    return{init,cleanup(){}};
  })();

  /* ── API pública ─────────────────────────────────────────── */
  return { init, launch, showSelection };

})();

/* Auto-inicializar cuando el DOM esté listo */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => GamesEngine.init());
} else {
  GamesEngine.init();
}