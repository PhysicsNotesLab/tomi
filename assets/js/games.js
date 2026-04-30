/* ═══════════════════════════════════════════════════════════
   GAMES ENGINE — Lab Física UNAL  v2.0
   12 juegos · Controles mejorados · Mouse + teclado + táctil
   ═══════════════════════════════════════════════════════════ */
'use strict';

const GamesEngine = (() => {

  /* ── Catálogo ─────────────────────────────────────────────── */
  const GAMES = [
    { id:'tetris',   emoji:'🧱', name:'TETRIS',        desc:'Bloques clásicos',              hint:'← → mover · ↑ rotar · Espacio: caída' },
    { id:'snake',    emoji:'🐍', name:'SNAKE',          desc:'Come y crece sin parar',        hint:'Flechas / WASD · Desliza en móvil' },
    { id:'breakout', emoji:'🎯', name:'BREAKOUT',       desc:'Rompe todos los ladrillos',     hint:'Mouse / toque para mover paleta' },
    { id:'flappy',   emoji:'🚀', name:'FLAPPY GALAXY',  desc:'Esquiva los asteroides',        hint:'Espacio / toque para impulsar' },
    { id:'asteroids',emoji:'💥', name:'ASTEROIDS',      desc:'Destruye los asteroides',       hint:'← → rotar · ↑ impulso · Espacio: disparar' },
    { id:'pong',     emoji:'🏓', name:'PONG',           desc:'Paletas contra la IA',          hint:'Mouse/desliza para mover · ↑↓ teclado' },
    { id:'sudoku',   emoji:'🔢', name:'SUDOKU 4×4',     desc:'Despeja la mente con lógica',   hint:'Toca celda y elige número' },
    { id:'pacman',   emoji:'👻', name:'PAC-MAN',        desc:'Come puntos, huye fantasmas',   hint:'Flechas / WASD · Desliza en móvil' },
    { id:'invaders', emoji:'👾', name:'SPACE INVADERS', desc:'Destruye la flota alienígena',  hint:'← → mover · Espacio: disparar' },
    { id:'g2048',    emoji:'🔮', name:'2048',           desc:'Combina hasta llegar a 2048',   hint:'Flechas / WASD · Desliza en móvil' },
    { id:'mines',    emoji:'💣', name:'MINESWEEPER',    desc:'Encuentra los campos seguros',  hint:'Clic revelar · Clic largo: bandera' },
    { id:'memory',   emoji:'🧠', name:'MEMORY MATCH',   desc:'Encuentra los pares ocultos',   hint:'Toca para voltear las cartas' },
  ];

  function featuredIndex(subjectId) {
    let h=0, s=String(subjectId||'');
    for(let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))&0xffff;
    return h % GAMES.length;
  }

  let overlayEl=null, gameBodyEl=null, animFrame=null, currentImpl=null, currentSubjectId='';
  const DOM_GAMES = new Set(['sudoku','g2048','mines','memory']);

  /* ── init ─────────────────────────────────────────────────── */
  function init() {
    createOverlay();
    const target = document.getElementById('appContent');
    if(!target) return;
    new MutationObserver(()=>tryInjectTab()).observe(target,{childList:true,subtree:true});
    tryInjectTab();
  }

  /* ── Tab injection ────────────────────────────────────────── */
  function tryInjectTab() {
    const content = document.getElementById('appContent');
    if(!content) return;
    const allBtns = [...content.querySelectorAll('button')];
    const pomBtn  = allBtns.find(b=>/pomodoro/i.test(b.textContent));
    if(!pomBtn) return;
    const tabBar = pomBtn.parentElement;
    if(!tabBar||tabBar.querySelector('[data-game-tab]')) return;
    const hash = window.location.hash || '';
    currentSubjectId = hash.split('/').pop() || hash;
    const tab = document.createElement('button');
    tab.setAttribute('data-game-tab','true');
    tab.className = pomBtn.className.replace(/\bactive\b/g,'').trim();
    tab.innerHTML = '<i class="fa-solid fa-gamepad"></i> Juego';
    tabBar.querySelectorAll('button:not([data-game-tab])').forEach(btn=>{
      btn.addEventListener('click',()=>{ tab.classList.remove('active'); hideOverlay(); },true);
    });
    tab.addEventListener('click',()=>{
      tabBar.querySelectorAll('button').forEach(b=>b.classList.remove('active'));
      tab.classList.add('active');
      showSelection();
    });
    tabBar.appendChild(tab);
  }

  /* ── Overlay ──────────────────────────────────────────────── */
  function createOverlay() {
    if(document.getElementById('gamesOverlay')) return;
    overlayEl = document.createElement('div');
    overlayEl.id = 'gamesOverlay';
    overlayEl.className = 'game-overlay';
    overlayEl.innerHTML = `
      <div class="game-overlay-header">
        <span class="game-overlay-title" id="gOverlayTitle">🎮 ARCADE</span>
        <span class="game-overlay-score" id="gOverlayScore"></span>
        <button class="game-overlay-close" id="gOverlayClose">✕ CERRAR</button>
      </div>
      <div id="gameBody"></div>`;
    document.body.appendChild(overlayEl);
    gameBodyEl = overlayEl.querySelector('#gameBody');
    document.getElementById('gOverlayClose').addEventListener('click',()=>{
      hideOverlay();
      const c=document.getElementById('appContent');
      if(c){ const gt=c.querySelector('[data-game-tab]');
        if(gt){ gt.classList.remove('active');
          const ft=c.querySelector('button:not([data-game-tab])');
          if(ft) ft.click(); }
      }
    });
  }

  function showOverlay(){ if(overlayEl) overlayEl.classList.add('active'); }
  function hideOverlay(){ stopGame(); if(overlayEl) overlayEl.classList.remove('active'); }

  /* ── Selection screen ─────────────────────────────────────── */
  function showSelection() {
    stopGame(); showOverlay(); setTitle('🎮 ARCADE'); setScore('');
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
        ${GAMES.map((g,i)=>`
          <div class="game-card${i===fi?' featured':''}" onclick="GamesEngine.launch('${g.id}')">
            <span class="game-card-emoji">${g.emoji}</span>
            <div class="game-card-name">${g.name}</div>
            <div class="game-card-desc">${g.desc}</div>
            <button class="game-card-playbtn">▶ JUGAR</button>
          </div>`).join('')}
      </div>`;
  }

  /* ── Launch ───────────────────────────────────────────────── */
  function launch(gameId) {
    const g = GAMES.find(x=>x.id===gameId);
    if(!g) return;
    stopGame(); setTitle(`${g.emoji} ${g.name}`); setScore('');
    if(DOM_GAMES.has(gameId)){
      gameBodyEl.innerHTML='';
      Impls[gameId].init(gameBodyEl);
      currentImpl=Impls[gameId];
      return;
    }
    const W=Math.min(400,window.innerWidth-32);
    const H=Math.min(560,window.innerHeight-130);
    gameBodyEl.innerHTML=`
      <div class="game-canvas-wrap" id="gameCanvasWrap">
        <canvas id="gameCanvas" class="game-canvas" width="${W}" height="${H}"></canvas>
        <div class="game-controls-hint">${g.hint}</div>
        ${needsDpad(gameId)?buildDpad(gameId):''}
        <div class="game-msg-overlay" id="gameMsgOverlay" style="display:none">
          <h2 id="gameMsgTitle">GAME OVER</h2>
          <p id="gameMsgBody">Puntuación: 0</p>
          <button class="game-restart-btn" onclick="GamesEngine.launch('${gameId}')">↺ REINICIAR</button>
          <br>
          <button class="game-back-btn" onclick="GamesEngine.showSelection()">◀ SELECCIÓN</button>
        </div>
      </div>`;
    const canvas=document.getElementById('gameCanvas');
    const impl=Impls[gameId];
    if(impl){ currentImpl=impl; impl.init(canvas); if(needsDpad(gameId)) attachDpad(gameId); }
  }

  /* ── D-pad ────────────────────────────────────────────────── */
  function needsDpad(id){ return ['tetris','asteroids','snake','pacman','invaders'].includes(id); }

  function buildDpad(gameId){
    const is4dir=['tetris','snake','pacman'].includes(gameId);
    if(is4dir) return `
      <div class="game-dpad always" id="gameDpad">
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
    if(gameId==='asteroids') return `
      <div class="game-dpad always" id="gameDpad">
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
    if(gameId==='invaders') return `
      <div class="game-dpad always" id="gameDpad" style="flex-direction:row;justify-content:center;gap:16px;margin-top:10px">
        <div class="game-dpad-row">
          <button class="dpad-btn" data-dir="left" style="width:64px">←</button>
          <button class="dpad-btn dpad-shoot" data-dir="shoot" style="width:80px">🚀 FIRE</button>
          <button class="dpad-btn" data-dir="right" style="width:64px">→</button>
        </div>
      </div>`;
    return '';
  }

  function attachDpad(gameId){
    const dpad=document.getElementById('gameDpad');
    if(!dpad) return;
    const km={left:'ArrowLeft',right:'ArrowRight',up:'ArrowUp',down:'ArrowDown',shoot:' '};
    dpad.querySelectorAll('.dpad-btn').forEach(btn=>{
      const k=km[btn.dataset.dir]; if(!k) return;
      const dn=()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:k,bubbles:true}));
      const up=()=>document.dispatchEvent(new KeyboardEvent('keyup',  {key:k,bubbles:true}));
      btn.addEventListener('touchstart',e=>{e.preventDefault();dn();},{passive:false});
      btn.addEventListener('touchend',  e=>{e.preventDefault();up();},{passive:false});
      btn.addEventListener('mousedown',dn); btn.addEventListener('mouseup',up);
    });
  }

  /* ── Helpers ──────────────────────────────────────────────── */
  function stopGame(){
    if(animFrame){cancelAnimationFrame(animFrame);animFrame=null;}
    if(currentImpl?.cleanup) currentImpl.cleanup();
    currentImpl=null;
  }
  function setTitle(t){ const e=document.getElementById('gOverlayTitle'); if(e) e.textContent=t; }
  function setScore(v){ const e=document.getElementById('gOverlayScore'); if(e) e.textContent=v; }
  function showGameMsg(title,body){
    stopGame();
    const el=document.getElementById('gameMsgOverlay');
    if(!el) return;
    document.getElementById('gameMsgTitle').textContent=title;
    document.getElementById('gameMsgBody').textContent=body;
    el.style.display='block';
  }
  function gameOver(score,won=false){ showGameMsg(won?'🏆 ¡VICTORIA!':'GAME OVER',`Puntuación: ${score}`); }
  function updateScore(v){ setScore(`SCORE: ${v}`); }

  /* ══════════════════════════════════════════════════════════
     IMPLEMENTACIONES
  ══════════════════════════════════════════════════════════ */
  const Impls = {};

  /* ─────────────────── TETRIS ──────────────────────────────── */
  Impls.tetris = (() => {
    let cv,ctx,S,kh;
    const COLS=10,ROWS=20;
    const COLORS=['','#d4a017','#00ffa8','#ef5350','#42a5f5','#ab47bc','#ff7043','#66bb6a'];
    const SHAPES=[null,[[1,1,1,1]],[[2,2],[2,2]],[[0,3,0],[3,3,3]],[[4,0],[4,0],[4,4]],[[0,5],[0,5],[5,5]],[[0,6,6],[6,6,0]],[[7,7,0],[0,7,7]]];
    const rnd=()=>{const id=Math.floor(Math.random()*7)+1;return{id,shape:SHAPES[id].map(r=>[...r]),x:Math.floor(COLS/2)-1,y:0};};
    const collide=(b,p,dx=0,dy=0,ns=null)=>{const s=ns||p.shape;return s.some((row,r)=>row.some((v,c)=>{if(!v)return false;const nx=p.x+c+dx,ny=p.y+r+dy;return nx<0||nx>=COLS||ny>=ROWS||(ny>=0&&b[ny][nx]);}));};
    const rotate=s=>s[0].map((_,i)=>s.map(r=>r[i]).reverse());
    const lock=(b,p)=>p.shape.forEach((row,r)=>row.forEach((v,c)=>{if(v)b[p.y+r][p.x+c]=v;}));
    const clearLines=b=>{let n=0;for(let r=ROWS-1;r>=0;r--){if(b[r].every(v=>v)){b.splice(r,1);b.unshift(new Array(COLS).fill(0));n++;r++;}}return n;};
    const cw=()=>cv.width/COLS,ch=()=>cv.height/ROWS;
    const drawCell=(x,y,col)=>{ctx.fillStyle=col;ctx.fillRect(x*cw()+1,y*ch()+1,cw()-2,ch()-2);ctx.fillStyle='rgba(255,255,255,0.12)';ctx.fillRect(x*cw()+1,y*ch()+1,cw()-2,4);};
    function draw(){
      ctx.fillStyle='#020b10';ctx.fillRect(0,0,cv.width,cv.height);
      ctx.strokeStyle='rgba(11,59,70,0.45)';ctx.lineWidth=0.5;
      for(let r=0;r<ROWS;r++){ctx.beginPath();ctx.moveTo(0,r*ch());ctx.lineTo(cv.width,r*ch());ctx.stroke();}
      for(let c=0;c<COLS;c++){ctx.beginPath();ctx.moveTo(c*cw(),0);ctx.lineTo(c*cw(),cv.height);ctx.stroke();}
      S.board.forEach((row,r)=>row.forEach((v,c)=>{if(v)drawCell(c,r,COLORS[v]);}));
      if(S.piece) S.piece.shape.forEach((row,r)=>row.forEach((v,c)=>{if(v)drawCell(S.piece.x+c,S.piece.y+r,COLORS[v]);}));
      if(S.piece){let gy=S.piece.y;while(!collide(S.board,S.piece,0,gy-S.piece.y+1))gy++;S.piece.shape.forEach((row,r)=>row.forEach((v,c)=>{if(!v)return;ctx.fillStyle='rgba(255,255,255,0.07)';ctx.fillRect((S.piece.x+c)*cw()+1,(gy+r)*ch()+1,cw()-2,ch()-2);}));}
      ctx.fillStyle='rgba(212,160,23,0.9)';ctx.font=`bold ${Math.max(11,cv.width/35)}px monospace`;
      ctx.fillText(`SCORE ${S.score}  LÍNEAS ${S.lines}  NIV ${S.level}`,8,16);
    }
    function loop(ts){
      if(S.over)return;
      animFrame=requestAnimationFrame(loop);
      if(ts-S.lastDrop>S.speed){
        S.lastDrop=ts;
        if(!collide(S.board,S.piece,0,1)){S.piece.y++;}
        else{lock(S.board,S.piece);const n=clearLines(S.board);if(n){S.lines+=n;S.score+=n*100*S.level;S.level=Math.floor(S.lines/10)+1;S.speed=Math.max(80,850-S.level*75);updateScore(S.score);}S.piece=S.next;S.next=rnd();if(collide(S.board,S.piece)){S.over=true;draw();gameOver(S.score);return;}}
      }
      draw();
    }
    return{
      init(c){
        cv=c;ctx=c.getContext('2d');
        S={board:Array.from({length:ROWS},()=>new Array(COLS).fill(0)),piece:rnd(),next:rnd(),score:0,lines:0,level:1,speed:850,lastDrop:0,over:false};
        kh=e=>{
          if(S.over)return;
          if(e.key==='ArrowLeft'&&!collide(S.board,S.piece,-1))S.piece.x--;
          if(e.key==='ArrowRight'&&!collide(S.board,S.piece,1))S.piece.x++;
          if(e.key==='ArrowDown'&&!collide(S.board,S.piece,0,1))S.piece.y++;
          if(e.key==='ArrowUp'||e.key==='z'){const r=rotate(S.piece.shape);if(!collide(S.board,S.piece,0,0,r))S.piece.shape=r;}
          if(e.key===' '){while(!collide(S.board,S.piece,0,1))S.piece.y++;}
          draw();
        };
        document.addEventListener('keydown',kh);
        let tx,ty;
        c.addEventListener('touchstart',e=>{tx=e.touches[0].clientX;ty=e.touches[0].clientY;},{passive:true});
        c.addEventListener('touchend',e=>{
          const dx=e.changedTouches[0].clientX-tx,dy=e.changedTouches[0].clientY-ty;
          if(Math.abs(dx)>Math.abs(dy)&&Math.abs(dx)>15){if(dx<0&&!collide(S.board,S.piece,-1))S.piece.x--;if(dx>0&&!collide(S.board,S.piece,1))S.piece.x++;}
          else if(dy>20&&!collide(S.board,S.piece,0,1))S.piece.y++;
          else if(dy<-20){const r=rotate(S.piece.shape);if(!collide(S.board,S.piece,0,0,r))S.piece.shape=r;}
          draw();
        },{passive:true});
        animFrame=requestAnimationFrame(loop);
      },
      cleanup(){if(kh)document.removeEventListener('keydown',kh);}
    };
  })();

  /* ─────────────────── SNAKE (mejorado) ───────────────────── */
  Impls.snake = (() => {
    let cv,ctx,S,kh,iv;
    const SZ=20;
    function spawnFood(){
      let p;
      do{p={x:Math.floor(Math.random()*S.cols),y:Math.floor(Math.random()*S.rows)};}
      while(S.snake.some(s=>s.x===p.x&&s.y===p.y));
      S.food=p;
    }
    function tick(){
      if(S.over)return;
      S.dir=S.nd;
      const h={x:(S.snake[0].x+S.dir.x+S.cols)%S.cols,y:(S.snake[0].y+S.dir.y+S.rows)%S.rows};
      if(S.snake.some(s=>s.x===h.x&&s.y===h.y)){S.over=true;draw();gameOver(S.score);return;}
      S.snake.unshift(h);
      if(h.x===S.food.x&&h.y===S.food.y){S.score+=10;updateScore(S.score);spawnFood();if(S.score%60===0&&S.interval>70){clearInterval(iv);S.interval-=10;iv=setInterval(tick,S.interval);}}
      else S.snake.pop();
      draw();
    }
    function draw(){
      ctx.fillStyle='#020b10';ctx.fillRect(0,0,cv.width,cv.height);
      ctx.strokeStyle='rgba(11,59,70,0.28)';ctx.lineWidth=0.5;
      for(let x=0;x<cv.width;x+=SZ){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,cv.height);ctx.stroke();}
      for(let y=0;y<cv.height;y+=SZ){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(cv.width,y);ctx.stroke();}
      const pulse=0.7+Math.sin(Date.now()*0.008)*0.3;
      ctx.shadowColor='#ef5350';ctx.shadowBlur=8*pulse;
      ctx.fillStyle='#ef5350';
      ctx.beginPath();ctx.arc(S.food.x*SZ+SZ/2,S.food.y*SZ+SZ/2,SZ*0.38,0,Math.PI*2);ctx.fill();
      ctx.shadowBlur=0;
      S.snake.forEach((s,i)=>{
        const t=i/Math.max(1,S.snake.length-1);
        ctx.fillStyle=`hsl(${155-t*30},85%,${52-t*18}%)`;
        if(ctx.roundRect){ctx.beginPath();ctx.roundRect(s.x*SZ+1,s.y*SZ+1,SZ-2,SZ-2,4);ctx.fill();}
        else ctx.fillRect(s.x*SZ+1,s.y*SZ+1,SZ-2,SZ-2);
        if(i===0){
          ctx.fillStyle='#020b10';
          const ew=S.dir.y!==0?SZ/2-2:SZ*0.65, eh=S.dir.x!==0?SZ/2-2:SZ*0.65;
          ctx.fillRect(s.x*SZ+(SZ-ew)/2-S.dir.x*2,s.y*SZ+SZ*0.2-S.dir.y*2,3,3);
          ctx.fillRect(s.x*SZ+(SZ-ew)/2-S.dir.x*2+ew*0.5,s.y*SZ+SZ*0.2-S.dir.y*2,3,3);
        }
      });
      ctx.fillStyle='rgba(212,160,23,0.9)';ctx.font='bold 13px monospace';
      ctx.fillText(`SCORE ${S.score}  LARGO ${S.snake.length}`,8,16);
    }
    return{
      init(c){
        cv=c;ctx=c.getContext('2d');
        const cols=Math.floor(c.width/SZ),rows=Math.floor(c.height/SZ);
        const cx=Math.floor(cols/2),cy=Math.floor(rows/2);
        S={snake:[{x:cx,y:cy},{x:cx-1,y:cy},{x:cx-2,y:cy}],dir:{x:1,y:0},nd:{x:1,y:0},food:null,score:0,cols,rows,interval:115,over:false};
        spawnFood();
        kh=e=>{
          const m={ArrowUp:{x:0,y:-1},ArrowDown:{x:0,y:1},ArrowLeft:{x:-1,y:0},ArrowRight:{x:1,y:0},w:{x:0,y:-1},s:{x:0,y:1},a:{x:-1,y:0},d:{x:1,y:0}};
          const nd=m[e.key];
          if(nd&&!(nd.x===-S.dir.x&&nd.y===-S.dir.y)){S.nd=nd;e.preventDefault();}
        };
        document.addEventListener('keydown',kh);
        let tx=0,ty=0;
        c.addEventListener('touchstart',e=>{tx=e.touches[0].clientX;ty=e.touches[0].clientY;},{passive:true});
        c.addEventListener('touchend',e=>{
          const dx=e.changedTouches[0].clientX-tx,dy=e.changedTouches[0].clientY-ty;
          if(Math.abs(dx)<10&&Math.abs(dy)<10)return;
          let nd;
          if(Math.abs(dx)>Math.abs(dy))nd=dx>0?{x:1,y:0}:{x:-1,y:0};
          else nd=dy>0?{x:0,y:1}:{x:0,y:-1};
          if(!(nd.x===-S.dir.x&&nd.y===-S.dir.y))S.nd=nd;
        },{passive:true});
        iv=setInterval(tick,S.interval);
      },
      cleanup(){if(kh)document.removeEventListener('keydown',kh);if(iv){clearInterval(iv);iv=null;}}
    };
  })();

  /* ─────────────────── BREAKOUT ───────────────────────────── */
  Impls.breakout = (() => {
    let cv,ctx,S,kh,mh,th;
    function init(c){
      cv=c;ctx=c.getContext('2d');
      const bCols=8,bRows=5,bW=(c.width-32)/bCols,bH=22,gap=4;
      const bricks=[];
      for(let r=0;r<bRows;r++)for(let col=0;col<bCols;col++){const hue=190+r*22;bricks.push({x:16+col*bW,y:50+r*(bH+gap),w:bW-gap,h:bH,alive:true,col:`hsl(${hue},65%,52%)`});}
      S={paddle:{x:c.width/2-44,y:c.height-28,w:88,h:12},ball:{x:c.width/2,y:c.height-60,vx:3.2,vy:-3.6,r:8},bricks,score:0,lives:3,over:false,win:false};
      kh=e=>{if(e.key==='ArrowLeft')S.paddle.x=Math.max(0,S.paddle.x-22);if(e.key==='ArrowRight')S.paddle.x=Math.min(c.width-S.paddle.w,S.paddle.x+22);};
      mh=e=>{const r=c.getBoundingClientRect();S.paddle.x=Math.min(Math.max(e.clientX-r.left-S.paddle.w/2,0),c.width-S.paddle.w);};
      th=e=>{e.preventDefault();const r=c.getBoundingClientRect();S.paddle.x=Math.min(Math.max(e.touches[0].clientX-r.left-S.paddle.w/2,0),c.width-S.paddle.w);};
      document.addEventListener('keydown',kh);c.addEventListener('mousemove',mh);c.addEventListener('touchmove',th,{passive:false});
      animFrame=requestAnimationFrame(loop);
    }
    function loop(){if(S.over||S.win)return;animFrame=requestAnimationFrame(loop);update();draw();}
    function update(){
      const b=S.ball,p=S.paddle;
      b.x+=b.vx;b.y+=b.vy;
      if(b.x-b.r<0){b.x=b.r;b.vx*=-1;}if(b.x+b.r>cv.width){b.x=cv.width-b.r;b.vx*=-1;}if(b.y-b.r<0){b.y=b.r;b.vy*=-1;}
      if(b.y+b.r>=p.y&&b.y+b.r<=p.y+p.h+4&&b.x>=p.x-4&&b.x<=p.x+p.w+4&&b.vy>0){b.vy=-Math.abs(b.vy);b.vx=(b.x-(p.x+p.w/2))/p.w*9;b.y=p.y-b.r;}
      if(b.y-b.r>cv.height){S.lives--;updateScore(`${S.score} ♥${S.lives}`);if(S.lives<=0){S.over=true;draw();gameOver(S.score);return;}b.x=cv.width/2;b.y=cv.height-80;b.vx=3.2;b.vy=-3.6;}
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
    function draw(){
      ctx.fillStyle='#020b10';ctx.fillRect(0,0,cv.width,cv.height);
      S.bricks.forEach(br=>{if(!br.alive)return;ctx.fillStyle=br.col;if(ctx.roundRect){ctx.beginPath();ctx.roundRect(br.x,br.y,br.w,br.h,3);ctx.fill();}else ctx.fillRect(br.x,br.y,br.w,br.h);ctx.fillStyle='rgba(255,255,255,0.1)';ctx.fillRect(br.x+2,br.y+2,br.w-4,4);});
      const pg=ctx.createLinearGradient(S.paddle.x,0,S.paddle.x+S.paddle.w,0);pg.addColorStop(0,'#d4a017');pg.addColorStop(1,'#c25b12');ctx.fillStyle=pg;
      if(ctx.roundRect){ctx.beginPath();ctx.roundRect(S.paddle.x,S.paddle.y,S.paddle.w,S.paddle.h,6);ctx.fill();}else ctx.fillRect(S.paddle.x,S.paddle.y,S.paddle.w,S.paddle.h);
      const bg=ctx.createRadialGradient(S.ball.x-2,S.ball.y-2,1,S.ball.x,S.ball.y,S.ball.r);bg.addColorStop(0,'#fff');bg.addColorStop(1,'#00ffa8');ctx.fillStyle=bg;ctx.beginPath();ctx.arc(S.ball.x,S.ball.y,S.ball.r,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='rgba(212,160,23,0.9)';ctx.font='bold 13px monospace';ctx.fillText(`SCORE ${S.score}  ♥ ${S.lives}`,8,20);
    }
    return{init,cleanup(){if(kh)document.removeEventListener('keydown',kh);if(cv){cv.removeEventListener('mousemove',mh);cv.removeEventListener('touchmove',th);}}};
  })();

  /* ─────────────────── FLAPPY GALAXY ──────────────────────── */
  Impls.flappy = (() => {
    let cv,ctx,S,kh,ch2,STARS=[];
    const GRAVITY=0.38,FLAP=-7,PIPE_W=38,GAP=155,SPEED=2.4;
    function init(c){
      cv=c;ctx=c.getContext('2d');
      STARS=Array.from({length:90},()=>({x:Math.random()*c.width,y:Math.random()*c.height,r:Math.random()*1.5+0.3,b:Math.random()}));
      S={ship:{x:80,y:c.height/2,vy:0},pipes:[],score:0,frame:0,over:false,started:false};
      const flap=()=>{if(!S.started)S.started=true;if(!S.over)S.ship.vy=FLAP;};
      kh=e=>{if(e.key===' '||e.key==='ArrowUp')flap();};
      ch2=()=>flap();
      document.addEventListener('keydown',kh);c.addEventListener('click',ch2);c.addEventListener('touchstart',ch2,{passive:true});
      animFrame=requestAnimationFrame(loop);
    }
    function loop(){
      if(S.over)return;animFrame=requestAnimationFrame(loop);
      if(!S.started){draw();return;}
      S.frame++;
      if(S.frame%95===0){const top=50+Math.random()*(cv.height-GAP-80);S.pipes.push({x:cv.width,top,bot:top+GAP,scored:false});}
      S.pipes.forEach(p=>{p.x-=SPEED;if(!p.scored&&p.x+PIPE_W<S.ship.x){p.scored=true;S.score++;updateScore(S.score);}});
      S.pipes=S.pipes.filter(p=>p.x+PIPE_W>0);
      S.ship.vy+=GRAVITY;S.ship.y+=S.ship.vy;
      const s=S.ship;
      if(s.y-12<0||s.y+12>cv.height){S.over=true;draw();gameOver(S.score);return;}
      for(const p of S.pipes){if(s.x+10>p.x&&s.x-10<p.x+PIPE_W){if(s.y-10<p.top||s.y+10>p.bot){S.over=true;draw();gameOver(S.score);return;}}}
      draw();
    }
    function draw(){
      ctx.fillStyle='#020b10';ctx.fillRect(0,0,cv.width,cv.height);
      STARS.forEach(s=>{ctx.fillStyle=`rgba(255,255,255,${0.25+s.b*0.75})`;ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill();});
      S.pipes.forEach(p=>{const g=ctx.createLinearGradient(p.x,0,p.x+PIPE_W,0);g.addColorStop(0,'#0d2a36');g.addColorStop(1,'#183848');ctx.fillStyle=g;ctx.fillRect(p.x,0,PIPE_W,p.top);ctx.fillRect(p.x,p.bot,PIPE_W,cv.height-p.bot);ctx.fillStyle='rgba(0,255,168,0.25)';ctx.fillRect(p.x+PIPE_W-3,0,3,p.top);ctx.fillRect(p.x+PIPE_W-3,p.bot,3,cv.height-p.bot);});
      const s=S.ship;ctx.save();ctx.translate(s.x,s.y);ctx.rotate(Math.max(-0.5,Math.min(0.5,s.vy*0.055)));ctx.fillStyle='#d4a017';ctx.beginPath();ctx.moveTo(14,0);ctx.lineTo(-10,-8);ctx.lineTo(-5,0);ctx.lineTo(-10,8);ctx.closePath();ctx.fill();ctx.fillStyle='rgba(0,255,168,0.55)';ctx.beginPath();ctx.moveTo(-5,0);ctx.lineTo(-16,-4);ctx.lineTo(-16,4);ctx.closePath();ctx.fill();ctx.restore();
      ctx.fillStyle='rgba(212,160,23,0.9)';ctx.font='bold 14px monospace';ctx.fillText(`SCORE ${S.score}`,8,22);
      if(!S.started){ctx.fillStyle='rgba(212,160,23,0.7)';ctx.font='bold 15px monospace';ctx.textAlign='center';ctx.fillText('TOCA PARA COMENZAR',cv.width/2,cv.height/2+4);ctx.textAlign='left';}
    }
    return{init,cleanup(){if(kh)document.removeEventListener('keydown',kh);if(cv){cv.removeEventListener('click',ch2);cv.removeEventListener('touchstart',ch2);}}};
  })();

  /* ─────────────────── ASTEROIDS ──────────────────────────── */
  Impls.asteroids = (() => {
    let cv,ctx,S,kh,ku,keys={};
    const rnd=(a,b)=>a+Math.random()*(b-a);
    function mkAsteroid(cx,cy,r=null){
      let x,y;do{x=Math.random()*cv.width;y=Math.random()*cv.height;}while(Math.hypot(x-cx,y-cy)<140);
      const angle=Math.random()*Math.PI*2,speed=rnd(0.6,1.6),radius=r||rnd(26,42);
      const pts=Array.from({length:9},(_,i)=>{const a=i/9*Math.PI*2;return{x:Math.cos(a)*(radius+rnd(-6,6)),y:Math.sin(a)*(radius+rnd(-6,6))};});
      return{x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,radius,pts,rot:0,rotSpeed:rnd(-0.02,0.02)};
    }
    function init(c){
      cv=c;ctx=c.getContext('2d');keys={};
      const cx=c.width/2,cy=c.height/2;
      S={ship:{x:cx,y:cy,vx:0,vy:0,angle:-Math.PI/2,cooldown:0},asteroids:Array.from({length:5},()=>mkAsteroid(cx,cy)),bullets:[],score:0,lives:3,over:false};
      kh=e=>{keys[e.key]=true;e.key===' '&&e.preventDefault();};
      ku=e=>{delete keys[e.key];};
      document.addEventListener('keydown',kh);document.addEventListener('keyup',ku);
      animFrame=requestAnimationFrame(loop);
    }
    function loop(){if(S.over)return;animFrame=requestAnimationFrame(loop);update();draw();}
    function update(){
      const s=S.ship;
      if(keys['ArrowLeft'])s.angle-=0.055;if(keys['ArrowRight'])s.angle+=0.055;
      if(keys['ArrowUp']){s.vx+=Math.cos(s.angle)*0.22;s.vy+=Math.sin(s.angle)*0.22;}
      s.vx*=0.985;s.vy*=0.985;s.x=(s.x+s.vx+cv.width)%cv.width;s.y=(s.y+s.vy+cv.height)%cv.height;
      if(keys[' ']&&s.cooldown<=0){S.bullets.push({x:s.x+Math.cos(s.angle)*18,y:s.y+Math.sin(s.angle)*18,vx:Math.cos(s.angle)*9,vy:Math.sin(s.angle)*9,life:55});s.cooldown=14;}
      if(s.cooldown>0)s.cooldown--;
      S.bullets.forEach(b=>{b.x=(b.x+b.vx+cv.width)%cv.width;b.y=(b.y+b.vy+cv.height)%cv.height;b.life--;});
      S.bullets=S.bullets.filter(b=>b.life>0);
      S.asteroids.forEach(a=>{a.x=(a.x+a.vx+cv.width)%cv.width;a.y=(a.y+a.vy+cv.height)%cv.height;a.rot+=a.rotSpeed;});
      for(let bi=S.bullets.length-1;bi>=0;bi--){for(let ai=S.asteroids.length-1;ai>=0;ai--){const b=S.bullets[bi],a=S.asteroids[ai];if(!b||!a)continue;if(Math.hypot(b.x-a.x,b.y-a.y)<a.radius){S.bullets.splice(bi,1);S.score+=a.radius>28?10:20;updateScore(`${S.score} ♥${S.lives}`);if(a.radius>18){S.asteroids.push(mkAsteroid(a.x,a.y,a.radius*0.55));S.asteroids.push(mkAsteroid(a.x,a.y,a.radius*0.55));}S.asteroids.splice(ai,1);break;}}}
      S.asteroids.forEach(a=>{if(Math.hypot(s.x-a.x,s.y-a.y)<a.radius+10){S.lives--;updateScore(`${S.score} ♥${S.lives}`);if(S.lives<=0){S.over=true;draw();gameOver(S.score);return;}s.x=cv.width/2;s.y=cv.height/2;s.vx=0;s.vy=0;}});
      if(S.asteroids.length===0)for(let i=0;i<5+Math.floor(S.score/60);i++)S.asteroids.push(mkAsteroid(s.x,s.y));
    }
    function draw(){
      ctx.fillStyle='#020b10';ctx.fillRect(0,0,cv.width,cv.height);
      S.asteroids.forEach(a=>{ctx.save();ctx.translate(a.x,a.y);ctx.rotate(a.rot);ctx.strokeStyle='#3a7a88';ctx.lineWidth=2;ctx.beginPath();a.pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.stroke();ctx.restore();});
      ctx.fillStyle='#00ffa8';S.bullets.forEach(b=>{ctx.beginPath();ctx.arc(b.x,b.y,3,0,Math.PI*2);ctx.fill();});
      const s=S.ship;ctx.save();ctx.translate(s.x,s.y);ctx.rotate(s.angle);ctx.strokeStyle='#d4a017';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(16,0);ctx.lineTo(-10,-8);ctx.lineTo(-5,0);ctx.lineTo(-10,8);ctx.closePath();ctx.stroke();
      if(keys['ArrowUp']){ctx.strokeStyle='#ef5350';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-5,0);ctx.lineTo(-16,0);ctx.stroke();}
      ctx.restore();
      ctx.fillStyle='rgba(212,160,23,0.9)';ctx.font='bold 13px monospace';ctx.fillText(`SCORE ${S.score}  ♥ ${S.lives}`,8,20);
    }
    return{init,cleanup(){if(kh){document.removeEventListener('keydown',kh);document.removeEventListener('keyup',ku);}}};
  })();

  /* ─────────────────── PONG (mejorado) ────────────────────── */
  Impls.pong = (() => {
    let cv,ctx,S,kh,ku,keys={},mh,th,iv;
    function reset(){S.ball.x=cv.width/2;S.ball.y=cv.height/2;S.ball.vx=(Math.random()>0.5?1:-1)*3.5;S.ball.vy=(Math.random()*2-1)*2.5;}
    function tick(){
      if(S.over)return;
      const b=S.ball,p1=S.p1,p2=S.p2;
      // Teclado suave
      if(keys['ArrowUp']  ||keys['w']) p1.y=Math.max(0,p1.y-7);
      if(keys['ArrowDown']||keys['s']) p1.y=Math.min(cv.height-p1.h,p1.y+7);
      b.x+=b.vx;b.y+=b.vy;
      if(b.y-b.r<0){b.y=b.r;b.vy*=-1;}if(b.y+b.r>cv.height){b.y=cv.height-b.r;b.vy*=-1;}
      // IA (más lenta y humana)
      const ac=p2.y+p2.h/2;
      if(ac<b.y-6)p2.y=Math.min(cv.height-p2.h,p2.y+2.8);
      if(ac>b.y+6)p2.y=Math.max(0,p2.y-2.8);
      // Colisiones
      if(b.x-b.r<=p1.x+p1.w&&b.y>=p1.y-4&&b.y<=p1.y+p1.h+4&&b.vx<0){b.vx=Math.abs(b.vx)*1.05;b.vy+=(b.y-(p1.y+p1.h/2))*0.1;b.x=p1.x+p1.w+b.r;}
      if(b.x+b.r>=p2.x&&b.y>=p2.y-4&&b.y<=p2.y+p2.h+4&&b.vx>0){b.vx=-Math.abs(b.vx)*1.05;b.vy+=(b.y-(p2.y+p2.h/2))*0.1;b.x=p2.x-b.r;}
      b.vx=Math.max(-9,Math.min(9,b.vx));b.vy=Math.max(-7,Math.min(7,b.vy));
      if(b.x-b.r<0){p2.score++;reset();updateScore(`${p1.score} — ${p2.score}`);}
      if(b.x+b.r>cv.width){p1.score++;reset();updateScore(`${p1.score} — ${p2.score}`);}
      if(p1.score>=7||p2.score>=7){S.over=true;draw();gameOver(p1.score*10,p1.score>=7);return;}
      draw();
    }
    function draw(){
      ctx.fillStyle='#020b10';ctx.fillRect(0,0,cv.width,cv.height);
      ctx.setLineDash([8,10]);ctx.strokeStyle='rgba(11,59,70,0.7)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(cv.width/2,0);ctx.lineTo(cv.width/2,cv.height);ctx.stroke();ctx.setLineDash([]);
      ctx.fillStyle='rgba(212,160,23,0.6)';ctx.font='bold 42px monospace';ctx.textAlign='center';
      ctx.fillText(S.p1.score,cv.width/4,56);ctx.fillText(S.p2.score,3*cv.width/4,56);
      ctx.font='10px monospace';ctx.fillStyle='rgba(74,106,114,0.7)';
      ctx.fillText('TÚ  ← mouse/↕',cv.width/4,cv.height-6);ctx.fillText('CPU',3*cv.width/4,cv.height-6);ctx.textAlign='left';
      // Paddles
      const pg=ctx.createLinearGradient(S.p1.x,0,S.p1.x+S.p1.w,0);pg.addColorStop(0,'#d4a017');pg.addColorStop(1,'#c25b12');ctx.fillStyle=pg;
      if(ctx.roundRect){ctx.beginPath();ctx.roundRect(S.p1.x,S.p1.y,S.p1.w,S.p1.h,6);ctx.fill();}else ctx.fillRect(S.p1.x,S.p1.y,S.p1.w,S.p1.h);
      ctx.fillStyle='#4a8a99';
      if(ctx.roundRect){ctx.beginPath();ctx.roundRect(S.p2.x,S.p2.y,S.p2.w,S.p2.h,6);ctx.fill();}else ctx.fillRect(S.p2.x,S.p2.y,S.p2.w,S.p2.h);
      // Pelota con brillo
      const bg=ctx.createRadialGradient(S.ball.x-2,S.ball.y-2,1,S.ball.x,S.ball.y,S.ball.r);bg.addColorStop(0,'#fff');bg.addColorStop(1,'#00ffa8');ctx.fillStyle=bg;ctx.beginPath();ctx.arc(S.ball.x,S.ball.y,S.ball.r,0,Math.PI*2);ctx.fill();
    }
    return{
      init(c){
        cv=c;ctx=c.getContext('2d');keys={};
        S={ball:{x:c.width/2,y:c.height/2,vx:3.5,vy:2,r:8},p1:{x:12,y:c.height/2-50,w:13,h:100,score:0},p2:{x:c.width-25,y:c.height/2-50,w:13,h:100,score:0},over:false};
        kh=e=>{keys[e.key]=true;};ku=e=>{delete keys[e.key];};
        document.addEventListener('keydown',kh);document.addEventListener('keyup',ku);
        // Movimiento con mouse (arrastra paddle suavemente)
        mh=e=>{const r=c.getBoundingClientRect();S.p1.y=Math.max(0,Math.min(c.height-S.p1.h,e.clientY-r.top-S.p1.h/2));};
        c.addEventListener('mousemove',mh);
        // Movimiento con toque (arrastra el dedo)
        th=e=>{e.preventDefault();const r=c.getBoundingClientRect();S.p1.y=Math.max(0,Math.min(c.height-S.p1.h,e.touches[0].clientY-r.top-S.p1.h/2));};
        c.addEventListener('touchmove',th,{passive:false});
        iv=setInterval(tick,16);
      },
      cleanup(){if(kh)document.removeEventListener('keydown',kh);if(ku)document.removeEventListener('keyup',ku);if(iv){clearInterval(iv);iv=null;}if(cv){cv.removeEventListener('mousemove',mh);cv.removeEventListener('touchmove',th);}}
    };
  })();

  /* ─────────────────── SUDOKU 4×4 ─────────────────────────── */
  Impls.sudoku = (() => {
    const PUZZLES=[
      {b:[[1,0,3,0],[0,4,0,2],[2,0,4,0],[0,3,0,1]],s:[[1,2,3,4],[3,4,1,2],[2,1,4,3],[4,3,2,1]]},
      {b:[[0,1,4,0],[4,0,0,1],[1,0,0,4],[0,4,1,0]],s:[[2,1,4,3],[4,3,2,1],[1,2,3,4],[3,4,1,2]]},
      {b:[[3,0,1,0],[0,2,0,4],[4,0,2,0],[0,1,0,3]],s:[[3,4,1,2],[1,2,3,4],[4,3,2,1],[2,1,4,3]]},
      {b:[[1,0,2,0],[0,4,0,3],[3,0,4,0],[0,2,0,1]],s:[[1,3,2,4],[2,4,1,3],[3,1,4,2],[4,2,3,1]]},
      {b:[[0,3,0,1],[4,0,2,0],[0,4,0,2],[1,0,3,0]],s:[[2,3,4,1],[4,1,2,3],[3,4,1,2],[1,2,3,4]]},
    ];
    let pz,selected=null;
    function init(container){
      const p=PUZZLES[Math.floor(Math.random()*PUZZLES.length)];
      pz={board:p.b.map(r=>[...r]),sol:p.s,given:p.b.map(r=>r.map(v=>v!==0))};
      selected=null;render(container);
    }
    function render(container){
      container.innerHTML=`
        <div class="sudoku-container">
          <div class="sudoku-status" id="sudokuStatus">Completa el puzzle — cada fila, columna y cuadro 2×2</div>
          <div class="sudoku-grid" id="sudokuGrid">
            ${pz.board.map((row,r)=>row.map((v,c)=>{const ig=pz.given[r][c];return`<div class="sudoku-cell${ig?' given':''}" data-r="${r}" data-c="${c}">${v||''}</div>`;}).join('')).join('')}
          </div>
          <div class="sudoku-numpad">
            ${[1,2,3,4].map(n=>`<div class="sudoku-num" data-n="${n}">${n}</div>`).join('')}
            <div class="sudoku-num sudoku-erase" data-n="0">⌫</div>
          </div>
        </div>`;
      container.querySelectorAll('.sudoku-cell').forEach(el=>{
        el.addEventListener('click',()=>{
          if(pz.given[+el.dataset.r][+el.dataset.c])return;
          container.querySelectorAll('.sudoku-cell').forEach(e=>e.classList.remove('selected'));
          el.classList.add('selected');selected={r:+el.dataset.r,c:+el.dataset.c};
        });
      });
      container.querySelectorAll('.sudoku-num').forEach(el=>{
        el.addEventListener('click',()=>{
          if(!selected)return;const v=+el.dataset.n;pz.board[selected.r][selected.c]=v;
          const cell=container.querySelector(`.sudoku-cell[data-r="${selected.r}"][data-c="${selected.c}"]`);
          cell.textContent=v||'';cell.classList.remove('error','correct');
          if(v!==0){if(v===pz.sol[selected.r][selected.c])cell.classList.add('correct');else cell.classList.add('error');}
          if(pz.board.every((row,r)=>row.every((v2,c)=>v2===pz.sol[r][c]))){document.getElementById('sudokuStatus').textContent='🏆 ¡Resuelto! Excelente lógica.';document.getElementById('sudokuStatus').style.color='#00ffa8';updateScore('¡COMPLETADO!');}
        });
      });
    }
    return{init,cleanup(){}};
  })();

  /* ═══════════════════════════════════════════════════════════
     NUEVOS JUEGOS
  ═══════════════════════════════════════════════════════════ */

  /* ─────────────────── PAC-MAN ────────────────────────────── */
  Impls.pacman = (() => {
    const ROWS=17,COLS=15;
    const T={WALL:1,DOT:0,PELLET:3,EMPTY:4,GHOST:2};
    const MAP_BASE=[
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,0,0,0,0,0,1,0,1,0,0,0,0,0,1],
      [1,0,1,1,0,1,1,0,1,1,0,1,1,0,1],
      [1,3,0,0,0,0,1,0,1,0,0,0,0,3,1],
      [1,0,1,1,0,1,1,0,1,1,0,1,1,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,1,1,4,4,4,1,1,0,0,0,1],
      [1,0,0,0,1,2,2,2,2,2,1,0,0,0,1],
      [1,0,0,0,1,2,2,2,2,2,1,0,0,0,1],
      [1,0,0,0,1,1,1,1,1,1,1,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,1,1,0,1,1,0,1,1,0,1,1,0,1],
      [1,3,0,0,0,0,1,0,1,0,0,0,0,3,1],
      [1,0,1,1,0,1,1,0,1,1,0,1,1,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,4,0,0,0,0,0,0,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    ];
    const DIRS4=[{r:-1,c:0},{r:1,c:0},{r:0,c:-1},{r:0,c:1}];
    let cv,ctx,S,kh,cs;

    function canWalk(map,r,c,ghost=false){
      if(r<0||r>=ROWS||c<0||c>=COLS)return false;
      const t=map[r][c];
      if(t===T.WALL)return false;
      if(t===T.GHOST&&!ghost)return false;
      return true;
    }

    function newState(){
      const map=MAP_BASE.map(row=>[...row]);
      let total=0;for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)if(map[r][c]===T.DOT||map[r][c]===T.PELLET)total++;
      return{
        map,total,eaten:0,score:0,frame:0,spd:8,gSpd:11,over:false,won:false,
        pac:{r:15,c:7,dir:{r:0,c:0},next:{r:0,c:-1},lives:3},
        ghosts:[
          {r:7,c:6,dir:{r:0,c:1},color:'#ef5350',mode:'house',timer:90,scared:0},
          {r:7,c:7,dir:{r:0,c:-1},color:'#f48fb1',mode:'house',timer:180,scared:0},
          {r:8,c:6,dir:{r:0,c:1},color:'#26c6da',mode:'house',timer:270,scared:0},
          {r:8,c:7,dir:{r:0,c:-1},color:'#ffb74d',mode:'house',timer:360,scared:0},
        ]
      };
    }

    function init(c){
      cv=c;ctx=c.getContext('2d');
      cs=Math.floor(c.width/COLS);
      c.height=cs*(ROWS+1);
      S=newState();
      kh=e=>{
        const m={ArrowUp:{r:-1,c:0},ArrowDown:{r:1,c:0},ArrowLeft:{r:0,c:-1},ArrowRight:{r:0,c:1},w:{r:-1,c:0},s:{r:1,c:0},a:{r:0,c:-1},d:{r:0,c:1}};
        if(m[e.key]){S.pac.next=m[e.key];e.preventDefault();}
      };
      document.addEventListener('keydown',kh);
      let tx=0,ty=0;
      c.addEventListener('touchstart',e=>{tx=e.touches[0].clientX;ty=e.touches[0].clientY;},{passive:true});
      c.addEventListener('touchend',e=>{
        const dx=e.changedTouches[0].clientX-tx,dy=e.changedTouches[0].clientY-ty;
        if(Math.abs(dx)<8&&Math.abs(dy)<8)return;
        S.pac.next=Math.abs(dx)>Math.abs(dy)?{r:0,c:dx>0?1:-1}:{r:dy>0?1:-1,c:0};
      },{passive:true});
      animFrame=requestAnimationFrame(loop);
    }

    function loop(){
      if(S.over)return;
      animFrame=requestAnimationFrame(loop);
      S.frame++;
      if(S.frame%S.spd===0)movePac();
      if(S.frame%S.gSpd===0)S.ghosts.forEach(g=>moveGhost(g));
      draw();
    }

    function movePac(){
      const p=S.pac;
      if(canWalk(S.map,p.r+p.next.r,p.c+p.next.c))p.dir={...p.next};
      if(canWalk(S.map,p.r+p.dir.r,p.c+p.dir.c)){p.r+=p.dir.r;p.c+=p.dir.c;}
      const t=S.map[p.r][p.c];
      if(t===T.DOT){S.map[p.r][p.c]=T.EMPTY;S.score+=10;S.eaten++;updateScore(S.score);}
      else if(t===T.PELLET){S.map[p.r][p.c]=T.EMPTY;S.score+=50;S.eaten++;updateScore(S.score);S.ghosts.forEach(g=>{if(g.mode!=='house')g.scared=220;});}
      if(S.eaten>=S.total){S.over=true;S.won=true;setTimeout(()=>gameOver(S.score,true),600);return;}
      hitCheck();
    }

    function hitCheck(){
      const p=S.pac;
      S.ghosts.forEach(g=>{
        if(g.mode==='house')return;
        if(g.r===p.r&&g.c===p.c){
          if(g.scared>0){g.scared=0;g.mode='house';g.r=7;g.c=7;g.timer=120;S.score+=200;updateScore(S.score);}
          else{p.lives--;if(p.lives<=0){S.over=true;setTimeout(()=>gameOver(S.score),500);}else{p.r=15;p.c=7;p.dir={r:0,c:0};p.next={r:0,c:-1};S.ghosts.forEach((g2,i)=>{g2.r=i<2?7:8;g2.c=i%2===0?6:7;g2.mode='house';g2.timer=90*(i+1);g2.scared=0;});}updateScore(`${S.score} ♥${p.lives}`);}
        }
      });
    }

    function moveGhost(g){
      if(g.scared>0)g.scared--;
      if(g.mode==='house'){
        g.timer--;if(g.timer>0)return;
        if(g.r>6){if(g.c<7&&canWalk(S.map,g.r,g.c+1,true))g.c++;else if(g.c>7&&canWalk(S.map,g.r,g.c-1,true))g.c--;else if(canWalk(S.map,g.r-1,g.c,true))g.r--;}
        else{g.mode='chase';}
        return;
      }
      const rev={r:-g.dir.r,c:-g.dir.c};
      const valid=DIRS4.filter(d=>!(d.r===rev.r&&d.c===rev.c)&&canWalk(S.map,g.r+d.r,g.c+d.c));
      if(!valid.length)return;
      let chosen;
      if(g.scared>0){chosen=valid[Math.floor(Math.random()*valid.length)];}
      else{valid.sort((a,b)=>Math.hypot((g.r+a.r)-S.pac.r,(g.c+a.c)-S.pac.c)-Math.hypot((g.r+b.r)-S.pac.r,(g.c+b.c)-S.pac.c));chosen=Math.random()<0.12&&valid.length>1?valid[1]:valid[0];}
      g.r+=chosen.r;g.c+=chosen.c;g.dir={...chosen};
      hitCheck();
    }

    function draw(){
      ctx.fillStyle='#020b10';ctx.fillRect(0,0,cv.width,cv.height);
      const oy=cs;
      for(let r=0;r<ROWS;r++){
        for(let c=0;c<COLS;c++){
          const x=c*cs,y=oy+r*cs,t=S.map[r][c];
          if(t===T.WALL){
            ctx.fillStyle='#0d3347';ctx.fillRect(x,y,cs,cs);
            ctx.strokeStyle='rgba(11,100,130,0.4)';ctx.lineWidth=0.5;ctx.strokeRect(x+0.5,y+0.5,cs-1,cs-1);
          } else {
            ctx.fillStyle='#0a1a26';ctx.fillRect(x,y,cs,cs);
            if(t===T.DOT){ctx.fillStyle='#c8880e';ctx.beginPath();ctx.arc(x+cs/2,y+cs/2,cs*0.1,0,Math.PI*2);ctx.fill();}
            else if(t===T.PELLET&&Math.floor(S.frame/8)%2===0){ctx.shadowColor='#00ffa8';ctx.shadowBlur=8;ctx.fillStyle='#00ffa8';ctx.beginPath();ctx.arc(x+cs/2,y+cs/2,cs*0.26,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;}
          }
        }
      }
      // Pac
      const p=S.pac;
      const px=p.c*cs+cs/2,py=oy+p.r*cs+cs/2;
      const mouth=Math.abs(Math.sin(S.frame*0.28))*0.38;
      const ang=Math.atan2(p.dir.r,p.dir.c);
      ctx.fillStyle='#d4a017';
      ctx.beginPath();ctx.moveTo(px,py);ctx.arc(px,py,cs*0.42,ang+mouth,ang+Math.PI*2-mouth);ctx.closePath();ctx.fill();
      // Ghosts
      S.ghosts.forEach(g=>{
        if(g.mode==='house'&&g.timer>60)return;
        const gx=g.c*cs+cs/2,gy=oy+g.r*cs+cs/2,gr=cs*0.4;
        const scared=g.scared>0;const blink=scared&&g.scared<60&&Math.floor(S.frame/8)%2===0;
        ctx.fillStyle=blink?'#ffffff':scared?'#2244dd':g.color;
        ctx.beginPath();ctx.arc(gx,gy-gr*0.1,gr,Math.PI,0);
        ctx.lineTo(gx+gr,gy+gr*0.75);
        for(let i=4;i>=0;i--){const wx=gx-gr+(i/4)*2*gr;ctx.lineTo(wx,gy+gr*0.75+(i%2===0?-gr*0.28:gr*0.28));}
        ctx.lineTo(gx-gr,gy-gr*0.1);ctx.fill();
        if(!scared){
          ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(gx-gr*0.28,gy-gr*0.32,gr*0.19,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(gx+gr*0.28,gy-gr*0.32,gr*0.19,0,Math.PI*2);ctx.fill();
          ctx.fillStyle='#002';ctx.beginPath();ctx.arc(gx-gr*0.22+g.dir.c*gr*0.09,gy-gr*0.26+g.dir.r*gr*0.09,gr*0.1,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(gx+gr*0.28+g.dir.c*gr*0.09,gy-gr*0.26+g.dir.r*gr*0.09,gr*0.1,0,Math.PI*2);ctx.fill();
        }
      });
      // HUD
      ctx.fillStyle='#d4a017';
      for(let i=0;i<S.pac.lives;i++){ctx.beginPath();ctx.moveTo(i*(cs+3)+cs/2,cs/2);ctx.arc(i*(cs+3)+cs/2,cs/2,cs*0.38,0.3,Math.PI*2-0.3);ctx.closePath();ctx.fill();}
      ctx.fillStyle='rgba(212,160,23,0.9)';ctx.font='bold 13px monospace';ctx.textAlign='right';ctx.fillText(`${S.score}`,cv.width-4,cs-3);ctx.textAlign='left';
    }

    return{init,cleanup(){if(kh)document.removeEventListener('keydown',kh);}};
  })();

  /* ─────────────────── SPACE INVADERS ─────────────────────── */
  Impls.invaders = (() => {
    let cv,ctx,S,kh,ku,keys={};
    const AW=28,AH=18,AGX=12,AGY=10,ACOLS=9,AROWS=4;

    function shoot(){
      if(S.shootCd>0)return;
      if(S.bullets.filter(b=>b.ok).length>=2)return;
      S.bullets.push({x:S.px,y:cv.height-30,vy:-11,ok:true});S.shootCd=18;
    }

    function init(c){
      cv=c;ctx=c.getContext('2d');keys={};
      const sx=(c.width-ACOLS*(AW+AGX))/2;
      S={
        aliens:Array.from({length:AROWS*ACOLS},(_,i)=>({baseX:sx+(i%ACOLS)*(AW+AGX),baseY:48+Math.floor(i/ACOLS)*(AH+AGY),row:Math.floor(i/ACOLS),alive:true})),
        offX:0,dir:1,spd:0.5,
        px:c.width/2,pSpd:5,lives:3,
        bullets:[],bombs:[],
        shootCd:0,score:0,frame:0,stars:null,over:false,won:false
      };
      S.stars=Array.from({length:55},()=>({x:Math.random()*c.width,y:Math.random()*c.height,r:Math.random()*1.2+0.3}));
      kh=e=>{keys[e.key]=true;e.key===' '&&e.preventDefault();};
      ku=e=>{delete keys[e.key];};
      document.addEventListener('keydown',kh);document.addEventListener('keyup',ku);
      c.addEventListener('touchmove',e=>{e.preventDefault();const r=c.getBoundingClientRect();S.px=Math.max(22,Math.min(c.width-22,e.touches[0].clientX-r.left));},{passive:false});
      c.addEventListener('touchstart',e=>{const r=c.getBoundingClientRect();S.px=Math.max(22,Math.min(c.width-22,e.touches[0].clientX-r.left));shoot();},{passive:true});
      animFrame=requestAnimationFrame(loop);
    }

    function loop(){
      if(S.over)return;animFrame=requestAnimationFrame(loop);S.frame++;
      if(S.shootCd>0)S.shootCd--;
      if(keys['ArrowLeft']||keys['a'])S.px=Math.max(22,S.px-S.pSpd);
      if(keys['ArrowRight']||keys['d'])S.px=Math.min(cv.width-22,S.px+S.pSpd);
      if(keys[' '])shoot();
      S.bullets.forEach(b=>{b.y+=b.vy;if(b.y<0)b.ok=false;});S.bullets=S.bullets.filter(b=>b.ok);
      S.bombs.forEach(b=>{b.y+=b.vy;if(b.y>cv.height)b.ok=false;});S.bombs=S.bombs.filter(b=>b.ok);
      const alive=S.aliens.filter(a=>a.alive);
      if(!alive.length){S.over=true;S.won=true;draw();gameOver(S.score,true);return;}
      const nOff=S.offX+S.spd*S.dir;
      const lx=Math.min(...alive.map(a=>a.baseX))+nOff;
      const rx=Math.max(...alive.map(a=>a.baseX+AW))+nOff;
      if(lx<4||rx>cv.width-4){S.dir*=-1;alive.forEach(a=>a.baseY+=18);S.spd=Math.min(2.5,S.spd+0.06);}else{S.offX=nOff;}
      if(S.frame%55===0){
        const cols=[...new Set(alive.map(a=>a.baseX))];
        cols.forEach(bx=>{if(Math.random()<0.28){const bot=alive.filter(a=>a.baseX===bx).sort((a,b)=>b.row-a.row)[0];if(bot)S.bombs.push({x:bot.baseX+S.offX+AW/2,y:bot.baseY+AH,vy:3.5,ok:true});}});
      }
      S.bullets.forEach(b=>{alive.forEach(a=>{const ax=a.baseX+S.offX;if(b.ok&&b.x>=ax&&b.x<=ax+AW&&b.y>=a.baseY&&b.y<=a.baseY+AH){a.alive=false;b.ok=false;S.score+=(AROWS-a.row)*10+10;updateScore(S.score);}});});
      const py=cv.height-22;
      S.bombs.forEach(b=>{if(b.ok&&b.x>=S.px-22&&b.x<=S.px+22&&Math.abs(b.y-py)<18){b.ok=false;S.lives--;updateScore(`${S.score} ♥${S.lives}`);if(S.lives<=0){S.over=true;draw();gameOver(S.score);}}});
      if(alive.some(a=>a.baseY+AH>cv.height-50)){S.over=true;draw();gameOver(S.score);}
      draw();
    }

    function draw(){
      ctx.fillStyle='#020b10';ctx.fillRect(0,0,cv.width,cv.height);
      S.stars.forEach(s=>{ctx.fillStyle='rgba(255,255,255,0.4)';ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill();});
      const AC=['#ef5350','#ab47bc','#42a5f5','#00ffa8'];
      S.aliens.forEach(a=>{
        if(!a.alive)return;
        const ax=a.baseX+S.offX,ay=a.baseY,ac=AC[a.row];const leg=S.frame%22<11?0:3;
        ctx.fillStyle=ac;ctx.fillRect(ax+4,ay,AW-8,AH*0.65);ctx.fillRect(ax+1,ay+4,AW-2,AH*0.45);
        ctx.fillRect(ax+4,ay-4,6,5);ctx.fillRect(ax+AW-10,ay-4,6,5);
        ctx.fillStyle='#020b10';ctx.fillRect(ax+7,ay+3,4,4);ctx.fillRect(ax+AW-11,ay+3,4,4);
        ctx.fillStyle=ac;ctx.fillRect(ax+leg,ay+AH*0.6,5,5);ctx.fillRect(ax+AW/2-2,ay+AH*0.6,5,5);ctx.fillRect(ax+AW-5-leg,ay+AH*0.6,5,5);
      });
      const py=cv.height-22;
      const pg=ctx.createLinearGradient(S.px-22,0,S.px+22,0);pg.addColorStop(0,'#d4a017');pg.addColorStop(1,'#c25b12');
      ctx.fillStyle=pg;
      if(ctx.roundRect){ctx.beginPath();ctx.roundRect(S.px-22,py,44,13,4);ctx.fill();}else ctx.fillRect(S.px-22,py,44,13);
      ctx.fillStyle='#d4a017';ctx.fillRect(S.px-4,py-10,8,12);
      S.bullets.forEach(b=>{ctx.shadowColor='#00ffa8';ctx.shadowBlur=6;ctx.fillStyle='#00ffa8';ctx.fillRect(b.x-2,b.y-7,4,10);ctx.shadowBlur=0;});
      S.bombs.forEach(b=>{ctx.fillStyle=S.frame%4<2?'#ef5350':'#ff7043';ctx.fillRect(b.x-2,b.y-5,4,10);});
      ctx.fillStyle='rgba(212,160,23,0.9)';ctx.font='bold 13px monospace';
      ctx.fillText(`SCORE ${S.score}  ♥${S.lives}  ENEMIGOS:${S.aliens.filter(a=>a.alive).length}`,8,20);
    }

    return{init,cleanup(){if(kh)document.removeEventListener('keydown',kh);if(ku)document.removeEventListener('keyup',ku);}};
  })();

  /* ─────────────────── 2048 ───────────────────────────────── */
  Impls.g2048 = (() => {
    let S,cont,kh,txs=0,tys=0;
    const C={0:'#0b2530',2:'#d4a017',4:'#c78010',8:'#ef5350',16:'#ab47bc',32:'#42a5f5',64:'#00ffa8',128:'#66bb6a',256:'#ff7043',512:'#e040fb',1024:'#ffd740',2048:'#ffd700'};
    function addRandom(){const e=[];for(let r=0;r<4;r++)for(let c=0;c<4;c++)if(!S.grid[r][c])e.push({r,c});if(!e.length)return;const p=e[Math.floor(Math.random()*e.length)];S.grid[p.r][p.c]=Math.random()<0.9?2:4;}
    function slide(row,rev){let a=[...row];if(rev)a.reverse();a=a.filter(v=>v);for(let i=0;i<a.length-1;i++)if(a[i]===a[i+1]){a[i]*=2;S.score+=a[i];a.splice(i+1,1);}while(a.length<4)a.push(0);if(rev)a.reverse();return a;}
    function move(k){
      const prev=JSON.stringify(S.grid);
      let d;if(k==='ArrowLeft'||k==='a')d='l';else if(k==='ArrowRight'||k==='d')d='r';else if(k==='ArrowUp'||k==='w')d='u';else if(k==='ArrowDown'||k==='s')d='d';else return false;
      if(d==='l'||d==='r'){for(let r=0;r<4;r++)S.grid[r]=slide(S.grid[r],d==='r');}
      else{for(let c=0;c<4;c++){const col=[S.grid[0][c],S.grid[1][c],S.grid[2][c],S.grid[3][c]];const sl=slide(col,d==='d');for(let r=0;r<4;r++)S.grid[r][c]=sl[r];}}
      return JSON.stringify(S.grid)!==prev;
    }
    function canMove(){for(let r=0;r<4;r++)for(let c=0;c<4;c++){if(!S.grid[r][c])return true;if(r<3&&S.grid[r][c]===S.grid[r+1][c])return true;if(c<3&&S.grid[r][c]===S.grid[r][c+1])return true;}return false;}
    function doMove(k){
      if(S.over)return;const moved=move(k);
      if(moved){addRandom();render();}updateScore(S.score);
      if(S.grid.flat().some(v=>v===2048)&&!S.won){S.won=S.over=true;render();return;}
      if(!canMove()){S.over=true;render();}
    }
    function render(){
      cont.innerHTML=`
        <div style="display:flex;flex-direction:column;align-items:center;padding:14px 8px 28px;user-select:none">
          <div style="font-size:11px;color:#4a6a72;letter-spacing:2px;margin-bottom:6px">DESLIZA O USA FLECHAS · META: 2048</div>
          <div style="font-size:22px;font-weight:900;color:#d4a017;margin-bottom:10px">SCORE: ${S.score}</div>
          <div id="g48grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;background:#0b3b46;padding:8px;border-radius:14px;width:min(300px,85vw);touch-action:none">
            ${S.grid.flat().map(v=>`<div style="aspect-ratio:1;background:${C[v]||C[2048]};border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:${v>512?'16px':v>64?'20px':'24px'};font-weight:900;color:#020b10;box-shadow:${v===2048?'0 0 18px rgba(255,215,0,0.5)':'none'}">${v||''}</div>`).join('')}
          </div>
          ${S.over?`<div style="margin-top:16px;text-align:center">
            <div style="color:${S.won?'#00ffa8':'#ef5350'};font-size:16px;font-weight:800;letter-spacing:2px;margin-bottom:12px">${S.won?'🏆 ¡2048 LOGRADO!':'💥 SIN MOVIMIENTOS'}</div>
            <button onclick="GamesEngine.launch('g2048')" style="background:linear-gradient(135deg,#d4a017,#c25b12);border:none;border-radius:10px;color:#020b10;font-size:13px;font-weight:800;padding:10px 24px;cursor:pointer;margin-right:8px;letter-spacing:1px">↺ REINICIAR</button>
            <button onclick="GamesEngine.showSelection()" style="background:transparent;border:1px solid #0b3b46;border-radius:10px;color:#6b8a91;font-size:12px;font-weight:700;padding:9px 18px;cursor:pointer">◀ VOLVER</button>
          </div>`:''}
        </div>`;
      const g=cont.querySelector('#g48grid');
      if(g&&!S.over){
        g.addEventListener('touchstart',e=>{txs=e.touches[0].clientX;tys=e.touches[0].clientY;},{passive:true});
        g.addEventListener('touchend',e=>{
          const dx=e.changedTouches[0].clientX-txs,dy=e.changedTouches[0].clientY-tys;
          if(Math.abs(dx)<8&&Math.abs(dy)<8)return;
          doMove(Math.abs(dx)>Math.abs(dy)?(dx>0?'ArrowRight':'ArrowLeft'):(dy>0?'ArrowDown':'ArrowUp'));
        },{passive:true});
      }
    }
    return{
      init(c){cont=c;S={grid:Array.from({length:4},()=>[0,0,0,0]),score:0,over:false,won:false};addRandom();addRandom();render();kh=e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','s','a','d'].includes(e.key)){e.preventDefault();doMove(e.key);}};document.addEventListener('keydown',kh);},
      cleanup(){if(kh)document.removeEventListener('keydown',kh);}
    };
  })();

  /* ─────────────────── MINESWEEPER ────────────────────────── */
  Impls.mines = (() => {
    const MR=9,MC=9,MINES=10;
    let S,cont;
    const AC=['','#42a5f5','#00ffa8','#ef5350','#7986cb','#ff7043','#26c6da','#555','#9e9e9e'];
    function place(fr,fc){
      let p=0;while(p<MINES){const r=Math.floor(Math.random()*MR),c=Math.floor(Math.random()*MC);if(Math.abs(r-fr)<=1&&Math.abs(c-fc)<=1)continue;if(S.g[r][c].m)continue;S.g[r][c].m=true;p++;}
      for(let r=0;r<MR;r++)for(let c=0;c<MC;c++)if(!S.g[r][c].m){let a=0;for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++)if(r+dr>=0&&r+dr<MR&&c+dc>=0&&c+dc<MC&&S.g[r+dr][c+dc].m)a++;S.g[r][c].a=a;}
      S.ready=true;
    }
    function reveal(r,c){
      if(r<0||r>=MR||c<0||c>=MC)return;const cell=S.g[r][c];
      if(cell.v||cell.f)return;cell.v=true;S.rev++;
      if(cell.m){S.over=true;S.boom={r,c};S.g.forEach(row=>row.forEach(cl=>{if(cl.m)cl.v=true;}));render();return;}
      if(cell.a===0)for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++)reveal(r+dr,c+dc);
      if(S.rev===MR*MC-MINES){S.won=S.over=true;}
    }
    function flag(r,c){if(S.g[r][c].v)return;S.g[r][c].f=!S.g[r][c].f;S.flags+=S.g[r][c].f?1:-1;render();}
    function render(){
      const cs='clamp(28px,9vw,34px)';
      cont.innerHTML=`
        <div style="display:flex;flex-direction:column;align-items:center;padding:12px 6px 20px;width:100%">
          <div style="font-size:11px;color:#4a6a72;letter-spacing:2px;margin-bottom:4px">💣 ${MINES-S.flags} minas restantes · Reveladas: ${S.rev}</div>
          <div style="font-size:10px;color:#2a4a52;margin-bottom:10px">Clic: revelar · Clic derecho / mantén: 🚩 bandera</div>
          <div id="msGrid" style="display:grid;grid-template-columns:repeat(${MC},${cs});gap:2px;background:#0b3b46;padding:4px;border-radius:10px;touch-action:none">
            ${S.g.map((row,r)=>row.map((cell,c)=>{
              let bg='#0b2530',txt='',color='';
              if(cell.v){bg=cell.m?(S.boom&&S.boom.r===r&&S.boom.c===c?'#c62828':'#3a0000'):'#020f14';txt=cell.m?'💣':(cell.a?cell.a:'');color=AC[cell.a]||'';}
              else if(cell.f){txt='🚩';}
              return`<div class="ms" data-r="${r}" data-c="${c}" style="width:${cs};height:${cs};background:${bg};border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:${cell.m&&cell.v?'14px':'13px'};font-weight:700;color:${color};cursor:${S.over||cell.v?'default':'pointer'};user-select:none;-webkit-tap-highlight-color:transparent;border:1px solid ${cell.v?'#0a1a20':'#0f3040'}">${txt}</div>`;
            }).join('')).join('')}
          </div>
          ${S.over?`<div style="margin-top:14px;text-align:center">
            <div style="color:${S.won?'#00ffa8':'#ef5350'};font-size:15px;font-weight:800;letter-spacing:2px;margin-bottom:10px">${S.won?'🏆 ¡CAMPO DESPEJADO!':'💥 ¡MINA ACTIVADA!'}</div>
            <button onclick="GamesEngine.launch('mines')" style="background:linear-gradient(135deg,#d4a017,#c25b12);border:none;border-radius:10px;color:#020b10;font-size:13px;font-weight:800;padding:10px 22px;cursor:pointer;margin-right:6px">↺ REINICIAR</button>
            <button onclick="GamesEngine.showSelection()" style="background:transparent;border:1px solid #0b3b46;border-radius:10px;color:#6b8a91;font-size:12px;font-weight:700;padding:9px 16px;cursor:pointer">◀ VOLVER</button>
          </div>`:''}
        </div>`;
      if(S.over)return;
      let ht=null;
      cont.querySelectorAll('.ms').forEach(el=>{
        const r=+el.dataset.r,c=+el.dataset.c;
        el.addEventListener('click',()=>{if(S.g[r][c].f)return;if(!S.ready)place(r,c);reveal(r,c);render();});
        el.addEventListener('contextmenu',e=>{e.preventDefault();flag(r,c);});
        el.addEventListener('touchstart',e=>{ht=setTimeout(()=>{flag(r,c);ht=null;},500);},{passive:true});
        el.addEventListener('touchend',()=>{if(ht){clearTimeout(ht);ht=null;if(!S.g[r][c].f){if(!S.ready)place(r,c);reveal(r,c);render();}}});
        el.addEventListener('touchmove',()=>{if(ht){clearTimeout(ht);ht=null;}},{passive:true});
      });
    }
    return{
      init(c){cont=c;S={g:Array.from({length:MR},()=>Array.from({length:MC},()=>({m:false,v:false,f:false,a:0}))),ready:false,flags:0,rev:0,over:false,won:false,boom:null};render();},
      cleanup(){}
    };
  })();

  /* ─────────────────── MEMORY MATCH ─────────────────────────*/
  Impls.memory = (() => {
    const SYMS=['⚛️','🔬','🧬','🌌','⚡','🧲','💡','🔭'];
    let S,cont;
    function flip(i){
      if(S.locked||S.cards[i].up||S.cards[i].ok)return;
      S.cards[i].up=true;S.fl.push(i);render();
      if(S.fl.length===2){
        S.moves++;S.locked=true;
        const[a,b]=S.fl;
        if(S.cards[a].sym===S.cards[b].sym){
          S.cards[a].ok=S.cards[b].ok=true;S.pairs++;S.fl=[];S.locked=false;
          updateScore(`${S.moves} movs · ${S.pairs}/8`);render();
          if(S.pairs===8){S.over=true;render();}
        } else {setTimeout(()=>{S.cards[a].up=S.cards[b].up=false;S.fl=[];S.locked=false;render();},900);}
      }
    }
    function render(){
      cont.innerHTML=`
        <div style="display:flex;flex-direction:column;align-items:center;padding:14px 6px 24px;width:100%;user-select:none">
          <div style="font-size:11px;color:#4a6a72;letter-spacing:2px;margin-bottom:6px">TOCA PARA VOLTEAR · ENCUENTRA LOS PARES</div>
          <div style="font-size:18px;font-weight:800;color:#d4a017;margin-bottom:12px">PARES: ${S.pairs}/8  |  MOVS: ${S.moves}</div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;width:min(300px,84vw)">
            ${S.cards.map((card,i)=>`
              <div data-i="${i}" style="
                aspect-ratio:1;
                background:${card.ok?'rgba(0,255,168,0.07)':card.up?'#142638':'#0a1e28'};
                border:2px solid ${card.ok?'rgba(0,255,168,0.45)':card.up?'#d4a017':'#0b3b46'};
                border-radius:14px;display:flex;align-items:center;justify-content:center;
                font-size:clamp(20px,6vw,30px);cursor:${card.ok?'default':'pointer'};
                transition:transform 0.12s;-webkit-tap-highlight-color:transparent;
                ${card.up&&!card.ok?'transform:scale(1.07);':''}
                ${card.ok?'box-shadow:0 0 12px rgba(0,255,168,0.18);':''}
              ">${card.up||card.ok?card.sym:'<span style="color:#0b3b46;font-size:20px">◈</span>'}</div>`).join('')}
          </div>
          ${S.over?`<div style="margin-top:16px;text-align:center">
            <div style="color:#00ffa8;font-size:16px;font-weight:800;letter-spacing:2px;margin-bottom:4px">🏆 ¡COMPLETADO!</div>
            <div style="color:#4a6a72;font-size:12px;margin-bottom:12px">${S.moves} movimientos · Puntaje: ${Math.max(10,100-S.moves*2)}</div>
            <button onclick="GamesEngine.launch('memory')" style="background:linear-gradient(135deg,#d4a017,#c25b12);border:none;border-radius:10px;color:#020b10;font-size:13px;font-weight:800;padding:10px 22px;cursor:pointer;margin-right:6px">↺ REINICIAR</button>
            <button onclick="GamesEngine.showSelection()" style="background:transparent;border:1px solid #0b3b46;border-radius:10px;color:#6b8a91;font-size:12px;font-weight:700;padding:9px 16px;cursor:pointer">◀ VOLVER</button>
          </div>`:''}
        </div>`;
      if(!S.over)cont.querySelectorAll('[data-i]').forEach(el=>el.addEventListener('click',()=>flip(+el.dataset.i)));
    }
    return{
      init(c){
        cont=c;
        const cards=[...SYMS,...SYMS].map((s,i)=>({id:i,sym:s,up:false,ok:false}));
        for(let i=cards.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[cards[i],cards[j]]=[cards[j],cards[i]];}
        S={cards,fl:[],pairs:0,moves:0,locked:false,over:false};render();
      },
      cleanup(){}
    };
  })();

  /* ── API pública ──────────────────────────────────────────── */
  return { init, launch, showSelection };

})();

/* Auto-inicializar */
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',()=>GamesEngine.init());
}else{
  GamesEngine.init();
}