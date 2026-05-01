/* ═══════════════════════════════════════════════════════════
   GAMES ENGINE — Lab Física UNAL  v2.1
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
    { id:'sudoku',   emoji:'🔢', name:'SUDOKU 9×9',     desc:'Despeja la mente con lógica',   hint:'Toca celda y elige número' },
    { id:'pacman',   emoji:'👻', name:'PAC-MAN',        desc:'Come puntos, huye fantasmas',   hint:'Flechas / WASD · Desliza en móvil' },
    { id:'invaders', emoji:'👾', name:'SPACE INVADERS', desc:'Destruye la flota alienígena',  hint:'Desliza · Toca para disparar' },
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
      <div class="game-dpad always" id="gameDpad" style="flex-direction:row;justify-content:center;gap:12px;margin-top:8px">
        <div class="game-dpad-row" style="gap:8px">
          <button class="dpad-btn" data-dir="left" style="width:72px;height:52px;font-size:22px">←</button>
          <button class="dpad-btn dpad-shoot" data-dir="shoot" style="width:96px;height:52px;font-size:14px;letter-spacing:1px">🚀 FIRE</button>
          <button class="dpad-btn" data-dir="right" style="width:72px;height:52px;font-size:22px">→</button>
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

  /* ─────────────────── SNAKE (con inicio y victoria) ──────── */
  Impls.snake = (() => {
    let cv,ctx,S,kh,iv;
    const SZ=20;
    const WIN_LEN=20; // ¡llega a largo 20 para ganar!

    function spawnFood(){
      let p;
      do{p={x:Math.floor(Math.random()*S.cols),y:Math.floor(Math.random()*S.rows)};}
      while(S.snake.some(s=>s.x===p.x&&s.y===p.y));
      S.food=p;
    }

    function tick(){
      if(S.over)return;
      if(!S.started){draw();return;}
      S.dir=S.nd;
      const h={x:(S.snake[0].x+S.dir.x+S.cols)%S.cols,y:(S.snake[0].y+S.dir.y+S.rows)%S.rows};
      if(S.snake.some(s=>s.x===h.x&&s.y===h.y)){
        S.over=true;S.won=false;draw();
        showGameMsg('💀 GAME OVER',`Puntuación: ${S.score} · Largo: ${S.snake.length}`);
        return;
      }
      S.snake.unshift(h);
      if(h.x===S.food.x&&h.y===S.food.y){
        S.score+=10;updateScore(`${S.score}  LARGO ${S.snake.length}`);spawnFood();
        if(S.score%60===0&&S.interval>70){clearInterval(iv);S.interval-=10;iv=setInterval(tick,S.interval);}
        if(S.snake.length>=WIN_LEN){S.over=true;S.won=true;draw();showGameMsg('🏆 ¡VICTORIA!',`Puntuación: ${S.score} · ¡Largo ${WIN_LEN} alcanzado!`);return;}
      } else {
        S.snake.pop();
      }
      draw();
    }

    function draw(){
      ctx.fillStyle='#020b10';ctx.fillRect(0,0,cv.width,cv.height);

      if(!S.started){
        // Pantalla de inicio
        ctx.fillStyle='rgba(2,11,16,0.92)';ctx.fillRect(0,0,cv.width,cv.height);
        ctx.textAlign='center';
        ctx.fillStyle='#00ffa8';ctx.font=`bold ${Math.max(28,cv.width/12)}px monospace`;
        ctx.fillText('🐍 SNAKE',cv.width/2,cv.height/2-60);
        ctx.fillStyle='rgba(212,160,23,0.85)';ctx.font=`bold ${Math.max(11,cv.width/34)}px monospace`;
        ctx.fillText('Come 🔴 para crecer',cv.width/2,cv.height/2-22);
        ctx.fillText(`¡Meta: largo ${WIN_LEN}!`,cv.width/2,cv.height/2+4);
        ctx.fillStyle='rgba(0,255,168,0.7)';ctx.font=`bold ${Math.max(12,cv.width/30)}px monospace`;
        ctx.fillText('▶  TOCA O PRESIONA TECLA',cv.width/2,cv.height/2+46);
        ctx.fillStyle='rgba(74,106,114,0.6)';ctx.font=`${Math.max(10,cv.width/38)}px monospace`;
        ctx.fillText('Flechas / WASD · Desliza en móvil',cv.width/2,cv.height/2+74);
        ctx.textAlign='left';
        return;
      }

      // Cuadrícula
      ctx.strokeStyle='rgba(11,59,70,0.28)';ctx.lineWidth=0.5;
      for(let x=0;x<cv.width;x+=SZ){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,cv.height);ctx.stroke();}
      for(let y=0;y<cv.height;y+=SZ){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(cv.width,y);ctx.stroke();}

      // Comida
      const pulse=0.7+Math.sin(Date.now()*0.008)*0.3;
      ctx.shadowColor='#ef5350';ctx.shadowBlur=8*pulse;
      ctx.fillStyle='#ef5350';
      ctx.beginPath();ctx.arc(S.food.x*SZ+SZ/2,S.food.y*SZ+SZ/2,SZ*0.38,0,Math.PI*2);ctx.fill();
      ctx.shadowBlur=0;

      // Serpiente
      S.snake.forEach((s,i)=>{
        const t=i/Math.max(1,S.snake.length-1);
        ctx.fillStyle=`hsl(${155-t*30},85%,${52-t*18}%)`;
        if(ctx.roundRect){ctx.beginPath();ctx.roundRect(s.x*SZ+1,s.y*SZ+1,SZ-2,SZ-2,4);ctx.fill();}
        else ctx.fillRect(s.x*SZ+1,s.y*SZ+1,SZ-2,SZ-2);
        if(i===0){
          ctx.fillStyle='#020b10';
          const ew=S.dir.y!==0?SZ/2-2:SZ*0.65,eh=S.dir.x!==0?SZ/2-2:SZ*0.65;
          ctx.fillRect(s.x*SZ+(SZ-ew)/2-S.dir.x*2,s.y*SZ+SZ*0.2-S.dir.y*2,3,3);
          ctx.fillRect(s.x*SZ+(SZ-ew)/2-S.dir.x*2+ew*0.5,s.y*SZ+SZ*0.2-S.dir.y*2,3,3);
        }
      });

      // HUD
      ctx.fillStyle='rgba(212,160,23,0.9)';ctx.font='bold 13px monospace';
      ctx.fillText(`SCORE ${S.score}  LARGO ${S.snake.length}/${WIN_LEN}`,8,16);

      // Barra de progreso
      const prog=Math.min(1,S.snake.length/WIN_LEN);
      ctx.fillStyle='rgba(11,59,70,0.6)';ctx.fillRect(8,cv.height-10,cv.width-16,6);
      const pg=ctx.createLinearGradient(8,0,8+prog*(cv.width-16),0);
      pg.addColorStop(0,'#00ffa8');pg.addColorStop(1,'#d4a017');
      ctx.fillStyle=pg;ctx.fillRect(8,cv.height-10,prog*(cv.width-16),6);
    }

    return{
      init(c){
        cv=c;ctx=c.getContext('2d');
        const cols=Math.floor(c.width/SZ),rows=Math.floor(c.height/SZ);
        const cx=Math.floor(cols/2),cy=Math.floor(rows/2);
        S={snake:[{x:cx,y:cy},{x:cx-1,y:cy},{x:cx-2,y:cy}],dir:{x:1,y:0},nd:{x:1,y:0},food:null,score:0,cols,rows,interval:115,over:false,won:false,started:false};
        spawnFood();
        updateScore(`0  LARGO 3/${WIN_LEN}`);

        kh=e=>{
          const m={ArrowUp:{x:0,y:-1},ArrowDown:{x:0,y:1},ArrowLeft:{x:-1,y:0},ArrowRight:{x:1,y:0},w:{x:0,y:-1},s:{x:0,y:1},a:{x:-1,y:0},d:{x:1,y:0}};
          const nd=m[e.key];
          if(nd){
            if(!S.started)S.started=true;
            if(!(nd.x===-S.dir.x&&nd.y===-S.dir.y)){S.nd=nd;e.preventDefault();}
          }
        };
        document.addEventListener('keydown',kh);

        let tx=0,ty=0;
        c.addEventListener('touchstart',e=>{
          tx=e.touches[0].clientX;ty=e.touches[0].clientY;
          if(!S.started){S.started=true;}
        },{passive:true});
        c.addEventListener('touchend',e=>{
          const dx=e.changedTouches[0].clientX-tx,dy=e.changedTouches[0].clientY-ty;
          if(Math.abs(dx)<10&&Math.abs(dy)<10)return;
          let nd;
          if(Math.abs(dx)>Math.abs(dy))nd=dx>0?{x:1,y:0}:{x:-1,y:0};
          else nd=dy>0?{x:0,y:1}:{x:0,y:-1};
          if(!(nd.x===-S.dir.x&&nd.y===-S.dir.y))S.nd=nd;
        },{passive:true});

        iv=setInterval(tick,S.interval);
        draw(); // mostrar pantalla de inicio
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


  /* ─────────────────── ASTEROIDS — 3 Niveles ──────────────── */
  Impls.asteroids = (() => {
    let cv,ctx,S,kh,ku,keys={};
    const rnd=(a,b)=>a+Math.random()*(b-a);

    /* Configuración de cada nivel */
    const LEVELS=[
      {
        label:'NIVEL 1', badge:'⭐',
        count:5,           // asteroides iniciales
        spdMin:0.5, spdMax:1.4,   // velocidad asteroides
        radMin:26,  radMax:42,    // tamaño
        splitR:0.55,              // radio al partir
        splitN:2,                 // fragmentos al explotar
        bulletSpd:9, bulletLife:55, cooldown:14,
        thrustAcc:0.22, drag:0.985,
        pts:{ big:10, small:20 },
        color:'#3a7a88',          // color borde asteroide
        shipColor:'#d4a017',
        waveBonus:500,            // bonus al limpiar oleada
      },
      {
        label:'NIVEL 2', badge:'⭐⭐',
        count:7,
        spdMin:0.9, spdMax:2.2,
        radMin:24,  radMax:40,
        splitR:0.55,
        splitN:3,                 // 3 fragmentos al explotar
        bulletSpd:10, bulletLife:52, cooldown:13,
        thrustAcc:0.26, drag:0.983,
        pts:{ big:15, small:30 },
        color:'#5a9aaa',
        shipColor:'#d4a017',
        waveBonus:800,
      },
      {
        label:'NIVEL 3', badge:'⭐⭐⭐',
        count:9,
        spdMin:1.4, spdMax:3.2,
        radMin:22,  radMax:38,
        splitR:0.52,
        splitN:3,
        bulletSpd:11, bulletLife:50, cooldown:11,
        thrustAcc:0.30, drag:0.981,
        pts:{ big:20, small:45 },
        color:'#ef5350',          // asteroide rojo — peligroso
        shipColor:'#00ffa8',      // nave verde en nivel 3
        waveBonus:1200,
      },
    ];

    function mkAsteroid(cx,cy,r,cfg){
      let x,y;
      const safe=r?80:140;
      do{x=Math.random()*cv.width;y=Math.random()*cv.height;}
      while(Math.hypot(x-cx,y-cy)<safe);
      const angle=Math.random()*Math.PI*2;
      const spd=rnd(cfg.spdMin,cfg.spdMax);
      const radius=r||rnd(cfg.radMin,cfg.radMax);
      const npts=7+Math.floor(Math.random()*4);
      const pts=Array.from({length:npts},(_,i)=>{
        const a=i/npts*Math.PI*2;
        return{x:Math.cos(a)*(radius+rnd(-radius*0.18,radius*0.18)),
               y:Math.sin(a)*(radius+rnd(-radius*0.18,radius*0.18))};
      });
      return{x,y,vx:Math.cos(angle)*spd,vy:Math.sin(angle)*spd,
             radius,pts,rot:0,rotSpeed:rnd(-0.025,0.025)};
    }

    function buildWave(lvlIdx, prevScore, prevLives){
      const cfg=LEVELS[lvlIdx];
      const cx=cv.width/2, cy=cv.height/2;
      return{
        lvl:lvlIdx, cfg,
        ship:{x:cx,y:cy,vx:0,vy:0,angle:-Math.PI/2,cooldown:0,invincible:120},
        asteroids:Array.from({length:cfg.count},()=>mkAsteroid(cx,cy,null,cfg)),
        bullets:[],
        score:prevScore||0,
        lives:prevLives!==undefined?prevLives:3,
        over:false, levelCleared:false, levelTimer:0,
        frame:0,
        stars:Array.from({length:80},()=>({
          x:Math.random()*cv.width,
          y:Math.random()*cv.height,
          r:Math.random()*1.4+0.3,
          b:Math.random()
        })),
        particles:[],
      };
    }

    function spawnParticles(x,y,color,n){
      for(let i=0;i<n;i++){
        const angle=Math.random()*Math.PI*2;
        const spd=rnd(1,4);
        S.particles.push({x,y,vx:Math.cos(angle)*spd,vy:Math.sin(angle)*spd,
                          life:35+Math.random()*20,maxLife:55,color});
      }
    }

    function init(c){
      cv=c; ctx=c.getContext('2d'); keys={};
      S=buildWave(0,0,3);
      kh=e=>{keys[e.key]=true; e.key===' '&&e.preventDefault();};
      ku=e=>{delete keys[e.key];};
      document.addEventListener('keydown',kh);
      document.addEventListener('keyup',ku);
      animFrame=requestAnimationFrame(loop);
    }

    function loop(){
      if(!S||S.over)return;
      animFrame=requestAnimationFrame(loop);
      S.frame++;

      /* Transición de nivel */
      if(S.levelCleared){
        S.levelTimer--;
        draw();
        if(S.levelTimer<=0){
          const next=S.lvl+1;
          if(next>=LEVELS.length){
            S.over=true; draw(); gameOver(S.score,true);
          } else {
            S=buildWave(next,S.score,S.lives);
          }
        }
        return;
      }

      update();
      draw();
    }

    function update(){
      const s=S.ship, cfg=S.cfg;
      if(s.invincible>0)s.invincible--;

      /* Controles nave */
      if(keys['ArrowLeft'] ||keys['a'])s.angle-=0.058;
      if(keys['ArrowRight']||keys['d'])s.angle+=0.058;
      if(keys['ArrowUp']   ||keys['w']){
        s.vx+=Math.cos(s.angle)*cfg.thrustAcc;
        s.vy+=Math.sin(s.angle)*cfg.thrustAcc;
      }
      s.vx*=cfg.drag; s.vy*=cfg.drag;
      s.x=(s.x+s.vx+cv.width )%cv.width;
      s.y=(s.y+s.vy+cv.height)%cv.height;

      /* Disparo */
      if((keys[' ']||keys['x'])&&s.cooldown<=0){
        S.bullets.push({
          x:s.x+Math.cos(s.angle)*19,
          y:s.y+Math.sin(s.angle)*19,
          vx:Math.cos(s.angle)*cfg.bulletSpd,
          vy:Math.sin(s.angle)*cfg.bulletSpd,
          life:cfg.bulletLife
        });
        s.cooldown=cfg.cooldown;
      }
      if(s.cooldown>0)s.cooldown--;

      /* Mover balas (wrap) */
      S.bullets.forEach(b=>{
        b.x=(b.x+b.vx+cv.width )%cv.width;
        b.y=(b.y+b.vy+cv.height)%cv.height;
        b.life--;
      });
      S.bullets=S.bullets.filter(b=>b.life>0);

      /* Mover asteroides (wrap) */
      S.asteroids.forEach(a=>{
        a.x=(a.x+a.vx+cv.width )%cv.width;
        a.y=(a.y+a.vy+cv.height)%cv.height;
        a.rot+=a.rotSpeed;
      });

      /* Colisiones bala - asteroide */
      for(let bi=S.bullets.length-1;bi>=0;bi--){
        for(let ai=S.asteroids.length-1;ai>=0;ai--){
          const b=S.bullets[bi],a=S.asteroids[ai];
          if(!b||!a)continue;
          if(Math.hypot(b.x-a.x,b.y-a.y)<a.radius){
            const pts=a.radius>28?cfg.pts.big:cfg.pts.small;
            S.score+=pts*(S.lvl+1);
            spawnParticles(a.x,a.y,cfg.color,8);
            S.bullets.splice(bi,1);
            /* Partir asteroide */
            if(a.radius>18){
              for(let k=0;k<cfg.splitN;k++)
                S.asteroids.push(mkAsteroid(a.x,a.y,a.radius*cfg.splitR,cfg));
            }
            S.asteroids.splice(ai,1);
            updateScore('NVL '+(S.lvl+1)+' · '+S.score+' ♥'+S.lives);
            break;
          }
        }
      }

      /* Partículas */
      S.particles.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vx*=0.93;p.vy*=0.93;p.life--;});
      S.particles=S.particles.filter(p=>p.life>0);

      /* Colisión nave - asteroide */
      if(s.invincible<=0){
        for(const a of S.asteroids){
          if(Math.hypot(s.x-a.x,s.y-a.y)<a.radius+11){
            S.lives--;
            spawnParticles(s.x,s.y,'#d4a017',14);
            updateScore('NVL '+(S.lvl+1)+' · '+S.score+' ♥'+S.lives);
            if(S.lives<=0){S.over=true;draw();gameOver(S.score);return;}
            /* Renacer en el centro con escudo temporal */
            s.x=cv.width/2; s.y=cv.height/2; s.vx=0; s.vy=0;
            s.invincible=150;
            break;
          }
        }
      }

      /* Oleada limpiada → siguiente nivel */
      if(S.asteroids.length===0&&!S.levelCleared){
        S.score+=S.cfg.waveBonus;
        S.levelCleared=true;
        S.levelTimer=150; // ~2.5 s
        updateScore('NVL '+(S.lvl+1)+' · '+S.score+' ♥'+S.lives);
      }
    }

    function draw(){
      if(!S)return;
      const W=cv.width,H=cv.height;
      ctx.fillStyle='#020b10'; ctx.fillRect(0,0,W,H);

      /* Estrellas con brillo variable */
      S.stars.forEach(st=>{
        const alpha=0.2+st.b*0.6;
        ctx.fillStyle=`rgba(255,255,255,${alpha})`;
        ctx.beginPath(); ctx.arc(st.x,st.y,st.r,0,Math.PI*2); ctx.fill();
      });

      /* Partículas de explosión */
      S.particles.forEach(p=>{
        const alpha=p.life/p.maxLife;
        ctx.fillStyle=p.color+(Math.floor(alpha*255).toString(16).padStart(2,'0'));
        ctx.beginPath(); ctx.arc(p.x,p.y,2,0,Math.PI*2); ctx.fill();
      });

      /* Asteroides */
      S.asteroids.forEach(a=>{
        ctx.save(); ctx.translate(a.x,a.y); ctx.rotate(a.rot);
        ctx.strokeStyle=S.cfg.color; ctx.lineWidth=1.8;
        ctx.beginPath();
        a.pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));
        ctx.closePath(); ctx.stroke();
        /* Relleno semitransparente */
        ctx.fillStyle='rgba(11,59,70,0.25)'; ctx.fill();
        ctx.restore();
      });

      /* Balas */
      ctx.fillStyle='#00ffa8';
      ctx.shadowColor='#00ffa8'; ctx.shadowBlur=6;
      S.bullets.forEach(b=>{ctx.beginPath();ctx.arc(b.x,b.y,3,0,Math.PI*2);ctx.fill();});
      ctx.shadowBlur=0;

      /* Nave */
      const s=S.ship;
      const blink=s.invincible>0&&Math.floor(S.frame/5)%2===0;
      if(!blink){
        ctx.save(); ctx.translate(s.x,s.y); ctx.rotate(s.angle);
        ctx.strokeStyle=S.cfg.shipColor; ctx.lineWidth=2;
        ctx.beginPath(); ctx.moveTo(17,0); ctx.lineTo(-11,-8); ctx.lineTo(-6,0); ctx.lineTo(-11,8); ctx.closePath(); ctx.stroke();
        /* Llama del propulsor */
        if(keys['ArrowUp']||keys['w']){
          ctx.strokeStyle='#ef5350'; ctx.lineWidth=2;
          ctx.beginPath(); ctx.moveTo(-6,0); ctx.lineTo(-18+rnd(-3,3),0); ctx.stroke();
          ctx.strokeStyle='#ffd740'; ctx.lineWidth=1;
          ctx.beginPath(); ctx.moveTo(-6,-2); ctx.lineTo(-14+rnd(-2,2),-2); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(-6, 2); ctx.lineTo(-14+rnd(-2,2), 2); ctx.stroke();
        }
        ctx.restore();
      }

      /* HUD */
      ctx.fillStyle='rgba(212,160,23,0.9)'; ctx.font='bold 13px monospace';
      ctx.fillText('NVL '+(S.lvl+1)+' · SCORE '+S.score+'  ♥ '+S.lives+'  ☄ '+S.asteroids.length,8,20);
      ctx.textAlign='right';
      ctx.fillStyle='rgba(212,160,23,0.5)'; ctx.font='bold 11px monospace';
      ctx.fillText(S.cfg.label+' '+S.cfg.badge,W-6,20);
      ctx.textAlign='left';

      /* Escudo activo */
      if(s.invincible>0&&!blink){
        ctx.strokeStyle='rgba(0,255,168,0.35)'; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.arc(s.x,s.y,18,0,Math.PI*2); ctx.stroke();
      }

      /* Pantalla de nivel completado */
      if(S.levelCleared){
        ctx.fillStyle='rgba(2,11,16,0.82)'; ctx.fillRect(0,0,W,H);
        ctx.textAlign='center';
        const next=S.lvl+1;
        if(next<LEVELS.length){
          ctx.fillStyle='#00ffa8'; ctx.font=`bold ${Math.max(18,W/17)}px monospace`;
          ctx.fillText('✅ NIVEL '+(S.lvl+1)+' COMPLETADO',W/2,H/2-32);
          ctx.fillStyle='rgba(212,160,23,0.9)'; ctx.font=`bold ${Math.max(13,W/24)}px monospace`;
          ctx.fillText('SCORE: '+S.score+'  +'+(S.cfg.waveBonus)+' BONUS',W/2,H/2+2);
          ctx.fillStyle='rgba(0,255,168,0.55)'; ctx.font=`${Math.max(11,W/34)}px monospace`;
          ctx.fillText('Preparando '+LEVELS[next].label+' '+LEVELS[next].badge+'...',W/2,H/2+30);
        } else {
          ctx.fillStyle='#ffd700'; ctx.font=`bold ${Math.max(20,W/14)}px monospace`;
          ctx.fillText('🏆 ¡MAESTRO!',W/2,H/2-30);
          ctx.fillStyle='rgba(212,160,23,0.9)'; ctx.font=`bold ${Math.max(13,W/22)}px monospace`;
          ctx.fillText('SCORE FINAL: '+S.score,W/2,H/2+6);
          ctx.fillStyle='rgba(0,255,168,0.5)'; ctx.font=`${Math.max(10,W/34)}px monospace`;
          ctx.fillText('¡Destruiste todos los asteroides!',W/2,H/2+30);
        }
        ctx.textAlign='left';
      }
    }

    return{
      init,
      cleanup(){
        if(kh){document.removeEventListener('keydown',kh);document.removeEventListener('keyup',ku);}
        S=null;
      }
    };
  })();

  /* ─────────────────── PONG (mejorado) ────────────────────── */
  Impls.pong = (() => {
    let cv,ctx,S,kh,ku,keys={},mh,th,iv;
    function reset(){S.ball.x=cv.width/2;S.ball.y=cv.height/2;S.ball.vx=(Math.random()>0.5?1:-1)*3.5;S.ball.vy=(Math.random()*2-1)*2.5;}
    function tick(){
      if(S.over)return;
      const b=S.ball,p1=S.p1,p2=S.p2;
      if(keys['ArrowUp']  ||keys['w']) p1.y=Math.max(0,p1.y-7);
      if(keys['ArrowDown']||keys['s']) p1.y=Math.min(cv.height-p1.h,p1.y+7);
      b.x+=b.vx;b.y+=b.vy;
      if(b.y-b.r<0){b.y=b.r;b.vy*=-1;}if(b.y+b.r>cv.height){b.y=cv.height-b.r;b.vy*=-1;}
      const ac=p2.y+p2.h/2;
      if(ac<b.y-6)p2.y=Math.min(cv.height-p2.h,p2.y+2.8);
      if(ac>b.y+6)p2.y=Math.max(0,p2.y-2.8);
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
      const pg=ctx.createLinearGradient(S.p1.x,0,S.p1.x+S.p1.w,0);pg.addColorStop(0,'#d4a017');pg.addColorStop(1,'#c25b12');ctx.fillStyle=pg;
      if(ctx.roundRect){ctx.beginPath();ctx.roundRect(S.p1.x,S.p1.y,S.p1.w,S.p1.h,6);ctx.fill();}else ctx.fillRect(S.p1.x,S.p1.y,S.p1.w,S.p1.h);
      ctx.fillStyle='#4a8a99';
      if(ctx.roundRect){ctx.beginPath();ctx.roundRect(S.p2.x,S.p2.y,S.p2.w,S.p2.h,6);ctx.fill();}else ctx.fillRect(S.p2.x,S.p2.y,S.p2.w,S.p2.h);
      const bg=ctx.createRadialGradient(S.ball.x-2,S.ball.y-2,1,S.ball.x,S.ball.y,S.ball.r);bg.addColorStop(0,'#fff');bg.addColorStop(1,'#00ffa8');ctx.fillStyle=bg;ctx.beginPath();ctx.arc(S.ball.x,S.ball.y,S.ball.r,0,Math.PI*2);ctx.fill();
    }
    return{
      init(c){
        cv=c;ctx=c.getContext('2d');keys={};
        S={ball:{x:c.width/2,y:c.height/2,vx:3.5,vy:2,r:8},p1:{x:12,y:c.height/2-50,w:13,h:100,score:0},p2:{x:c.width-25,y:c.height/2-50,w:13,h:100,score:0},over:false};
        kh=e=>{keys[e.key]=true;};ku=e=>{delete keys[e.key];};
        document.addEventListener('keydown',kh);document.addEventListener('keyup',ku);
        mh=e=>{const r=c.getBoundingClientRect();S.p1.y=Math.max(0,Math.min(c.height-S.p1.h,e.clientY-r.top-S.p1.h/2));};
        c.addEventListener('mousemove',mh);
        th=e=>{e.preventDefault();const r=c.getBoundingClientRect();S.p1.y=Math.max(0,Math.min(c.height-S.p1.h,e.touches[0].clientY-r.top-S.p1.h/2));};
        c.addEventListener('touchmove',th,{passive:false});
        iv=setInterval(tick,16);
      },
      cleanup(){if(kh)document.removeEventListener('keydown',kh);if(ku)document.removeEventListener('keyup',ku);if(iv){clearInterval(iv);iv=null;}if(cv){cv.removeEventListener('mousemove',mh);cv.removeEventListener('touchmove',th);}}
    };
  })();

  /* ─────────────────── SUDOKU 9×9 ─────────────────────────── */
  Impls.sudoku = (() => {
    // Tres puzzles 9×9 verificados (0 = vacío)
    const PUZZLES=[
      {
        b:[
          [5,3,0,0,7,0,0,0,0],
          [6,0,0,1,9,5,0,0,0],
          [0,9,8,0,0,0,0,6,0],
          [8,0,0,0,6,0,0,0,3],
          [4,0,0,8,0,3,0,0,1],
          [7,0,0,0,2,0,0,0,6],
          [0,6,0,0,0,0,2,8,0],
          [0,0,0,4,1,9,0,0,5],
          [0,0,0,0,8,0,0,7,9],
        ],
        s:[
          [5,3,4,6,7,8,9,1,2],
          [6,7,2,1,9,5,3,4,8],
          [1,9,8,3,4,2,5,6,7],
          [8,5,9,7,6,1,4,2,3],
          [4,2,6,8,5,3,7,9,1],
          [7,1,3,9,2,4,8,5,6],
          [9,6,1,5,3,7,2,8,4],
          [2,8,7,4,1,9,6,3,5],
          [3,4,5,2,8,6,1,7,9],
        ]
      },
      {
        b:[
          [0,0,0,2,6,0,7,0,1],
          [6,8,0,0,7,0,0,9,0],
          [1,9,0,0,0,4,5,0,0],
          [8,2,0,1,0,0,0,4,0],
          [0,0,4,6,0,2,9,0,0],
          [0,5,0,0,0,3,0,2,8],
          [0,0,9,3,0,0,0,7,4],
          [0,4,0,0,5,0,0,3,6],
          [7,0,3,0,1,8,0,0,0],
        ],
        s:[
          [4,3,5,2,6,9,7,8,1],
          [6,8,2,5,7,1,4,9,3],
          [1,9,7,8,3,4,5,6,2],
          [8,2,6,1,9,5,3,4,7],
          [3,7,4,6,8,2,9,1,5],
          [9,5,1,7,4,3,6,2,8],
          [5,1,9,3,2,6,8,7,4],
          [2,4,8,9,5,7,1,3,6],
          [7,6,3,4,1,8,2,5,9],
        ]
      },
      {
        b:[
          [0,2,0,6,0,8,0,0,0],
          [5,8,0,0,0,9,7,0,0],
          [0,0,0,0,4,0,0,0,0],
          [3,7,0,0,0,0,5,0,0],
          [6,0,0,0,0,0,0,0,4],
          [0,0,8,0,0,0,0,1,3],
          [0,0,0,0,2,0,0,0,0],
          [0,0,9,8,0,0,0,3,6],
          [0,0,0,3,0,6,0,9,0],
        ],
        s:[
          [1,2,3,6,7,8,9,4,5],
          [5,8,4,2,3,9,7,6,1],
          [9,6,7,1,4,5,3,2,8],
          [3,7,2,4,6,1,5,8,9],
          [6,9,1,5,8,3,2,7,4],
          [4,5,8,7,9,2,6,1,3],
          [8,3,6,9,2,4,1,5,7],
          [2,1,9,8,5,7,4,3,6],
          [7,4,5,3,1,6,8,9,2],
        ]
      },
    ];

    let pz, selected=null, cont;

    function init(container){
      cont=container;
      const p=PUZZLES[Math.floor(Math.random()*PUZZLES.length)];
      pz={board:p.b.map(r=>[...r]),sol:p.s,given:p.b.map(r=>r.map(v=>v!==0)),solved:false};
      selected=null;
      render();
    }

    function render(){
      const sz='clamp(30px,9.8vw,40px)';
      cont.innerHTML=`
        <div style="display:flex;flex-direction:column;align-items:center;padding:10px 4px 20px;width:100%;user-select:none">
          <div style="font-size:10px;color:#4a6a72;letter-spacing:1.5px;margin-bottom:4px;text-align:center">TOCA CELDA → ELIGE NÚMERO · CADA FILA, COL Y 3×3</div>
          <div id="sudokuStatus" style="font-size:12px;color:#d4a017;margin-bottom:8px;min-height:18px;text-align:center">&nbsp;</div>
          <div style="display:grid;grid-template-columns:repeat(9,${sz});grid-template-rows:repeat(9,${sz});gap:0;border:2px solid #d4a017;border-radius:6px;overflow:hidden;background:#0b3b46">
            ${pz.board.map((row,r)=>row.map((v,c)=>{
              const ig=pz.given[r][c];
              const sel=selected&&selected.r===r&&selected.c===c;
              const err=!ig&&v&&v!==pz.sol[r][c];
              const ok=!ig&&v&&v===pz.sol[r][c];
              const bb=(r+1)%3===0&&r<8?'2px solid #d4a017':'1px solid #0b3b46';
              const br=(c+1)%3===0&&c<8?'2px solid #d4a017':'1px solid #0b3b46';
              return`<div class="sk9-cell" data-r="${r}" data-c="${c}" style="
                width:${sz};height:${sz};
                background:${sel?'#1a3f55':ig?'#0d1e28':'#0b2530'};
                border-bottom:${bb};border-right:${br};
                display:flex;align-items:center;justify-content:center;
                font-size:clamp(11px,3vw,15px);font-weight:${ig?'900':'700'};
                color:${sel?'#ffd740':ig?'#d4a017':err?'#ef5350':ok?'#00ffa8':'#7ab0c0'};
                cursor:${ig?'default':'pointer'};
                -webkit-tap-highlight-color:transparent;
                box-sizing:border-box;
              ">${v||''}</div>`;
            }).join('')).join('')}
          </div>
          <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:5px;margin-top:12px;width:min(280px,88vw)">
            ${[1,2,3,4,5,6,7,8,9].map(n=>`<div class="sk9-num" data-n="${n}" style="
              background:#0a1e28;border:1px solid #0b3b46;border-radius:8px;
              padding:7px 2px;text-align:center;font-size:clamp(14px,4.5vw,18px);font-weight:800;
              color:#d4a017;cursor:pointer;-webkit-tap-highlight-color:transparent;
            ">${n}</div>`).join('')}
            <div class="sk9-num" data-n="0" style="
              background:#0a1e28;border:1px solid #0b3b46;border-radius:8px;
              padding:7px 2px;text-align:center;font-size:clamp(14px,4.5vw,18px);font-weight:800;
              color:#6b8a91;cursor:pointer;-webkit-tap-highlight-color:transparent;
            ">⌫</div>
          </div>
          ${pz.solved?`<div style="margin-top:14px;text-align:center">
            <button onclick="GamesEngine.launch('sudoku')" style="background:linear-gradient(135deg,#d4a017,#c25b12);border:none;border-radius:10px;color:#020b10;font-size:13px;font-weight:800;padding:10px 22px;cursor:pointer;margin-right:6px">↺ NUEVO PUZZLE</button>
            <button onclick="GamesEngine.showSelection()" style="background:transparent;border:1px solid #0b3b46;border-radius:10px;color:#6b8a91;font-size:12px;font-weight:700;padding:9px 16px;cursor:pointer">◀ VOLVER</button>
          </div>`:''}
        </div>`;

      cont.querySelectorAll('.sk9-cell').forEach(el=>{
        el.addEventListener('click',()=>{
          const r=+el.dataset.r,c=+el.dataset.c;
          if(pz.given[r][c])return;
          selected={r,c};
          render();
        });
      });

      cont.querySelectorAll('.sk9-num').forEach(el=>{
        el.addEventListener('click',()=>{
          if(!selected||pz.solved)return;
          const v=+el.dataset.n;
          pz.board[selected.r][selected.c]=v;
          if(pz.board.every((row,r2)=>row.every((v2,c2)=>v2===pz.sol[r2][c2]))){
            pz.solved=true;
            updateScore('¡COMPLETADO!');
          }
          render();
          // Re-marcar la celda seleccionada después de render
          if(selected&&!pz.solved){
            const el2=cont.querySelector(`.sk9-cell[data-r="${selected.r}"][data-c="${selected.c}"]`);
            if(el2)el2.style.background='#1a3f55';
          }
          if(pz.solved){
            const st=document.getElementById('sudokuStatus');
            if(st){st.textContent='🏆 ¡Resuelto! Excelente lógica.';st.style.color='#00ffa8';}
          }
        });
      });
    }

    return{init(c){init(c);},cleanup(){}};
  })();

  /* ═══════════════════════════════════════════════════════════
     NUEVOS JUEGOS
  ═══════════════════════════════════════════════════════════ */


  /* ─────────────────── PAC-MAN — 3 Niveles ────────────────── */
  Impls.pacman = (() => {
    const ROWS=17, COLS=15;
    const T={WALL:1,DOT:0,PELLET:3,EMPTY:4,GHOST:2};

    /* Configuración por nivel */
    const LEVELS=[
      {
        label:'NIVEL 1', badge:'👻',
        pacSpd:8,          // frames por movimiento (menos = más rápido)
        gSpd:11,           // frames por movimiento fantasma
        scaredTime:220,    // duración modo asustado
        ghostRandom:0.18,  // probabilidad de que el fantasma ignore al jugador
        ptsDot:10, ptsPellet:50, ptsGhost:200,
        wallColor:'#0d3347', wallStroke:'rgba(11,100,130,0.4)',
        waveBonus:300,
      },
      {
        label:'NIVEL 2', badge:'👻👻',
        pacSpd:6,
        gSpd:8,
        scaredTime:140,
        ghostRandom:0.07,
        ptsDot:15, ptsPellet:80, ptsGhost:400,
        wallColor:'#2a0d47', wallStroke:'rgba(100,11,130,0.5)',
        waveBonus:600,
      },
      {
        label:'NIVEL 3', badge:'👻👻👻',
        pacSpd:5,
        gSpd:6,
        scaredTime:70,
        ghostRandom:0.02,  // casi siempre persiguen
        ptsDot:20, ptsPellet:120, ptsGhost:800,
        wallColor:'#3d0a0a', wallStroke:'rgba(180,30,30,0.5)',
        waveBonus:1000,
      },
    ];

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

    function buildLevel(lvlIdx, prevScore, prevLives){
      const cfg=LEVELS[lvlIdx];
      const map=MAP_BASE.map(row=>[...row]);
      let total=0;
      for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)
        if(map[r][c]===T.DOT||map[r][c]===T.PELLET)total++;
      return{
        lvl:lvlIdx, cfg, map, total,
        eaten:0,
        score:prevScore||0,
        frame:0,
        spd:cfg.pacSpd,
        gSpd:cfg.gSpd,
        over:false, won:false,
        levelCleared:false, levelTimer:0,
        pac:{r:15,c:7,dir:{r:0,c:0},next:{r:0,c:-1},lives:prevLives!==undefined?prevLives:3},
        ghosts:[
          {r:7,c:6,dir:{r:0,c:1},color:'#ef5350',mode:'house',timer:60,scared:0},
          {r:7,c:7,dir:{r:0,c:-1},color:'#f48fb1',mode:'house',timer:140,scared:0},
          {r:8,c:6,dir:{r:0,c:1},color:'#26c6da',mode:'house',timer:220,scared:0},
          {r:8,c:7,dir:{r:0,c:-1},color:'#ffb74d',mode:'house',timer:300,scared:0},
        ],
      };
    }

    function init(c){
      cv=c; ctx=c.getContext('2d');
      cs=Math.floor(c.width/COLS);
      c.height=cs*(ROWS+1);
      S=buildLevel(0,0,3);

      kh=e=>{
        const m={ArrowUp:{r:-1,c:0},ArrowDown:{r:1,c:0},ArrowLeft:{r:0,c:-1},ArrowRight:{r:0,c:1},
                 w:{r:-1,c:0},s:{r:1,c:0},a:{r:0,c:-1},d:{r:0,c:1}};
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
      if(!S||S.over)return;
      animFrame=requestAnimationFrame(loop);
      S.frame++;

      /* Transición de nivel */
      if(S.levelCleared){
        S.levelTimer--;
        draw();
        if(S.levelTimer<=0){
          const next=S.lvl+1;
          if(next>=LEVELS.length){
            S.over=true; draw(); gameOver(S.score,true);
          } else {
            S=buildLevel(next,S.score,S.pac.lives);
          }
        }
        return;
      }

      if(S.frame%S.spd===0) movePac();
      if(S.frame%S.gSpd===0) S.ghosts.forEach(g=>moveGhost(g));
      draw();
    }

    function movePac(){
      const p=S.pac, cfg=S.cfg;
      if(canWalk(S.map,p.r+p.next.r,p.c+p.next.c))p.dir={...p.next};
      if(canWalk(S.map,p.r+p.dir.r,p.c+p.dir.c)){p.r+=p.dir.r;p.c+=p.dir.c;}
      const t=S.map[p.r][p.c];
      if(t===T.DOT){
        S.map[p.r][p.c]=T.EMPTY; S.score+=cfg.ptsDot*(S.lvl+1); S.eaten++;
        updateScore('NVL '+(S.lvl+1)+' · '+S.score);
      } else if(t===T.PELLET){
        S.map[p.r][p.c]=T.EMPTY; S.score+=cfg.ptsPellet*(S.lvl+1); S.eaten++;
        updateScore('NVL '+(S.lvl+1)+' · '+S.score);
        S.ghosts.forEach(g=>{if(g.mode!=='house')g.scared=cfg.scaredTime;});
      }
      if(S.eaten>=S.total&&!S.levelCleared){
        S.score+=S.cfg.waveBonus;
        S.levelCleared=true;
        S.levelTimer=160;
        updateScore('NVL '+(S.lvl+1)+' · '+S.score);
        return;
      }
      hitCheck();
    }

    function hitCheck(){
      const p=S.pac, cfg=S.cfg;
      S.ghosts.forEach(g=>{
        if(g.mode==='house')return;
        if(g.r===p.r&&g.c===p.c){
          if(g.scared>0){
            g.scared=0; g.mode='house'; g.r=7; g.c=7; g.timer=100;
            S.score+=cfg.ptsGhost*(S.lvl+1);
            updateScore('NVL '+(S.lvl+1)+' · '+S.score);
          } else {
            p.lives--;
            if(p.lives<=0){S.over=true;setTimeout(()=>gameOver(S.score),500);}
            else{
              p.r=15;p.c=7;p.dir={r:0,c:0};p.next={r:0,c:-1};
              S.ghosts.forEach((g2,i)=>{g2.r=i<2?7:8;g2.c=i%2===0?6:7;g2.mode='house';g2.timer=90*(i+1);g2.scared=0;});
            }
            updateScore('NVL '+(S.lvl+1)+' · '+S.score+' ♥'+p.lives);
          }
        }
      });
    }

    function moveGhost(g){
      if(g.scared>0)g.scared--;
      if(g.mode==='house'){
        g.timer--;if(g.timer>0)return;
        if(g.r>6){if(g.c<7&&canWalk(S.map,g.r,g.c+1,true))g.c++;
          else if(g.c>7&&canWalk(S.map,g.r,g.c-1,true))g.c--;
          else if(canWalk(S.map,g.r-1,g.c,true))g.r--;}
        else{g.mode='chase';}
        return;
      }
      const rev={r:-g.dir.r,c:-g.dir.c};
      const valid=DIRS4.filter(d=>!(d.r===rev.r&&d.c===rev.c)&&canWalk(S.map,g.r+d.r,g.c+d.c));
      if(!valid.length)return;
      let chosen;
      if(g.scared>0){
        chosen=valid[Math.floor(Math.random()*valid.length)];
      } else {
        valid.sort((a,b)=>
          Math.hypot((g.r+a.r)-S.pac.r,(g.c+a.c)-S.pac.c)-
          Math.hypot((g.r+b.r)-S.pac.r,(g.c+b.c)-S.pac.c)
        );
        /* ghostRandom: nivel 1 = 18% random, nivel 3 = 2% random */
        chosen=Math.random()<S.cfg.ghostRandom&&valid.length>1?valid[1]:valid[0];
      }
      g.r+=chosen.r; g.c+=chosen.c; g.dir={...chosen};
      hitCheck();
    }

    function draw(){
      if(!S)return;
      ctx.fillStyle='#020b10'; ctx.fillRect(0,0,cv.width,cv.height);
      const oy=cs;
      const cfg=S.cfg;

      /* Mapa */
      for(let r=0;r<ROWS;r++){
        for(let c=0;c<COLS;c++){
          const x=c*cs,y=oy+r*cs,t=S.map[r][c];
          if(t===T.WALL){
            ctx.fillStyle=cfg.wallColor; ctx.fillRect(x,y,cs,cs);
            ctx.strokeStyle=cfg.wallStroke; ctx.lineWidth=0.5; ctx.strokeRect(x+0.5,y+0.5,cs-1,cs-1);
          } else {
            ctx.fillStyle='#0a1a26'; ctx.fillRect(x,y,cs,cs);
            if(t===T.DOT){
              ctx.fillStyle=S.lvl===0?'#c8880e':S.lvl===1?'#9b59b6':'#e74c3c';
              ctx.beginPath(); ctx.arc(x+cs/2,y+cs/2,cs*0.1,0,Math.PI*2); ctx.fill();
            } else if(t===T.PELLET&&Math.floor(S.frame/8)%2===0){
              ctx.shadowColor='#00ffa8'; ctx.shadowBlur=8;
              ctx.fillStyle='#00ffa8';
              ctx.beginPath(); ctx.arc(x+cs/2,y+cs/2,cs*0.26,0,Math.PI*2); ctx.fill();
              ctx.shadowBlur=0;
            }
          }
        }
      }

      /* Pac-Man */
      const p=S.pac;
      const px=p.c*cs+cs/2, py2=oy+p.r*cs+cs/2;
      const mouth=Math.abs(Math.sin(S.frame*0.28))*0.38;
      const ang=Math.atan2(p.dir.r,p.dir.c);
      /* Color pac según nivel */
      ctx.fillStyle=S.lvl===0?'#d4a017':S.lvl===1?'#e056e0':'#ef5350';
      ctx.beginPath(); ctx.moveTo(px,py2);
      ctx.arc(px,py2,cs*0.42,ang+mouth,ang+Math.PI*2-mouth);
      ctx.closePath(); ctx.fill();

      /* Fantasmas */
      S.ghosts.forEach(g=>{
        if(g.mode==='house'&&g.timer>60)return;
        const gx=g.c*cs+cs/2, gy=oy+g.r*cs+cs/2, gr=cs*0.4;
        const scared=g.scared>0;
        const blink=scared&&g.scared<60&&Math.floor(S.frame/8)%2===0;
        ctx.fillStyle=blink?'#ffffff':scared?'#2244dd':g.color;
        ctx.beginPath(); ctx.arc(gx,gy-gr*0.1,gr,Math.PI,0);
        ctx.lineTo(gx+gr,gy+gr*0.75);
        for(let i=4;i>=0;i--){const wx=gx-gr+(i/4)*2*gr;ctx.lineTo(wx,gy+gr*0.75+(i%2===0?-gr*0.28:gr*0.28));}
        ctx.lineTo(gx-gr,gy-gr*0.1); ctx.fill();
        if(!scared){
          ctx.fillStyle='#fff';
          ctx.beginPath();ctx.arc(gx-gr*0.28,gy-gr*0.32,gr*0.19,0,Math.PI*2);ctx.fill();
          ctx.beginPath();ctx.arc(gx+gr*0.28,gy-gr*0.32,gr*0.19,0,Math.PI*2);ctx.fill();
          ctx.fillStyle='#002';
          ctx.beginPath();ctx.arc(gx-gr*0.22+g.dir.c*gr*0.09,gy-gr*0.26+g.dir.r*gr*0.09,gr*0.1,0,Math.PI*2);ctx.fill();
          ctx.beginPath();ctx.arc(gx+gr*0.28+g.dir.c*gr*0.09,gy-gr*0.26+g.dir.r*gr*0.09,gr*0.1,0,Math.PI*2);ctx.fill();
        }
      });

      /* Vidas y HUD */
      const livColor=S.lvl===0?'#d4a017':S.lvl===1?'#e056e0':'#ef5350';
      ctx.fillStyle=livColor;
      for(let i=0;i<S.pac.lives;i++){
        ctx.beginPath();ctx.moveTo(i*(cs+3)+cs/2,cs/2);
        ctx.arc(i*(cs+3)+cs/2,cs/2,cs*0.38,0.3,Math.PI*2-0.3);
        ctx.closePath();ctx.fill();
      }
      ctx.fillStyle='rgba(212,160,23,0.9)';ctx.font='bold 12px monospace';
      ctx.textAlign='right';
      ctx.fillText('NVL '+(S.lvl+1)+' · '+S.score,cv.width-4,cs-3);
      ctx.textAlign='left';
      ctx.fillStyle='rgba(212,160,23,0.45)';ctx.font='10px monospace';
      ctx.fillText(cfg.badge,4,cs-3);

      /* Pantalla de nivel completado */
      if(S.levelCleared){
        ctx.fillStyle='rgba(2,11,16,0.85)'; ctx.fillRect(0,0,cv.width,cv.height);
        ctx.textAlign='center';
        const next=S.lvl+1;
        if(next<LEVELS.length){
          ctx.fillStyle='#00ffa8'; ctx.font=`bold ${Math.max(16,cv.width/18)}px monospace`;
          ctx.fillText('✅ NIVEL '+(S.lvl+1)+' COMPLETADO',cv.width/2,cv.height/2-30);
          ctx.fillStyle='rgba(212,160,23,0.9)'; ctx.font=`bold ${Math.max(12,cv.width/26)}px monospace`;
          ctx.fillText('SCORE: '+S.score+'  +'+S.cfg.waveBonus+' BONUS',cv.width/2,cv.height/2+4);
          ctx.fillStyle='rgba(0,255,168,0.55)'; ctx.font=`${Math.max(10,cv.width/36)}px monospace`;
          ctx.fillText('Preparando '+LEVELS[next].label+' '+LEVELS[next].badge+'...',cv.width/2,cv.height/2+28);
        } else {
          ctx.fillStyle='#ffd700'; ctx.font=`bold ${Math.max(18,cv.width/15)}px monospace`;
          ctx.fillText('🏆 ¡CAMPEÓN!',cv.width/2,cv.height/2-28);
          ctx.fillStyle='rgba(212,160,23,0.9)'; ctx.font=`bold ${Math.max(12,cv.width/24)}px monospace`;
          ctx.fillText('SCORE FINAL: '+S.score,cv.width/2,cv.height/2+6);
          ctx.fillStyle='rgba(0,255,168,0.5)'; ctx.font=`${Math.max(10,cv.width/36)}px monospace`;
          ctx.fillText('¡3 niveles completados!',cv.width/2,cv.height/2+28);
        }
        ctx.textAlign='left';
      }
    }

    return{
      init,
      cleanup(){if(kh)document.removeEventListener('keydown',kh); S=null;}
    };
  })();

  /* ─────────────────── SPACE INVADERS — 3 Niveles ─────────── */
  Impls.invaders = (() => {
    let cv,ctx,S,kh,ku,keys={},touchFiring=false;

    /* Configuración por nivel */
    const LEVELS=[
      { label:'NIVEL 1', ACOLS:8, AROWS:5, spdMult:1.0, bombFreq:0.50, bombSpd:1.0, dropMult:1.0, color:'⬜' },
      { label:'NIVEL 2', ACOLS:9, AROWS:5, spdMult:1.45, bombFreq:0.70, bombSpd:1.35, dropMult:1.2, color:'🟡' },
      { label:'NIVEL 3', ACOLS:9, AROWS:5, spdMult:2.0,  bombFreq:0.90, bombSpd:1.75, dropMult:1.5, color:'🔴' },
    ];

    function buildLevel(c, lvlIdx, prevScore, prevLives){
      const W=c.width, H=c.height;
      const cfg=LEVELS[lvlIdx];

      const AW=Math.floor(W*0.076);
      const AH=Math.floor(AW*0.65);
      const AGX=Math.floor(AW*0.30);
      const AGY=Math.floor(AH*0.48);
      const formW=cfg.ACOLS*(AW+AGX);
      const sx=Math.floor((W-formW)/2);
      const formH=cfg.AROWS*(AH+AGY);
      const startY=Math.floor(H*0.08)+22;
      const dangerY=Math.floor(H*0.80);
      const safeStartY=Math.min(startY, dangerY-formH-55);

      const baseSpd=W*0.00085;
      const initSpd=baseSpd*cfg.spdMult;
      const dropStep=Math.max(4,Math.floor(H*0.016))*cfg.dropMult;
      const bombSpeed=Math.max(1.3,H*0.0038)*cfg.bombSpd;

      return {
        lvl:lvlIdx, cfg,
        AW,AH,AGX,AGY,
        aliens:Array.from({length:cfg.AROWS*cfg.ACOLS},(_,i)=>({
          baseX:sx+(i%cfg.ACOLS)*(AW+AGX),
          baseY:safeStartY+Math.floor(i/cfg.ACOLS)*(AH+AGY),
          row:Math.floor(i/cfg.ACOLS), alive:true
        })),
        offX:0,dir:1,spd:initSpd,initSpd,
        px:W/2,lives:prevLives!==undefined?prevLives:3,
        bullets:[],bombs:[],
        shootCd:0,score:prevScore||0,frame:0,
        stars:Array.from({length:50},()=>({x:Math.random()*W,y:Math.random()*H,r:Math.random()*1.1+0.3})),
        over:false,won:false,levelCleared:false,levelTimer:0,
        dangerY,dropStep,bombSpeed,bombFreq:cfg.bombFreq,
        maxSpd:Math.min(2.0,initSpd*3.5),
        ACOLS:cfg.ACOLS,AROWS:cfg.AROWS,
      };
    }

    function shoot(){
      if(!S||S.shootCd>0)return;
      if(S.bullets.filter(b=>b.ok).length>=3)return;
      S.bullets.push({x:S.px,y:cv.height-28,vy:-10,ok:true});
      S.shootCd=15;
    }

    function init(c){
      cv=c; ctx=c.getContext('2d'); keys={}; touchFiring=false;
      S=buildLevel(c,0,0,3);

      kh=e=>{keys[e.key]=true; e.key===' '&&e.preventDefault();};
      ku=e=>{delete keys[e.key];};
      document.addEventListener('keydown',kh);
      document.addEventListener('keyup',ku);

      c.addEventListener('touchmove',e=>{
        e.preventDefault();
        const r=c.getBoundingClientRect();
        S.px=Math.max(22,Math.min(cv.width-22,e.touches[0].clientX-r.left));
      },{passive:false});
      c.addEventListener('touchstart',e=>{
        const r=c.getBoundingClientRect();
        S.px=Math.max(22,Math.min(cv.width-22,e.touches[0].clientX-r.left));
        touchFiring=true; shoot();
      },{passive:true});
      c.addEventListener('touchend', ()=>{touchFiring=false;},{passive:true});
      c.addEventListener('touchcancel',()=>{touchFiring=false;},{passive:true});

      animFrame=requestAnimationFrame(loop);
    }

    function loop(){
      if(!S||S.over)return;
      animFrame=requestAnimationFrame(loop);
      S.frame++;

      /* ── Transición entre niveles ── */
      if(S.levelCleared){
        S.levelTimer--;
        draw(); // sigue dibujando el mensaje
        if(S.levelTimer<=0){
          const nextLvl=S.lvl+1;
          if(nextLvl>=LEVELS.length){
            // ¡Todos los niveles completados!
            S.over=true; draw(); gameOver(S.score,true);
          } else {
            S=buildLevel(cv,nextLvl,S.score,S.lives);
          }
        }
        return;
      }

      if(S.shootCd>0)S.shootCd--;

      if(keys['ArrowLeft']||keys['a']) S.px=Math.max(22,S.px-4.5);
      if(keys['ArrowRight']||keys['d'])S.px=Math.min(cv.width-22,S.px+4.5);
      if(keys[' '])shoot();
      if(touchFiring)shoot();

      S.bullets.forEach(b=>{b.y+=b.vy; if(b.y<0)b.ok=false;});
      S.bullets=S.bullets.filter(b=>b.ok);
      S.bombs.forEach(b=>{b.y+=b.vy; if(b.y>cv.height)b.ok=false;});
      S.bombs=S.bombs.filter(b=>b.ok);

      const alive=S.aliens.filter(a=>a.alive);

      /* ── Nivel completado ── */
      if(!alive.length){
        S.levelCleared=true;
        S.levelTimer=120; // ~2 segundos a 60fps
        return;
      }

      /* ── Movimiento horizontal ── */
      const nOff=S.offX+S.spd*S.dir;
      const lx=Math.min(...alive.map(a=>a.baseX))+nOff;
      const rx=Math.max(...alive.map(a=>a.baseX+S.AW))+nOff;
      if(lx<4||rx>cv.width-4){
        S.dir*=-1;
        alive.forEach(a=>a.baseY+=S.dropStep);
        S.spd=Math.min(S.maxSpd,S.spd+0.025);
      }else{
        S.offX=nOff;
      }

      /* ── Bombas ── */
      if(S.frame%75===0){
        const cols=[...new Set(alive.map(a=>a.baseX))];
        // Cuántas bombas lanzar según nivel
        const nBombs=S.lvl+1;
        for(let b=0;b<nBombs;b++){
          if(Math.random()<S.bombFreq){
            const chosen=cols[Math.floor(Math.random()*cols.length)];
            const bot=alive.filter(a=>a.baseX===chosen).sort((a,b2)=>b2.row-a.row)[0];
            if(bot)S.bombs.push({x:bot.baseX+S.offX+S.AW/2,y:bot.baseY+S.AH,vy:S.bombSpeed,ok:true});
          }
        }
      }

      /* ── Colisiones bala-alien ── */
      S.bullets.forEach(b=>{
        alive.forEach(a=>{
          const ax=a.baseX+S.offX;
          if(b.ok&&b.x>=ax&&b.x<=ax+S.AW&&b.y>=a.baseY&&b.y<=a.baseY+S.AH){
            a.alive=false; b.ok=false;
            S.score+=(S.AROWS-a.row)*10+10*(S.lvl+1);
            updateScore('NVL '+(S.lvl+1)+' · '+S.score);
          }
        });
      });

      /* ── Colisiones bomba-nave ── */
      const py=cv.height-22;
      S.bombs.forEach(b=>{
        if(b.ok&&Math.abs(b.x-S.px)<24&&Math.abs(b.y-py)<16){
          b.ok=false; S.lives--;
          updateScore('NVL '+(S.lvl+1)+' · '+S.score+' ♥'+S.lives);
          if(S.lives<=0){S.over=true; draw(); gameOver(S.score);}
        }
      });
      if(S.over)return;

      /* ── Game over si alien llega a la nave ── */
      if(alive.some(a=>a.baseY+S.AH>S.dangerY)){
        S.over=true; draw(); gameOver(S.score); return;
      }

      draw();
    }

    const AC_ROWS=['#ef5350','#ff7043','#ab47bc','#42a5f5','#00ffa8'];

    function draw(){
      if(!S)return;
      const W=cv.width,H=cv.height;
      ctx.fillStyle='#020b10'; ctx.fillRect(0,0,W,H);

      /* Estrellas */
      S.stars.forEach(s=>{ctx.fillStyle='rgba(255,255,255,0.4)';ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill();});

      /* Línea de peligro */
      ctx.strokeStyle='rgba(239,83,80,0.15)';ctx.lineWidth=1;ctx.setLineDash([3,7]);
      ctx.beginPath();ctx.moveTo(0,S.dangerY);ctx.lineTo(W,S.dangerY);ctx.stroke();
      ctx.setLineDash([]);

      /* Aliens */
      const {AW,AH}=S;
      S.aliens.forEach(a=>{
        if(!a.alive)return;
        const ax=a.baseX+S.offX,ay=a.baseY,ac=AC_ROWS[a.row%5];
        const leg=S.frame%22<11?0:2;
        ctx.fillStyle=ac;
        ctx.fillRect(ax+3,ay,AW-6,AH*0.60);
        ctx.fillRect(ax,ay+4,AW,AH*0.42);
        ctx.fillRect(ax+3,ay-3,4,3); ctx.fillRect(ax+AW-7,ay-3,4,3);
        ctx.fillStyle='#020b10';
        ctx.fillRect(ax+5,ay+3,3,3); ctx.fillRect(ax+AW-8,ay+3,3,3);
        ctx.fillStyle=ac;
        ctx.fillRect(ax+leg,ay+AH*0.58,3,3);
        ctx.fillRect(ax+AW/2-1,ay+AH*0.58,3,3);
        ctx.fillRect(ax+AW-3-leg,ay+AH*0.58,3,3);
      });

      /* Nave jugador */
      const py=H-22;
      const pg=ctx.createLinearGradient(S.px-22,0,S.px+22,0);
      pg.addColorStop(0,'#d4a017'); pg.addColorStop(1,'#c25b12');
      ctx.fillStyle=pg;
      if(ctx.roundRect){ctx.beginPath();ctx.roundRect(S.px-22,py,44,12,4);ctx.fill();}
      else ctx.fillRect(S.px-22,py,44,12);
      ctx.fillStyle='#d4a017'; ctx.fillRect(S.px-3,py-9,6,10);

      /* Proyectiles */
      S.bullets.forEach(b=>{ctx.shadowColor='#00ffa8';ctx.shadowBlur=5;ctx.fillStyle='#00ffa8';ctx.fillRect(b.x-2,b.y-6,4,9);ctx.shadowBlur=0;});
      S.bombs.forEach(b=>{ctx.fillStyle=S.frame%4<2?'#ef5350':'#ff7043';ctx.fillRect(b.x-2,b.y-4,4,8);});

      /* HUD */
      ctx.fillStyle='rgba(212,160,23,0.9)';ctx.font='bold 12px monospace';
      ctx.fillText('NVL '+(S.lvl+1)+' · SCORE '+S.score+'  ♥'+S.lives+'  👾'+S.aliens.filter(a=>a.alive).length,6,18);

      /* Indicador de nivel en esquina */
      ctx.textAlign='right';
      ctx.fillStyle='rgba(212,160,23,0.5)';ctx.font='bold 11px monospace';
      ctx.fillText(S.cfg.label+' '+S.cfg.color, W-6, 18);
      ctx.textAlign='left';

      /* Pantalla de nivel completado */
      if(S.levelCleared){
        ctx.fillStyle='rgba(2,11,16,0.82)';ctx.fillRect(0,0,W,H);
        ctx.textAlign='center';
        const nextLvl=S.lvl+1;
        if(nextLvl<LEVELS.length){
          ctx.fillStyle='#00ffa8';ctx.font=`bold ${Math.max(20,W/16)}px monospace`;
          ctx.fillText('✅ NIVEL '+(S.lvl+1)+' COMPLETADO',W/2,H/2-28);
          ctx.fillStyle='rgba(212,160,23,0.9)';ctx.font=`bold ${Math.max(13,W/24)}px monospace`;
          ctx.fillText('SCORE: '+S.score,W/2,H/2+2);
          ctx.fillStyle='rgba(0,255,168,0.6)';ctx.font=`${Math.max(11,W/32)}px monospace`;
          ctx.fillText('Preparando '+LEVELS[nextLvl].label+'...',W/2,H/2+30);
        } else {
          ctx.fillStyle='#ffd700';ctx.font=`bold ${Math.max(20,W/14)}px monospace`;
          ctx.fillText('🏆 ¡COMPLETADO!',W/2,H/2-28);
          ctx.fillStyle='rgba(212,160,23,0.9)';ctx.font=`bold ${Math.max(13,W/22)}px monospace`;
          ctx.fillText('SCORE FINAL: '+S.score,W/2,H/2+8);
        }
        ctx.textAlign='left';
      }

      if(touchFiring&&!S.levelCleared){ctx.fillStyle='rgba(0,255,168,0.15)';ctx.beginPath();ctx.arc(S.px,py+5,26,0,Math.PI*2);ctx.fill();}
    }

    return{
      init,
      cleanup(){
        if(kh){document.removeEventListener('keydown',kh);document.removeEventListener('keyup',ku);}
        touchFiring=false; S=null;
      }
    };
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
        <div style="display:flex;flex-direction:column;align-items:center;padding:14px 8px 24px;user-select:none">
          <!-- Nota de cómo se juega -->
          <div style="background:rgba(11,59,70,0.5);border:1px solid rgba(212,160,23,0.25);border-radius:10px;padding:8px 14px;margin-bottom:10px;width:min(300px,85vw);text-align:center">
            <div style="font-size:11px;color:#d4a017;font-weight:800;letter-spacing:1px;margin-bottom:3px">📖 CÓMO SE JUEGA</div>
            <div style="font-size:10px;color:#6b8a91;line-height:1.5">Desliza o usa las flechas para mover las fichas.<br>Fichas iguales se fusionan: 2+2=4, 4+4=8…<br>¡Llega a la ficha <span style="color:#ffd700;font-weight:800">2048</span> para ganar!</div>
          </div>
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

  /* ─────────────────── MEMORY MATCH (cards más grandes) ─────*/
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
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:clamp(8px,2.5vw,14px);width:min(360px,94vw)">
            ${S.cards.map((card,i)=>`
              <div data-i="${i}" style="
                aspect-ratio:1;
                background:${card.ok?'rgba(0,255,168,0.07)':card.up?'#142638':'#0a1e28'};
                border:2px solid ${card.ok?'rgba(0,255,168,0.45)':card.up?'#d4a017':'#0b3b46'};
                border-radius:14px;display:flex;align-items:center;justify-content:center;
                font-size:clamp(26px,8vw,38px);cursor:${card.ok?'default':'pointer'};
                transition:transform 0.12s;-webkit-tap-highlight-color:transparent;
                ${card.up&&!card.ok?'transform:scale(1.07);':''}
                ${card.ok?'box-shadow:0 0 14px rgba(0,255,168,0.22);':''}
              ">${card.up||card.ok?card.sym:'<span style="color:#0b3b46;font-size:clamp(22px,6vw,30px)">◈</span>'}</div>`).join('')}
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