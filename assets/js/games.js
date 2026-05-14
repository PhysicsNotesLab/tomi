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
    { id:'wordsearch',emoji:'🔤', name:'SOPA DE LETRAS', desc:'Encuentra palabras de física',   hint:'Arrastra sobre las letras' },
    { id:'projectile',emoji:'🎯', name:'TIRO PARABÓLICO', desc:'Acierta el blanco con física real', hint:'Ajusta ángulo y velocidad' },
    { id:'quiz',      emoji:'🧪', name:'QUIZ DE FÍSICA',  desc:'Pon a prueba tu conocimiento',   hint:'Elige la respuesta correcta' },
    { id:'ballguide', emoji:'🎱', name:'GUÍA LA BOLA',   desc:'Dibuja líneas para guiar la bola', hint:'Dibuja con el dedo o el ratón' },
    { id:'balanza',   emoji:'⚖️',  name:'BALANZA DE FUERZAS', desc:'Equilibra torques — Física real', hint:'Selecciona posición o masa' },
    { id:'narrativa', emoji:'🌌', name:'CRÓNICAS DEL COSMOS', desc:'Aventura narrativa · Física real', hint:'Lee la historia y resuelve el desafío' },
  ];

  function featuredIndex(subjectId) {
    let h=0, s=String(subjectId||'');
    for(let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))&0xffff;
    return h % GAMES.length;
  }

  let overlayEl=null, gameBodyEl=null, animFrame=null, currentImpl=null, currentSubjectId='';
  const DOM_GAMES = new Set(['sudoku','g2048','mines','memory','wordsearch','projectile','quiz','ballguide','balanza','narrativa']);

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


  /* ─────────────────── TETRIS — 3 Niveles ─────────────────── */
  Impls.tetris = (() => {
    let cv,ctx,S,kh;
    const COLS=10, ROWS=20;
    const COLORS=['','#d4a017','#00ffa8','#ef5350','#42a5f5','#ab47bc','#ff7043','#66bb6a'];
    const SHAPES=[null,[[1,1,1,1]],[[2,2],[2,2]],[[0,3,0],[3,3,3]],[[4,0],[4,0],[4,4]],[[0,5],[0,5],[5,5]],[[0,6,6],[6,6,0]],[[7,7,0],[0,7,7]]];

    /* Configuración de los 3 niveles iniciales */
    const LEVEL_PRESETS=[
      {
        label:'NIVEL 1', badge:'🧱',
        startSpeed:850,     // ms entre caídas
        speedDecay:75,      // reducción por nivel interno
        minSpeed:80,
        linesPerInternalLvl:10,
        ptsMult:1,
        gridColor:'rgba(11,59,70,0.45)',
        bgColor:'#020b10',
        wallColor:'rgba(11,59,70,0.2)',
        waveLines:20,       // líneas para completar este nivel
        waveBonus:500,
        startInternalLvl:1,
      },
      {
        label:'NIVEL 2', badge:'🧱🧱',
        startSpeed:480,
        speedDecay:55,
        minSpeed:70,
        linesPerInternalLvl:10,
        ptsMult:2,
        gridColor:'rgba(80,20,100,0.45)',
        bgColor:'#0a0215',
        wallColor:'rgba(80,20,100,0.2)',
        waveLines:30,
        waveBonus:1000,
        startInternalLvl:5,  // empieza ya en nivel interno 5
      },
      {
        label:'NIVEL 3', badge:'🧱🧱🧱',
        startSpeed:250,
        speedDecay:35,
        minSpeed:55,
        linesPerInternalLvl:10,
        ptsMult:3,
        gridColor:'rgba(120,20,20,0.45)',
        bgColor:'#150505',
        wallColor:'rgba(120,20,20,0.2)',
        waveLines:40,
        waveBonus:2000,
        startInternalLvl:10,
      },
    ];

    const rnd=()=>{const id=Math.floor(Math.random()*7)+1;return{id,shape:SHAPES[id].map(r=>[...r]),x:Math.floor(COLS/2)-1,y:0};};
    const collide=(b,p,dx=0,dy=0,ns=null)=>{
      const s=ns||p.shape;
      return s.some((row,r)=>row.some((v,c)=>{
        if(!v)return false;
        const nx=p.x+c+dx, ny=p.y+r+dy;
        return nx<0||nx>=COLS||ny>=ROWS||(ny>=0&&b[ny][nx]);
      }));
    };
    const rotate=s=>s[0].map((_,i)=>s.map(r=>r[i]).reverse());
    const lock=(b,p)=>p.shape.forEach((row,r)=>row.forEach((v,c)=>{if(v)b[p.y+r][p.x+c]=v;}));
    const clearLines=b=>{
      let n=0;
      for(let r=ROWS-1;r>=0;r--){
        if(b[r].every(v=>v)){b.splice(r,1);b.unshift(new Array(COLS).fill(0));n++;r++;}
      }
      return n;
    };
    const cw=()=>cv.width/COLS, ch2=()=>cv.height/ROWS;

    function buildState(presetIdx, prevScore){
      const cfg=LEVEL_PRESETS[presetIdx];
      return{
        preset:presetIdx, cfg,
        board:Array.from({length:ROWS},()=>new Array(COLS).fill(0)),
        piece:rnd(), next:rnd(),
        score:prevScore||0,
        lines:0,           // líneas en este nivel
        totalLines:0,      // acumulado
        level:cfg.startInternalLvl,
        speed:cfg.startSpeed,
        lastDrop:0, over:false,
        levelCleared:false, levelTimer:0,
        flashLines:[],     // filas para animar al limpiar
        particles:[],
      };
    }

    function spawnLineParts(rows){
      rows.forEach(r=>{
        for(let c=0;c<COLS;c++){
          S.particles.push({
            x:(c+0.5)*cw(), y:(r+0.5)*ch2(),
            vx:(Math.random()-0.5)*4,
            vy:-Math.random()*3-1,
            life:30+Math.random()*20, maxLife:50,
            color:COLORS[1+Math.floor(Math.random()*7)],
          });
        }
      });
    }

    function draw(ts){
      const cfg=S.cfg;
      ctx.fillStyle=cfg.bgColor; ctx.fillRect(0,0,cv.width,cv.height);

      /* Cuadrícula */
      ctx.strokeStyle=cfg.gridColor; ctx.lineWidth=0.5;
      for(let r=0;r<ROWS;r++){ctx.beginPath();ctx.moveTo(0,r*ch2());ctx.lineTo(cv.width,r*ch2());ctx.stroke();}
      for(let c=0;c<COLS;c++){ctx.beginPath();ctx.moveTo(c*cw(),0);ctx.lineTo(c*cw(),cv.height);ctx.stroke();}

      /* Tablero */
      S.board.forEach((row,r)=>row.forEach((v,c)=>{
        if(!v)return;
        const flash=S.flashLines.includes(r)&&Math.floor((ts||0)/60)%2===0;
        const col=flash?'#ffffff':COLORS[v];
        ctx.fillStyle=col; ctx.fillRect(c*cw()+1,r*ch2()+1,cw()-2,ch2()-2);
        ctx.fillStyle='rgba(255,255,255,0.13)'; ctx.fillRect(c*cw()+1,r*ch2()+1,cw()-2,3);
      }));

      /* Pieza fantasma */
      if(S.piece){
        let gy=S.piece.y;
        while(!collide(S.board,S.piece,0,gy-S.piece.y+1))gy++;
        S.piece.shape.forEach((row,r)=>row.forEach((v,c)=>{
          if(!v)return;
          ctx.fillStyle='rgba(255,255,255,0.06)';
          ctx.fillRect((S.piece.x+c)*cw()+1,(gy+r)*ch2()+1,cw()-2,ch2()-2);
        }));
      }

      /* Pieza actual */
      if(S.piece) S.piece.shape.forEach((row,r)=>row.forEach((v,c)=>{
        if(v){
          ctx.fillStyle=COLORS[v]; ctx.fillRect((S.piece.x+c)*cw()+1,(S.piece.y+r)*ch2()+1,cw()-2,ch2()-2);
          ctx.fillStyle='rgba(255,255,255,0.13)'; ctx.fillRect((S.piece.x+c)*cw()+1,(S.piece.y+r)*ch2()+1,cw()-2,3);
        }
      }));

      /* Partículas */
      S.particles.forEach(p=>{
        const a=p.life/p.maxLife;
        ctx.fillStyle=p.color+(Math.floor(a*200).toString(16).padStart(2,'0'));
        ctx.beginPath();ctx.arc(p.x,p.y,2.5,0,Math.PI*2);ctx.fill();
      });

      /* HUD */
      const fs=Math.max(10,cv.width/32);
      ctx.fillStyle='rgba(212,160,23,0.9)'; ctx.font=`bold ${fs}px monospace`;
      ctx.fillText(`NVL ${cfg.label.split(' ')[1]} · SCORE ${S.score}  LÍNEAS ${S.lines}/${cfg.waveLines}`,6,15);
      ctx.textAlign='right';
      ctx.fillStyle='rgba(212,160,23,0.45)'; ctx.font=`bold ${Math.max(9,fs-1)}px monospace`;
      ctx.fillText(cfg.badge+' SPD '+S.level,cv.width-4,15);
      ctx.textAlign='left';

      /* Barra de progreso líneas */
      const pct=Math.min(1,S.lines/cfg.waveLines);
      ctx.fillStyle='rgba(11,59,70,0.5)'; ctx.fillRect(0,cv.height-3,cv.width,3);
      ctx.fillStyle=cfg.preset===0?'#00ffa8':cfg.preset===1?'#ab47bc':'#ef5350';
      ctx.fillRect(0,cv.height-3,pct*cv.width,3);

      /* Pantalla de nivel completado */
      if(S.levelCleared){
        ctx.fillStyle='rgba(2,11,16,0.88)'; ctx.fillRect(0,0,cv.width,cv.height);
        ctx.textAlign='center';
        const next=S.preset+1;
        if(next<LEVEL_PRESETS.length){
          ctx.fillStyle='#00ffa8'; ctx.font=`bold ${Math.max(16,cv.width/18)}px monospace`;
          ctx.fillText('✅ '+cfg.label+' COMPLETADO',cv.width/2,cv.height/2-32);
          ctx.fillStyle='rgba(212,160,23,0.9)'; ctx.font=`bold ${Math.max(12,cv.width/26)}px monospace`;
          ctx.fillText('SCORE: '+S.score+'  +'+cfg.waveBonus+' BONUS',cv.width/2,cv.height/2+2);
          ctx.fillStyle='rgba(0,255,168,0.5)'; ctx.font=`${Math.max(10,cv.width/36)}px monospace`;
          ctx.fillText('Preparando '+LEVEL_PRESETS[next].label+' '+LEVEL_PRESETS[next].badge+'...',cv.width/2,cv.height/2+28);
        } else {
          ctx.fillStyle='#ffd700'; ctx.font=`bold ${Math.max(18,cv.width/14)}px monospace`;
          ctx.fillText('🏆 ¡TETRIS MASTER!',cv.width/2,cv.height/2-28);
          ctx.fillStyle='rgba(212,160,23,0.9)'; ctx.font=`bold ${Math.max(12,cv.width/22)}px monospace`;
          ctx.fillText('SCORE FINAL: '+S.score,cv.width/2,cv.height/2+6);
          ctx.fillStyle='rgba(255,255,255,0.3)'; ctx.font=`${Math.max(10,cv.width/36)}px monospace`;
          ctx.fillText('¡3 niveles completados!',cv.width/2,cv.height/2+28);
        }
        ctx.textAlign='left';
      }
    }

    function loop(ts){
      if(!S||S.over)return;
      animFrame=requestAnimationFrame(loop);
      S.frame=(S.frame||0)+1;

      /* Partículas */
      S.particles.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=0.15;p.life--;});
      S.particles=S.particles.filter(p=>p.life>0);

      /* Transición de nivel */
      if(S.levelCleared){
        S.levelTimer--;
        draw(ts);
        if(S.levelTimer<=0){
          const next=S.preset+1;
          if(next>=LEVEL_PRESETS.length){S.over=true;draw(ts);gameOver(S.score,true);}
          else{S=buildState(next,S.score);}
        }
        return;
      }

      /* Caída automática */
      if(ts-S.lastDrop>S.speed){
        S.lastDrop=ts;
        if(!collide(S.board,S.piece,0,1)){
          S.piece.y++;
        } else {
          lock(S.board,S.piece);

          /* Detectar filas llenas */
          const fullRows=[];
          for(let r=0;r<ROWS;r++){if(S.board[r].every(v=>v))fullRows.push(r);}

          if(fullRows.length){
            spawnLineParts(fullRows);
            const n=clearLines(S.board);
            S.lines+=n; S.totalLines+=n;

            /* Puntos: 1 línea=100, 2=300, 3=500, 4=800 × multiplicador de nivel */
            const pts=[0,100,300,500,800][Math.min(n,4)]*S.cfg.ptsMult*S.level;
            S.score+=pts;

            /* Subir nivel interno */
            S.level=S.cfg.startInternalLvl+Math.floor(S.lines/S.cfg.linesPerInternalLvl);
            S.speed=Math.max(S.cfg.minSpeed, S.cfg.startSpeed - (S.level-S.cfg.startInternalLvl)*S.cfg.speedDecay);
            updateScore('NVL '+S.cfg.label.split(' ')[1]+' · '+S.score);

            /* ¿Nivel completado? */
            if(S.lines>=S.cfg.waveLines&&!S.levelCleared){
              S.score+=S.cfg.waveBonus;
              S.levelCleared=true;
              S.levelTimer=200;
              updateScore('NVL '+S.cfg.label.split(' ')[1]+' · '+S.score);
            }
          }

          S.piece=S.next; S.next=rnd();
          if(collide(S.board,S.piece)){S.over=true;draw(ts);gameOver(S.score);return;}
        }
      }
      draw(ts);
    }

    return{
      init(c){
        cv=c; ctx=c.getContext('2d');
        S=buildState(0,0); S.frame=0;
        kh=e=>{
          if(!S||S.over||S.levelCleared)return;
          if(e.key==='ArrowLeft'&&!collide(S.board,S.piece,-1))S.piece.x--;
          if(e.key==='ArrowRight'&&!collide(S.board,S.piece,1))S.piece.x++;
          if(e.key==='ArrowDown'&&!collide(S.board,S.piece,0,1))S.piece.y++;
          if(e.key==='ArrowUp'||e.key==='z'){const r=rotate(S.piece.shape);if(!collide(S.board,S.piece,0,0,r))S.piece.shape=r;}
          if(e.key===' '){while(!collide(S.board,S.piece,0,1))S.piece.y++;draw(performance.now());}
        };
        document.addEventListener('keydown',kh);
        let tx,ty;
        c.addEventListener('touchstart',e=>{tx=e.touches[0].clientX;ty=e.touches[0].clientY;},{passive:true});
        c.addEventListener('touchend',e=>{
          if(!S||S.over||S.levelCleared)return;
          const dx=e.changedTouches[0].clientX-tx, dy=e.changedTouches[0].clientY-ty;
          if(Math.abs(dx)>Math.abs(dy)&&Math.abs(dx)>15){
            if(dx<0&&!collide(S.board,S.piece,-1))S.piece.x--;
            if(dx>0&&!collide(S.board,S.piece,1))S.piece.x++;
          } else if(dy>20&&!collide(S.board,S.piece,0,1))S.piece.y++;
          else if(dy<-20){const r=rotate(S.piece.shape);if(!collide(S.board,S.piece,0,0,r))S.piece.shape=r;}
        },{passive:true});
        animFrame=requestAnimationFrame(loop);
      },
      cleanup(){if(kh)document.removeEventListener('keydown',kh); S=null;}
    };
  })();


  /* ─────────────────── SNAKE — 3 Niveles ──────────────────── */
  Impls.snake = (() => {
    let cv,ctx,S,kh,iv;
    const SZ=20;

    const LEVELS=[
      {
        label:'NIVEL 1', badge:'🐍',
        winLen:15,           // largo para completar el nivel
        interval:115,        // ms entre movimientos
        minInterval:75,      // límite de aceleración
        accelEvery:50,       // puntos para acelerar
        accelStep:10,        // ms que se reduce el intervalo
        walls:false,         // sin paredes = wrap
        foodPts:10,
        waveBonus:200,
        gridColor:'rgba(11,59,70,0.28)',
        snakeHue:155,        // tono verde
        foodColor:'#ef5350',
        foodPulse:true,
        extraFood:false,     // sin comida extra
      },
      {
        label:'NIVEL 2', badge:'🐍🐍',
        winLen:25,
        interval:90,
        minInterval:55,
        accelEvery:40,
        accelStep:8,
        walls:true,          // paredes matan — sin wrap
        foodPts:15,
        waveBonus:450,
        gridColor:'rgba(60,20,80,0.32)',
        snakeHue:270,        // tono morado
        foodColor:'#d4a017',
        foodPulse:true,
        extraFood:true,      // aparece comida bonus amarilla (+30 pts)
        bonusFoodPts:30,
        bonusFoodLife:80,    // frames antes de desaparecer
      },
      {
        label:'NIVEL 3', badge:'🐍🐍🐍',
        winLen:35,
        interval:68,
        minInterval:38,
        accelEvery:30,
        accelStep:6,
        walls:true,
        foodPts:20,
        waveBonus:800,
        gridColor:'rgba(100,15,15,0.35)',
        snakeHue:0,          // tono rojo
        foodColor:'#00ffa8',
        foodPulse:true,
        extraFood:true,
        bonusFoodPts:50,
        bonusFoodLife:55,
        obstacles:true,      // bloques obstáculo en el tablero
      },
    ];

    /* ── Helpers ── */
    function freeCell(){
      let p;
      do{p={x:Math.floor(Math.random()*S.cols),y:Math.floor(Math.random()*S.rows)};}
      while(
        S.snake.some(s=>s.x===p.x&&s.y===p.y)||
        (S.obstacles&&S.obstacles.some(o=>o.x===p.x&&o.y===p.y))||
        (S.food&&S.food.x===p.x&&S.food.y===p.y)
      );
      return p;
    }

    function spawnFood(){ S.food=freeCell(); }

    function spawnBonus(){
      if(!S.cfg.extraFood)return;
      S.bonus={...freeCell(),life:S.cfg.bonusFoodLife};
    }

    function buildObstacles(cols,rows){
      const obs=[];
      const n=Math.floor(cols*rows*0.06); // ~6% del tablero
      const cx=Math.floor(cols/2),cy=Math.floor(rows/2);
      for(let i=0;i<n;i++){
        let p;
        do{p={x:Math.floor(Math.random()*cols),y:Math.floor(Math.random()*rows)};}
        while(
          (Math.abs(p.x-cx)<3&&Math.abs(p.y-cy)<3)||
          obs.some(o=>o.x===p.x&&o.y===p.y)
        );
        obs.push(p);
      }
      return obs;
    }

    function buildState(lvlIdx,prevScore){
      const cfg=LEVELS[lvlIdx];
      return{
        lvl:lvlIdx, cfg,
        snake:null, dir:null, nd:null,
        food:null, bonus:null,
        bonusTimer:0,
        obstacles:null,
        score:prevScore||0,
        cols:0,rows:0,
        interval:cfg.interval,
        over:false,won:false,
        levelCleared:false,levelTimer:0,
        started:false,
      };
    }

    /* ── Tick ── */
    function tick(){
      if(!S||S.over)return;
      if(!S.started){draw();return;}
      if(S.levelCleared){ draw(); return; }

      /* Bonus food countdown */
      if(S.bonus){
        S.bonus.life--;
        if(S.bonus.life<=0)S.bonus=null;
      }
      /* Spawn bonus periódicamente */
      if(S.cfg.extraFood&&!S.bonus&&Math.random()<0.004)spawnBonus();

      S.dir=S.nd;
      let nx=S.snake[0].x+S.dir.x;
      let ny=S.snake[0].y+S.dir.y;

      /* Paredes */
      if(S.cfg.walls){
        if(nx<0||nx>=S.cols||ny<0||ny>=S.rows){
          S.over=true;draw();showGameMsg('💀 GAME OVER','Chocaste con la pared · Score: '+S.score);return;
        }
      } else {
        nx=(nx+S.cols)%S.cols; ny=(ny+S.rows)%S.rows;
      }
      const h={x:nx,y:ny};

      /* Auto-colisión */
      if(S.snake.some(s=>s.x===h.x&&s.y===h.y)){
        S.over=true;draw();showGameMsg('💀 GAME OVER','Te mordiste · Score: '+S.score);return;
      }
      /* Obstáculos */
      if(S.obstacles&&S.obstacles.some(o=>o.x===h.x&&o.y===h.y)){
        S.over=true;draw();showGameMsg('💀 GAME OVER','Chocaste con un bloque · Score: '+S.score);return;
      }

      S.snake.unshift(h);
      let grew=false;

      /* Comer comida normal */
      if(h.x===S.food.x&&h.y===S.food.y){
        S.score+=S.cfg.foodPts*(S.lvl+1);
        grew=true; spawnFood();
        updateScore('NVL '+(S.lvl+1)+' · '+S.score+' LARGO '+S.snake.length+'/'+S.cfg.winLen);
        /* Acelerar */
        if(S.score%(S.cfg.accelEvery*(S.lvl+1))===0&&S.interval>S.cfg.minInterval){
          clearInterval(iv); S.interval=Math.max(S.cfg.minInterval,S.interval-S.cfg.accelStep);
          iv=setInterval(tick,S.interval);
        }
        /* ¿Nivel completado? */
        if(S.snake.length>=S.cfg.winLen&&!S.levelCleared){
          S.score+=S.cfg.waveBonus;
          S.levelCleared=true;
          updateScore('NVL '+(S.lvl+1)+' · '+S.score);
          clearInterval(iv); iv=null;
          setTimeout(()=>{
            if(!S||!S.levelCleared) return;
            const next=S.lvl+1;
            if(next>=LEVELS.length){S.over=true;draw();showGameMsg('🏆 ¡MAESTRO SNAKE!','Score final: '+S.score);return;}
            initLevel(next,S.score);
          }, 2200);
        }
      }

      /* Comer comida bonus */
      if(S.bonus&&h.x===S.bonus.x&&h.y===S.bonus.y){
        S.score+=S.cfg.bonusFoodPts*(S.lvl+1);
        grew=true; S.bonus=null;
        updateScore('NVL '+(S.lvl+1)+' · '+S.score+' LARGO '+S.snake.length+'/'+S.cfg.winLen);
      }

      if(!grew)S.snake.pop();
      draw();
    }

    /* ── Draw ── */
    function draw(){
      if(!S)return;
      ctx.fillStyle='#020b10';ctx.fillRect(0,0,cv.width,cv.height);

      /* Pantalla de inicio */
      if(!S.started){
        ctx.textAlign='center';
        const cfg=S.cfg;
        const snakeCol=`hsl(${cfg.snakeHue},85%,52%)`;
        ctx.fillStyle=snakeCol;
        ctx.font=`bold ${Math.max(24,cv.width/13)}px monospace`;
        ctx.fillText('🐍 '+cfg.label,cv.width/2,cv.height/2-65);
        ctx.font=`bold ${Math.max(11,cv.width/34)}px monospace`;
        ctx.fillStyle='rgba(212,160,23,0.85)';
        ctx.fillText('Meta: largo '+cfg.winLen+' · '+cfg.badge,cv.width/2,cv.height/2-28);
        ctx.fillStyle='rgba(255,255,255,0.4)';ctx.font=`${Math.max(10,cv.width/38)}px monospace`;
        ctx.fillText(cfg.walls?'⚠ Hay paredes · No chocas':'↩ Puedes atravesar bordes',cv.width/2,cv.height/2-4);
        if(cfg.obstacles)ctx.fillText('⬛ Evita los bloques',cv.width/2,cv.height/2+16);
        if(cfg.extraFood)ctx.fillText('⭐ Comida bonus aparece y desaparece',cv.width/2,cv.height/2+(cfg.obstacles?36:22));
        ctx.fillStyle='rgba(0,255,168,0.7)';ctx.font=`bold ${Math.max(12,cv.width/30)}px monospace`;
        ctx.fillText('▶ TOCA O PRESIONA TECLA',cv.width/2,cv.height/2+66);
        ctx.textAlign='left';
        return;
      }

      /* Cuadrícula */
      ctx.strokeStyle=S.cfg.gridColor;ctx.lineWidth=0.5;
      for(let x=0;x<cv.width;x+=SZ){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,cv.height);ctx.stroke();}
      for(let y=0;y<cv.height;y+=SZ){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(cv.width,y);ctx.stroke();}

      /* Paredes (borde rojo en niveles con paredes) */
      if(S.cfg.walls){
        ctx.strokeStyle=`hsl(${S.cfg.snakeHue},80%,35%)`;ctx.lineWidth=2;
        ctx.strokeRect(1,1,cv.width-2,cv.height-2);
      }

      /* Obstáculos */
      if(S.obstacles){
        ctx.fillStyle='#1a1a2e';
        S.obstacles.forEach(o=>{
          ctx.fillRect(o.x*SZ+1,o.y*SZ+1,SZ-2,SZ-2);
          ctx.fillStyle='rgba(255,255,255,0.04)';ctx.fillRect(o.x*SZ+1,o.y*SZ+1,SZ-2,4);
          ctx.fillStyle='#1a1a2e';
        });
      }

      /* Comida normal */
      const pulse=0.7+Math.sin(Date.now()*0.008)*0.3;
      ctx.shadowColor=S.cfg.foodColor;ctx.shadowBlur=8*pulse;
      ctx.fillStyle=S.cfg.foodColor;
      ctx.beginPath();ctx.arc(S.food.x*SZ+SZ/2,S.food.y*SZ+SZ/2,SZ*0.38,0,Math.PI*2);ctx.fill();
      ctx.shadowBlur=0;

      /* Comida bonus */
      if(S.bonus){
        const bp=S.bonus.life/S.cfg.bonusFoodLife;
        ctx.shadowColor='#ffd700';ctx.shadowBlur=10;
        ctx.fillStyle=`rgba(255,215,0,${0.5+bp*0.5})`;
        ctx.beginPath();
        ctx.moveTo(S.bonus.x*SZ+SZ/2,S.bonus.y*SZ+2);
        for(let i=0;i<5;i++){
          const a1=Math.PI*2/5*i-Math.PI/2;
          const a2=a1+Math.PI/5;
          ctx.lineTo(S.bonus.x*SZ+SZ/2+Math.cos(a1)*(SZ*0.42),S.bonus.y*SZ+SZ/2+Math.sin(a1)*(SZ*0.42));
          ctx.lineTo(S.bonus.x*SZ+SZ/2+Math.cos(a2)*(SZ*0.22),S.bonus.y*SZ+SZ/2+Math.sin(a2)*(SZ*0.22));
        }
        ctx.closePath();ctx.fill();
        ctx.shadowBlur=0;
      }

      /* Serpiente */
      S.snake.forEach((s,i)=>{
        const t=i/Math.max(1,S.snake.length-1);
        ctx.fillStyle=`hsl(${S.cfg.snakeHue-t*25},85%,${52-t*18}%)`;
        if(ctx.roundRect){ctx.beginPath();ctx.roundRect(s.x*SZ+1,s.y*SZ+1,SZ-2,SZ-2,4);ctx.fill();}
        else ctx.fillRect(s.x*SZ+1,s.y*SZ+1,SZ-2,SZ-2);
        if(i===0){
          ctx.fillStyle='#020b10';
          ctx.fillRect(s.x*SZ+(SZ-S.dir.y*2)/2-S.dir.x*2,s.y*SZ+SZ*0.2-S.dir.y*2,3,3);
          ctx.fillRect(s.x*SZ+(SZ-S.dir.y*2)/2-S.dir.x*2+5,s.y*SZ+SZ*0.2-S.dir.y*2,3,3);
        }
      });

      /* HUD */
      ctx.fillStyle='rgba(212,160,23,0.9)';ctx.font='bold 12px monospace';
      ctx.fillText('NVL '+(S.lvl+1)+' · '+S.score+'  LARGO '+S.snake.length+'/'+S.cfg.winLen,6,15);

      /* Barra de progreso */
      const prog=Math.min(1,S.snake.length/S.cfg.winLen);
      ctx.fillStyle='rgba(11,59,70,0.55)';ctx.fillRect(6,cv.height-9,cv.width-12,5);
      const pg=ctx.createLinearGradient(6,0,6+prog*(cv.width-12),0);
      pg.addColorStop(0,`hsl(${S.cfg.snakeHue},85%,52%)`);
      pg.addColorStop(1,'#d4a017');
      ctx.fillStyle=pg;ctx.fillRect(6,cv.height-9,prog*(cv.width-12),5);

      /* Pantalla de nivel completado */
      if(S.levelCleared){
        ctx.fillStyle='rgba(2,11,16,0.88)';ctx.fillRect(0,0,cv.width,cv.height);
        ctx.textAlign='center';
        const next=S.lvl+1;
        if(next<LEVELS.length){
          ctx.fillStyle=`hsl(${S.cfg.snakeHue},85%,60%)`;
          ctx.font=`bold ${Math.max(16,cv.width/18)}px monospace`;
          ctx.fillText('✅ NIVEL '+(S.lvl+1)+' COMPLETADO',cv.width/2,cv.height/2-30);
          ctx.fillStyle='rgba(212,160,23,0.9)';ctx.font=`bold ${Math.max(12,cv.width/26)}px monospace`;
          ctx.fillText('SCORE: '+S.score+'  +'+S.cfg.waveBonus+' BONUS',cv.width/2,cv.height/2+4);
          ctx.fillStyle='rgba(255,255,255,0.4)';ctx.font=`${Math.max(10,cv.width/36)}px monospace`;
          ctx.fillText('Preparando '+LEVELS[next].label+' '+LEVELS[next].badge+'...',cv.width/2,cv.height/2+28);
        }else{
          ctx.fillStyle='#ffd700';ctx.font=`bold ${Math.max(18,cv.width/14)}px monospace`;
          ctx.fillText('🏆 ¡MAESTRO SNAKE!',cv.width/2,cv.height/2-28);
          ctx.fillStyle='rgba(212,160,23,0.9)';ctx.font=`bold ${Math.max(12,cv.width/22)}px monospace`;
          ctx.fillText('SCORE FINAL: '+S.score,cv.width/2,cv.height/2+6);
        }
        ctx.textAlign='left';
      }
    }

    /* ── initLevel ── */
    function initLevel(lvlIdx,prevScore){
      if(iv){clearInterval(iv);iv=null;}
      S=buildState(lvlIdx,prevScore);
      const cols=Math.floor(cv.width/SZ),rows=Math.floor(cv.height/SZ);
      S.cols=cols;S.rows=rows;
      const cx=Math.floor(cols/2),cy=Math.floor(rows/2);
      S.snake=[{x:cx,y:cy},{x:cx-1,y:cy},{x:cx-2,y:cy}];
      S.dir={x:1,y:0};S.nd={x:1,y:0};
      if(S.cfg.obstacles)S.obstacles=buildObstacles(cols,rows);
      spawnFood();
      // Nivel 2+ arranca solo — no requiere interacción extra del usuario
      if(lvlIdx>0) S.started=true;
      updateScore('NVL '+(lvlIdx+1)+' · '+(prevScore||0)+' LARGO 3/'+S.cfg.winLen);
      draw();
      iv=setInterval(tick,S.interval);
    }

    return{
      init(c){
        cv=c;ctx=c.getContext('2d');
        S=null;
        kh=e=>{
          const m={ArrowUp:{x:0,y:-1},ArrowDown:{x:0,y:1},ArrowLeft:{x:-1,y:0},ArrowRight:{x:1,y:0},
                   w:{x:0,y:-1},s:{x:0,y:1},a:{x:-1,y:0},d:{x:1,y:0}};
          const nd=m[e.key];
          if(nd&&S){
            if(!S.started)S.started=true;
            if(!(nd.x===-S.dir.x&&nd.y===-S.dir.y)){S.nd=nd;e.preventDefault();}
          }
        };
        document.addEventListener('keydown',kh);
        let tx=0,ty=0;
        c.addEventListener('touchstart',e=>{
          tx=e.touches[0].clientX;ty=e.touches[0].clientY;
          if(S&&!S.started)S.started=true;
        },{passive:true});
        c.addEventListener('touchend',e=>{
          if(!S)return;
          const dx=e.changedTouches[0].clientX-tx,dy=e.changedTouches[0].clientY-ty;
          if(Math.abs(dx)<10&&Math.abs(dy)<10)return;
          let nd;
          if(Math.abs(dx)>Math.abs(dy))nd=dx>0?{x:1,y:0}:{x:-1,y:0};
          else nd=dy>0?{x:0,y:1}:{x:0,y:-1};
          if(!(nd.x===-S.dir.x&&nd.y===-S.dir.y))S.nd=nd;
        },{passive:true});
        initLevel(0,0);
      },
      cleanup(){
        if(kh)document.removeEventListener('keydown',kh);
        if(iv){clearInterval(iv);iv=null;}
        S=null;
      }
    };
  })();

  /* ─────────────────── BREAKOUT — 3 Niveles ───────────────── */
  Impls.breakout = (() => {
    let cv,ctx,S,kh,mh,th;

    const LEVELS=[
      {
        label:'NIVEL 1', badge:'🎯',
        bCols:8, bRows:5,
        ballSpd:3.4,           // velocidad inicial bola
        maxBallSpd:8,          // velocidad máxima
        paddleW:88,            // ancho paleta
        hits:1,                // golpes para destruir ladrillo
        waveBonus:300,
        ballColor:'#00ffa8',
        hueStart:190, hueStep:22,
      },
      {
        label:'NIVEL 2', badge:'🎯🎯',
        bCols:9, bRows:6,
        ballSpd:4.0,
        maxBallSpd:9.5,
        paddleW:74,            // paleta más angosta
        hits:1,                // sigue 1 golpe pero hay ladrillos dorados (2 golpes)
        hardRowPct:0.33,       // 33% de filas son duras (2 golpes)
        waveBonus:600,
        ballColor:'#d4a017',
        hueStart:30, hueStep:18,
      },
      {
        label:'NIVEL 3', badge:'🎯🎯🎯',
        bCols:10, bRows:7,
        ballSpd:4.8,
        maxBallSpd:11,
        paddleW:60,            // paleta aún más corta
        hits:1,
        hardRowPct:0.57,       // más de la mitad son duras
        waveBonus:1000,
        ballColor:'#ef5350',
        hueStart:0, hueStep:15,
      },
    ];

    function buildBricks(c, cfg){
      const bW=(c.width-28)/cfg.bCols, bH=Math.min(22,Math.floor((c.height*0.45)/cfg.bRows)), gap=3;
      const bricks=[];
      for(let r=0;r<cfg.bRows;r++){
        const isHard=cfg.hardRowPct&&(r/cfg.bRows)<cfg.hardRowPct;
        const maxHp=isHard?2:1;
        for(let col=0;col<cfg.bCols;col++){
          const hue=cfg.hueStart+r*cfg.hueStep;
          bricks.push({
            x:14+col*bW, y:44+r*(bH+gap),
            w:bW-gap, h:bH,
            hp:maxHp, maxHp,
            col:`hsl(${hue},65%,52%)`,
            hardCol:`hsl(${hue},90%,68%)`,
          });
        }
      }
      return bricks;
    }

    function buildState(c, lvlIdx, prevScore, prevLives){
      const cfg=LEVELS[lvlIdx];
      const spd=cfg.ballSpd;
      const angle=-Math.PI/2 + (Math.random()-0.5)*0.5; // ángulo inicial aleatorio
      return{
        lvl:lvlIdx, cfg,
        paddle:{x:c.width/2-cfg.paddleW/2, y:c.height-28, w:cfg.paddleW, h:12},
        ball:{x:c.width/2, y:c.height-55, vx:Math.cos(angle)*spd, vy:Math.sin(angle)*spd, r:7},
        bricks:buildBricks(c,cfg),
        score:prevScore||0,
        lives:prevLives!==undefined?prevLives:3,
        over:false, levelCleared:false, levelTimer:0,
        frame:0, particles:[],
      };
    }

    function spawnParticles(x,y,color,n){
      for(let i=0;i<n;i++){
        const a=Math.random()*Math.PI*2, spd=1+Math.random()*3;
        S.particles.push({x,y,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd,
          life:28+Math.random()*16, maxLife:44, color});
      }
    }

    function init(c){
      cv=c; ctx=c.getContext('2d');
      S=buildState(c,0,0,3);
      attachControls(c);
      animFrame=requestAnimationFrame(loop);
    }

    function attachControls(c){
      kh=e=>{
        if(e.key==='ArrowLeft') S.paddle.x=Math.max(0,S.paddle.x-20);
        if(e.key==='ArrowRight')S.paddle.x=Math.min(c.width-S.paddle.w,S.paddle.x+20);
      };
      mh=e=>{const r=c.getBoundingClientRect();S.paddle.x=Math.min(Math.max(e.clientX-r.left-S.paddle.w/2,0),c.width-S.paddle.w);};
      th=e=>{e.preventDefault();const r=c.getBoundingClientRect();S.paddle.x=Math.min(Math.max(e.touches[0].clientX-r.left-S.paddle.w/2,0),c.width-S.paddle.w);};
      document.addEventListener('keydown',kh);
      c.addEventListener('mousemove',mh);
      c.addEventListener('touchmove',th,{passive:false});
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
          if(next>=LEVELS.length){S.over=true;draw();gameOver(S.score,true);}
          else{S=buildState(cv,next,S.score,S.lives);}
        }
        return;
      }

      update();
      draw();
    }

    function update(){
      const b=S.ball, p=S.paddle, cfg=S.cfg;

      /* Mover bola */
      b.x+=b.vx; b.y+=b.vy;

      /* Paredes */
      if(b.x-b.r<0){b.x=b.r;b.vx*=-1;}
      if(b.x+b.r>cv.width){b.x=cv.width-b.r;b.vx*=-1;}
      if(b.y-b.r<0){b.y=b.r;b.vy*=-1;}

      /* Paleta */
      if(b.y+b.r>=p.y&&b.y+b.r<=p.y+p.h+5&&b.x>=p.x-5&&b.x<=p.x+p.w+5&&b.vy>0){
        b.vy=-Math.abs(b.vy);
        b.vx=(b.x-(p.x+p.w/2))/p.w*10;  // más ángulo en niveles difíciles
        b.y=p.y-b.r;
        /* Aceleración progresiva con cada rebote */
        const speedup=1.025;
        b.vx*=speedup; b.vy*=speedup;
      }

      /* Límite velocidad */
      const spd=Math.hypot(b.vx,b.vy);
      if(spd>cfg.maxBallSpd){b.vx=b.vx/spd*cfg.maxBallSpd;b.vy=b.vy/spd*cfg.maxBallSpd;}

      /* Bola perdida */
      if(b.y-b.r>cv.height){
        S.lives--;
        updateScore('NVL '+(S.lvl+1)+' · '+S.score+' ♥'+S.lives);
        if(S.lives<=0){S.over=true;draw();gameOver(S.score);return;}
        const angle=-Math.PI/2+(Math.random()-0.5)*0.5;
        const sp=cfg.ballSpd;
        b.x=cv.width/2;b.y=cv.height-60;
        b.vx=Math.cos(angle)*sp;b.vy=Math.sin(angle)*sp;
      }

      /* Colisiones bola-ladrillo */
      for(const br of S.bricks){
        if(br.hp<=0)continue;
        if(b.x+b.r>br.x&&b.x-b.r<br.x+br.w&&b.y+b.r>br.y&&b.y-b.r<br.y+br.h){
          br.hp--;
          const pts=br.maxHp>1?15:10;
          S.score+=pts*(S.lvl+1);
          updateScore('NVL '+(S.lvl+1)+' · '+S.score+' ♥'+S.lives);
          spawnParticles(b.x,b.y,br.hp>0?br.hardCol:br.col,br.hp>0?4:7);

          /* Dirección rebote */
          const oL=b.x+b.r-br.x,oR=br.x+br.w-(b.x-b.r),oT=b.y+b.r-br.y,oB=br.y+br.h-(b.y-b.r);
          if(Math.min(oL,oR)<Math.min(oT,oB))b.vx*=-1;else b.vy*=-1;
          b.vx=Math.max(-cfg.maxBallSpd,Math.min(cfg.maxBallSpd,b.vx));
          break; // un solo ladrillo por frame
        }
      }

      /* Partículas */
      S.particles.forEach(p2=>{p2.x+=p2.vx;p2.y+=p2.vy;p2.vy+=0.08;p2.life--;});
      S.particles=S.particles.filter(p2=>p2.life>0);

      /* ¿Todos los ladrillos destruidos? */
      if(S.bricks.every(br=>br.hp<=0)&&!S.levelCleared){
        S.score+=S.cfg.waveBonus;
        S.levelCleared=true;
        S.levelTimer=160;
        updateScore('NVL '+(S.lvl+1)+' · '+S.score);
      }
    }

    function draw(){
      if(!S)return;
      ctx.fillStyle='#020b10'; ctx.fillRect(0,0,cv.width,cv.height);

      /* Ladrillos */
      S.bricks.forEach(br=>{
        if(br.hp<=0)return;
        const isHard=br.maxHp>1;
        ctx.fillStyle=isHard&&br.hp===br.maxHp?br.hardCol:br.col;
        if(ctx.roundRect){ctx.beginPath();ctx.roundRect(br.x,br.y,br.w,br.h,3);ctx.fill();}
        else ctx.fillRect(br.x,br.y,br.w,br.h);
        /* Brillo superior */
        ctx.fillStyle='rgba(255,255,255,0.12)'; ctx.fillRect(br.x+2,br.y+2,br.w-4,4);
        /* Crack en ladrillo duro golpeado */
        if(isHard&&br.hp<br.maxHp){
          ctx.strokeStyle='rgba(0,0,0,0.55)';ctx.lineWidth=1.5;
          ctx.beginPath();ctx.moveTo(br.x+br.w*0.3,br.y+2);ctx.lineTo(br.x+br.w*0.55,br.y+br.h-2);ctx.stroke();
          ctx.beginPath();ctx.moveTo(br.x+br.w*0.6,br.y+2);ctx.lineTo(br.x+br.w*0.4,br.y+br.h-2);ctx.stroke();
        }
      });

      /* Partículas */
      S.particles.forEach(p2=>{
        const a=p2.life/p2.maxLife;
        ctx.fillStyle=p2.color+(Math.floor(a*200).toString(16).padStart(2,'0'));
        ctx.beginPath();ctx.arc(p2.x,p2.y,2.5,0,Math.PI*2);ctx.fill();
      });

      /* Paleta */
      const pg=ctx.createLinearGradient(S.paddle.x,0,S.paddle.x+S.paddle.w,0);
      pg.addColorStop(0,'#d4a017');pg.addColorStop(1,'#c25b12');ctx.fillStyle=pg;
      if(ctx.roundRect){ctx.beginPath();ctx.roundRect(S.paddle.x,S.paddle.y,S.paddle.w,S.paddle.h,6);ctx.fill();}
      else ctx.fillRect(S.paddle.x,S.paddle.y,S.paddle.w,S.paddle.h);

      /* Bola */
      const bg=ctx.createRadialGradient(S.ball.x-2,S.ball.y-2,1,S.ball.x,S.ball.y,S.ball.r);
      bg.addColorStop(0,'#fff'); bg.addColorStop(1,S.cfg.ballColor);
      ctx.fillStyle=bg;ctx.shadowColor=S.cfg.ballColor;ctx.shadowBlur=8;
      ctx.beginPath();ctx.arc(S.ball.x,S.ball.y,S.ball.r,0,Math.PI*2);ctx.fill();
      ctx.shadowBlur=0;

      /* HUD */
      ctx.fillStyle='rgba(212,160,23,0.9)';ctx.font='bold 13px monospace';
      ctx.fillText('NVL '+(S.lvl+1)+' · SCORE '+S.score+'  ♥ '+S.lives,8,20);
      ctx.textAlign='right';
      ctx.fillStyle='rgba(212,160,23,0.45)';ctx.font='bold 11px monospace';
      ctx.fillText(S.cfg.label+' '+S.cfg.badge,cv.width-6,20);
      ctx.textAlign='left';

      /* Barra de progreso ladrillos */
      const total=S.bricks.length, alive=S.bricks.filter(b=>b.hp>0).length;
      const pct=1-(alive/total);
      ctx.fillStyle='rgba(11,59,70,0.5)';ctx.fillRect(0,cv.height-4,cv.width,4);
      ctx.fillStyle=S.cfg.ballColor;ctx.fillRect(0,cv.height-4,pct*cv.width,4);

      /* Pantalla de nivel completado */
      if(S.levelCleared){
        ctx.fillStyle='rgba(2,11,16,0.85)';ctx.fillRect(0,0,cv.width,cv.height);
        ctx.textAlign='center';
        const next=S.lvl+1;
        if(next<LEVELS.length){
          ctx.fillStyle=S.cfg.ballColor;ctx.font=`bold ${Math.max(17,cv.width/17)}px monospace`;
          ctx.fillText('✅ NIVEL '+(S.lvl+1)+' COMPLETADO',cv.width/2,cv.height/2-30);
          ctx.fillStyle='rgba(212,160,23,0.9)';ctx.font=`bold ${Math.max(12,cv.width/26)}px monospace`;
          ctx.fillText('SCORE: '+S.score+'  +'+S.cfg.waveBonus+' BONUS',cv.width/2,cv.height/2+4);
          ctx.fillStyle='rgba(255,255,255,0.4)';ctx.font=`${Math.max(10,cv.width/36)}px monospace`;
          ctx.fillText('Preparando '+LEVELS[next].label+' '+LEVELS[next].badge+'...',cv.width/2,cv.height/2+28);
        } else {
          ctx.fillStyle='#ffd700';ctx.font=`bold ${Math.max(18,cv.width/14)}px monospace`;
          ctx.fillText('🏆 ¡LEYENDA!',cv.width/2,cv.height/2-28);
          ctx.fillStyle='rgba(212,160,23,0.9)';ctx.font=`bold ${Math.max(12,cv.width/22)}px monospace`;
          ctx.fillText('SCORE FINAL: '+S.score,cv.width/2,cv.height/2+6);
          ctx.fillStyle='rgba(255,255,255,0.35)';ctx.font=`${Math.max(10,cv.width/36)}px monospace`;
          ctx.fillText('¡3 niveles destruidos!',cv.width/2,cv.height/2+28);
        }
        ctx.textAlign='left';
      }
    }

    return{
      init,
      cleanup(){
        if(kh)document.removeEventListener('keydown',kh);
        if(cv){cv.removeEventListener('mousemove',mh);cv.removeEventListener('touchmove',th);}
        S=null;
      }
    };
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


  /* ─────────────────── PONG — 3 Niveles ───────────────────── */
  Impls.pong = (() => {
    let cv,ctx,S,kh,ku,keys={},mh,th,iv;

    const LEVELS=[
      {
        label:'NIVEL 1', badge:'🏓',
        winScore:5,           // puntos para ganar el nivel
        ballSpd:3.5,          // velocidad inicial bola
        maxBallSpd:9,
        cpuSpd:2.8,           // velocidad CPU
        cpuError:8,           // píxeles de margen de error CPU (más = más torpe)
        paddleH:100,          // alto paleta jugador
        cpuH:100,             // alto paleta CPU
        accelPerHit:1.05,     // aceleración por golpe
        ballColor:'#00ffa8',
        cpuColor:'#4a8a99',
        midColor:'rgba(11,59,70,0.7)',
        ptsMult:10,
        waveBonus:150,
      },
      {
        label:'NIVEL 2', badge:'🏓🏓',
        winScore:7,
        ballSpd:4.5,
        maxBallSpd:11,
        cpuSpd:3.8,           // CPU más rápida
        cpuError:4,           // CPU casi perfecta
        paddleH:82,           // paleta jugador más pequeña
        cpuH:88,
        accelPerHit:1.06,
        ballColor:'#d4a017',
        cpuColor:'#7c4dff',
        midColor:'rgba(60,20,80,0.7)',
        ptsMult:15,
        waveBonus:300,
      },
      {
        label:'NIVEL 3', badge:'🏓🏓🏓',
        winScore:9,
        ballSpd:5.8,
        maxBallSpd:14,
        cpuSpd:5.0,           // CPU muy rápida
        cpuError:1,           // CPU casi perfecta
        paddleH:66,           // paleta mucho más pequeña
        cpuH:76,
        accelPerHit:1.07,
        ballColor:'#ef5350',
        cpuColor:'#ef5350',
        midColor:'rgba(80,10,10,0.7)',
        ptsMult:20,
        waveBonus:500,
      },
    ];

    function buildState(lvlIdx, prevScore){
      const cfg=LEVELS[lvlIdx];
      const h=cv.height;
      return{
        lvl:lvlIdx, cfg,
        ball:{x:cv.width/2,y:h/2,
              vx:(Math.random()>0.5?1:-1)*cfg.ballSpd,
              vy:(Math.random()*2-1)*2.2, r:8},
        p1:{x:12,        y:h/2-cfg.paddleH/2, w:13,h:cfg.paddleH, score:0},
        p2:{x:cv.width-25,y:h/2-cfg.cpuH/2,   w:13,h:cfg.cpuH,   score:0},
        score:prevScore||0,
        over:false, levelCleared:false, levelTimer:0,
        particles:[], frame:0,
      };
    }

    function resetBall(){
      const cfg=S.cfg;
      S.ball.x=cv.width/2; S.ball.y=cv.height/2;
      const ang=(Math.random()*0.6-0.3);
      const dir=Math.random()>0.5?1:-1;
      S.ball.vx=Math.cos(ang)*cfg.ballSpd*dir;
      S.ball.vy=Math.sin(ang)*cfg.ballSpd;
    }

    function spawnHitParts(x,y,color){
      for(let i=0;i<8;i++){
        const a=Math.random()*Math.PI*2, sp=1.5+Math.random()*3;
        S.particles.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,
          life:22+Math.random()*14,maxLife:36,color});
      }
    }

    function tick(){
      if(!S||S.over)return;
      S.frame++;
      const b=S.ball, p1=S.p1, p2=S.p2, cfg=S.cfg;

      /* Jugador: teclado */
      const pSpd=7+S.lvl;
      if(keys['ArrowUp']  ||keys['w'])p1.y=Math.max(0,p1.y-pSpd);
      if(keys['ArrowDown']||keys['s'])p1.y=Math.min(cv.height-p1.h,p1.y+pSpd);

      /* Mover bola */
      b.x+=b.vx; b.y+=b.vy;

      /* Techo/suelo */
      if(b.y-b.r<0){b.y=b.r;b.vy*=-1;}
      if(b.y+b.r>cv.height){b.y=cv.height-b.r;b.vy*=-1;}

      /* IA CPU con error proporcional al nivel */
      const cpuCenter=p2.y+p2.h/2;
      const targetY=b.y+(Math.random()-0.5)*cfg.cpuError*2;
      if(cpuCenter<targetY-cfg.cpuError)p2.y=Math.min(cv.height-p2.h,p2.y+cfg.cpuSpd);
      if(cpuCenter>targetY+cfg.cpuError)p2.y=Math.max(0,p2.y-cfg.cpuSpd);

      /* Colisión paleta jugador */
      if(b.x-b.r<=p1.x+p1.w&&b.y>=p1.y-4&&b.y<=p1.y+p1.h+4&&b.vx<0){
        b.vx=Math.abs(b.vx)*cfg.accelPerHit;
        b.vy+=(b.y-(p1.y+p1.h/2))*0.12;
        b.x=p1.x+p1.w+b.r;
        spawnHitParts(p1.x+p1.w,b.y,cfg.ballColor);
      }
      /* Colisión paleta CPU */
      if(b.x+b.r>=p2.x&&b.y>=p2.y-4&&b.y<=p2.y+p2.h+4&&b.vx>0){
        b.vx=-Math.abs(b.vx)*cfg.accelPerHit;
        b.vy+=(b.y-(p2.y+p2.h/2))*0.12;
        b.x=p2.x-b.r;
        spawnHitParts(p2.x,b.y,cfg.cpuColor);
      }

      /* Límite velocidad */
      b.vx=Math.max(-cfg.maxBallSpd,Math.min(cfg.maxBallSpd,b.vx));
      b.vy=Math.max(-cfg.maxBallSpd*0.75,Math.min(cfg.maxBallSpd*0.75,b.vy));

      /* Punto */
      if(b.x-b.r<0){
        p2.score++;
        updateScore('NVL '+(S.lvl+1)+' · TÚ '+p1.score+' — CPU '+p2.score);
        spawnHitParts(0,b.y,'#ef5350');
        resetBall();
      }
      if(b.x+b.r>cv.width){
        p1.score++; S.score+=cfg.ptsMult;
        updateScore('NVL '+(S.lvl+1)+' · TÚ '+p1.score+' — CPU '+p2.score);
        spawnHitParts(cv.width,b.y,cfg.ballColor);
        resetBall();
      }

      /* ¿Alguien llegó al límite? */
      if(p1.score>=cfg.winScore){
        S.score+=cfg.waveBonus;
        S.levelCleared=true;
        clearInterval(iv); iv=null;
        updateScore('NVL '+(S.lvl+1)+' · '+S.score);
        setTimeout(()=>{
          if(!S||!S.levelCleared) return;
          const next=S.lvl+1;
          if(next>=LEVELS.length){S.over=true;draw();gameOver(S.score,true);return;}
          S=buildState(next,S.score);
          iv=setInterval(tick,16);
        },2200);
      }
      if(p2.score>=cfg.winScore){
        S.over=true;
        draw();
        gameOver(S.score, false);
        clearInterval(iv); iv=null;
        return;
      }

      /* Partículas */
      S.particles.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.life--;});
      S.particles=S.particles.filter(p=>p.life>0);

      /* Transición — gestionada por setTimeout */
      if(S.levelCleared){ draw(); return; }

      draw();
    }

    function draw(){
      if(!S)return;
      const W=cv.width, H=cv.height, cfg=S.cfg;
      ctx.fillStyle='#020b10'; ctx.fillRect(0,0,W,H);

      /* Línea central */
      ctx.setLineDash([8,10]);
      ctx.strokeStyle=cfg.midColor; ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(W/2,0);ctx.lineTo(W/2,H);ctx.stroke();
      ctx.setLineDash([]);

      /* Marcador grande */
      ctx.fillStyle='rgba(212,160,23,0.55)';
      ctx.font=`bold ${Math.min(44,W/8)}px monospace`;
      ctx.textAlign='center';
      ctx.fillText(S.p1.score,W/4,54);
      ctx.fillText(S.p2.score,3*W/4,54);

      /* Etiquetas */
      ctx.font='10px monospace'; ctx.fillStyle='rgba(74,106,114,0.7)';
      ctx.fillText('TÚ',W/4,H-6);
      ctx.fillText('CPU',3*W/4,H-6);
      ctx.textAlign='left';

      /* Nivel badge */
      ctx.textAlign='center';
      ctx.fillStyle='rgba(212,160,23,0.35)'; ctx.font='bold 10px monospace';
      ctx.fillText(cfg.label+' '+cfg.badge,W/2,H-6);
      ctx.textAlign='left';

      /* Meta */
      ctx.fillStyle='rgba(212,160,23,0.25)'; ctx.font='10px monospace';
      ctx.textAlign='center';
      ctx.fillText('META: '+cfg.winScore+' puntos',W/2,20);
      ctx.textAlign='left';

      /* Partículas */
      S.particles.forEach(p=>{
        const a=p.life/p.maxLife;
        ctx.fillStyle=p.color+(Math.floor(a*220).toString(16).padStart(2,'0'));
        ctx.beginPath();ctx.arc(p.x,p.y,2.5,0,Math.PI*2);ctx.fill();
      });

      /* Paleta jugador */
      const pg=ctx.createLinearGradient(S.p1.x,0,S.p1.x+S.p1.w,0);
      pg.addColorStop(0,'#d4a017');pg.addColorStop(1,'#c25b12');
      ctx.fillStyle=pg;
      if(ctx.roundRect){ctx.beginPath();ctx.roundRect(S.p1.x,S.p1.y,S.p1.w,S.p1.h,6);ctx.fill();}
      else ctx.fillRect(S.p1.x,S.p1.y,S.p1.w,S.p1.h);

      /* Paleta CPU */
      ctx.fillStyle=cfg.cpuColor;
      if(ctx.roundRect){ctx.beginPath();ctx.roundRect(S.p2.x,S.p2.y,S.p2.w,S.p2.h,6);ctx.fill();}
      else ctx.fillRect(S.p2.x,S.p2.y,S.p2.w,S.p2.h);

      /* Bola */
      const bg2=ctx.createRadialGradient(S.ball.x-2,S.ball.y-2,1,S.ball.x,S.ball.y,S.ball.r);
      bg2.addColorStop(0,'#fff');bg2.addColorStop(1,cfg.ballColor);
      ctx.fillStyle=bg2;
      ctx.shadowColor=cfg.ballColor;ctx.shadowBlur=10;
      ctx.beginPath();ctx.arc(S.ball.x,S.ball.y,S.ball.r,0,Math.PI*2);ctx.fill();
      ctx.shadowBlur=0;

      /* Barras de progreso hacia la meta */
      const barW=W*0.35, barH=4, barY=H-22;
      /* Jugador */
      ctx.fillStyle='rgba(11,59,70,0.5)';ctx.fillRect(W*0.08,barY,barW,barH);
      ctx.fillStyle='#d4a017';ctx.fillRect(W*0.08,barY,(S.p1.score/cfg.winScore)*barW,barH);
      /* CPU */
      ctx.fillStyle='rgba(11,59,70,0.5)';ctx.fillRect(W*0.57,barY,barW,barH);
      ctx.fillStyle=cfg.cpuColor;ctx.fillRect(W*0.57,barY,(S.p2.score/cfg.winScore)*barW,barH);

      /* Pantalla de nivel completado */
      if(S.levelCleared){
        ctx.fillStyle='rgba(2,11,16,0.88)';ctx.fillRect(0,0,W,H);
        ctx.textAlign='center';
        const next=S.lvl+1;
        if(next<LEVELS.length){
          ctx.fillStyle=cfg.ballColor;ctx.font=`bold ${Math.max(16,W/18)}px monospace`;
          ctx.fillText('✅ '+cfg.label+' COMPLETADO',W/2,H/2-32);
          ctx.fillStyle='rgba(212,160,23,0.9)';ctx.font=`bold ${Math.max(12,W/26)}px monospace`;
          ctx.fillText('SCORE: '+S.score+'  +'+cfg.waveBonus+' BONUS',W/2,H/2+2);
          ctx.fillStyle='rgba(255,255,255,0.4)';ctx.font=`${Math.max(10,W/36)}px monospace`;
          ctx.fillText('Preparando '+LEVELS[next].label+' '+LEVELS[next].badge+'...',W/2,H/2+28);
        }else{
          ctx.fillStyle='#ffd700';ctx.font=`bold ${Math.max(18,W/14)}px monospace`;
          ctx.fillText('🏆 ¡CAMPEÓN!',W/2,H/2-28);
          ctx.fillStyle='rgba(212,160,23,0.9)';ctx.font=`bold ${Math.max(12,W/22)}px monospace`;
          ctx.fillText('SCORE FINAL: '+S.score,W/2,H/2+6);
          ctx.fillStyle='rgba(255,255,255,0.3)';ctx.font=`${Math.max(10,W/36)}px monospace`;
          ctx.fillText('¡3 niveles superados!',W/2,H/2+28);
        }
        ctx.textAlign='left';
      }
    }

    return{
      init(c){
        cv=c;ctx=c.getContext('2d');keys={};
        S=buildState(0,0);
        kh=e=>{keys[e.key]=true;};
        ku=e=>{delete keys[e.key];};
        document.addEventListener('keydown',kh);
        document.addEventListener('keyup',ku);
        mh=e=>{const r=c.getBoundingClientRect();S.p1.y=Math.max(0,Math.min(c.height-S.p1.h,e.clientY-r.top-S.p1.h/2));};
        c.addEventListener('mousemove',mh);
        th=e=>{e.preventDefault();const r=c.getBoundingClientRect();S.p1.y=Math.max(0,Math.min(c.height-S.p1.h,e.touches[0].clientY-r.top-S.p1.h/2));};
        c.addEventListener('touchmove',th,{passive:false});
        iv=setInterval(tick,16);
      },
      cleanup(){
        if(kh)document.removeEventListener('keydown',kh);
        if(ku)document.removeEventListener('keyup',ku);
        if(iv){clearInterval(iv);iv=null;}
        if(cv){cv.removeEventListener('mousemove',mh);cv.removeEventListener('touchmove',th);}
        S=null;
      }
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
        pointer-events:none;
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


  /* ─────────────────── MEMORY MATCH — 3 Niveles ───────────── */
  Impls.memory = (() => {

    /* Configuración por nivel */
    const LEVELS=[
      {
        label:'NIVEL 1', badge:'🧠',
        cols:4, pairs:8,           // 4×4 = 16 cartas
        flipBack:900,              // ms antes de voltear cartas incorrectas
        timeLimit:0,               // 0 = sin límite
        syms:['⚛️','🔬','🧬','🌌','⚡','🧲','💡','🔭'],
        accentColor:'#00ffa8',
        waveBonus:200,
      },
      {
        label:'NIVEL 2', badge:'🧠🧠',
        cols:5, pairs:10,          // 5×4 = 20 cartas
        flipBack:700,
        timeLimit:90,              // 90 segundos
        syms:['⚛️','🔬','🧬','🌌','⚡','🧲','💡','🔭','🌡️','🔋'],
        accentColor:'#d4a017',
        waveBonus:400,
      },
      {
        label:'NIVEL 3', badge:'🧠🧠🧠',
        cols:6, pairs:12,          // 6×4 = 24 cartas
        flipBack:500,
        timeLimit:75,              // 75 segundos — ¡presión!
        syms:['⚛️','🔬','🧬','🌌','⚡','🧲','💡','🔭','🌡️','🔋','🧪','🔩'],
        accentColor:'#ef5350',
        waveBonus:700,
      },
    ];

    let S, cont, timerIv=null;

    /* ── Lógica ── */
    function shuffle(arr){
      for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];}
      return arr;
    }

    function buildLevel(lvlIdx, prevScore){
      const cfg=LEVELS[lvlIdx];
      const cards=shuffle([...cfg.syms,...cfg.syms].map((s,i)=>({id:i,sym:s,up:false,ok:false})));
      return{
        lvl:lvlIdx, cfg, cards,
        fl:[], pairs:0, moves:0, locked:false,
        score:prevScore||0,
        timeLeft:cfg.timeLimit||null,
        over:false, levelCleared:false,
      };
    }

    function startTimer(){
      if(timerIv)clearInterval(timerIv);
      if(!S.cfg.timeLimit)return;
      timerIv=setInterval(()=>{
        if(!S||S.over||S.levelCleared){clearInterval(timerIv);return;}
        S.timeLeft--;
        if(S.timeLeft<=0){
          clearInterval(timerIv);
          S.over=true;
          S.timeOut=true;
          render();
        } else {
          /* Solo actualiza el HUD del tiempo sin re-renderizar todo */
          const el=cont.querySelector('#memTimer');
          if(el){
            el.textContent='⏱ '+S.timeLeft+'s';
            el.style.color=S.timeLeft<=15?'#ef5350':S.timeLeft<=30?'#d4a017':'#4a6a72';
          }
        }
      },1000);
    }

    function flip(i){
      if(S.locked||S.cards[i].up||S.cards[i].ok||S.over)return;
      S.cards[i].up=true; S.fl.push(i); render();
      if(S.fl.length===2){
        S.moves++; S.locked=true;
        const[a,b]=S.fl;
        if(S.cards[a].sym===S.cards[b].sym){
          S.cards[a].ok=S.cards[b].ok=true;
          S.pairs++; S.fl=[]; S.locked=false;
          const bonus=Math.max(0,S.cfg.timeLimit?Math.floor(S.timeLeft/3):0);
          S.score+=50*(S.lvl+1)+bonus;
          updateScore('NVL '+(S.lvl+1)+' · '+S.pairs+'/'+S.cfg.pairs+' pares');
          if(S.pairs===S.cfg.pairs){
            clearInterval(timerIv);
            S.score+=S.cfg.waveBonus;
            S.levelCleared=true;
            S.over=true;
          }
          render();
        } else {
          setTimeout(()=>{
            if(!S)return;
            S.cards[a].up=S.cards[b].up=false;
            S.fl=[]; S.locked=false; render();
          }, S.cfg.flipBack);
        }
      }
    }

    /* ── Render ── */
    function render(){
      if(!cont)return;
      const cfg=S.cfg;
      const cardSize=`clamp(${S.lvl===2?'34px':'38px'},${S.lvl===2?'13.5vw':'15vw'},${S.lvl===2?'48px':'56px'})`;
      const fontSize=`clamp(${S.lvl===2?'18px':'22px'},${S.lvl===2?'5vw':'7vw'},${S.lvl===2?'28px':'36px'})`;
      const gridW=`min(${S.lvl===2?'340px':'330px'},96vw)`;

      const timePct=cfg.timeLimit?S.timeLeft/cfg.timeLimit:1;
      const timeColor=S.timeLeft<=15?'#ef5350':S.timeLeft<=30?'#d4a017':'#4a6a72';

      cont.innerHTML=`
        <div style="display:flex;flex-direction:column;align-items:center;padding:12px 4px 20px;width:100%;user-select:none">

          <!-- Header nivel -->
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
            <span style="font-size:12px;color:${cfg.accentColor};font-weight:800;letter-spacing:2px">${cfg.label}</span>
            <span style="font-size:13px">${cfg.badge}</span>
          </div>

          <!-- HUD -->
          <div style="display:flex;gap:18px;align-items:center;margin-bottom:8px;flex-wrap:wrap;justify-content:center">
            <span style="font-size:15px;font-weight:800;color:${cfg.accentColor}">PARES: ${S.pairs}/${cfg.pairs}</span>
            <span style="font-size:13px;color:#4a6a72">MOVS: ${S.moves}</span>
            <span style="font-size:13px;font-weight:700;color:#d4a017">SCORE: ${S.score}</span>
            ${cfg.timeLimit?`<span id="memTimer" style="font-size:13px;font-weight:800;color:${timeColor}">⏱ ${S.timeLeft}s</span>`:''}
          </div>

          <!-- Barra de progreso pares -->
          <div style="width:${gridW};height:5px;background:#0b3b46;border-radius:4px;margin-bottom:10px;overflow:hidden">
            <div style="height:100%;width:${(S.pairs/cfg.pairs)*100}%;background:${cfg.accentColor};border-radius:4px;transition:width 0.3s"></div>
          </div>

          ${cfg.timeLimit?`
          <!-- Barra de tiempo -->
          <div style="width:${gridW};height:4px;background:#0b3b46;border-radius:4px;margin-bottom:10px;overflow:hidden">
            <div style="height:100%;width:${timePct*100}%;background:${S.timeLeft<=15?'#ef5350':S.timeLeft<=30?'#d4a017':'#26c6da'};border-radius:4px;transition:width 0.9s linear"></div>
          </div>`:''}

          <!-- Grid de cartas -->
          <div style="display:grid;grid-template-columns:repeat(${cfg.cols},${cardSize});gap:clamp(5px,1.8vw,10px);width:${gridW};justify-content:center">
            ${S.cards.map((card,i)=>`
              <div data-i="${i}" style="
                width:${cardSize};height:${cardSize};
                background:${card.ok?`rgba(${cfg.accentColor==='#00ffa8'?'0,255,168':'ef5350'===cfg.accentColor.slice(1)?'239,83,80':'212,160,23'},0.08)`:card.up?'#142638':'#0a1e28'};
                border:2px solid ${card.ok?cfg.accentColor+'88':card.up?cfg.accentColor:'#0b3b46'};
                border-radius:12px;display:flex;align-items:center;justify-content:center;
                font-size:${fontSize};cursor:${card.ok?'default':'pointer'};
                -webkit-tap-highlight-color:transparent;
                ${card.up&&!card.ok?'transform:scale(1.08);transition:transform 0.1s;':''}
                ${card.ok?`box-shadow:0 0 12px ${cfg.accentColor}44;`:''}
                box-sizing:border-box;
              ">${card.up||card.ok
                  ? card.sym
                  : `<span style="color:#0b3b46;font-size:clamp(16px,5vw,24px)">◈</span>`
              }</div>`).join('')}
          </div>

          <!-- Estado final -->
          ${S.over?`
          <div style="margin-top:18px;text-align:center">
            ${S.levelCleared?`
              <div style="color:${cfg.accentColor};font-size:15px;font-weight:800;letter-spacing:2px;margin-bottom:4px">
                ${S.lvl<LEVELS.length-1?'✅ ¡NIVEL '+(S.lvl+1)+' SUPERADO!':'🏆 ¡MAESTRO DE LA MEMORIA!'}
              </div>
              <div style="color:#4a6a72;font-size:12px;margin-bottom:12px">
                ${S.moves} movimientos · +${cfg.waveBonus} bonus · SCORE: ${S.score}
              </div>
              ${S.lvl<LEVELS.length-1
                ? `<button id="memNextBtn" style="background:linear-gradient(135deg,${cfg.accentColor},#0b8f6a);border:none;border-radius:10px;color:#020b10;font-size:13px;font-weight:800;padding:10px 22px;cursor:pointer;margin-right:6px;letter-spacing:1px">▶ NIVEL ${S.lvl+2}</button>`
                : ''
              }
              <button onclick="GamesEngine.launch('memory')" style="background:transparent;border:1px solid #0b3b46;border-radius:10px;color:#6b8a91;font-size:12px;font-weight:700;padding:9px 16px;cursor:pointer;margin-right:6px">↺ REINICIAR</button>
              <button onclick="GamesEngine.showSelection()" style="background:transparent;border:1px solid #0b3b46;border-radius:10px;color:#6b8a91;font-size:12px;font-weight:700;padding:9px 14px;cursor:pointer">◀ VOLVER</button>
            `:S.timeOut?`
              <div style="color:#ef5350;font-size:15px;font-weight:800;letter-spacing:2px;margin-bottom:4px">⏰ ¡TIEMPO AGOTADO!</div>
              <div style="color:#4a6a72;font-size:12px;margin-bottom:12px">${S.pairs}/${cfg.pairs} pares · SCORE: ${S.score}</div>
              <button onclick="GamesEngine.launch('memory')" style="background:linear-gradient(135deg,#d4a017,#c25b12);border:none;border-radius:10px;color:#020b10;font-size:13px;font-weight:800;padding:10px 22px;cursor:pointer;margin-right:6px">↺ REINICIAR</button>
              <button onclick="GamesEngine.showSelection()" style="background:transparent;border:1px solid #0b3b46;border-radius:10px;color:#6b8a91;font-size:12px;font-weight:700;padding:9px 16px;cursor:pointer">◀ VOLVER</button>
            `:''}
          </div>`:''}
        </div>`;

      const memNB = cont.querySelector('#memNextBtn');
      if(memNB) memNB.addEventListener('click',()=>nextLevel());
      if(!S.over)
        cont.querySelectorAll('[data-i]').forEach(el=>el.addEventListener('click',()=>flip(+el.dataset.i)));
    }

    /* Exponer función para pasar al siguiente nivel desde el HTML */
    function nextLevel(){
      if(!S||S.lvl>=LEVELS.length-1)return;
      S=buildLevel(S.lvl+1,S.score);
      render();
      startTimer();
    }

    return{
      init(c){
        clearInterval(timerIv);
        cont=c;
        S=buildLevel(0,0);
        render();
        // Sin timer en nivel 1
      },
      nextLevel,
      cleanup(){clearInterval(timerIv);timerIv=null;S=null;}
    };
  })();


  /* ═══════════════════════════════════════════════════════════
     SOPA DE LETRAS — 3 Niveles
  ═══════════════════════════════════════════════════════════ */

  /* ═══════════════════════════════════════════════════════════
     SOPA DE LETRAS — 3 Niveles  (v2 — feedback visual completo)
  ═══════════════════════════════════════════════════════════ */
  Impls.wordsearch = (() => {

    // ── Repositorios amplios de palabras por nivel ──────────────
    const WORD_POOL = {
      1: [
        'ATOMO','FUERZA','LUZ','MASA','ONDA','CALOR','ION','GAS','SOL',
        'PESO','CALOR','RAYO','POLO','ARCO','FLUJO','CAMPO','CARGA','SPIN',
        'NODO','TONO','CAIDA','PULSO','FLUIDO','PRISMA','VAPOR','SUELO',
        'CHOQUE','OPTICA','PLASMA','TIEMPO','RADAR','LASER','FOTON','QUARK',
      ],
      2: [
        'ELECTRON','PROTON','NEUTRON','ENERGIA','VOLTAJE','CIRCUITO','PRESION',
        'DENSIDAD','TENSION','MOMENTO','IMPULSO','TRABAJO','POTENCIA','TORQUE',
        'ENTROPIA','INERCIA','GRAVEDAD','ESPECTRO','PENDULO','FRICCION',
        'REFRACCION','REFLEXION','MAGNETON','INDUCTOR','RESISTOR','CAPACITOR',
        'DIFUSION','COLISION','TURBINA','REACTOR','NEUTRINO','FERMION','BOSON',
        'ORBITA','CALORICO','TERMINO','ISOTOPO','FOSFORO','CUANTICO','FOTON',
      ],
      3: [
        'MAGNETISMO','RESISTENCIA','ACELERACION','GRAVITACION','CAPACITANCIA',
        'INDUCTANCIA','OSCILACION','DIFRACCION','TERMODINAMICA','ELECTROSTTICA',
        'SUPERCONDUCTOR','INTERFERENCIA','RADIOACTIVIDAD','ELECTROMAGNETISMO',
        'RELATIVIDAD','MECANICACUANTICA','TERMONUCLEAR','SEMICONDUCTORES',
        'FISIONNUCLEAR','FUSIONNUCLEAR','SUPERSIMETRIA','ANTIMATERIA',
        'ESPINTRONICA','ASTROFISICA','COSMOLOGIA','ESPECTROSCOPIA',
        'PIEZOELECTRICO','FERROMAGNETICO','DIAMAGNETISMO','PARAMAGNETISMO',
        'SUPERCONDUCTIVIDAD','NANOTECNOLOGIA','CRISTALOGRAFIA',
      ],
    };

    function pickWords(level, count){
      const pool=[...WORD_POOL[level]];
      // Fisher-Yates shuffle
      for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
      return pool.slice(0,count);
    }

    const COLORS_POOL=['#00ffa8','#42a5f5','#ab47bc','#ff7043','#ffd740','#26c6da','#66bb6a','#d4a017','#ef5350','#f48fb1','#80cbc4','#ce93d8','#ffcc80','#80deea','#a5d6a7'];

    const LEVELS = [
      {
        label:'NIVEL 1', badge:'🔤',
        size:9, timeLimit:0, wordCount:7,
        dirs:[[0,1],[1,0],[0,-1],[-1,0],[0,1],[1,0],[0,-1],[-1,0],[1,1],[1,-1]],
        accentColor:'#00ffa8',
        waveBonus:300,
        poolKey:1,
        colors:COLORS_POOL,
      },
      {
        label:'NIVEL 2', badge:'🔤🔤',
        size:12, timeLimit:120, wordCount:8,
        dirs:[[0,1],[1,0],[0,-1],[-1,0],[0,1],[1,0],[1,1],[1,-1],[-1,1],[-1,-1]],
        accentColor:'#d4a017',
        waveBonus:600,
        poolKey:2,
        colors:COLORS_POOL,
      },
      {
        label:'NIVEL 3', badge:'🔤🔤🔤',
        size:15, timeLimit:150, wordCount:10,
        dirs:[[0,1],[1,0],[0,-1],[-1,0],[0,1],[1,0],[1,1],[1,-1],[-1,1],[-1,-1],[-1,1],[-1,-1]],
        accentColor:'#ef5350',
        waveBonus:1000,
        poolKey:3,
        colors:COLORS_POOL,
      },
    ];

    let S, cont, timerIv=null;

    /* ── Construir grilla ──────────────────────────────────── */
    function buildGrid(size, words, dirs){
      const ALPHA='ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const grid=Array.from({length:size},()=>Array(size).fill(''));
      const placed=[];
      const sorted=[...words].sort((a,b)=>b.length-a.length);

      sorted.forEach(word=>{
        const shuffled=[...dirs].sort(()=>Math.random()-0.5);
        for(let att=0;att<200;att++){
          const [dr,dc]=shuffled[att%shuffled.length];
          const r0=Math.floor(Math.random()*size);
          const c0=Math.floor(Math.random()*size);
          const r1=r0+dr*(word.length-1), c1=c0+dc*(word.length-1);
          if(r1<0||r1>=size||c1<0||c1>=size) continue;
          const cells=[];
          let ok=true;
          for(let i=0;i<word.length;i++){
            const r=r0+dr*i, c=c0+dc*i;
            if(grid[r][c]!==''&&grid[r][c]!==word[i]){ok=false;break;}
            cells.push({r,c});
          }
          if(!ok) continue;
          cells.forEach((cell,i)=>{grid[cell.r][cell.c]=word[i];});
          placed.push({word,cells});
          break;
        }
      });

      for(let r=0;r<size;r++)
        for(let c=0;c<size;c++)
          if(grid[r][c]==='') grid[r][c]=ALPHA[Math.floor(Math.random()*ALPHA.length)];

      return {grid,placed};
    }

    /* ── Estado ───────────────────────────────────────────── */
    function buildState(lvlIdx, prevScore){
      const cfg=LEVELS[lvlIdx];
      const words=pickWords(cfg.poolKey, cfg.wordCount);
      const {grid,placed}=buildGrid(cfg.size,words,cfg.dirs);
      return{
        lvl:lvlIdx, cfg, grid, placed,
        words:placed.map(p=>p.word),
        found:[],           // palabras encontradas
        foundColors:{},     // word -> color asignado
        foundCells:{},      // "r,c" -> color de la celda encontrada
        score:prevScore||0,
        timeLeft:cfg.timeLimit||null,
        drag:null,
        flash:null,         // {word, until} — palabra recién encontrada
        over:false, levelCleared:false, timeOut:false,
      };
    }

    /* ── Timer ────────────────────────────────────────────── */
    function startTimer(){
      if(timerIv) clearInterval(timerIv);
      if(!S.cfg.timeLimit) return;
      timerIv=setInterval(()=>{
        if(!S||S.over){clearInterval(timerIv);return;}
        S.timeLeft--;
        updateTimerUI();
        if(S.timeLeft<=0){clearInterval(timerIv);S.over=true;S.timeOut=true;render();}
      },1000);
    }

    function updateTimerUI(){
      const el=cont&&cont.querySelector('#wsTimer');
      if(!el) return;
      el.textContent='⏱ '+S.timeLeft+'s';
      el.style.color=S.timeLeft<=20?'#ef5350':S.timeLeft<=40?'#d4a017':'#4a6a72';
      const bar=cont.querySelector('#wsTimerBar');
      if(bar) bar.style.width=(S.timeLeft/S.cfg.timeLimit*100)+'%';
    }

    /* ── Selección ────────────────────────────────────────── */
    function lineFrom(r0,c0,r1,c1){
      const dr=r1-r0, dc=c1-c0;
      const len=Math.max(Math.abs(dr),Math.abs(dc));
      if(len===0) return [{r:r0,c:c0}];
      if(dr!==0&&dc!==0&&Math.abs(dr)!==Math.abs(dc)) return null;
      const sr=dr===0?0:dr/Math.abs(dr), sc=dc===0?0:dc/Math.abs(dc);
      return Array.from({length:len+1},(_,i)=>({r:r0+sr*i,c:c0+sc*i}));
    }

    function tryMatch(r0,c0,r1,c1){
      const cells=lineFrom(r0,c0,r1,c1);
      if(!cells||cells.length<2) return null;
      const word=cells.map(({r,c})=>S.grid[r][c]).join('');
      // Match solo por string — robusto ante imprecisión del dedo
      const fwd=S.placed.find(p=>!S.found.includes(p.word)&&p.word===word);
      if(fwd) return fwd.word;
      // También aceptar la palabra al revés (arrastre en sentido contrario)
      const rev=word.split('').reverse().join('');
      const bwd=S.placed.find(p=>!S.found.includes(p.word)&&p.word===rev);
      if(bwd) return bwd.word;
      return null;
    }

    /* ── Render principal ─────────────────────────────────── */
    function render(){
      if(!cont||!S) return;
      const cfg=S.cfg, size=cfg.size;

      const cpx=size>=15?'clamp(17px,5.2vw,24px)':size>=12?'clamp(22px,6.5vw,30px)':'clamp(28px,8.5vw,38px)';
      const fpx=size>=15?'clamp(8px,2vw,12px)':size>=12?'clamp(10px,2.5vw,14px)':'clamp(12px,3.2vw,17px)';

      // Celdas del drag actual
      let dragCells=[];
      if(S.drag){
        const c=lineFrom(S.drag.r0,S.drag.c0,S.drag.r,S.drag.c);
        if(c) dragCells=c;
      }

      const timePct=cfg.timeLimit&&S.timeLeft!=null?S.timeLeft/cfg.timeLimit:1;
      const foundN=S.found.length, totalN=S.words.length;
      const pct=foundN/totalN;

      cont.innerHTML=`
<div style="display:flex;flex-direction:column;align-items:center;padding:10px 4px 18px;width:100%;user-select:none;-webkit-user-select:none">

  <!-- Header -->
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
    <span style="font-size:12px;color:${cfg.accentColor};font-weight:800;letter-spacing:2px">${cfg.label} ${cfg.badge}</span>
    ${cfg.timeLimit?`<span id="wsTimer" style="font-size:13px;font-weight:800;color:#4a6a72">⏱ ${S.timeLeft!=null?S.timeLeft:cfg.timeLimit}s</span>`:''}
  </div>

  <!-- Barra de tiempo -->
  ${cfg.timeLimit?`
  <div style="width:min(${size>=15?'420px':'360px'},94vw);height:4px;background:#0b3b46;border-radius:4px;margin-bottom:6px;overflow:hidden">
    <div id="wsTimerBar" style="height:100%;width:${timePct*100}%;background:${S.timeLeft<=20?'#ef5350':S.timeLeft<=40?'#d4a017':'#26c6da'};border-radius:4px;transition:width 0.9s linear"></div>
  </div>`:'<div style="margin-bottom:4px"></div>'}

  <!-- Progreso palabras -->
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;width:min(${size>=15?'420px':'360px'},94vw)">
    <span style="font-size:13px;font-weight:800;color:${cfg.accentColor}">${foundN}/${totalN}</span>
    <div style="flex:1;height:7px;background:#0b3b46;border-radius:4px;overflow:hidden">
      <div style="height:100%;width:${pct*100}%;background:${cfg.accentColor};border-radius:4px;transition:width 0.4s"></div>
    </div>
    <span style="font-size:12px;color:#d4a017;font-weight:700">SCORE: ${S.score}</span>
  </div>

  <!-- Flash palabra encontrada -->
  <div id="wsFlash" style="height:22px;margin-bottom:4px;text-align:center;font-size:13px;font-weight:800;letter-spacing:2px;transition:opacity 0.3s;opacity:${S.flash?1:0};color:${S.flash?S.foundColors[S.flash]||cfg.accentColor:'transparent'}">
    ${S.flash?'✔ '+S.flash:'&nbsp;'}
  </div>

  <!-- Grilla -->
  <div id="wsGrid" style="display:grid;grid-template-columns:repeat(${size},${cpx});gap:2px;background:#0b3b46;padding:4px;border-radius:10px;touch-action:none;cursor:crosshair;pointer-events:auto">
    ${S.grid.map((row,r)=>row.map((L,c)=>{
      const key=r+','+c;
      const foundColor=S.foundCells[key];
      const isDrag=dragCells.some(d=>d.r===r&&d.c===c);
      let bg='#0a1e28', fg='#4a7a8a', brd='transparent', fw='700', shadow='none';
      if(foundColor){
        bg=foundColor+'28'; fg=foundColor; brd=foundColor+'66';
        shadow=`0 0 6px ${foundColor}55`;
      }
      if(isDrag){bg='#1e3f5a'; fg='#ffd740'; brd='#ffd74088'; fw='900';}
      return `<div class="wsc" data-r="${r}" data-c="${c}" style="
        width:${cpx};height:${cpx};background:${bg};
        border:1.5px solid ${brd};border-radius:5px;
        display:flex;align-items:center;justify-content:center;
        font-size:${fpx};font-weight:${fw};color:${fg};
        box-shadow:${shadow};box-sizing:border-box;
        -webkit-tap-highlight-color:transparent;
        transition:background 0.15s,color 0.15s;
      ">${L}</div>`;
    }).join('')).join('')}
  </div>

  <!-- Instrucción dirección -->
  <div style="font-size:10px;color:#2a5a6a;margin-top:5px;text-align:center">
    ${cfg.poolKey===1?'Palabras en horizontal y vertical':'Palabras en todas las direcciones, incluso en diagonal'}
  </div>

  <!-- Lista de palabras -->
  <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;justify-content:center;width:min(${size>=15?'420px':'360px'},94vw)">
    ${S.words.map(w=>{
      const done=S.found.includes(w);
      const col=S.foundColors[w]||cfg.accentColor;
      return `<span style="
        font-size:clamp(9px,2.8vw,13px);font-weight:800;letter-spacing:1px;padding:5px 11px;
        border-radius:8px;transition:all 0.35s;
        background:${done?col:'#0a1e28'};
        color:${done?'#020b10':'#2a5a6a'};
        border:2px solid ${done?col:'#0f3a46'};
        text-decoration:${done?'line-through':'none'};
        box-shadow:${done?`0 0 12px ${col}88`:'none'};
        opacity:${done?'1':'0.6'};
      ">${done?'✔ '+w:w}</span>`;
    }).join('')}
  </div>

  <!-- Estado final -->
  ${S.over?`
  <div style="margin-top:16px;text-align:center">
    ${S.levelCleared?`
      <div style="color:${cfg.accentColor};font-size:15px;font-weight:800;letter-spacing:2px;margin-bottom:6px">
        ${S.lvl<LEVELS.length-1?'✅ ¡NIVEL '+(S.lvl+1)+' COMPLETADO!':'🏆 ¡MAESTRO LÉXICO!'}
      </div>
      <div style="color:#4a6a72;font-size:11px;margin-bottom:12px">+${cfg.waveBonus} bonus · SCORE: ${S.score}</div>
      ${S.lvl<LEVELS.length-1?`<button id="wsNext" style="background:linear-gradient(135deg,${cfg.accentColor},#0a7a5a);border:none;border-radius:10px;color:#020b10;font-size:13px;font-weight:800;padding:10px 20px;cursor:pointer;margin-right:6px">▶ NIVEL ${S.lvl+2}</button>`:''}
      <button onclick="GamesEngine.launch('wordsearch')" style="background:transparent;border:1px solid #0b3b46;border-radius:10px;color:#6b8a91;font-size:12px;padding:9px 14px;cursor:pointer;margin-right:6px">↺ REINICIAR</button>
      <button onclick="GamesEngine.showSelection()" style="background:transparent;border:1px solid #0b3b46;border-radius:10px;color:#6b8a91;font-size:12px;padding:9px 14px;cursor:pointer">◀ VOLVER</button>
    `:`
      <div style="color:#ef5350;font-size:15px;font-weight:800;letter-spacing:2px;margin-bottom:6px">⏰ ¡TIEMPO AGOTADO!</div>
      <div style="color:#4a6a72;font-size:11px;margin-bottom:12px">${S.found.length}/${S.words.length} · SCORE: ${S.score}</div>
      <button onclick="GamesEngine.launch('wordsearch')" style="background:linear-gradient(135deg,#d4a017,#c25b12);border:none;border-radius:10px;color:#020b10;font-size:13px;font-weight:800;padding:10px 20px;cursor:pointer;margin-right:6px">↺ REINICIAR</button>
      <button onclick="GamesEngine.showSelection()" style="background:transparent;border:1px solid #0b3b46;border-radius:10px;color:#6b8a91;font-size:12px;padding:9px 14px;cursor:pointer">◀ VOLVER</button>
    `}
  </div>`:''}
</div>`;

      // Botón siguiente nivel
      const nb=cont.querySelector('#wsNext');
      if(nb) nb.addEventListener('click',nextLevel);

      if(!S.over) attachEvents();
    }

    /* ── Eventos drag ─────────────────────────────────────── */
    function attachEvents(){
      const grid=cont&&cont.querySelector('#wsGrid');
      if(!grid) return;

      function cellFrom(e){
        // changedTouches primero: funciona en touchend (touches queda vacío)
        const t=(e.changedTouches&&e.changedTouches.length)?e.changedTouches[0]
               :(e.touches&&e.touches.length)?e.touches[0]:null;
        const src=t||e;
        if(!src||src.clientX==null) return null;
        const el=document.elementFromPoint(src.clientX,src.clientY);
        if(!el||el.dataset.r==null) return null;
        return {r:+el.dataset.r, c:+el.dataset.c};
      }

      function onStart(e){
        const cell=cellFrom(e); if(!cell) return;
        S.drag={r0:cell.r,c0:cell.c,r:cell.r,c:cell.c};
        updateDragUI();
      }
      function onMove(e){
        e.preventDefault();
        if(!S.drag) return;
        const cell=cellFrom(e); if(!cell) return;
        if(S.drag.r!==cell.r||S.drag.c!==cell.c){S.drag.r=cell.r;S.drag.c=cell.c;updateDragUI();}
      }
      function onEnd(e){
        if(!S.drag) return;
        const cell=cellFrom(e)||{r:S.drag.r,c:S.drag.c};
        const matched=tryMatch(S.drag.r0,S.drag.c0,cell.r,cell.c);
        S.drag=null;
        if(matched&&!S.found.includes(matched)){
          const colorIdx=S.found.length%S.cfg.colors.length;
          const col=S.cfg.colors[colorIdx];
          S.foundColors[matched]=col;
          S.placed.find(p=>p.word===matched).cells.forEach(({r,c})=>{S.foundCells[r+','+c]=col;});
          S.found.push(matched);
          S.score+=matched.length*10*(S.lvl+1)+(S.cfg.timeLimit&&S.timeLeft?Math.floor(S.timeLeft/5):0);
          S.flash=matched;
          setTimeout(()=>{if(S){S.flash=null;const f=cont&&cont.querySelector('#wsFlash');if(f)f.style.opacity='0';}},1800);
          if(S.found.length===S.words.length){
            clearInterval(timerIv);
            S.score+=S.cfg.waveBonus;
            S.levelCleared=true; S.over=true;
          }
          render();
        } else {
          updateDragUI(); // limpiar resaltado drag
        }
      }

      grid.addEventListener('mousedown',onStart);
      grid.addEventListener('mousemove',e=>{if(e.buttons)onMove(e);});
      grid.addEventListener('mouseup',onEnd);
      grid.addEventListener('mouseleave',e=>{if(S.drag)onEnd(e);});
      grid.addEventListener('touchstart',e=>{e.preventDefault();onStart(e);},{passive:false});
      grid.addEventListener('touchmove', e=>{e.preventDefault();onMove(e); },{passive:false});
      grid.addEventListener('touchend',  e=>{e.preventDefault();onEnd(e);  },{passive:false});
    }

    /* Actualiza solo las celdas visualmente durante el drag, sin re-render completo */
    function updateDragUI(){
      if(!cont) return;
      const allCells=cont.querySelectorAll('.wsc');
      const dragCells=[];
      if(S.drag){
        const line=lineFrom(S.drag.r0,S.drag.c0,S.drag.r,S.drag.c);
        if(line) line.forEach(({r,c})=>dragCells.push(r+','+c));
      }
      allCells.forEach(el=>{
        const key=el.dataset.r+','+el.dataset.c;
        const foundCol=S.foundCells[key];
        const isDrag=dragCells.includes(key);
        if(isDrag){
          el.style.background='#1e3f5a'; el.style.color='#ffd740';
          el.style.borderColor='#ffd74088'; el.style.fontWeight='900';
        } else if(foundCol){
          el.style.background=foundCol+'28'; el.style.color=foundCol;
          el.style.borderColor=foundCol+'66'; el.style.fontWeight='700';
          el.style.boxShadow=`0 0 6px ${foundCol}55`;
        } else {
          el.style.background='#0a1e28'; el.style.color='#4a7a8a';
          el.style.borderColor='transparent'; el.style.fontWeight='700';
          el.style.boxShadow='none';
        }
      });
    }

    function nextLevel(){
      clearInterval(timerIv);
      S=buildState(S.lvl+1,S.score);
      render(); startTimer();
    }

    return{
      init(c){clearInterval(timerIv);cont=c;S=buildState(0,0);render();},
      cleanup(){clearInterval(timerIv);timerIv=null;S=null;}
    };
  })();


  /* ═══════════════════════════════════════════════════════════
     TIRO PARABÓLICO — 3 Niveles
  ═══════════════════════════════════════════════════════════ */
  Impls.projectile = (() => {
    const G = 9.8;

    const LEVELS = [
      {
        label:'NIVEL 1', badge:'🎯',
        targets:5, wind:0, heightOffset:0,
        vMin:10, vMax:60, angleHint:true,
        accentColor:'#00ffa8',
        waveBonus:300,
        desc:'Sin viento · Terreno plano',
      },
      {
        label:'NIVEL 2', badge:'🎯🎯',
        targets:5, windRange:[-8,8], heightOffset:0,
        vMin:15, vMax:80, angleHint:false,
        accentColor:'#d4a017',
        waveBonus:600,
        desc:'Con viento aleatorio',
      },
      {
        label:'NIVEL 3', badge:'🎯🎯🎯',
        targets:6, windRange:[-14,14], heightRange:[-30,30],
        vMin:15, vMax:100, angleHint:false,
        accentColor:'#ef5350',
        waveBonus:1000,
        desc:'Viento + altura inicial variable',
      },
    ];

    let S, cont;

    function rnd(a,b){ return a + Math.random()*(b-a); }

    function buildState(lvlIdx, prevScore){
      const cfg = LEVELS[lvlIdx];
      const wind = cfg.windRange ? rnd(...cfg.windRange) : 0;
      const h0   = cfg.heightRange ? rnd(...cfg.heightRange) : 0;
      return {
        lvl:lvlIdx, cfg,
        angle:45, velocity:30,
        wind: parseFloat(wind.toFixed(1)),
        h0: parseFloat(h0.toFixed(1)),
        target: null,
        trail: [],
        result: null,   // 'hit'|'miss'|null
        targetsLeft: cfg.targets,
        score: prevScore||0,
        shots: 0,
        over:false, levelCleared:false,
      };
    }

    function newTarget(state){
      const cfg = state.cfg;
      // Distancia horizontal aleatoria entre 40 y 180 m según nivel
      const minD = 40 + state.lvl*20;
      const maxD = 120 + state.lvl*40;
      state.target = { x: rnd(minD, maxD), tolerance: 5 - state.lvl };
      state.trail = [];
      state.result = null;
    }

    /* Calcular trayectoria completa */
    function calcTrajectory(v0, angleDeg, wind, h0){
      const rad = angleDeg * Math.PI/180;
      const vx0 = v0 * Math.cos(rad);
      const vy0 = v0 * Math.sin(rad);
      const pts = [];
      const dt = 0.05;
      let t = 0;
      while(t < 30){
        const x = vx0*t + 0.5*wind*t*t;
        const y = h0 + vy0*t - 0.5*G*t*t;
        pts.push({x, y, t});
        if(y < 0 && t > 0.1) break;
        t += dt;
      }
      return pts;
    }

    function fire(){
      if(!S || S.result !== null || S.over) return;
      S.shots++;
      const pts = calcTrajectory(S.velocity, S.angle, S.wind, S.h0);
      S.trail = pts;
      const last = pts[pts.length-1];
      const landX = last.x + (last.y < 0 ? 0 : 0); // approximate landing
      // Interpolate exact landing x
      if(pts.length >= 2){
        const p1 = pts[pts.length-2], p2 = pts[pts.length-1];
        const frac = p1.y/(p1.y-p2.y);
        const exactX = p1.x + frac*(p2.x-p1.x);
        const tol = 4 - S.lvl * 0.8;
        const hit = Math.abs(exactX - S.target.x) <= Math.max(2, tol);
        S.result = hit ? 'hit' : 'miss';
        if(hit){
          const bonus = Math.max(0, 50 - S.shots*8);
          S.score += 100*(S.lvl+1) + bonus;
          S.targetsLeft--;
          if(S.targetsLeft <= 0){
            S.score += S.cfg.waveBonus;
            S.levelCleared = true; S.over = true;
          }
        }
      }
      render();
    }

    function nextShot(){
      if(!S || S.levelCleared) return;
      S.shots = 0;
      newTarget(S);
      render();
    }

    function nextLevel(){
      const next = S.lvl+1;
      if(next >= LEVELS.length){ render(); return; }
      S = buildState(next, S.score);
      newTarget(S);
      render();
    }

    /* ── Render ─────────────────────────────────────────────── */
    function render(){
      if(!cont || !S) return;
      const cfg = S.cfg;
      const W = Math.min(cont.clientWidth || cont.parentElement?.clientWidth || 360, 500);
      // Canvas scale: 1px = how many meters
      const maxX = 220 + S.lvl*60;
      const scale = (W - 40) / maxX;
      const canH = Math.min(220, Math.round(W*0.48));

      // Trajectory points in canvas coords
      const originX = 24, originY = canH - 24;
      const h0px = S.h0 * scale;

      function toCanv(x,y){ return { cx: originX + x*scale, cy: originY - y*scale - h0px }; }

      // Build SVG trajectory
      let trailSVG = '';
      if(S.trail.length > 1){
        const d = S.trail.map((p,i)=>{
          const {cx,cy} = toCanv(p.x, Math.max(0,p.y));
          return (i===0?'M':'L')+cx.toFixed(1)+' '+cy.toFixed(1);
        }).join(' ');
        trailSVG = `<path d="${d}" fill="none" stroke="${cfg.accentColor}" stroke-width="2" stroke-dasharray="4 2" opacity="0.8"/>`;

        // Landing marker
        if(S.trail.length >= 2){
          const p1=S.trail[S.trail.length-2], p2=S.trail[S.trail.length-1];
          const frac=p1.y/(p1.y-p2.y);
          const lx=p1.x+frac*(p2.x-p1.x);
          const {cx:lc} = toCanv(lx,0);
          trailSVG += `<circle cx="${lc.toFixed(1)}" cy="${originY}" r="5" fill="${S.result==='hit'?'#00ffa8':'#ef5350'}" opacity="0.9"/>`;
        }
      }

      // Target marker
      let targetSVG = '';
      if(S.target){
        const {cx:tx} = toCanv(S.target.x, 0);
        targetSVG = `
          <rect x="${(tx-8).toFixed(1)}" y="${(originY-18).toFixed(1)}" width="16" height="18" fill="#d4a017" rx="2"/>
          <rect x="${(tx-14).toFixed(1)}" y="${(originY-4).toFixed(1)}" width="28" height="4" fill="#a07010" rx="1"/>
          <text x="${tx.toFixed(1)}" y="${(originY-6).toFixed(1)}" fill="#020b10" font-size="9" text-anchor="middle" font-weight="800">🎯</text>`;
      }

      // Cannon
      const rad = S.angle * Math.PI/180;
      const cannonLen = 22;
      const cx2 = originX + Math.cos(rad)*cannonLen;
      const cy2 = originY - Math.sin(rad)*cannonLen - h0px;
      const cannonSVG = `
        <circle cx="${originX}" cy="${(originY - h0px).toFixed(1)}" r="8" fill="#4a6a72"/>
        <line x1="${originX}" y1="${(originY-h0px).toFixed(1)}" x2="${cx2.toFixed(1)}" y2="${cy2.toFixed(1)}" stroke="#d4a017" stroke-width="5" stroke-linecap="round"/>`;

      // Ground
      const groundSVG = `<line x1="${originX}" y1="${originY}" x2="${W-8}" y2="${originY}" stroke="#0b3b46" stroke-width="2"/>`;

      // Height offset marker
      let heightSVG = '';
      if(Math.abs(S.h0) > 1){
        const hpx = S.h0*scale;
        heightSVG = `
          <line x1="${originX}" y1="${originY}" x2="${originX}" y2="${(originY-hpx).toFixed(1)}" stroke="#ab47bc" stroke-width="1.5" stroke-dasharray="3 2"/>
          <text x="${originX+4}" y="${(originY-hpx/2).toFixed(1)}" fill="#ab47bc" font-size="9">${S.h0>0?'+':''}${S.h0}m</text>`;
      }

      // Physics info box
      const rad2 = S.angle*Math.PI/180;
      const vx = (S.velocity*Math.cos(rad2)).toFixed(1);
      const vy = (S.velocity*Math.sin(rad2)).toFixed(1);
      const tFlight = S.h0>=0
        ? ((vy*1 + Math.sqrt(vy*vy + 2*G*S.h0))/G).toFixed(2)
        : ((vy*1 + Math.sqrt(Math.max(0,vy*vy + 2*G*S.h0)))/G).toFixed(2);
      const xMax = (S.velocity*Math.cos(rad2)*parseFloat(tFlight) + 0.5*S.wind*parseFloat(tFlight)**2).toFixed(1);
      const yMax = (S.h0 + vy*vy/(2*G)).toFixed(1);

      cont.innerHTML = `
<div style="display:flex;flex-direction:column;align-items:center;padding:10px 8px 20px;width:100%;user-select:none;font-family:monospace">

  <!-- Header -->
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
    <span style="font-size:12px;color:${cfg.accentColor};font-weight:800;letter-spacing:2px">${cfg.label} ${cfg.badge}</span>
    <span style="font-size:11px;color:#2a5a6a">${cfg.desc}</span>
  </div>

  <!-- HUD -->
  <div style="display:flex;gap:14px;margin-bottom:8px;flex-wrap:wrap;justify-content:center">
    <span style="font-size:13px;font-weight:800;color:${cfg.accentColor}">🎯 ${S.targetsLeft} blancos</span>
    <span style="font-size:13px;color:#d4a017;font-weight:700">SCORE: ${S.score}</span>
    ${S.wind!==0?`<span style="font-size:12px;color:#ab47bc">💨 Viento: ${S.wind>0?'+':''}${S.wind} m/s²</span>`:''}
  </div>

  <!-- Canvas SVG -->
  <svg width="${W}" height="${canH}" style="background:#020b10;border-radius:10px;border:1px solid #0b3b46;display:block">
    ${groundSVG}${heightSVG}${targetSVG}${trailSVG}${cannonSVG}
    <text x="${W-6}" y="14" fill="rgba(212,160,23,0.4)" font-size="9" text-anchor="end" font-family="monospace">0────${Math.round(maxX/2)}────${maxX} m</text>
  </svg>

  <!-- Ecuaciones en tiempo real -->
  <div style="background:#0a1e28;border:1px solid #0b3b46;border-radius:8px;padding:7px 12px;margin:8px 0;width:min(340px,95vw);display:grid;grid-template-columns:1fr 1fr;gap:3px 14px">
    <span style="font-size:10px;color:#4a7a8a">vₓ = v·cos θ</span>
    <span style="font-size:10px;color:#00ffa8;font-weight:700">${vx} m/s</span>
    <span style="font-size:10px;color:#4a7a8a">vᵧ = v·sin θ</span>
    <span style="font-size:10px;color:#00ffa8;font-weight:700">${vy} m/s</span>
    <span style="font-size:10px;color:#4a7a8a">t vuelo ≈</span>
    <span style="font-size:10px;color:#ffd740;font-weight:700">${tFlight} s</span>
    <span style="font-size:10px;color:#4a7a8a">x máx ≈</span>
    <span style="font-size:10px;color:#ffd740;font-weight:700">${xMax} m</span>
    <span style="font-size:10px;color:#4a7a8a">y máx ≈</span>
    <span style="font-size:10px;color:#ab47bc;font-weight:700">${yMax} m</span>
    ${S.target?`<span style="font-size:10px;color:#4a7a8a">Blanco en</span><span style="font-size:10px;color:#d4a017;font-weight:800">${S.target.x.toFixed(0)} m</span>`:''}
  </div>

  <!-- Botones +/- táctiles grandes para ángulo -->
  <div style="width:min(340px,95vw)">

    <div style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span style="font-size:13px;color:#d4a017;font-weight:800">🎯 Ángulo: ${S.angle}°</span>
        <span style="font-size:10px;color:#2a5a6a">θ = ${S.angle}°</span>
      </div>
      <!-- Track personalizado -->
      <div style="position:relative;height:12px;background:#0b3b46;border-radius:6px;margin-bottom:8px;cursor:pointer" id="trackAngle">
        <div style="position:absolute;left:0;top:0;height:100%;width:${((S.angle-1)/88*100).toFixed(1)}%;background:#d4a017;border-radius:6px;pointer-events:none"></div>
        <div style="position:absolute;top:50%;left:${((S.angle-1)/88*100).toFixed(1)}%;transform:translate(-50%,-50%);width:28px;height:28px;background:#d4a017;border-radius:50%;border:3px solid #020b10;box-shadow:0 0 8px rgba(212,160,23,0.6);pointer-events:none"></div>
      </div>
      <!-- Botones ± grandes -->
      <div style="display:flex;gap:6px">
        <button class="sl-btn" data-sl="a" data-d="-10" style="flex:1;padding:10px 0;background:#0a1e28;border:1px solid #0b3b46;border-radius:8px;color:#d4a017;font-size:18px;font-weight:900;cursor:pointer;-webkit-tap-highlight-color:transparent">−10°</button>
        <button class="sl-btn" data-sl="a" data-d="-1"  style="flex:1;padding:10px 0;background:#0a1e28;border:1px solid #0b3b46;border-radius:8px;color:#d4a017;font-size:18px;font-weight:900;cursor:pointer;-webkit-tap-highlight-color:transparent">−1°</button>
        <button class="sl-btn" data-sl="a" data-d="+1"  style="flex:1;padding:10px 0;background:#0a1e28;border:1px solid #0b3b46;border-radius:8px;color:#d4a017;font-size:18px;font-weight:900;cursor:pointer;-webkit-tap-highlight-color:transparent">+1°</button>
        <button class="sl-btn" data-sl="a" data-d="+10" style="flex:1;padding:10px 0;background:#0a1e28;border:1px solid #0b3b46;border-radius:8px;color:#d4a017;font-size:18px;font-weight:900;cursor:pointer;-webkit-tap-highlight-color:transparent">+10°</button>
      </div>
    </div>

    <div style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span style="font-size:13px;color:#42a5f5;font-weight:800">🚀 Velocidad: ${S.velocity} m/s</span>
        <span style="font-size:10px;color:#2a5a6a">v₀ = ${S.velocity} m/s</span>
      </div>
      <div style="position:relative;height:12px;background:#0b3b46;border-radius:6px;margin-bottom:8px;cursor:pointer" id="trackVel">
        <div style="position:absolute;left:0;top:0;height:100%;width:${((S.velocity-cfg.vMin)/(cfg.vMax-cfg.vMin)*100).toFixed(1)}%;background:#42a5f5;border-radius:6px;pointer-events:none"></div>
        <div style="position:absolute;top:50%;left:${((S.velocity-cfg.vMin)/(cfg.vMax-cfg.vMin)*100).toFixed(1)}%;transform:translate(-50%,-50%);width:28px;height:28px;background:#42a5f5;border-radius:50%;border:3px solid #020b10;box-shadow:0 0 8px rgba(66,165,245,0.6);pointer-events:none"></div>
      </div>
      <div style="display:flex;gap:6px">
        <button class="sl-btn" data-sl="v" data-d="-10" style="flex:1;padding:10px 0;background:#0a1e28;border:1px solid #0b3b46;border-radius:8px;color:#42a5f5;font-size:16px;font-weight:900;cursor:pointer;-webkit-tap-highlight-color:transparent">−10</button>
        <button class="sl-btn" data-sl="v" data-d="-1"  style="flex:1;padding:10px 0;background:#0a1e28;border:1px solid #0b3b46;border-radius:8px;color:#42a5f5;font-size:16px;font-weight:900;cursor:pointer;-webkit-tap-highlight-color:transparent">−1</button>
        <button class="sl-btn" data-sl="v" data-d="+1"  style="flex:1;padding:10px 0;background:#0a1e28;border:1px solid #0b3b46;border-radius:8px;color:#42a5f5;font-size:16px;font-weight:900;cursor:pointer;-webkit-tap-highlight-color:transparent">+1</button>
        <button class="sl-btn" data-sl="v" data-d="+10" style="flex:1;padding:10px 0;background:#0a1e28;border:1px solid #0b3b46;border-radius:8px;color:#42a5f5;font-size:16px;font-weight:900;cursor:pointer;-webkit-tap-highlight-color:transparent">+10</button>
      </div>
    </div>

    ${cfg.angleHint&&S.target?`
    <div style="font-size:10px;color:#1e3a42;text-align:center;margin-bottom:8px">
      💡 Pista: θ óptimo ≈ 45° · sin viento: x = v²·sin(2θ)/g
    </div>`:''}

  </div>

  <!-- Resultado y botones -->
  ${S.result?`
  <div style="text-align:center;margin-bottom:10px">
    <div style="font-size:16px;font-weight:800;letter-spacing:2px;color:${S.result==='hit'?'#00ffa8':'#ef5350'};margin-bottom:4px">
      ${S.result==='hit'?'🎯 ¡IMPACTO!':'💨 FALLADO'}
    </div>
    ${S.result==='hit'&&!S.levelCleared?`<button id="btnNext" style="background:linear-gradient(135deg,#00ffa8,#0b8f6a);border:none;border-radius:10px;color:#020b10;font-size:13px;font-weight:800;padding:10px 24px;cursor:pointer">▶ SIGUIENTE BLANCO</button>`:''}
  </div>`:`
  <button id="btnFire" style="background:linear-gradient(135deg,${cfg.accentColor},#0b6a4a);border:none;border-radius:12px;color:#020b10;font-size:15px;font-weight:800;padding:12px 32px;cursor:pointer;letter-spacing:1px;-webkit-tap-highlight-color:transparent">
    🚀 DISPARAR
  </button>`}

  <!-- Nivel completado -->
  ${S.levelCleared?`
  <div style="margin-top:14px;text-align:center">
    <div style="color:${cfg.accentColor};font-size:15px;font-weight:800;letter-spacing:2px;margin-bottom:4px">
      ${S.lvl<LEVELS.length-1?'✅ ¡NIVEL '+(S.lvl+1)+' COMPLETADO!':'🏆 ¡FÍSICO EXPERTO!'}
    </div>
    <div style="color:#4a6a72;font-size:11px;margin-bottom:12px">+${cfg.waveBonus} bonus · SCORE: ${S.score}</div>
    ${S.lvl<LEVELS.length-1?`<button id="btnNextLvl" style="background:linear-gradient(135deg,${cfg.accentColor},#0a7a5a);border:none;border-radius:10px;color:#020b10;font-size:13px;font-weight:800;padding:10px 20px;cursor:pointer;margin-right:8px">▶ NIVEL ${S.lvl+2}</button>`:''}
    <button onclick="GamesEngine.launch('projectile')" style="background:transparent;border:1px solid #0b3b46;border-radius:10px;color:#6b8a91;font-size:12px;padding:9px 14px;cursor:pointer;margin-right:6px">↺ REINICIAR</button>
    <button onclick="GamesEngine.showSelection()" style="background:transparent;border:1px solid #0b3b46;border-radius:10px;color:#6b8a91;font-size:12px;padding:9px 14px;cursor:pointer">◀ VOLVER</button>
  </div>`:''}
</div>`;

      // Botones +/- ángulo y velocidad
      cont.querySelectorAll('.sl-btn').forEach(btn=>{
        btn.addEventListener('click',()=>{
          const d=+btn.dataset.d;
          if(btn.dataset.sl==='a'){
            S.angle=Math.max(1,Math.min(89,S.angle+d));
          } else {
            S.velocity=Math.max(cfg.vMin,Math.min(cfg.vMax,S.velocity+d));
          }
          S.trail=[]; S.result=null; render();
        });
      });

      // Track táctil — arrastrar el pulgar directamente
      function attachTrack(id, isAngle){
        const track=cont.querySelector('#'+id);
        if(!track) return;
        function setFromTouch(e){
          e.preventDefault();
          const src=e.touches?e.touches[0]:e;
          const rect=track.getBoundingClientRect();
          const pct=Math.max(0,Math.min(1,(src.clientX-rect.left)/rect.width));
          if(isAngle){ S.angle=Math.round(1+pct*88); }
          else { S.velocity=Math.round(cfg.vMin+pct*(cfg.vMax-cfg.vMin)); }
          S.trail=[]; S.result=null; render();
        }
        track.addEventListener('touchstart',setFromTouch,{passive:false});
        track.addEventListener('touchmove', setFromTouch,{passive:false});
        track.addEventListener('mousedown', setFromTouch);
        track.addEventListener('mousemove', e=>{if(e.buttons===1)setFromTouch(e);});
      }
      attachTrack('trackAngle',true);
      attachTrack('trackVel',false);

      const btnFire = cont.querySelector('#btnFire');
      if(btnFire) btnFire.addEventListener('click', fire);
      const btnNext = cont.querySelector('#btnNext');
      if(btnNext) btnNext.addEventListener('click', nextShot);
      const btnNL = cont.querySelector('#btnNextLvl');
      if(btnNL) btnNL.addEventListener('click', nextLevel);
    }

    return {
      init(c){ cont=c; S=buildState(0,0); newTarget(S); render(); },
      cleanup(){ S=null; }
    };
  })();

  /* ═══════════════════════════════════════════════════════════
     QUIZ DE FÍSICA — 3 Niveles
  ═══════════════════════════════════════════════════════════ */
  Impls.quiz = (() => {

    const QUESTION_BANK = {
      1: [
        { q:'¿Cuál es la unidad del Sistema Internacional de Fuerza?', a:1, opts:['Joule','Newton','Pascal','Watt'], exp:'Newton (N) = kg·m/s². El Joule es energía, Pascal presión, Watt potencia.' },
        { q:'¿Qué describe la Primera Ley de Newton?', a:2, opts:['F=ma','Inercia','Acción y reacción','Conservación de energía'], exp:'La Ley de Inercia: un cuerpo en reposo o MRU permanece así si no actúa fuerza neta.' },
        { q:'Un objeto cae desde el reposo. ¿Qué velocidad tiene a los 3 s? (g=10 m/s²)', a:0, opts:['30 m/s','25 m/s','10 m/s','15 m/s'], exp:'v = g·t = 10·3 = 30 m/s.' },
        { q:'¿Cuál es la fórmula del trabajo mecánico?', a:3, opts:['W=mv²','W=Pt','W=mgh','W=F·d·cos θ'], exp:'W = F·d·cos θ. Cuando θ=0°, W=F·d. La fuerza debe tener componente en la dirección del desplazamiento.' },
        { q:'¿Qué tipo de energía tiene un objeto en movimiento?', a:1, opts:['Potencial','Cinética','Térmica','Elástica'], exp:'Ec = ½mv². Depende de la masa y el cuadrado de la velocidad.' },
        { q:'¿Cuánto mide g en la superficie terrestre?', a:2, opts:['10.8 m/s²','8.9 m/s²','9.8 m/s²','11.2 m/s²'], exp:'g ≈ 9.8 m/s² (usamos 10 m/s² como aproximación en cálculos rápidos).' },
        { q:'Un bloque de 5 kg se mueve a 4 m/s. ¿Cuál es su energía cinética?', a:0, opts:['40 J','20 J','80 J','10 J'], exp:'Ec = ½mv² = ½·5·16 = 40 J.' },
        { q:'¿Cuál es la unidad del impulso?', a:3, opts:['J','W','N','kg·m/s'], exp:'Impulso J = F·Δt = Δp. Sus unidades son kg·m/s = N·s.' },
        { q:'¿Qué mide la densidad?', a:1, opts:['Fuerza por área','Masa por volumen','Peso por área','Velocidad por tiempo'], exp:'ρ = m/V. Unidades: kg/m³.' },
        { q:'¿Cuál de estas magnitudes es vectorial?', a:2, opts:['Masa','Temperatura','Velocidad','Densidad'], exp:'La velocidad tiene módulo y dirección. La masa, temperatura y densidad son escalares.' },
        { q:'¿Qué es la presión?', a:0, opts:['Fuerza por unidad de área','Fuerza por unidad de masa','Energía por unidad de tiempo','Masa por unidad de volumen'], exp:'P = F/A. Unidad: Pascal (Pa) = N/m².' },
        { q:'¿Cuál es la unidad de potencia?', a:1, opts:['Joule','Watt','Newton','Pascal'], exp:'W = J/s = kg·m²/s³. 1 caballo de fuerza ≈ 746 W.' },
        { q:'Un auto frena uniformemente de 20 m/s a 0 en 5 s. ¿Cuál es su desaceleración?', a:3, opts:['2 m/s²','6 m/s²','8 m/s²','4 m/s²'], exp:'a = Δv/t = (0-20)/5 = -4 m/s². La magnitud es 4 m/s².' },
        { q:'¿Qué conserva el Principio de Conservación de Momento Lineal?', a:2, opts:['Energía cinética','Fuerza total','Momento total del sistema aislado','Aceleración'], exp:'En un sistema aislado (sin fuerzas externas), el momento total p = Σmv se conserva.' },
        { q:'¿Cuál es la relación entre posición y velocidad?', a:0, opts:['v = dx/dt','v = x·t','v = x²','v = d²x/dt²'], exp:'La velocidad es la derivada de la posición respecto al tiempo. v = dx/dt.' },
      ],
      2: [
        { q:'¿Cuál es la ley de Coulomb para dos cargas puntuales?', a:2, opts:['F=qE','F=kq/r','F=kq₁q₂/r²','F=q·v×B'], exp:'F = k·q₁·q₂/r². k ≈ 9×10⁹ N·m²/C². La fuerza es inversamente proporcional al cuadrado de la distancia.' },
        { q:'¿Qué establece la Ley de Gauss?', a:1, opts:['∮B·dA=0','∮E·dA=Q/ε₀','∮E·dl=-dΦB/dt','∇×B=μ₀J'], exp:'El flujo eléctrico total a través de una superficie cerrada es Q_enc/ε₀.' },
        { q:'¿Cuál es la frecuencia de un péndulo simple de 1 m? (g=9.8 m/s²)', a:3, opts:['2.0 Hz','1.5 Hz','0.8 Hz','0.5 Hz'], exp:'f = (1/2π)√(g/L) = (1/2π)√(9.8/1) ≈ 0.5 Hz.' },
        { q:'¿Qué tipo de onda es el sonido?', a:0, opts:['Longitudinal mecánica','Transversal mecánica','Transversal electromagnética','Longitudinal electromagnética'], exp:'El sonido es una onda de presión longitudinal que necesita medio material para propagarse.' },
        { q:'¿Cuál es la velocidad del sonido en el aire a 20°C?', a:2, opts:['200 m/s','500 m/s','343 m/s','1480 m/s'], exp:'v ≈ 343 m/s en aire a 20°C. En agua ≈ 1480 m/s. Depende del medio y temperatura.' },
        { q:'¿Qué mide el número de Reynolds?', a:1, opts:['Viscosidad','Razón entre fuerzas inerciales y viscosas','Presión en fluidos','Calor específico'], exp:'Re = ρvL/μ. Re < 2300: flujo laminar. Re > 4000: flujo turbulento.' },
        { q:'¿Cuál es la primera ley de la termodinámica?', a:3, opts:['S≥0','PV=nRT','Q=mcΔT','ΔU=Q-W'], exp:'ΔU = Q - W. La variación de energía interna = calor absorbido menos trabajo realizado.' },
        { q:'En un proceso isotérmico, ¿qué es constante?', a:0, opts:['Temperatura','Presión','Volumen','Entropía'], exp:'Isotérmico = temperatura constante. Isobárico = presión. Isocórico = volumen.' },
        { q:'¿Cuál es la velocidad de la luz en el vacío?', a:2, opts:['2×10⁸ m/s','3.5×10⁸ m/s','3×10⁸ m/s','2.5×10⁸ m/s'], exp:'c = 2.998×10⁸ m/s ≈ 3×10⁸ m/s. Es una constante fundamental de la naturaleza.' },
        { q:'¿Qué es el efecto Doppler?', a:1, opts:['Reflexión de luz','Cambio de frecuencia por movimiento relativo','Difracción de ondas','Interferencia destructiva'], exp:'Al acercarse una fuente, f aumenta. Al alejarse, f disminuye. Aplica a sonido y luz.' },
        { q:'¿Cuál es la unidad de capacitancia eléctrica?', a:3, opts:['Ohm','Henry','Tesla','Faradio'], exp:'Faradio (F) = C/V. El Ohm es resistencia, Henry inductancia, Tesla campo magnético.' },
        { q:'¿Qué ley relaciona campo magnético y corriente eléctrica?', a:0, opts:['Ley de Ampère','Ley de Faraday','Ley de Gauss magnética','Ley de Biot-Savart'], exp:'∮B·dl = μ₀I_enc. Ampère relaciona la circulación de B con la corriente encerrada.' },
        { q:'¿Qué es la impedancia en un circuito AC?', a:2, opts:['Solo resistencia','Solo reactancia','Combinación de resistencia y reactancia','Capacitancia total'], exp:'Z = √(R² + X²). Combina resistencia (R) y reactancia (X = XL - XC).' },
        { q:'¿Cuál es la longitud de onda de la luz visible?', a:1, opts:['1-10 nm','380-700 nm','700-1000 nm','0.1-1 nm'], exp:'La luz visible va de ~380 nm (violeta) a ~700 nm (rojo). UV < 380 nm, IR > 700 nm.' },
        { q:'¿Qué es la entropía?', a:3, opts:['Energía total','Calor específico','Temperatura absoluta','Medida del desorden termodinámico'], exp:'S mide el desorden. ΔS = Q_rev/T. La 2ª ley: ΔS_universo ≥ 0.' },
      ],
      3: [
        { q:'¿Cuál es la relación de De Broglie?', a:0, opts:['λ=h/p','λ=hf','λ=E/c','λ=mc²'], exp:'λ = h/p = h/(mv). Toda partícula con momento p tiene longitud de onda asociada.' },
        { q:'¿Qué dice el principio de incertidumbre de Heisenberg?', a:2, opts:['E=hf','hν=φ+Ec','Δx·Δp ≥ ℏ/2','ψ²=probabilidad'], exp:'No se puede conocer simultáneamente posición y momento con precisión arbitraria. Δx·Δp ≥ ℏ/2.' },
        { q:'En relatividad especial, ¿cómo varía la masa relativista?', a:1, opts:['m=m₀/γ','m=γm₀','m=m₀/c²','m=m₀+E/c²'], exp:'m = γm₀ donde γ = 1/√(1-v²/c²). Al acercarse a c, la masa relativista tiende a infinito.' },
        { q:'¿Cuál es la energía del fotón?', a:3, opts:['E=mv²','E=hλ','E=pc','E=hf'], exp:'E = hf = hc/λ. h = 6.626×10⁻³⁴ J·s es la constante de Planck.' },
        { q:'¿Qué describe la ecuación de Schrödinger?', a:0, opts:['La evolución temporal de la función de onda','La masa relativista','La energía de enlace nuclear','El flujo de probabilidad'], exp:'iℏ∂ψ/∂t = Ĥψ. La función de onda ψ contiene toda la información del sistema cuántico.' },
        { q:'¿Cuál es la constante de estructura fina α?', a:2, opts:['1/100','1/10','1/137','1/1000'], exp:'α = e²/(4πε₀ℏc) ≈ 1/137. Mide la intensidad de la interacción electromagnética.' },
        { q:'¿Qué son los bosones de gauge?', a:1, opts:['Partículas de materia','Partículas portadoras de fuerza','Antipartículas','Quarks de segunda generación'], exp:'Fotón (EM), W/Z (débil), gluón (fuerte), gravitón (gravitacional). Tienen espín entero.' },
        { q:'En el modelo estándar, ¿cuántos quarks existen?', a:3, opts:['3','4','5','6'], exp:'Up, down, charm, strange, top, bottom. Se combinan en hadrones (bariones y mesones).' },
        { q:'¿Qué es la constante de Hubble?', a:0, opts:['Tasa de expansión del universo','Energía de enlace nuclear','Constante gravitacional','Frecuencia de rotación galáctica'], exp:'H₀ ≈ 70 km/s/Mpc. Relaciona la velocidad de recesión de galaxias con su distancia.' },
        { q:'¿Cuál es la relación entre energía y masa de Einstein?', a:2, opts:['E=mv','E=mgh','E=mc²','E=mv²'], exp:'E = mc². Implica que masa y energía son equivalentes. c² ≈ 9×10¹⁶ m²/s².' },
        { q:'¿Qué es la radiación de Hawking?', a:1, opts:['Radiación de acreción de agujero negro','Emisión térmica cuántica de agujeros negros','Rayos gamma de pulsares','Radiación de fondo de microondas'], exp:'Efecto cuántico en el horizonte de eventos: pares virtuales donde uno cae y el otro escapa.' },
        { q:'¿Cuál es la temperatura de la radiación de fondo de microondas?', a:3, opts:['10 K','5 K','1 K','2.73 K'], exp:'T_CMB ≈ 2.73 K. Remanente del Big Bang (380,000 años después). Descubierta en 1965.' },
        { q:'¿Qué es la supersimetría (SUSY)?', a:0, opts:['Simetría entre bosones y fermiones','Simetría de carga eléctrica','Invarianza de Lorentz','Simetría de color en QCD'], exp:'SUSY predice un supercompañero para cada partícula. No confirmada experimentalmente aún.' },
        { q:'¿Qué describe la QCD (Cromodinámica Cuántica)?', a:2, opts:['Interacción electromagnética','Interacción débil','Interacción fuerte entre quarks','Gravedad cuántica'], exp:'QCD describe la fuerza fuerte con gluones como mediadores y carga de color (RGB).' },
        { q:'¿Cuántas dimensiones propone la teoría de cuerdas M?', a:1, opts:['10','11','12','26'], exp:'La teoría M (unificación de las 5 teorías de cuerdas) requiere 11 dimensiones espacio-temporales.' },
      ],
    };

    const LEVEL_CFG = [
      { label:'NIVEL 1', badge:'🧪', topic:'Mecánica Clásica', color:'#00ffa8', timePerQ:25, qCount:8, poolKey:1, waveBonus:400 },
      { label:'NIVEL 2', badge:'🧪🧪', topic:'Ondas · Termodinámica · Electromagnetismo', color:'#d4a017', timePerQ:20, qCount:8, poolKey:2, waveBonus:700 },
      { label:'NIVEL 3', badge:'🧪🧪🧪', topic:'Física Moderna · Cuántica · Cosmología', color:'#ef5350', timePerQ:18, qCount:8, poolKey:3, waveBonus:1200 },
    ];

    let S, cont, timerIv=null;

    function shuffle(arr){ for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];}return arr; }

    function buildState(lvlIdx, prevScore){
      const cfg = LEVEL_CFG[lvlIdx];
      const pool = shuffle([...QUESTION_BANK[cfg.poolKey]]).slice(0, cfg.qCount);
      return {
        lvl:lvlIdx, cfg, pool,
        qIdx:0, score:prevScore||0,
        streak:0, maxStreak:0,
        chosen:null, showExp:false,
        timeLeft:cfg.timePerQ,
        correct:0, wrong:0,
        over:false, levelCleared:false,
      };
    }

    function startTimer(){
      if(timerIv) clearInterval(timerIv);
      timerIv = setInterval(()=>{
        if(!S||S.showExp||S.over){return;}
        S.timeLeft--;
        const el = cont&&cont.querySelector('#qTimer');
        if(el){
          el.textContent = S.timeLeft+'s';
          el.style.color = S.timeLeft<=5?'#ef5350':S.timeLeft<=10?'#d4a017':'#4a6a72';
        }
        const bar = cont&&cont.querySelector('#qTimerBar');
        if(bar) bar.style.width = (S.timeLeft/S.cfg.timePerQ*100)+'%';
        if(S.timeLeft<=0){
          clearInterval(timerIv);
          S.chosen=-1; S.showExp=true;
          S.streak=0; S.wrong++;
          render();
        }
      },1000);
    }

    function choose(idx){
      if(!S||S.showExp||S.chosen!==null) return;
      clearInterval(timerIv);
      S.chosen = idx;
      S.showExp = true;
      const q = S.pool[S.qIdx];
      if(idx === q.a){
        const bonus = Math.floor(S.timeLeft*2*(S.lvl+1));
        const streakBonus = S.streak>=2 ? S.streak*10 : 0;
        S.score += 100*(S.lvl+1) + bonus + streakBonus;
        S.streak++; S.correct++;
        if(S.streak>S.maxStreak) S.maxStreak=S.streak;
      } else {
        S.streak=0; S.wrong++;
      }
      render();
    }

    function nextQuestion(){
      if(!S) return;
      S.qIdx++;
      if(S.qIdx >= S.pool.length){
        clearInterval(timerIv);
        S.score += S.cfg.waveBonus;
        S.levelCleared = true; S.over = true;
        render(); return;
      }
      S.chosen=null; S.showExp=false; S.timeLeft=S.cfg.timePerQ;
      render();
      startTimer();
    }

    function nextLevel(){
      clearInterval(timerIv);
      S = buildState(S.lvl+1, S.score);
      render();
      startTimer();
    }

    function renderFinal(){
      if(!cont||!S) return;
      clearInterval(timerIv);
      const cfg = S.cfg;
      cont.innerHTML = `
<div style="display:flex;flex-direction:column;align-items:center;padding:20px 12px;width:100%;text-align:center">
  <div style="font-size:48px;margin-bottom:10px">${S.lvl<LEVEL_CFG.length-1?'✅':'🏆'}</div>
  <div style="font-size:16px;font-weight:800;letter-spacing:2px;color:${cfg.color};margin-bottom:6px">
    ${S.lvl<LEVEL_CFG.length-1?'¡NIVEL '+(S.lvl+1)+' COMPLETADO!':'¡DOCTOR EN FÍSICA!'}
  </div>
  <div style="background:#0a1e28;border:1px solid #0b3b46;border-radius:12px;padding:14px 20px;margin:14px 0;width:min(320px,90vw)">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div style="text-align:center">
        <div style="font-size:28px;font-weight:900;color:#00ffa8">${S.correct}</div>
        <div style="font-size:10px;color:#4a6a72">CORRECTAS</div>
      </div>
      <div style="text-align:center">
        <div style="font-size:28px;font-weight:900;color:#ef5350">${S.wrong}</div>
        <div style="font-size:10px;color:#4a6a72">INCORRECTAS</div>
      </div>
      <div style="text-align:center">
        <div style="font-size:28px;font-weight:900;color:#ffd740">${S.maxStreak}</div>
        <div style="font-size:10px;color:#4a6a72">RACHA MAX</div>
      </div>
      <div style="text-align:center">
        <div style="font-size:28px;font-weight:900;color:#d4a017">${S.score}</div>
        <div style="font-size:10px;color:#4a6a72">SCORE FINAL</div>
      </div>
    </div>
    <div style="margin-top:10px;font-size:11px;color:#2a5a6a">+${cfg.waveBonus} bonus de nivel incluido</div>
  </div>
  <div style="display:flex;flex-direction:column;gap:8px;width:min(280px,85vw)">
    ${S.lvl<LEVEL_CFG.length-1?`<button id="btnNL" style="background:linear-gradient(135deg,${cfg.color},#0a6a4a);border:none;border-radius:12px;color:#020b10;font-size:14px;font-weight:800;padding:13px 20px;cursor:pointer;-webkit-tap-highlight-color:transparent">▶ NIVEL ${S.lvl+2}: ${LEVEL_CFG[S.lvl+1].topic.split('·')[0].trim()}</button>`:''}
    <button onclick="GamesEngine.launch('quiz')" style="background:transparent;border:1px solid #0b3b46;border-radius:12px;color:#6b8a91;font-size:13px;padding:11px;cursor:pointer">↺ REINICIAR DESDE NIVEL 1</button>
    <button onclick="GamesEngine.showSelection()" style="background:transparent;border:1px solid #0b3b46;border-radius:12px;color:#6b8a91;font-size:13px;padding:11px;cursor:pointer">◀ SELECCIÓN DE JUEGOS</button>
  </div>
</div>`;
      const bnl = cont.querySelector('#btnNL');
      if(bnl) bnl.addEventListener('click', nextLevel);
    }

    function render(){
      if(!cont||!S) return;
      const cfg = S.cfg;
      // Si ya se terminaron todas las preguntas, mostrar solo la pantalla de resultados
      if(S.over && S.levelCleared && S.qIdx >= S.pool.length){
        renderFinal(); return;
      }
      const q = S.pool[S.qIdx];
      if(!q) return; // guard extra
      const progress = S.qIdx/S.pool.length;
      const timePct = S.timeLeft/cfg.timePerQ;

      cont.innerHTML = `
<div style="display:flex;flex-direction:column;align-items:center;padding:12px 8px 20px;width:100%;user-select:none">

  <!-- Header -->
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap;justify-content:center">
    <span style="font-size:12px;color:${cfg.color};font-weight:800;letter-spacing:2px">${cfg.label} ${cfg.badge}</span>
    <span style="font-size:10px;color:#2a5a6a;text-align:center">${cfg.topic}</span>
  </div>

  <!-- Progreso preguntas -->
  <div style="display:flex;align-items:center;gap:8px;width:min(380px,95vw);margin-bottom:6px">
    <span style="font-size:11px;color:${cfg.color};font-weight:800;white-space:nowrap">${S.qIdx+1}/${S.pool.length}</span>
    <div style="flex:1;height:6px;background:#0b3b46;border-radius:4px;overflow:hidden">
      <div style="height:100%;width:${progress*100}%;background:${cfg.color};border-radius:4px;transition:width 0.4s"></div>
    </div>
    <span style="font-size:11px;color:#d4a017;font-weight:700;white-space:nowrap">SCORE ${S.score}</span>
  </div>

  <!-- Timer -->
  <div style="display:flex;align-items:center;gap:8px;width:min(380px,95vw);margin-bottom:10px">
    <span id="qTimer" style="font-size:13px;font-weight:800;color:#4a6a72;width:32px">${S.timeLeft}s</span>
    <div style="flex:1;height:4px;background:#0b3b46;border-radius:4px;overflow:hidden">
      <div id="qTimerBar" style="height:100%;width:${timePct*100}%;background:${S.timeLeft<=5?'#ef5350':S.timeLeft<=10?'#d4a017':'#26c6da'};border-radius:4px;transition:width 0.9s linear"></div>
    </div>
    ${S.streak>=2?`<span style="font-size:11px;color:#ffd740;font-weight:800">🔥×${S.streak}</span>`:'<span style="width:36px"></span>'}
  </div>

  <!-- HUD aciertos/fallos -->
  <div style="display:flex;gap:16px;margin-bottom:10px">
    <span style="font-size:12px;color:#00ffa8;font-weight:800">✔ ${S.correct}</span>
    <span style="font-size:12px;color:#ef5350;font-weight:800">✘ ${S.wrong}</span>
    ${S.maxStreak>=3?`<span style="font-size:11px;color:#ffd740">🏅 Racha: ${S.maxStreak}</span>`:''}
  </div>

  <!-- Pregunta -->
  <div style="background:#0a1e28;border:1px solid #0b3b46;border-radius:12px;padding:14px 16px;margin-bottom:12px;width:min(380px,95vw);text-align:center">
    <div style="font-size:clamp(12px,3.5vw,15px);color:#d0e8f0;font-weight:700;line-height:1.5">${q.q}</div>
  </div>

  <!-- Opciones -->
  <div style="display:flex;flex-direction:column;gap:8px;width:min(380px,95vw)">
    ${q.opts.map((opt,i)=>{
      let bg='#0a1e28', border='#0b3b46', color='#7ab0c0', icon='';
      if(S.showExp){
        if(i===q.a){ bg='rgba(0,255,168,0.15)'; border='#00ffa8'; color='#00ffa8'; icon='✔ '; }
        else if(i===S.chosen){ bg='rgba(239,83,80,0.15)'; border='#ef5350'; color='#ef5350'; icon='✘ '; }
        else { color='#1e3a42'; }
      }
      return `<button data-i="${i}" style="
        background:${bg};border:2px solid ${border};border-radius:10px;
        color:${color};font-size:clamp(12px,3.2vw,14px);font-weight:700;
        padding:12px 14px;text-align:left;cursor:${S.showExp?'default':'pointer'};
        -webkit-tap-highlight-color:transparent;transition:all 0.2s;
        width:100%;
      ">${icon}${String.fromCharCode(65+i)}) ${opt}</button>`;
    }).join('')}
  </div>

  <!-- Explicación -->
  ${S.showExp?`
  <div style="background:${S.chosen===q.a?'rgba(0,255,168,0.08)':'rgba(239,83,80,0.08)'};border:1px solid ${S.chosen===q.a?'#00ffa855':'#ef535055'};border-radius:10px;padding:10px 14px;margin-top:10px;width:min(380px,95vw)">
    <div style="font-size:11px;color:#4a7a8a;margin-bottom:3px;font-weight:800">💡 EXPLICACIÓN</div>
    <div style="font-size:clamp(11px,3vw,13px);color:#7ab0c0;line-height:1.5">${q.exp}</div>
  </div>
  <button id="btnNextQ" style="background:linear-gradient(135deg,${cfg.color},#0a6a4a);border:none;border-radius:10px;color:#020b10;font-size:13px;font-weight:800;padding:11px 28px;cursor:pointer;margin-top:12px;-webkit-tap-highlight-color:transparent">
    ${S.qIdx+1<S.pool.length?'SIGUIENTE ▶':'VER RESULTADO ▶'}
  </button>`:''}

  <!-- Final -->
  ${S.over&&S.levelCleared?`
  <div style="margin-top:14px;text-align:center">
    <div style="color:${cfg.color};font-size:15px;font-weight:800;letter-spacing:2px;margin-bottom:4px">
      ${S.lvl<LEVEL_CFG.length-1?'✅ ¡NIVEL '+(S.lvl+1)+' COMPLETADO!':'🏆 ¡DOCTOR EN FÍSICA!'}
    </div>
    <div style="color:#4a6a72;font-size:11px;margin-bottom:12px">
      ${S.correct}/${S.pool.length} correctas · Racha max: ${S.maxStreak} · +${cfg.waveBonus} bonus · SCORE: ${S.score}
    </div>
    ${S.lvl<LEVEL_CFG.length-1?`<button id="btnNL" style="background:linear-gradient(135deg,${cfg.color},#0a6a4a);border:none;border-radius:10px;color:#020b10;font-size:13px;font-weight:800;padding:10px 20px;cursor:pointer;margin-right:8px">▶ NIVEL ${S.lvl+2}</button>`:''}
    <button onclick="GamesEngine.launch('quiz')" style="background:transparent;border:1px solid #0b3b46;border-radius:10px;color:#6b8a91;font-size:12px;padding:9px 14px;cursor:pointer;margin-right:6px">↺ REINICIAR</button>
    <button onclick="GamesEngine.showSelection()" style="background:transparent;border:1px solid #0b3b46;border-radius:10px;color:#6b8a91;font-size:12px;padding:9px 14px;cursor:pointer">◀ VOLVER</button>
  </div>`:''}
</div>`;

      // Eventos opciones
      if(!S.showExp){
        cont.querySelectorAll('[data-i]').forEach(btn=>{
          btn.addEventListener('click',()=>choose(+btn.dataset.i));
        });
      }
      const bnq = cont.querySelector('#btnNextQ');
      if(bnq) bnq.addEventListener('click', nextQuestion);
      const bnl = cont.querySelector('#btnNL');
      if(bnl) bnl.addEventListener('click', nextLevel);
    }

    return {
      init(c){
        clearInterval(timerIv);
        cont=c; S=buildState(0,0);
        render(); startTimer();
      },
      cleanup(){ clearInterval(timerIv); timerIv=null; S=null; }
    };
  })();

  /* ═══════════════════════════════════════════════════════════
     GUÍA LA BOLA — 10 Niveles
     Dibuja líneas para guiar la bola al recipiente.
     Física real: gravedad, reflexión, momento.
  ═══════════════════════════════════════════════════════════ */

  /* ═══════════════════════════════════════════════════════════
     GUÍA LA BOLA — 10 Niveles  (v3 — mobile-first fix)
  ═══════════════════════════════════════════════════════════ */
  Impls.ballguide = (() => {

    const G         = 0.30;
    const BALL_R    = 11;
    const REST      = 0.62;
    const FRICTION  = 0.985;

    const LEVELS = [
      { label:'Nivel 1',  concept:'Caída Libre',
        hint:'Dibuja 1 línea inclinada para desviar la bola',
        maxLines:1, waveBonus:150,
        ball:{px:14,py:10,vx:2.0,vy:0},
        bucket:{px:74,py:80,pw:16}, statics:[] },

      { label:'Nivel 2',  concept:'Plano Inclinado',
        hint:'La plataforma bloquea el camino directo',
        maxLines:1, waveBonus:200,
        ball:{px:50,py:8,vx:0,vy:0},
        bucket:{px:84,py:80,pw:14},
        statics:[{x1:8,y1:46,x2:66,y2:46}] },

      { label:'Nivel 3',  concept:'Conservación de Momento',
        hint:'Aprovecha el impulso horizontal',
        maxLines:2, waveBonus:250,
        ball:{px:8,py:18,vx:3.2,vy:0},
        bucket:{px:80,py:80,pw:13},
        statics:[{x1:32,y1:52,x2:68,y2:52}] },

      { label:'Nivel 4',  concept:'Doble Reflexión',
        hint:'Necesitas dos rebotes consecutivos',
        maxLines:2, waveBonus:320,
        ball:{px:50,py:8,vx:0,vy:0},
        bucket:{px:12,py:80,pw:13},
        statics:[{x1:28,y1:36,x2:78,y2:36},{x1:22,y1:60,x2:70,y2:60}] },

      { label:'Nivel 5',  concept:'Energía Potencial',
        hint:'Convierte energía potencial en cinética',
        maxLines:2, waveBonus:380,
        ball:{px:8,py:10,vx:0,vy:0},
        bucket:{px:86,py:80,pw:12},
        statics:[{x1:18,y1:30,x2:52,y2:30},{x1:48,y1:55,x2:82,y2:55}] },

      { label:'Nivel 6',  concept:'Plataformas Escalonadas',
        hint:'Navega entre tres plataformas en zigzag',
        maxLines:3, waveBonus:450,
        ball:{px:50,py:8,vx:0,vy:0},
        bucket:{px:88,py:80,pw:11},
        statics:[{x1:8,y1:30,x2:46,y2:30},{x1:54,y1:50,x2:92,y2:50},{x1:8,y1:68,x2:46,y2:68}] },

      { label:'Nivel 7',  concept:'Ángulo de Reflexión',
        hint:'θᵢ = θᵣ — la incidencia iguala la reflexión',
        maxLines:2, waveBonus:520,
        ball:{px:50,py:8,vx:0,vy:0},
        bucket:{px:50,py:80,pw:10},
        statics:[{x1:14,y1:22,x2:44,y2:58},{x1:56,y1:58,x2:86,y2:22}] },

      { label:'Nivel 8',  concept:'Trayectoria Compleja',
        hint:'Tres plataformas forman un laberinto',
        maxLines:3, waveBonus:600,
        ball:{px:8,py:12,vx:2.8,vy:0},
        bucket:{px:86,py:80,pw:9},
        statics:[{x1:24,y1:34,x2:56,y2:34},{x1:44,y1:56,x2:78,y2:56},{x1:18,y1:72,x2:52,y2:72}] },

      { label:'Nivel 9',  concept:'Precisión Extrema',
        hint:'Recipiente muy estrecho — calcula el ángulo exacto',
        maxLines:3, waveBonus:750,
        ball:{px:50,py:8,vx:0,vy:0},
        bucket:{px:18,py:80,pw:8},
        statics:[{x1:32,y1:28,x2:88,y2:28},{x1:12,y1:50,x2:62,y2:50},{x1:38,y1:68,x2:84,y2:68}] },

      { label:'Nivel 10', concept:'Maestro de la Física',
        hint:'Reto final: mínimas líneas, máxima complejidad',
        maxLines:3, waveBonus:1200,
        ball:{px:14,py:10,vx:2.2,vy:0},
        bucket:{px:82,py:80,pw:7},
        statics:[{x1:30,y1:26,x2:30,y2:60},{x1:60,y1:40,x2:60,y2:74},{x1:38,y1:66,x2:62,y2:66}] },

      /* ── NIVELES 11-20: dificultad alta, objetos nuevos ── */
      { label:'Nivel 11', concept:'Pared Vertical',
        hint:'Usa la pared vertical como trampolín — la normal es perpendicular',
        maxLines:1, waveBonus:800,
        ball:{px:8,py:50,vx:4.5,vy:-1},
        bucket:{px:85,py:30,pw:11},
        statics:[{x1:60,y1:10,x2:60,y2:75}],
        bouncers:[] },

      { label:'Nivel 12', concept:'Doble Pared',
        hint:'Dos paredes crean un canal — guía la bola entre ellas',
        maxLines:2, waveBonus:850,
        ball:{px:50,py:8,vx:0,vy:0},
        bucket:{px:50,py:84,pw:9},
        statics:[{x1:30,y1:20,x2:30,y2:70},{x1:70,y1:20,x2:70,y2:70}],
        bouncers:[] },

      { label:'Nivel 13', concept:'Trampolín Elástico',
        hint:'El rebotador rojo invierte la velocidad — apunta bien',
        maxLines:1, waveBonus:900,
        ball:{px:15,py:15,vx:3,vy:0},
        bucket:{px:82,py:82,pw:9},
        statics:[{x1:28,y1:50,x2:72,y2:50}],
        bouncers:[{x1:20,y1:68,x2:55,y2:68,type:'elastic'}] },

      { label:'Nivel 14', concept:'Tobogán en U',
        hint:'El canal en U redirige la bola — dos líneas forman la U',
        maxLines:2, waveBonus:950,
        ball:{px:10,py:10,vx:2.5,vy:0},
        bucket:{px:88,py:45,pw:9},
        statics:[{x1:40,y1:30,x2:40,y2:65},{x1:70,y1:30,x2:70,y2:65},{x1:40,y1:65,x2:70,y2:65}],
        bouncers:[] },

      { label:'Nivel 15', concept:'Impulso Lateral Extremo',
        hint:'v₀=5 m/s horizontal — compensa con ángulos agudos',
        maxLines:2, waveBonus:1000,
        ball:{px:5,py:20,vx:5,vy:0},
        bucket:{px:90,py:80,pw:8},
        statics:[{x1:35,y1:38,x2:65,y2:38},{x1:20,y1:60,x2:55,y2:60}],
        bouncers:[] },

      { label:'Nivel 16', concept:'Laberinto de Paredes',
        hint:'Las paredes verticales y horizontales forman un laberinto',
        maxLines:3, waveBonus:1050,
        ball:{px:8,py:8,vx:0,vy:0},
        bucket:{px:88,py:84,pw:8},
        statics:[
          {x1:30,y1:10,x2:30,y2:50},{x1:60,y1:30,x2:60,y2:70},
          {x1:10,y1:55,x2:50,y2:55},{x1:45,y1:72,x2:85,y2:72}
        ],
        bouncers:[] },

      { label:'Nivel 17', concept:'Triple Rebotador',
        hint:'Tres trampolines elásticos en serie — calcula la trayectoria',
        maxLines:1, waveBonus:1100,
        ball:{px:50,py:6,vx:0,vy:0},
        bucket:{px:50,py:84,pw:7},
        statics:[],
        bouncers:[
          {x1:15,y1:28,x2:45,y2:28,type:'elastic'},
          {x1:55,y1:50,x2:85,y2:50,type:'elastic'},
          {x1:15,y1:70,x2:45,y2:70,type:'elastic'}
        ] },

      { label:'Nivel 18', concept:'Cañón Diagonal',
        hint:'vx=4, vy=-2 — proyectil parabólico clásico',
        maxLines:2, waveBonus:1150,
        ball:{px:8,py:70,vx:4,vy:-3.5},
        bucket:{px:85,py:25,pw:7},
        statics:[{x1:35,y1:10,x2:35,y2:48},{x1:60,y1:30,x2:60,y2:70}],
        bouncers:[] },

      { label:'Nivel 19', concept:'Suma Vectorial',
        hint:'Descompon velocidades: vₓ y vᵧ — una línea para cada componente',
        maxLines:2, waveBonus:1250,
        ball:{px:5,py:5,vx:3.8,vy:1.5},
        bucket:{px:92,py:80,pw:6},
        statics:[
          {x1:25,y1:35,x2:55,y2:35},{x1:50,y1:55,x2:80,y2:55},
          {x1:70,y1:20,x2:70,y2:55}
        ],
        bouncers:[] },

      { label:'Nivel 20', concept:'Gran Maestro',
        hint:'El reto definitivo — 3 líneas, 4 obstáculos, recipiente mínimo',
        maxLines:3, waveBonus:2000,
        ball:{px:50,py:5,vx:0,vy:0},
        bucket:{px:50,py:86,pw:5},
        statics:[
          {x1:10,y1:25,x2:45,y2:25},{x1:55,y1:25,x2:90,y2:25},
          {x1:25,y1:50,x2:25,y2:75},{x1:75,y1:50,x2:75,y2:75}
        ],
        bouncers:[{x1:40,y1:62,x2:60,y2:62,type:'elastic'}] },
    ];

    /* Colores vivos para las líneas del jugador */
    const LINE_COLORS=['#ffd740','#ff6e40','#69f0ae','#40c4ff','#ea80fc','#ff4081','#b2ff59','#ffab40'];

    let cont, canvas, ctx, S, animId, W, H;

    /* ── Escalar coordenadas touch/mouse al espacio del canvas ─
       Usa la proporción real CSS→canvas para funcionar correctamente
       en cualquier DPR, zoom o contenedor redimensionado.           */
    function toCanvas(clientX, clientY){
      const rect = canvas.getBoundingClientRect();
      return {
        x: (clientX - rect.left) * (canvas.width  / rect.width),
        y: (clientY - rect.top)  * (canvas.height / rect.height),
      };
    }

    function getXY(e){
      // changedTouches[0] funciona en touchstart, touchmove Y touchend.
      // e.touches en touchend es una lista VACÍA pero sigue siendo un objeto truthy,
      // así que e.touches[0] === undefined → crash silencioso → línea nunca guardada.
      const src = (e.changedTouches && e.changedTouches.length > 0) ? e.changedTouches[0]
                : (e.touches        && e.touches.length        > 0) ? e.touches[0]
                : e;
      return toCanvas(src.clientX, src.clientY);
    }

    /* ── Física ─────────────────────────────────────────────── */
    function closestPt(px,py,ax,ay,bx,by){
      const dx=bx-ax, dy=by-ay, len2=dx*dx+dy*dy;
      if(len2<0.001) return {x:ax,y:ay};
      const t=Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/len2));
      return {x:ax+t*dx, y:ay+t*dy};
    }

    function collideSeg(ball,ax,ay,bx,by, restitution){
      const r = restitution !== undefined ? restitution : REST;
      const cp = closestPt(ball.x,ball.y,ax,ay,bx,by);
      const dx = ball.x-cp.x, dy = ball.y-cp.y;
      const dist = Math.sqrt(dx*dx+dy*dy);
      if(dist < BALL_R && dist > 0.01){
        const nx=dx/dist, ny=dy/dist;
        // Push bola fuera
        ball.x = cp.x + nx*(BALL_R+1);
        ball.y = cp.y + ny*(BALL_R+1);
        const dot = ball.vx*nx + ball.vy*ny;
        if(dot < 0){
          ball.vx = (ball.vx - 2*dot*nx)*r*FRICTION;
          ball.vy = (ball.vy - 2*dot*ny)*r;
          return true;
        }
      }
      return false;
    }

    /* ── Estado ─────────────────────────────────────────────── */
    function buildState(lvlIdx, prevScore){
      const cfg = LEVELS[lvlIdx];
      const bx  = W*cfg.ball.px/100, by = H*cfg.ball.py/100;
      return {
        lvl:lvlIdx, cfg,
        score:prevScore||0,
        lines:[],
        drawing:null,
        ball:{x:bx,y:by,vx:cfg.ball.vx,vy:cfg.ball.vy},
        ballStart:{x:bx,y:by,vx:cfg.ball.vx,vy:cfg.ball.vy},
        running:false, over:false, won:false,
        attempts:0,
      };
    }

    function getBucket(){
      const cfg=S.cfg;
      return {
        bx:W*cfg.bucket.px/100,
        by:H*cfg.bucket.py/100,
        bw:W*cfg.bucket.pw/100,
        bh:H*0.055,
      };
    }

    function getStatics(){
      return S.cfg.statics.map(s=>({
        x1:W*s.x1/100, y1:H*s.y1/100,
        x2:W*s.x2/100, y2:H*s.y2/100,
      }));
    }
    function getBouncers(){
      return (S.cfg.bouncers||[]).map(b=>({
        x1:W*b.x1/100, y1:H*b.y1/100,
        x2:W*b.x2/100, y2:H*b.y2/100,
      }));
    }

    /* ── Step ───────────────────────────────────────────────── */
    function step(){
      const b = S.ball;
      /* Sub-pasos: divide cada frame en 3 para evitar que la bola
         atraviese las líneas a alta velocidad (tunneling).         */
      const SUB = 3;
      for(let s = 0; s < SUB; s++){
        b.vy += G / SUB;
        b.x  += b.vx / SUB;
        b.y  += b.vy / SUB;

        // Paredes
        if(b.x-BALL_R<0)  {b.x=BALL_R;      b.vx= Math.abs(b.vx)*REST;}
        if(b.x+BALL_R>W)  {b.x=W-BALL_R;    b.vx=-Math.abs(b.vx)*REST;}
        if(b.y-BALL_R<0)  {b.y=BALL_R;      b.vy= Math.abs(b.vy)*REST;}

        // Líneas del jugador
        for(const l of S.lines)
          collideSeg(b, l.x1,l.y1, l.x2,l.y2, REST);

        // Estáticos
        for(const st of getStatics())
          collideSeg(b, st.x1,st.y1, st.x2,st.y2, 0.55);

        // Rebotadores elásticos (supera velocidad de entrada — REST > 1)
        for(const brc of getBouncers())
          collideSeg(b, brc.x1,brc.y1, brc.x2,brc.y2, 1.1);

        // Victoria — la bola DEBE entrar en el recipiente para avanzar
        const {bx,by,bw,bh} = getBucket();
        if(b.x > bx-bw/2-BALL_R*0.4 && b.x < bx+bw/2+BALL_R*0.4 &&
           b.y+BALL_R > by && b.y < by+bh){
          S.won=true; S.over=true; S.running=false;
          S.score += S.cfg.waveBonus + Math.max(0,400-S.attempts*40);
          return;
        }

        // Fallo — bola sale por abajo sin entrar al recipiente
        if(b.y-BALL_R > H){ S.over=true; S.running=false; return; }
      }
    }

    /* ── Render ─────────────────────────────────────────────── */
    function render(){
      ctx.clearRect(0,0,W,H);
      ctx.fillStyle='#020b10'; ctx.fillRect(0,0,W,H);

      // Grid
      ctx.strokeStyle='rgba(11,59,70,0.18)'; ctx.lineWidth=1;
      for(let x=0;x<W;x+=W/10){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
      for(let y=0;y<H;y+=H/8) {ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}

      // Plataformas estáticas — gris azulado grueso y visible
      ctx.lineCap='round';
      for(const s of getStatics()){
        ctx.lineWidth=7; ctx.strokeStyle='#1a4a5a';
        ctx.beginPath(); ctx.moveTo(s.x1,s.y1); ctx.lineTo(s.x2,s.y2); ctx.stroke();
        ctx.lineWidth=3; ctx.strokeStyle='#2a7a9a';
        ctx.beginPath(); ctx.moveTo(s.x1,s.y1); ctx.lineTo(s.x2,s.y2); ctx.stroke();
      }

      // Rebotadores elásticos — naranja brillante con glow
      for(const brc of getBouncers()){
        ctx.shadowColor='#ff6e40'; ctx.shadowBlur=12;
        ctx.lineWidth=8; ctx.strokeStyle='#ff6e40'; ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(brc.x1,brc.y1); ctx.lineTo(brc.x2,brc.y2); ctx.stroke();
        ctx.lineWidth=3; ctx.strokeStyle='#fff3e0';
        ctx.beginPath(); ctx.moveTo(brc.x1,brc.y1); ctx.lineTo(brc.x2,brc.y2); ctx.stroke();
        ctx.shadowBlur=0;
        // Etiqueta
        ctx.fillStyle='#ff6e40'; ctx.font='bold 9px monospace'; ctx.textAlign='center';
        ctx.fillText('⚡ELÁSTICO',(brc.x1+brc.x2)/2,(brc.y1+brc.y2)/2-8);
        ctx.textAlign='left';
      }

      // Líneas del jugador — GRUESAS y con color brillante único
      S.lines.forEach((l,i)=>{
        const col = LINE_COLORS[i % LINE_COLORS.length];
        // Sombra para contraste
        ctx.shadowColor=col; ctx.shadowBlur=10;
        ctx.lineWidth=7; ctx.strokeStyle=col; ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(l.x1,l.y1); ctx.lineTo(l.x2,l.y2); ctx.stroke();
        ctx.shadowBlur=0;
        // Índice número sobre la línea
        ctx.fillStyle=col; ctx.font='bold 11px monospace';
        ctx.textAlign='center';
        ctx.fillText('L'+(i+1),(l.x1+l.x2)/2,(l.y1+l.y2)/2-8);
        ctx.textAlign='left';
      });

      // Línea en construcción — punteada blanca
      if(S.drawing){
        const dcol = LINE_COLORS[S.lines.length % LINE_COLORS.length];
        ctx.shadowColor=dcol; ctx.shadowBlur=8;
        ctx.strokeStyle=dcol+'aa'; ctx.lineWidth=5; ctx.lineCap='round';
        ctx.setLineDash([8,5]);
        ctx.beginPath(); ctx.moveTo(S.drawing.x1,S.drawing.y1);
        ctx.lineTo(S.drawing.x2,S.drawing.y2); ctx.stroke();
        ctx.setLineDash([]); ctx.shadowBlur=0;
      }

      // Recipiente
      const {bx,by,bw,bh} = getBucket();
      const bucketCol = S.won ? '#00ffa8' : '#42a5f5';
      ctx.shadowColor=bucketCol; ctx.shadowBlur=S.won?18:8;
      ctx.strokeStyle=bucketCol; ctx.lineWidth=4; ctx.lineCap='square';
      ctx.beginPath();
      ctx.moveTo(bx-bw/2,by); ctx.lineTo(bx-bw/2,by+bh);
      ctx.lineTo(bx+bw/2,by+bh); ctx.lineTo(bx+bw/2,by);
      ctx.stroke();
      ctx.fillStyle=bucketCol+'22'; ctx.fillRect(bx-bw/2+3,by,bw-6,bh);
      ctx.shadowBlur=0;
      // Flecha encima del recipiente
      ctx.fillStyle=bucketCol; ctx.font='bold 13px monospace';
      ctx.textAlign='center'; ctx.fillText('▼',bx,by-4); ctx.textAlign='left';

      // Bola
      if(S.ball){
        const b=S.ball;
        ctx.shadowColor='#00ffa8'; ctx.shadowBlur=S.running?12:6;
        const gr=ctx.createRadialGradient(b.x-3,b.y-3,1,b.x,b.y,BALL_R);
        gr.addColorStop(0,'#ffffff');
        gr.addColorStop(0.45,'#69f0ae');
        gr.addColorStop(1,'#005533');
        ctx.fillStyle=gr;
        ctx.beginPath(); ctx.arc(b.x,b.y,BALL_R,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur=0;
      }

      // HUD top
      ctx.fillStyle='rgba(2,11,16,0.82)'; ctx.fillRect(0,0,W,32);
      ctx.fillStyle='#d4a017'; ctx.font='bold 11px monospace';
      ctx.fillText(S.cfg.label+' · '+S.cfg.concept,8,21);
      ctx.textAlign='right';
      ctx.fillStyle='#00ffa8';
      ctx.fillText('SCORE '+S.score,W-8,21);
      ctx.textAlign='left';

      // HUD bottom barra de herramientas
      ctx.fillStyle='rgba(2,11,16,0.88)'; ctx.fillRect(0,H-40,W,40);
      const lLeft=S.cfg.maxLines-S.lines.length;
      const lCol=lLeft===0?'#ef5350':lLeft===1?'#ffd740':'#00ffa8';

      if(!S.running&&!S.over){
        // Líneas disponibles
        ctx.fillStyle=lCol; ctx.font='bold 11px monospace';
        ctx.fillText(`Líneas: ${S.lines.length}/${S.cfg.maxLines}`,10,H-16);

        // Botón DESHACER
        if(S.lines.length>0){
          ctx.fillStyle='#3a1010';
          rRect(ctx,W/2-88,H-36,72,28,7);
          ctx.fillStyle='#ef5350'; ctx.font='bold 11px monospace';
          ctx.textAlign='center'; ctx.fillText('← BORRAR',W/2-52,H-17); ctx.textAlign='left';
        }

        // Botón LANZAR
        ctx.fillStyle='#003322';
        rRect(ctx,W/2+4,H-36,80,28,7);
        ctx.fillStyle='#00ffa8'; ctx.font='bold 11px monospace';
        ctx.textAlign='center'; ctx.fillText('▶ LANZAR',W/2+44,H-17); ctx.textAlign='left';

      } else if(S.running&&!S.over){
        ctx.fillStyle='rgba(212,160,23,0.7)'; ctx.font='11px monospace';
        ctx.fillText('Simulando...',10,H-16);
        ctx.fillStyle='#3a1010';
        rRect(ctx,W-90,H-36,80,28,7);
        ctx.fillStyle='#ef5350'; ctx.font='bold 11px monospace';
        ctx.textAlign='right'; ctx.fillText('✕ RESET',W-14,H-17); ctx.textAlign='left';
      }

      // Hint cuando no hay líneas aún
      if(!S.running&&!S.over&&S.lines.length===0){
        ctx.textAlign='center';
        ctx.fillStyle='rgba(100,160,180,0.55)'; ctx.font='10px monospace';
        const hintWords=S.cfg.hint.split(' ');
        let line1='',line2='';
        for(const w of hintWords){
          if((line1+' '+w).trim().length<=36) line1=(line1+' '+w).trim();
          else line2=(line2+' '+w).trim();
        }
        ctx.fillText(line1,W/2,H/2+10);
        if(line2) ctx.fillText(line2,W/2,H/2+24);
        ctx.fillStyle='rgba(0,255,168,0.3)'; ctx.font='10px monospace';
        ctx.fillText('⚛ '+S.cfg.concept,W/2,H/2+42);
        ctx.textAlign='left';
      }

      // Pantalla resultado
      if(S.over){
        ctx.fillStyle='rgba(2,11,16,0.90)'; ctx.fillRect(0,0,W,H);
        ctx.textAlign='center';
        if(S.won){
          ctx.fillStyle='#00ffa8'; ctx.shadowColor='#00ffa8'; ctx.shadowBlur=20;
          ctx.font=`bold ${Math.max(20,W/16)}px monospace`;
          ctx.fillText('🎯 ¡BIEN HECHO!',W/2,H/2-50); ctx.shadowBlur=0;
          ctx.fillStyle='rgba(212,160,23,0.9)'; ctx.font=`bold ${Math.max(12,W/28)}px monospace`;
          ctx.fillText(`SCORE: ${S.score}  +${S.cfg.waveBonus}`,W/2,H/2-18);
          ctx.fillStyle='rgba(0,255,168,0.5)'; ctx.font=`${Math.max(10,W/38)}px monospace`;
          ctx.fillText(S.lvl<LEVELS.length-1?`Preparando Nivel ${S.lvl+2}…`:'¡Todos los niveles completados!',W/2,H/2+8);
          ctx.fillStyle='rgba(0,130,80,0.9)';
          rRect(ctx,W/2-65,H/2+28,130,36,10);
          ctx.fillStyle='#020b10'; ctx.font='bold 13px monospace';
          ctx.fillText(S.lvl<LEVELS.length-1?`▶ NIVEL ${S.lvl+2}`:'↺ REINICIAR',W/2,H/2+51);
          ctx.fillStyle='rgba(20,30,40,0.85)';
          rRect(ctx,W/2-55,H/2+74,110,28,8);
          ctx.fillStyle='#4a6a72'; ctx.font='11px monospace';
          ctx.fillText('◀ SELECCIÓN',W/2,H/2+93);
        } else {
          ctx.fillStyle='#ef5350'; ctx.font=`bold ${Math.max(18,W/17)}px monospace`;
          ctx.fillText('💨 FALLIDO',W/2,H/2-46);
          ctx.fillStyle='rgba(212,160,23,0.65)'; ctx.font=`${Math.max(10,W/36)}px monospace`;
          ctx.fillText(`Intento #${S.attempts} · Tus líneas se conservan`,W/2,H/2-16);
          ctx.fillStyle='rgba(100,20,20,0.9)';
          rRect(ctx,W/2-65,H/2+10,130,36,10);
          ctx.fillStyle='#ffffff'; ctx.font='bold 13px monospace';
          ctx.fillText('↺ REINTENTAR',W/2,H/2+33);
          ctx.fillStyle='rgba(20,30,40,0.85)';
          rRect(ctx,W/2-55,H/2+56,110,28,8);
          ctx.fillStyle='#4a6a72'; ctx.font='11px monospace';
          ctx.fillText('◀ SELECCIÓN',W/2,H/2+75);
        }
        ctx.textAlign='left';
      }
    }

    function rRect(c,x,y,w,h,r){
      c.beginPath();
      if(c.roundRect) c.roundRect(x,y,w,h,r); else c.rect(x,y,w,h);
      c.fill();
    }

    /* ── Loop ───────────────────────────────────────────────── */
    function loop(){
      if(!S){return;}
      animId=requestAnimationFrame(loop);
      if(S.running&&!S.over) step();
      render();
    }

    /* ── Acciones ───────────────────────────────────────────── */
    function launch(){
      if(S.running||S.over) return;
      S.attempts++;
      const bs=S.ballStart;
      S.ball={x:bs.x,y:bs.y,vx:bs.vx,vy:bs.vy};
      S.running=true;
    }

    function retry(){
      const bs=S.ballStart;
      S.ball={x:bs.x,y:bs.y,vx:bs.vx,vy:bs.vy};
      S.running=false; S.over=false; S.won=false;
    }

    function nextLevel(){
      const next=S.lvl+1;
      S=buildState(next<LEVELS.length?next:0, S.score);
    }

    /* ── Eventos ────────────────────────────────────────────── */
    function hitBtn(x,y,bx,by,bw,bh){ return x>=bx&&x<=bx+bw&&y>=by&&y<=by+bh; }

    function onDown(e){
      e.preventDefault();
      const {x,y}=getXY(e);

      if(S.over){
        if(S.won){
          if(hitBtn(x,y,W/2-65,H/2+28,130,36)) nextLevel();
          if(hitBtn(x,y,W/2-55,H/2+74,110,28)) GamesEngine.showSelection();
        } else {
          if(hitBtn(x,y,W/2-65,H/2+10,130,36)) retry();
          if(hitBtn(x,y,W/2-55,H/2+56,110,28)) GamesEngine.showSelection();
        }
        return;
      }

      if(!S.running){
        // Botón LANZAR
        if(hitBtn(x,y,W/2+4,H-36,80,28)){ launch(); return; }
        // Botón DESHACER
        if(S.lines.length>0&&hitBtn(x,y,W/2-88,H-36,72,28)){ S.lines.pop(); return; }
      } else {
        // Botón RESET
        if(hitBtn(x,y,W-90,H-36,80,28)){ retry(); return; }
      }

      // Iniciar dibujo sólo fuera del área HUD inferior y superior
      if(!S.running && S.lines.length<S.cfg.maxLines && y>34 && y<H-42){
        S.drawing={x1:x,y1:y,x2:x,y2:y};
      }
    }

    function onMove(e){
      e.preventDefault();
      if(!S.drawing) return;
      const {x,y}=getXY(e);
      S.drawing.x2=x; S.drawing.y2=y;
    }

    function onUp(e){
      e.preventDefault();
      if(!S || !S.drawing) return;
      try {
        const p=getXY(e);
        const dx=p.x-S.drawing.x1, dy=p.y-S.drawing.y1;
        if(Math.sqrt(dx*dx+dy*dy)>18){
          S.lines.push({x1:S.drawing.x1,y1:S.drawing.y1,x2:p.x,y2:p.y});
        }
      } catch(_){
        // Fallback: usar la última posición de arrastre registrada en onMove
        const dx=S.drawing.x2-S.drawing.x1, dy=S.drawing.y2-S.drawing.y1;
        if(Math.sqrt(dx*dx+dy*dy)>18){
          S.lines.push({x1:S.drawing.x1,y1:S.drawing.y1,x2:S.drawing.x2,y2:S.drawing.y2});
        }
      } finally {
        S.drawing=null;
      }
    }

    /* ── Init ───────────────────────────────────────────────── */
    function init(c){
      cont=c; cont.innerHTML='';
      cont.style.cssText='position:relative;width:100%;display:flex;flex-direction:column;align-items:center;padding:8px 0;';

      // Canvas — dimensiones basadas en el viewport real del móvil
      canvas=document.createElement('canvas');
      const availW = Math.min(
        (cont.clientWidth > 0 ? cont.clientWidth : window.innerWidth) - 16,
        420
      );
      W = availW;
      H = Math.min(Math.round(W * 1.4), 540);
      canvas.width  = W;
      canvas.height = H;
      // CSS: max-width:100% garantiza que nunca desborde en pantallas pequeñas;
      // toCanvas() compensa automáticamente cualquier diferencia de escala.
      canvas.style.cssText = `display:block;width:${W}px;max-width:100%;height:${H}px;border-radius:12px;border:1px solid #0b3b46;touch-action:none;cursor:crosshair;`;
      cont.appendChild(canvas);
      ctx = canvas.getContext('2d');

      // Instrucción
      const tip=document.createElement('div');
      tip.style.cssText='font-size:10px;color:#2a5a6a;text-align:center;margin-top:5px;letter-spacing:0.5px;';
      tip.textContent='✏ Dibuja líneas · ▶ Lanza la bola · ← Borra la última línea';
      cont.appendChild(tip);

      S=buildState(0,0);

      // Listeners — passive:false para preventDefault en touch
      canvas.addEventListener('touchstart', onDown, {passive:false});
      canvas.addEventListener('touchmove',  onMove, {passive:false});
      canvas.addEventListener('touchend',   onUp,   {passive:false});
      canvas.addEventListener('touchcancel',e=>{e.preventDefault();S.drawing=null;},{passive:false});
      canvas.addEventListener('mousedown',  onDown);
      canvas.addEventListener('mousemove',  e=>{if(e.buttons===1)onMove(e);});
      canvas.addEventListener('mouseup',    onUp);

      animId=requestAnimationFrame(loop);
    }

    function cleanup(){
      if(animId){cancelAnimationFrame(animId);animId=null;}
      S=null;
    }

    return {init, cleanup};
  })();





  /* ═══════════════════════════════════════════════════════════
     BALANZA DE FUERZAS — Equilibrio de Torques  30 Niveles
     Equilibra la balanza eligiendo posición o masa correcta.
     Ley: Σ(F·d)_izquierda = Σ(F·d)_derecha
  ═══════════════════════════════════════════════════════════ */
  Impls.balanza = (() => {

    /* Nomenclatura:
       Viga: posiciones 1-9.  Pivote en 5.
       Distancia izquierda: 5 - pos  (pos ∈ {1,2,3,4})
       Distancia derecha:   pos - 5  (pos ∈ {6,7,8,9})
       Torque: masa × distancia
       Equilibrio: ΣM_izq = ΣM_der
    */
    const LEVELS=[
      /* ── GRUPO 1: ENCUENTRA LA POSICIÓN (1-10) ────────────
         Se da el peso derecho, el jugador elige la posición  */
      {n:'L-01',law:'τ = F·d',title:'Primer equilibrio',
       concept:'Una sola pesa. Elige dónde colocarla.',
       lft:[{m:8,p:1}],           // TL = 8×4 = 32
       rgt:{m:8,ans:9},           // TR = 8×4 = 32 ✓
       mode:'pos'},

      {n:'L-02',law:'τ = F·d',title:'Distancia menor',
       concept:'Misma masa, distinta posición.',
       lft:[{m:6,p:2}],           // TL = 6×3 = 18
       rgt:{m:6,ans:8},           // TR = 6×3 = 18 ✓
       mode:'pos'},

      {n:'L-03',law:'τ = F·d',title:'Pesas distintas',
       concept:'Una masa diferente cambia la posición de equilibrio.',
       lft:[{m:3,p:1}],           // TL = 3×4 = 12
       rgt:{m:4,ans:8},           // TR = 4×3 = 12 ✓
       mode:'pos'},

      {n:'L-04',law:'τ = F·d',title:'Más ligero, más lejos',
       concept:'Pesa más ligera → debe ir más lejos del pivote.',
       lft:[{m:4,p:2}],           // TL = 4×3 = 12
       rgt:{m:3,ans:9},           // TR = 3×4 = 12 ✓
       mode:'pos'},

      {n:'L-05',law:'τ = F·d',title:'Cerca del pivote',
       concept:'Pesa izquierda cerca del pivote → poca distancia necesaria.',
       lft:[{m:5,p:3}],           // TL = 5×2 = 10
       rgt:{m:5,ans:7},           // TR = 5×2 = 10 ✓
       mode:'pos'},

      {n:'L-06',law:'Στ = 0',title:'Dos pesas izquierda',
       concept:'Suma de torques izquierdos = torque derecho.',
       lft:[{m:3,p:1},{m:2,p:2}], // TL = 12+4 = 16
       rgt:{m:4,ans:9},           // TR = 4×4 = 16 ✓
       mode:'pos'},

      {n:'L-07',law:'Στ = 0',title:'Mayor masa izquierda',
       concept:'Dos pesas pesadas — ¿dónde colocar el contrapeso?',
       lft:[{m:4,p:1},{m:2,p:2}], // TL = 16+4 = 20
       rgt:{m:5,ans:9},           // TR = 5×4 = 20 ✓
       mode:'pos'},

      {n:'L-08',law:'Στ = 0',title:'Torques simétricos',
       concept:'Dos pesas iguales, simétricas. ¿Coincide?',
       lft:[{m:3,p:2},{m:3,p:3}], // TL = 9+6 = 15
       rgt:{m:5,ans:8},           // TR = 5×3 = 15 ✓
       mode:'pos'},

      {n:'L-09',law:'Στ = 0',title:'Pesa alejada',
       concept:'Una pesa pesada lejos y otra liviana cerca.',
       lft:[{m:6,p:2},{m:2,p:4}], // TL = 18+2 = 20
       rgt:{m:5,ans:9},           // TR = 5×4 = 20 ✓
       mode:'pos'},

      {n:'L-10',law:'Στ = 0',title:'Tres pesas izquierda',
       concept:'Tres pesas — suma todos los torques.',
       lft:[{m:3,p:1},{m:2,p:2},{m:1,p:4}], // TL = 12+4+1 = 17... hmm
       // 12+4+1=17. 17/1=17 (pos 22 out). 17/17 pos=6 (dist=1)=17 ✓
       rgt:{m:17,ans:6},
       mode:'pos'},

      /* ── GRUPO 2: ENCUENTRA LA MASA (11-20) ────────────────
         Se da la posición, el jugador elige la masa correcta  */
      {n:'L-11',law:'F = τ/d',title:'Calcula la masa',
       concept:'Conoces la posición — despeja la masa de la ecuación.',
       lft:[{m:6,p:2}],           // TL = 18
       rgt:{p:8,ans:6,opts:[3,4,6,9]}, // TR = 6×3 = 18 ✓
       mode:'mass'},

      {n:'L-12',law:'F = τ/d',title:'Distancia mínima',
       concept:'Posición muy cercana al pivote → masa muy grande.',
       lft:[{m:8,p:1}],           // TL = 32
       rgt:{p:7,ans:16,opts:[8,12,16,20]}, // TR = 16×2 = 32 ✓
       mode:'mass'},

      {n:'L-13',law:'F = τ/d',title:'Posición extrema',
       concept:'Posición 9 (máxima distancia) → masa mínima necesaria.',
       lft:[{m:10,p:1}],          // TL = 40
       rgt:{p:9,ans:10,opts:[5,8,10,15]}, // TR = 10×4 = 40 ✓
       mode:'mass'},

      {n:'L-14',law:'F = τ/d',title:'Dos pesas, una incógnita',
       concept:'Torque total izquierdo / distancia derecha = masa.',
       lft:[{m:4,p:2},{m:4,p:3}], // TL = 12+8 = 20
       rgt:{p:9,ans:5,opts:[3,5,7,9]}, // TR = 5×4 = 20 ✓
       mode:'mass'},

      {n:'L-15',law:'F = τ/d',title:'Pesa pequeña lejos',
       concept:'Una pesa muy liviana muy lejos puede equilibrar mucho.',
       lft:[{m:6,p:2},{m:3,p:4}], // TL = 18+3 = 21
       rgt:{p:8,ans:7,opts:[5,7,9,11]}, // TR = 7×3 = 21 ✓
       mode:'mass'},

      {n:'L-16',law:'F = τ/d',title:'Tres pesas sumadas',
       concept:'Σ torques izquierdos dividido entre distancia = masa.',
       lft:[{m:5,p:1},{m:3,p:3},{m:2,p:4}], // TL = 20+6+2 = 28
       rgt:{p:9,ans:7,opts:[4,6,7,9]},       // TR = 7×4 = 28 ✓
       mode:'mass'},

      {n:'L-17',law:'F = τ/d',title:'Masa exacta',
       concept:'No hay margen de error — la ecuación tiene solución única.',
       lft:[{m:4,p:1},{m:6,p:3}], // TL = 16+12 = 28
       rgt:{p:8,ans:28,opts:[14,21,28,35]}, // TR = 28/3 no... dist=3: 28/3 ✗
       // Let me use p:6 (dist=1): 28/1=28. TR=28×1=28 ✓
       rgt:{p:6,ans:28,opts:[14,21,28,35]},
       mode:'mass'},

      {n:'L-18',law:'F = τ/d',title:'Equilibrio preciso',
       concept:'Una pesa cerca del pivote necesita ser muy pesada.',
       lft:[{m:3,p:1},{m:3,p:2},{m:3,p:3}], // TL = 12+9+6 = 27
       rgt:{p:8,ans:9,opts:[6,7,9,12]},      // TR = 9×3 = 27 ✓
       mode:'mass'},

      {n:'L-19',law:'F = τ/d',title:'Palanca de tercer grado',
       concept:'Distribución asimétrica de pesas — suma cuidadosamente.',
       lft:[{m:5,p:1},{m:4,p:2},{m:1,p:4}], // TL = 20+8+1 = 29... 29/p
       // 29/p must be integer: p must divide 29 → 1,29. dist right=1→pos6: 29. odd opts.
       // Let me redo: lft TL divisible by nice distances.
       // lft=[{m:5,p:1},{m:2,p:2},{m:3,p:3}] TL=20+4+6=30. p=8(dist=3): 30/3=10 ✓
       lft:[{m:5,p:1},{m:2,p:2},{m:3,p:3}], // TL=30
       rgt:{p:8,ans:10,opts:[5,8,10,15]},    // TR=10×3=30 ✓
       mode:'mass'},

      {n:'L-20',law:'F = τ/d',title:'Máximo torque',
       concept:'Posición 9 tiene la máxima distancia — úsala para equilibrar cargas pesadas.',
       lft:[{m:8,p:1},{m:6,p:2},{m:2,p:3}], // TL=32+12+4=48... /4=12 ✓ p=9
       rgt:{p:9,ans:12,opts:[8,10,12,16]},   // TR=12×4=48 ✓
       mode:'mass'},

      /* ── GRUPO 3: PIVOTE DESCENTRADO (21-25) ────────────────
         Pivote en posición 4 (descentrado a la izquierda)
         dist_L(p)=4-p (p∈{1,2,3}), dist_R(p)=p-4 (p∈{5,6,7,8,9})
         Esto simula una palanca con punto de apoyo desplazado  */
      {n:'L-21',law:'τ=F·d, pivote≠centro',title:'Pivote descentrado',
       concept:'El pivote ya no está en el centro — las distancias cambian.',
       pivot:4,
       lft:[{m:6,p:1}],           // TL = 6×3 = 18
       rgt:{m:6,ans:7,opts:[5,6,7,8,9]}, // dist=3 → pos 4+3=7. TR=6×3=18 ✓
       mode:'pos'},

      {n:'L-22',law:'τ=F·d, pivote≠centro',title:'Ventaja mecánica',
       concept:'Pivote descentrado → ventaja mecánica. Pesa pequeña equilibra pesa grande.',
       pivot:4,
       lft:[{m:9,p:1}],           // TL = 9×3 = 27
       rgt:{m:3,ans:9},           // TR = 3×5 = 15 ✗. 
       // Need 27/dist: dist=3→pos7: 9kg. Or 27/9=3→pos7.
       // rgt m=27 at pos5(dist=1). Or m=9 at pos7(dist=3).
       rgt:{m:9,ans:7},           // TR = 9×3 = 27 ✓
       mode:'pos'},

      {n:'L-23',law:'τ=F·d, pivote≠centro',title:'Brazo derecho más largo',
       concept:'Pivote descentrado crea brazos de diferente longitud.',
       pivot:4,
       lft:[{m:4,p:2},{m:2,p:3}], // TL = 4×2+2×1 = 8+2 = 10
       rgt:{m:2,ans:9},           // TR = 2×5 = 10 ✓
       mode:'pos'},

      {n:'L-24',law:'τ=F·d, pivote≠centro',title:'Equilibrio asimétrico',
       concept:'¿Cuánto necesitas en posición 9 para equilibrar?',
       pivot:4,
       lft:[{m:6,p:1},{m:4,p:2}], // TL = 18+8 = 26... 26/5=5.2 ✗ 
       // lft=[{m:5,p:1},{m:5,p:3}] TL=15+5=20. dist5→pos9: 20/5=4. rgt m=4 ✓
       lft:[{m:5,p:1},{m:5,p:3}], // TL=20
       rgt:{p:9,ans:4,opts:[2,3,4,6]}, // TR=4×5=20 ✓
       mode:'mass'},

      {n:'L-25',law:'Στ=0',title:'Tres pesas, pivote off-center',
       concept:'Pivote descentrado + tres pesas. Calcula cuidadosamente.',
       pivot:4,
       lft:[{m:3,p:1},{m:2,p:2},{m:4,p:3}], // TL=9+4+4=17... 17/5=3.4 ✗
       // lft=[{m:4,p:1},{m:3,p:2},{m:3,p:3}] TL=12+6+3=21. 21/3=7→pos7. dist=3 ✓
       lft:[{m:4,p:1},{m:3,p:2},{m:3,p:3}], // TL=21
       rgt:{m:7,ans:7},           // TR=7×3=21 ✓
       mode:'pos'},

      /* ── GRUPO 4: MASA Y POSICIÓN (26-30) ──────────────────
         El jugador elige AMBAS: masa (4 opciones) Y posición (botones)  */
      {n:'L-26',law:'Στ=0',title:'Doble incógnita',
       concept:'Solo UNA combinación de masa+posición equilibra la balanza.',
       pivot:5,
       lft:[{m:6,p:2},{m:2,p:4}], // TL=18+2=20
       // Opciones masa: [4,5,6,8]. Solo 5@pos9(dist=4)=20 funciona.
       rgt:{ansM:5,ansP:9,massOpts:[4,5,6,8]},
       mode:'both'},

      {n:'L-27',law:'Στ=0',title:'Busca la combinación',
       concept:'Hay 16 combinaciones posibles — ¡solo una equilibra!',
       pivot:5,
       lft:[{m:5,p:2},{m:3,p:3}], // TL=15+6=21
       // 7@pos8(dist=3)=21 ✓. massOpts=[4,6,7,9]
       rgt:{ansM:7,ansP:8,massOpts:[4,6,7,9]},
       mode:'both'},

      {n:'L-28',law:'Στ=0',title:'Tres pesas, dos incógnitas',
       concept:'La suma de torques te da la clave.',
       pivot:5,
       lft:[{m:4,p:1},{m:3,p:2},{m:1,p:4}], // TL=16+6+1=23... 23/p: solo 23@pos6(dist=1). odd.
       // lft=[{m:3,p:1},{m:4,p:2},{m:2,p:3}] TL=12+8+4=24. 6@pos9(dist=4)=24. or 8@pos8(dist=3)=24 ambiguous!
       // lft=[{m:4,p:1},{m:2,p:2},{m:4,p:3}] TL=16+4+8=28. 7@pos9(dist=4)=28 ✓. massOpts=[5,6,7,9]
       lft:[{m:4,p:1},{m:2,p:2},{m:4,p:3}], // TL=28
       rgt:{ansM:7,ansP:9,massOpts:[5,6,7,9]},
       mode:'both'},

      {n:'L-29',law:'Στ=0',title:'Reto final I',
       concept:'Cuatro opciones de masa, cuatro posiciones. Solo una solución.',
       pivot:5,
       lft:[{m:6,p:1},{m:2,p:3}], // TL=24+4=28
       // 7@pos9(dist=4)=28 ✓. massOpts=[5,6,7,8] — other combos: 5@pos? 28/5 not int. 6@pos? 28/6 not int. 8@pos? 28/8=3.5 not int. unique ✓
       rgt:{ansM:7,ansP:9,massOpts:[5,6,7,8]},
       mode:'both'},

      {n:'L-30',law:'MAESTRO',title:'¡EQUILIBRISTA EXPERTO!',
       concept:'Reto final — aplica toda la física aprendida.',
       pivot:5,
       lft:[{m:5,p:1},{m:4,p:2},{m:3,p:3},{m:2,p:4}], // TL=20+8+6+2=36
       // 9@pos9(dist=4)=36 ✓. massOpts=[6,7,8,9] — 6@pos? 36/6=6>4 impossible. 7@? 36/7 not int. 8@? 36/8=4.5 not int. unique ✓
       rgt:{ansM:9,ansP:9,massOpts:[6,7,8,9]},
       mode:'both'},
    ];

    let cont, S;

    /* ── Torque helpers ─────────────────────────────────────── */
    function pivotOf(lvl){ return lvl.pivot||5; }

    function distL(pos,piv){ return piv - pos; }  // pos < piv
    function distR(pos,piv){ return pos - piv; }  // pos > piv

    function torqueLeft(lft,piv){
      return lft.reduce((s,w)=>s + w.m*distL(w.p,piv),0);
    }

    function torqueRight(m,pos,piv){
      return m * distR(pos,piv);
    }

    /* ── Estado ─────────────────────────────────────────────── */
    function newState(lvl,sc){
      const cfg=LEVELS[lvl];
      const piv=pivotOf(cfg);
      return{
        lvl, cfg, piv,
        score:sc||0,
        selPos: cfg.mode==='pos'||cfg.mode==='both' ? null : (cfg.rgt.p),
        selMass: cfg.mode==='mass' ? null : (cfg.mode==='both'? null : cfg.rgt.m),
        checked:false, correct:false,
        tl:torqueLeft(cfg.lft,piv),
      };
    }

    function isCorrect(){
      const cfg=S.cfg;
      if(cfg.mode==='pos')  return S.selPos===cfg.rgt.ans;
      if(cfg.mode==='mass') return S.selMass===cfg.rgt.ans;
      if(cfg.mode==='both') return S.selPos===cfg.rgt.ansP && S.selMass===cfg.rgt.ansM;
      return false;
    }

    function currentTR(){
      if(S.selPos===null||S.selMass===null) return null;
      return torqueRight(S.selMass,S.selPos,S.piv);
    }

    /* ── Render ─────────────────────────────────────────────── */
    function render(){
      if(!cont||!S) return;
      const cfg=S.cfg;
      const piv=S.piv;
      const TL=S.tl;
      const TR=currentTR();
      const diff=TR!==null?TR-TL:null;

      // Tilt del brazo: proporcional al desequilibrio
      const maxTilt=28;
      const tiltRaw=diff!==null ? Math.min(maxTilt,Math.max(-maxTilt,diff*1.8)) : 0;
      const tilt=S.checked?(isCorrect()?0:tiltRaw):tiltRaw;

      // Colores de estado
      const statusCol=!S.checked?'#0d3c78':isCorrect()?'#1b5e20':'#b71c1c';
      const statusBg =!S.checked?'#e8f4ff':isCorrect()?'#e8f5e9':'#ffebee';

      // Posiciones disponibles en el lado derecho
      const rightPosOpts=[];
      for(let p=piv+1;p<=9;p++) rightPosOpts.push(p);

      const massOpts=cfg.mode==='mass'? cfg.rgt.opts :
                     cfg.mode==='both'? cfg.rgt.massOpts : null;

      // Construir SVG de la viga
      const svgW=320, svgH=160;
      const beamY=90;    // Y del centro de la viga
      const beamLen=260; // longitud total en px
      const pivX=svgW/2 + (piv-5)*beamLen/8; // posición X del pivote

      // Cada posición 1-9 ocupa beamLen/8 px
      function posToX(pos){ return (pos-1)*beamLen/8 + (svgW-beamLen)/2; }

      const cos=Math.cos(tilt*Math.PI/180), sin2=Math.sin(tilt*Math.PI/180);

      function rotX(px2,py2){
        const dx=px2-pivX, dy=py2-beamY;
        return pivX + dx*cos - dy*sin2;
      }
      function rotY(px2,py2){
        const dx=px2-pivX, dy=py2-beamY;
        return beamY + dx*sin2 + dy*cos;
      }

      // Puntos extremos de la viga
      const x1=posToX(1)-10, x2=posToX(9)+10;
      const beamPoints=[
        [x1,beamY-6],[x2,beamY-6],[x2,beamY+6],[x1,beamY+6]
      ].map(([x,y])=>[rotX(x,y),rotY(x,y)]);

      function weightSVG(pos,mass,col,label,isRight){
        const wx=posToX(pos);
        const wy=beamY+(mass>15?24:18);
        const rx=rotX(wx,wy), ry=rotY(wx,wy);
        const r=mass>15?16:14;
        const lx=rotX(wx,beamY-18), ly=rotY(wx,beamY-18);
        return `
          <line x1="${rotX(wx,beamY-6).toFixed(1)}" y1="${rotY(wx,beamY-6).toFixed(1)}"
                x2="${lx.toFixed(1)}" y2="${ly.toFixed(1)}"
                stroke="${col}" stroke-width="2" stroke-dasharray="3,2"/>
          <circle cx="${rx.toFixed(1)}" cy="${ry.toFixed(1)}" r="${r}"
                  fill="${col}" stroke="white" stroke-width="1.5"/>
          <text x="${rx.toFixed(1)}" y="${(ry+4).toFixed(1)}"
                text-anchor="middle" font-size="11" font-weight="bold" fill="white">${mass}kg</text>
          ${label?`<text x="${rotX(wx,beamY-28).toFixed(1)}" y="${rotY(wx,beamY-28).toFixed(1)}"
                text-anchor="middle" font-size="9" fill="${col}">${label}</text>`:''}
        `;
      }

      // Marcadores de posición con distancia
      function tickSVG(pos,highlight){
        const tx=posToX(pos);
        const ty=beamY+6;
        const rx=rotX(tx,ty+10), ry=rotY(tx,ty+10);
        const d=Math.abs(pos-piv);
        return `
          <circle cx="${rx.toFixed(1)}" cy="${(ry).toFixed(1)}" r="4"
                  fill="${highlight?'#e53935':'rgba(0,0,0,0.15)'}"/>
          <text x="${rx.toFixed(1)}" y="${(ry+14).toFixed(1)}"
                text-anchor="middle" font-size="9"
                fill="${highlight?'#e53935':'#666'}">${d}m</text>
        `;
      }

      const svgContent=`
        <!-- Pivote (triángulo) -->
        <polygon points="${pivX},${beamY+7} ${pivX-14},${beamY+36} ${pivX+14},${beamY+36}"
                 fill="#546E7A" stroke="#37474F" stroke-width="1.5"/>
        <rect x="${pivX-20}" y="${beamY+36}" width="40" height="6" rx="2" fill="#37474F"/>
        <!-- Viga -->
        <polygon points="${beamPoints.map(p=>p.join(',')).join(' ')}"
                 fill="#90A4AE" stroke="#546E7A" stroke-width="2"/>
        <!-- Decoración viga -->
        <line x1="${rotX(x1+10,beamY).toFixed(1)}" y1="${rotY(x1+10,beamY).toFixed(1)}"
              x2="${rotX(x2-10,beamY).toFixed(1)}" y2="${rotY(x2-10,beamY).toFixed(1)}"
              stroke="rgba(255,255,255,0.3)" stroke-width="1"/>
        <!-- Ticks posición -->
        ${Array.from({length:9},(_,i)=>i+1).map(p=>tickSVG(p,S.selPos===p)).join('')}
        <!-- Pesas izquierda (dadas) -->
        ${cfg.lft.map(w=>weightSVG(w.p,w.m,'#1565C0',`${distL(w.p,piv)}m`,false)).join('')}
        <!-- Pesa derecha (jugador) -->
        ${S.selPos!==null&&S.selMass!==null
          ? weightSVG(S.selPos,S.selMass,'#e53935',`${distR(S.selPos,piv)}m`,true)
          : S.selPos!==null&&cfg.mode==='pos'&&cfg.rgt.m
            ? weightSVG(S.selPos,cfg.rgt.m,'#e53935',`${distR(S.selPos,piv)}m`,true)
            : S.selMass!==null&&cfg.mode==='mass'&&cfg.rgt.p
              ? weightSVG(cfg.rgt.p,S.selMass,'#e53935',`${distR(cfg.rgt.p,piv)}m`,true)
              : ''
        }
        <!-- Etiqueta pivote -->
        <text x="${pivX}" y="${beamY+52}" text-anchor="middle"
              font-size="10" fill="#546E7A">PIVOTE</text>
      `;

      cont.innerHTML=`
<div style="font-family:monospace;max-width:380px;margin:0 auto;padding:8px;user-select:none">

  <!-- Encabezado -->
  <div style="background:#0d3c78;color:white;border-radius:10px 10px 0 0;padding:10px 14px;display:flex;justify-content:space-between;align-items:center">
    <div>
      <div style="font-size:11px;color:#ffd740;letter-spacing:1px">${cfg.n} · ${cfg.law}</div>
      <div style="font-size:14px;font-weight:bold">${cfg.title}</div>
    </div>
    <div style="font-size:13px;color:#69f0ae;font-weight:bold">⭐ ${S.score}</div>
  </div>

  <!-- Concepto -->
  <div style="background:#e8f4ff;padding:8px 14px;border-left:3px solid #0d3c78;font-size:11px;color:#1a237e">
    💡 ${cfg.concept}
  </div>

  <!-- Viga SVG -->
  <div style="background:#f5f5f5;display:flex;justify-content:center;padding:8px 0;border:1px solid #e0e0e0">
    <svg width="${svgW}" height="${svgH}" style="overflow:visible">
      ${svgContent}
    </svg>
  </div>

  <!-- Ecuación de torques en tiempo real -->
  <div style="background:#1a237e;color:white;padding:8px 14px;text-align:center;font-size:12px">
    <div style="display:flex;justify-content:space-around;align-items:center">
      <div>
        <div style="font-size:10px;color:#90caf9">Σ Torques Izquierda</div>
        <div style="font-size:20px;font-weight:900;color:#ffd740">${TL} N·m</div>
        <div style="font-size:9px;color:#90caf9">${cfg.lft.map(w=>`${w.m}kg × ${distL(w.p,piv)}m`).join(' + ')}</div>
      </div>
      <div style="font-size:24px">${diff===null?'⚖️':diff===0?'✅':diff>0?'↗':'↙'}</div>
      <div>
        <div style="font-size:10px;color:#90caf9">Σ Torques Derecha</div>
        <div style="font-size:20px;font-weight:900;color:${TR===TL?'#00e676':TR===null?'#bbb':'#ff6e40'}">${TR===null?'?':TR+' N·m'}</div>
        <div style="font-size:9px;color:#90caf9">${TR===null?'coloca la pesa':
          (S.selMass||cfg.rgt.m||'?')+'kg × '+(S.selPos||cfg.rgt.p?distR(S.selPos||cfg.rgt.p,piv):''||'?')+'m'}</div>
      </div>
    </div>
    ${S.checked?`<div style="margin-top:6px;font-size:13px;font-weight:bold;color:${isCorrect()?'#00e676':'#ff6e40'}">${isCorrect()?'✅ ¡EQUILIBRIO PERFECTO!':'❌ La balanza no equilibra — intenta de nuevo'}</div>`:''}
  </div>

  <!-- Controles -->
  <div style="background:white;border:1px solid #e0e0e0;border-top:none;padding:10px;border-radius:0 0 10px 10px">

    ${cfg.mode==='pos'||cfg.mode==='both'?`
    <!-- Selector de POSICIÓN -->
    <div style="margin-bottom:8px">
      <div style="font-size:10px;font-weight:bold;color:#0d3c78;margin-bottom:5px">
        📍 POSICIÓN (lado derecho) ${cfg.rgt.m?'· Masa: '+cfg.rgt.m+'kg':''}
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px">
        ${rightPosOpts.map(p=>`
          <button onclick="window.__balanza_selPos(${p})" style="
            padding:10px 0;border:2px solid ${S.selPos===p?'#e53935':'#90a4ae'};
            border-radius:8px;font-size:12px;font-weight:bold;cursor:pointer;
            background:${S.selPos===p?'#e53935':'white'};
            color:${S.selPos===p?'white':'#37474F'};
            -webkit-tap-highlight-color:transparent;
          ">P${p}<br><span style="font-size:9px">${distR(p,piv)}m</span></button>
        `).join('')}
      </div>
    </div>`:''}

    ${cfg.mode==='mass'||cfg.mode==='both'?`
    <!-- Selector de MASA -->
    <div style="margin-bottom:8px">
      <div style="font-size:10px;font-weight:bold;color:#0d3c78;margin-bottom:5px">
        ⚖️ MASA ${cfg.rgt.p?'· En posición '+cfg.rgt.p+' (dist='+distR(cfg.rgt.p,piv)+'m)':''}
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px">
        ${(massOpts||[]).map(m=>`
          <button onclick="window.__balanza_selMass(${m})" style="
            padding:10px 0;border:2px solid ${S.selMass===m?'#e53935':'#90a4ae'};
            border-radius:8px;font-size:14px;font-weight:bold;cursor:pointer;
            background:${S.selMass===m?'#e53935':'white'};
            color:${S.selMass===m?'white':'#37474F'};
            -webkit-tap-highlight-color:transparent;
          ">${m}<br><span style="font-size:9px">kg</span></button>
        `).join('')}
      </div>
    </div>`:''}

    <!-- Botones de acción -->
    ${!S.checked?`
    <button onclick="window.__balanza_check()" style="
      width:100%;padding:13px;font-size:15px;font-weight:bold;
      background:#0d3c78;color:white;border:none;border-radius:10px;
      cursor:pointer;-webkit-tap-highlight-color:transparent;
      margin-top:4px;letter-spacing:1px;
    ">⚖️  COMPROBAR EQUILIBRIO</button>`:
    isCorrect()?`
    <button onclick="window.__balanza_next()" style="
      width:100%;padding:13px;font-size:15px;font-weight:bold;
      background:#1b5e20;color:white;border:none;border-radius:10px;
      cursor:pointer;-webkit-tap-highlight-color:transparent;margin-top:4px;
    ">${S.lvl<LEVELS.length-1?('▶  NIVEL '+(S.lvl+2)):'🏆  JUGAR DE NUEVO'}</button>`:
    `<button onclick="window.__balanza_retry()" style="
      width:100%;padding:13px;font-size:15px;font-weight:bold;
      background:#b71c1c;color:white;border:none;border-radius:10px;
      cursor:pointer;-webkit-tap-highlight-color:transparent;margin-top:4px;
    ">↺  INTENTAR DE NUEVO</button>`
    }
    <button onclick="GamesEngine.showSelection()" style="
      width:100%;padding:9px;font-size:12px;font-weight:bold;margin-top:6px;
      background:transparent;color:#546E7A;border:1px solid #90A4AE;
      border-radius:8px;cursor:pointer;-webkit-tap-highlight-color:transparent;
    ">◀  SELECCIÓN DE JUEGOS</button>
  </div>
</div>`;

      // Exponer handlers globales
      window.__balanza_selPos=p=>{if(S.checked)return;S.selPos=p;render();};
      window.__balanza_selMass=m=>{if(S.checked)return;S.selMass=m;render();};
      window.__balanza_check=()=>{
        // Validate complete selection
        const needPos =cfg.mode==='pos'||cfg.mode==='both';
        const needMass=cfg.mode==='mass'||cfg.mode==='both';
        if(needPos&&S.selPos===null)return;
        if(needMass&&S.selMass===null)return;
        // Set fixed values for single-mode
        if(cfg.mode==='pos')  S.selMass=cfg.rgt.m;
        if(cfg.mode==='mass') S.selPos=cfg.rgt.p;
        S.checked=true;
        S.correct=isCorrect();
        if(S.correct) S.score+=Math.max(50,200-S.lvl*5);
        render();
      };
      window.__balanza_next=()=>{
        const n=S.lvl+1;S=newState(n<LEVELS.length?n:0,S.score);render();
      };
      window.__balanza_retry=()=>{
        S=newState(S.lvl,S.score);render();
      };
    }

    return{
      init(c){cont=c;S=newState(0,0);render();},
      cleanup(){
        cont=null;S=null;
        delete window.__balanza_selPos;
        delete window.__balanza_selMass;
        delete window.__balanza_check;
        delete window.__balanza_next;
        delete window.__balanza_retry;
      }
    };
  })();

  /* ─────────────── CRÓNICAS DEL COSMOS — Narrativa ─────────── */
  Impls.narrativa = (() => {

    /* ══════════════════════════════════════════════
       MISIONES: 3 capítulos con física universitaria
       Cada misión = narración + diálogos + problema
    ══════════════════════════════════════════════ */
    const MISSIONS = [
      {
        id: 1,
        title: 'La Órbita Perdida',
        badge: '🛰️',
        law: 'Mecánica Orbital · Gravitación Universal',
        color: '#00ffa8',
        bgGrad: 'linear-gradient(135deg,#020b10 0%,#001a0e 100%)',
        accentBg: '#00271a',
        story: [
          'Año 2087. Eres el Dr. Galvis Barrera, físico teórico egresado de la Universidad Nacional de Colombia. Llevas tres años investigando anomalías gravitacionales en el cinturón de asteroides cuando recibes una señal de socorro cifrada.',
          'La señal proviene de la estación Kepler-7, una instalación científica en órbita baja terrestre (LEO) que ha perdido su sistema de propulsión. La tripulación tiene 48 horas antes de que la órbita decaiga irreversiblemente.',
          '«Necesitamos calcular la velocidad orbital exacta para enviar un módulo de rescate al mismo plano orbital», te transmite el comandante con voz entrecortada. «Sin los datos correctos, el acoplamiento fallará y perderemos la estación.»',
          'Abres tu terminal de cálculo y activas las ecuaciones de Newton. Solo tú puedes resolver esto.',
        ],
        dialogues: [
          { speaker: 'Comandante Santiago', avatar: '👨‍🚀', text: '«Galvis, la estación orbita a 400 km sobre la superficie terrestre. Necesito la velocidad orbital. Tenemos que actuar YA.»' },
          { speaker: 'Dr. Galvis Barrera', avatar: '👨‍🔬', text: '«Entendido. Radio terrestre: 6.371×10⁶ m. Masa Tierra: 5.972×10²⁴ kg. G = 6.674×10⁻¹¹ N·m²/kg². Calculando…»' },
          { speaker: 'Sistema IA', avatar: '🤖', text: '«Recuerda: la fuerza gravitacional es la fuerza centrípeta en órbita circular. v = √(GM/r), donde r es la distancia al centro de la Tierra.»' },
        ],
        problem: {
          statement: 'La Kepler-7 orbita a h = 400 km sobre la superficie terrestre. ¿Cuál es su velocidad orbital?',
          formula: 'v = √(GM / r)    donde r = R_T + h',
          data: 'G = 6.674×10⁻¹¹ N·m²/kg²  |  M = 5.97×10²⁴ kg  |  R_T = 6.371×10⁶ m  |  h = 4×10⁵ m',
          opts: ['6.32 km/s', '7.67 km/s', '11.2 km/s', '9.41 km/s'],
          correct: 1,
          exp: 'r = 6.371×10⁶ + 4×10⁵ = 6.771×10⁶ m. v = √(GM/r) = √(6.674×10⁻¹¹ × 5.97×10²⁴ / 6.771×10⁶) ≈ √(5.886×10⁷) ≈ 7.67 km/s. ¡Velocidad orbital LEO típica!',
          successMsg: '¡MÓDULO DE RESCATE EN CAMINO! La Kepler-7 está salvada. El comandante transmite: «Galvis, eres el mejor físico del sistema solar.»',
          failMsg: 'Velocidad incorrecta — el módulo de rescate pasó de largo. Recalcula r = R_T + h correctamente.',
        },
        points: 500,
      },
      {
        id: 2,
        title: 'La Señal del Pulsar',
        badge: '📡',
        law: 'Efecto Doppler · Ondas Relativistas',
        color: '#d4a017',
        bgGrad: 'linear-gradient(135deg,#0a0800 0%,#1a1200 100%)',
        accentBg: '#231a00',
        story: [
          'Misión cumplida, pero la señal original esconde algo más. Analizando los datos de la Kepler-7 encuentras un patrón en las frecuencias de radio: es un pulsar desconocido, y emite con una regularidad perfecta… excepto por una anomalía Doppler que sugiere que algo se mueve a velocidades relativistas hacia él.',
          'En los archivos clasificados de la estación encuentras el proyecto secreto "Hermes": una sonda experimental lanzada 5 años atrás con un motor de iones experimental, acelerando continuamente. Las comunicaciones con Hermes llevan años sin descifrarse.',
          '«La sonda Hermes se acerca al pulsar a 0.1c», lees en el informe. «Si podemos calcular la frecuencia que observa la sonda, podremos decodificar su telemetría y saber si el sistema de vida a bordo sigue activo.»',
          'Activas el módulo de relatividad especial de tu software. El efecto Doppler relativista no es igual al clásico…',
        ],
        dialogues: [
          { speaker: 'Dra. Restrepo', avatar: '👩‍💻', text: '«Galvis, el pulsar emite a f₀ = 716 Hz. La sonda viaja hacia él a v = 0.1c. ¿A qué frecuencia lo detecta la sonda?»' },
          { speaker: 'Dr. Galvis Barrera', avatar: '👨‍🔬', text: '«Necesito el Doppler relativista longitudinal: f = f₀ √[(1+β)/(1−β)] donde β = v/c. La versión clásica daría error.»' },
          { speaker: 'Sistema IA', avatar: '🤖', text: '«Cuidado: β = v/c = 0.1. El factor γ = 1/√(1−β²) importa porque v es significativa respecto a c.»' },
        ],
        problem: {
          statement: 'La sonda Hermes se acerca al pulsar a v = 0.1c. El pulsar emite a f₀ = 716 Hz. ¿Qué frecuencia detecta la sonda?',
          formula: 'f = f₀ · √[(1 + β) / (1 − β)]    β = v/c',
          data: 'f₀ = 716 Hz  |  v = 0.1c  |  β = 0.1  |  c = 3×10⁸ m/s',
          opts: ['716 Hz', '787 Hz', '652 Hz', '810 Hz'],
          correct: 1,
          exp: 'β = 0.1. f = 716·√[(1.1)/(0.9)] = 716·√(1.2222) = 716·1.1055 ≈ 791 Hz ≈ 787 Hz. Al acercarse, la frecuencia aumenta (corrimiento al azul). El Doppler relativista corrige el factor de tiempo que el clásico ignora.',
          successMsg: '¡TELEMETRÍA DECODIFICADA! La sonda Hermes responde: «Sistemas en línea. Aproximando objetivo.» La Dra. Restrepo celebra con lágrimas en los ojos.',
          failMsg: 'Frecuencia errónea — la decodificación falló. Verifica el factor Doppler relativista √[(1+β)/(1−β)].',
        },
        points: 700,
      },
      {
        id: 3,
        title: 'El Umbral Cuántico',
        badge: '⚛️',
        law: 'Mecánica Cuántica · De Broglie · Heisenberg',
        color: '#ef5350',
        bgGrad: 'linear-gradient(135deg,#0a0005 0%,#150010 100%)',
        accentBg: '#200015',
        story: [
          'La sonda Hermes ha llegado. Y ha encontrado algo que ningún físico esperaba: no una estrella de neutrones normal, sino una estructura artificial que emite materia a velocidades relativistas en patrones que solo pueden ser intencionales. Alguien —o algo— construyó esto.',
          'Para aproximarse sin ser destruida, la sonda debe pasar por una "celosía cuántica": una barrera de campo que solo permite el paso de partículas cuya longitud de onda de De Broglie coincide exactamente con el espaciado de la red cristalina del escudo, d = 2.1×10⁻¹⁰ m.',
          '«La sonda necesita acelerar electrones para hacerlos pasar como sonda de difracción», escribe Hermes en su último mensaje. «¿Con qué velocidad deben moverse los electrones para que su longitud de onda coincida con d?»',
          'Todo lo que estudiaste en Física Moderna en la UNAL llega a este momento. La constante de Planck, la relación de De Broglie, la masa del electrón. Ahora sabes por qué el universo habla en ecuaciones.',
        ],
        dialogues: [
          { speaker: 'Sonda Hermes', avatar: '🛸', text: '«Requiero electrones con λ = 2.1×10⁻¹⁰ m. Calcule la velocidad necesaria usando la relación de De Broglie.»' },
          { speaker: 'Dr. Galvis Barrera', avatar: '👨‍🔬', text: '«λ = h/(mv). Despejando: v = h/(mλ). Con h = 6.626×10⁻³⁴ J·s y mₑ = 9.109×10⁻³¹ kg…»' },
          { speaker: 'Sistema IA', avatar: '🤖', text: '«La longitud de onda de De Broglie conecta mecánica cuántica con mecánica clásica. A esta escala, los electrones son ondas. Esta fue la revolución de 1924.»' },
        ],
        problem: {
          statement: 'Para que los electrones difracten en la celosía (d = 2.1×10⁻¹⁰ m), se necesita λ = 2.1×10⁻¹⁰ m. ¿Con qué velocidad deben moverse?',
          formula: 'λ = h / (m·v)  ⟹  v = h / (m·λ)',
          data: 'h = 6.626×10⁻³⁴ J·s  |  mₑ = 9.109×10⁻³¹ kg  |  λ = 2.1×10⁻¹⁰ m',
          opts: ['2.46×10⁶ m/s', '3.47×10⁶ m/s', '1.23×10⁶ m/s', '4.92×10⁶ m/s'],
          correct: 1,
          exp: 'v = h/(mλ) = 6.626×10⁻³⁴ / (9.109×10⁻³¹ × 2.1×10⁻¹⁰) = 6.626×10⁻³⁴ / 1.913×10⁻⁴⁰ ≈ 3.47×10⁶ m/s. Solo ~1.2% de c, así que la mecánica clásica de De Broglie aplica sin correcciones relativistas.',
          successMsg: '🌌 ¡LA BARRERA SE ABRE! Los electrones difractan perfectamente. La sonda Hermes cruza el umbral. Lo que encuentra al otro lado cambiará la física para siempre…',
          failMsg: 'Velocidad errónea — los electrones no difractan. Verifica v = h/(mλ) y las unidades.',
        },
        points: 1000,
      },

      /* ═══ MISIONES 4-12: El Otro Lado del Umbral ════════ */
      {
        id: 4,
        title: 'La Trampa de Lorentz',
        badge: '⚡',
        law: 'Fuerza de Lorentz · Movimiento Circular',
        color: '#42a5f5',
        bgGrad: 'linear-gradient(135deg,#000a14 0%,#001428 100%)',
        accentBg: '#001428',
        story: [
          'Al cruzar el umbral cuántico, la sonda Hermes encuentra una cámara cilíndrica colosal llena de un campo magnético perfecto de 0.1 T. Miles de protones giran en espiral, atrapados en órbitas perfectas. Es un acelerador de partículas alienígena… pero está dañado.',
          'La IA de Hermes detecta que los protones han perdido sincronía. Para restablecer el campo confinador, necesitas conocer el radio exacto de giro de un protón moviéndose a 2×10⁶ m/s dentro del campo. Un radio incorrecto destruirá el sistema.',
          '«Las ecuaciones de Lorentz son tu única herramienta», transmite Hermes. «La fuerza magnética actúa como fuerza centrípeta. qvB = mv²/r. Despeja r.»',
          'Dr. Galvis Barrera activa su módulo de electromagnetismo. Ha estudiado este problema cientos de veces en los laboratorios de la UNAL. Ahora la vida de la misión depende de ello.',
        ],
        dialogues: [
          { speaker: 'Hermes IA', avatar: '🛸', text: '«Protón moviéndose a v = 2×10⁶ m/s perpendicular a B = 0.1 T. Calcula el radio de giro o el confinador colapsará.»' },
          { speaker: 'Dr. Galvis Barrera', avatar: '👨‍🔬', text: '«Fuerza de Lorentz = fuerza centrípeta: qvB = mv²/r. Despejando: r = mv/(qB). Busco masa y carga del protón…»' },
          { speaker: 'Comandante Santiago', avatar: '👨‍🚀', text: '«¡Date prisa Galvis! El campo oscila. Tienes 90 segundos antes de que el confinador falle.»' },
        ],
        problem: {
          statement: 'Un protón (m = 1.67×10⁻²⁷ kg, q = 1.6×10⁻¹⁹ C) se mueve a v = 2×10⁶ m/s perpendicular a B = 0.1 T. ¿Cuál es el radio de su órbita circular?',
          formula: 'r = mv / (qB)    [qvB = mv²/r → Lorentz = Centrípeta]',
          data: 'm = 1.67×10⁻²⁷ kg  |  q = 1.6×10⁻¹⁹ C  |  v = 2×10⁶ m/s  |  B = 0.1 T',
          opts: ['0.11 m', '0.21 m', '0.42 m', '0.84 m'],
          correct: 1,
          exp: 'r = mv/(qB) = (1.67×10⁻²⁷ × 2×10⁶) / (1.6×10⁻¹⁹ × 0.1) = 3.34×10⁻²¹ / 1.6×10⁻²⁰ ≈ 0.209 m ≈ 0.21 m. Este principio es la base de los ciclotrones y el LHC del CERN.',
          successMsg: '✅ ¡CONFINADOR ESTABILIZADO! Los protones retoman su órbita perfecta. El acelerador alienígena vuelve a la vida con un zumbido grave y profundo.',
          failMsg: 'Radio incorrecto — el campo de confinamiento falló. Verifica r = mv/(qB) con cuidado en las unidades.',
        },
        points: 600,
      },

      {
        id: 5,
        title: 'El Motor Eterno',
        badge: '🔥',
        law: 'Ciclo de Carnot · Segunda Ley de la Termodinámica',
        color: '#ff7043',
        bgGrad: 'linear-gradient(135deg,#0a0300 0%,#1a0800 100%)',
        accentBg: '#1a0800',
        story: [
          'Más adentro de la estructura, Hermes descubre la fuente de energía que ha mantenido activo este sistema durante milenios: un motor térmico ciclópeo que opera entre dos reservorios a temperaturas extremas. La fuente caliente es una reacción de fusión controlada a 800 K. El sumidero frío es el vacío del espacio a 300 K.',
          'El motor controla toda la infraestructura de la estructura. Está operando con una eficiencia desconocida. Para sincronizar Hermes con el sistema, necesitas calcular la eficiencia máxima teórica posible según las leyes de la termodinámica.',
          '«Ningún motor puede superar la eficiencia de Carnot», recita Dr. Galvis Barrera desde su memoria de los cursos de termodinámica de la UNAL. «Es la barrera fundamental que impone la segunda ley.»',
          'Si la estructura opera por debajo del límite de Carnot, es tecnología convencional. Si lo supera… cambia todo lo que sabemos sobre física.',
        ],
        dialogues: [
          { speaker: 'Dra. Restrepo', avatar: '👩‍💻', text: '«Galvis, T_caliente = 800 K, T_fría = 300 K. ¿Cuál es la eficiencia máxima teórica de Carnot? Necesito saberlo para la calibración.»' },
          { speaker: 'Dr. Galvis Barrera', avatar: '👨‍🔬', text: '«η_Carnot = 1 − T_fría/T_caliente. Es el límite absoluto que no puede violar ninguna máquina real. La segunda ley lo garantiza.»' },
          { speaker: 'Sistema IA', avatar: '🤖', text: '«Recuerda: las temperaturas DEBEN estar en Kelvin. El resultado es una fracción entre 0 y 1, multiplicada por 100 da el porcentaje.»' },
        ],
        problem: {
          statement: 'Un motor de Carnot opera entre T_H = 800 K y T_C = 300 K. ¿Cuál es su eficiencia máxima teórica?',
          formula: 'η_Carnot = 1 − (T_C / T_H)    × 100%',
          data: 'T_H = 800 K  |  T_C = 300 K  |  Temperaturas en Kelvin obligatorio',
          opts: ['37.5 %', '62.5 %', '75.0 %', '50.0 %'],
          correct: 1,
          exp: 'η = 1 − T_C/T_H = 1 − 300/800 = 1 − 0.375 = 0.625 = 62.5%. Ningún motor real puede superar este valor. El motor de Stirling se aproxima más que el de vapor. La estructura alienígena opera al 62.4%… justo por debajo del límite.',
          successMsg: '🔥 ¡SINCRONIZACIÓN COMPLETADA! La eficiencia calculada coincide con las mediciones. La estructura es termodinámicamente consistente. Pero algo no encaja aún…',
          failMsg: 'Eficiencia incorrecta. Asegúrate de usar Kelvin y aplicar η = 1 − T_C/T_H correctamente.',
        },
        points: 650,
      },

      {
        id: 6,
        title: 'El Espejo de Bragg',
        badge: '💎',
        law: 'Difracción de Rayos X · Ley de Bragg',
        color: '#ab47bc',
        bgGrad: 'linear-gradient(135deg,#050008 0%,#0e0018 100%)',
        accentBg: '#0e0018',
        story: [
          'Las paredes de la estructura están compuestas por un cristal perfecto, diferente a cualquier mineral conocido. Su red cristalina actúa como un espejo selectivo que solo deja pasar ciertas longitudes de onda. Para analizar su composición, Hermes dispara un haz de rayos X con λ = 1.54×10⁻¹⁰ m.',
          'El detector registra un máximo de difracción a un ángulo θ desconocido. Sabemos que el espaciado interplanar del cristal es d = 2.8×10⁻¹⁰ m y que estamos observando el primer orden de difracción (n = 1).',
          '«La Ley de Bragg es la clave», anota Dr. Galvis Barrera en su bitácora. «William Henry Bragg y su hijo William Lawrence ganaron el Nobel de Física en 1915 por esto. Hoy la usaré para descifrar un cristal extraterrestre.»',
          'El análisis cristalográfico podría revelar si este material puede fabricarse en la Tierra o si requiere condiciones imposibles en nuestro planeta.',
        ],
        dialogues: [
          { speaker: 'Hermes IA', avatar: '🛸', text: '«Rayos X con λ = 1.54 Å impactando cristal con d = 2.8 Å. n = 1. Necesito el ángulo de difracción para identificar el material.»' },
          { speaker: 'Dr. Galvis Barrera', avatar: '👨‍🔬', text: '«Ley de Bragg: 2d·sinθ = nλ. Despejando sinθ = nλ/(2d). Luego θ = arcsin(sinθ). Simple pero elegante.»' },
          { speaker: 'Dra. Restrepo', avatar: '👩‍💻', text: '«Usa 1 Å = 1×10⁻¹⁰ m. El ángulo resultante debe estar entre 0° y 90° para ser físicamente válido.»' },
        ],
        problem: {
          statement: 'Rayos X con λ = 1.54×10⁻¹⁰ m inciden sobre un cristal con d = 2.8×10⁻¹⁰ m. Para n = 1, ¿cuál es el ángulo de difracción θ?',
          formula: '2d·sin θ = nλ  →  θ = arcsin(nλ / 2d)',
          data: 'λ = 1.54×10⁻¹⁰ m  |  d = 2.80×10⁻¹⁰ m  |  n = 1',
          opts: ['8.0°', '16.0°', '24.0°', '33.0°'],
          correct: 1,
          exp: 'sinθ = (1 × 1.54×10⁻¹⁰)/(2 × 2.80×10⁻¹⁰) = 1.54/5.60 = 0.2750. θ = arcsin(0.275) ≈ 15.96° ≈ 16.0°. Este es exactamente el ángulo del NaCl (sal común). ¡El cristal alienígena tiene la misma estructura que la sal de cocina!',
          successMsg: '💎 ¡MATERIAL IDENTIFICADO! Estructura tipo NaCl pero con átomos de masa desconocida. La Dra. Restrepo enmudece: «Dios mío… lo hicieron con silicio y carbono. Lo podemos fabricar en la Tierra.»',
          failMsg: 'Ángulo incorrecto. Verifica sinθ = nλ/(2d) y luego aplica arcsin. Usa calculadora.',
        },
        points: 700,
      },

      {
        id: 7,
        title: 'El Colapso de la Estrella',
        badge: '🕳️',
        law: 'Radio de Schwarzschild · Relatividad General',
        color: '#546e7a',
        bgGrad: 'linear-gradient(135deg,#000000 0%,#0a0a0a 100%)',
        accentBg: '#0a0a14',
        story: [
          'En el núcleo de la estructura alienígena, Hermes descubre algo perturbador: un repositorio de datos que registra el colapso de una estrella de 10 masas solares. La estructura fue construida para sobrevivir ese evento. Los registros muestran que la estrella colapsó en un agujero negro.',
          'Para descifrar los últimos datos de los registros, necesitas calcular el radio de Schwarzschild de ese agujero negro — la distancia desde el centro a la que ni la luz puede escapar. Con ese dato, los archivos restantes se desbloquearán.',
          '«Karl Schwarzschild calculó esto en 1916, mientras servía en el frente ruso durante la Primera Guerra Mundial», recuerda Dr. Galvis Barrera. «Lo envió a Einstein desde las trincheras. Hoy yo lo calculo desde el interior de una estructura alienígena.»',
          'La ironía del universo: las ecuaciones humanas que describen los objetos más extremos del cosmos… escritas en una guerra, aplicadas en las estrellas.',
        ],
        dialogues: [
          { speaker: 'Hermes IA', avatar: '🛸', text: '«Estrella colapsada: M = 10 M☉ = 1.989×10³¹ kg. Calcula r_s para desbloquear los archivos del repositorio.»' },
          { speaker: 'Dr. Galvis Barrera', avatar: '👨‍🔬', text: '«r_s = 2GM/c². Es la solución de Schwarzschild a las ecuaciones de campo de Einstein. G = 6.674×10⁻¹¹, c = 3×10⁸ m/s.»' },
          { speaker: 'Comandante Santiago', avatar: '👨‍🚀', text: '«Galvis, una estrella de 10 masas solares. El radio del sol ya lo conoces. Para un agujero negro, el resultado estará en kilómetros.»' },
        ],
        problem: {
          statement: 'Una estrella de 10 masas solares colapsa en un agujero negro (M = 1.989×10³¹ kg). ¿Cuál es su radio de Schwarzschild?',
          formula: 'r_s = 2GM / c²',
          data: 'G = 6.674×10⁻¹¹ N·m²/kg²  |  M = 1.989×10³¹ kg  |  c = 3×10⁸ m/s',
          opts: ['≈ 3 km', '≈ 15 km', '≈ 30 km', '≈ 60 km'],
          correct: 2,
          exp: 'r_s = 2GM/c² = 2 × 6.674×10⁻¹¹ × 1.989×10³¹ / (3×10⁸)² = 2.654×10²¹ / 9×10¹⁶ ≈ 2.95×10⁴ m ≈ 29.5 km ≈ 30 km. Para el Sol sería solo ~3 km. ¡Toda la masa del Sol comprimida en una esfera de 3 km!',
          successMsg: '🕳️ ¡ARCHIVOS DESBLOQUEADOS! 47 terabytes de datos fluyen hacia Hermes. La última entrada del repositorio dice: «Si lees esto, eres suficientemente avanzado. Busca la frecuencia de plasma.»',
          failMsg: 'Radio incorrecto. r_s = 2GM/c². El resultado debe estar en metros, conviértelo a km dividiendo entre 1000.',
        },
        points: 750,
      },

      {
        id: 8,
        title: 'La Voz del Plasma',
        badge: '🌊',
        law: 'Ondas Estacionarias · Armónicos en Cuerdas',
        color: '#26c6da',
        bgGrad: 'linear-gradient(135deg,#000a0a 0%,#001818 100%)',
        accentBg: '#001a1a',
        story: [
          'El mensaje encontrado hace referencia a una «frecuencia de plasma». Hermes detecta que toda la estructura vibra a frecuencias específicas — como una enorme cuerda cósmica. El sistema de comunicación alienígena usa ondas estacionarias en una cuerda de longitud L = 0.5 m tensada con v = 320 m/s.',
          'Para sintonizar el receptor de Hermes con la frecuencia de comunicación, debes calcular la frecuencia del tercer armónico (n = 3) de ese sistema de cuerdas. Cada armónico codifica un mensaje diferente. El tercero contiene las coordenadas del planeta origen.',
          '«Es como afinar un violín cósmico», dice el Dr. Galvis Barrera con una sonrisa. «Los modos normales de vibración — los aprendí en el laboratorio de ondas de la UNAL, vibrando cuerdas con un parlante y un estroboscopio.»',
          'La música del universo habla en frecuencias. Los alienigenas también.',
        ],
        dialogues: [
          { speaker: 'Dra. Restrepo', avatar: '👩‍💻', text: '«La cuerda tiene L = 0.5 m y la onda se propaga a v = 320 m/s. Necesitamos el tercer armónico (n = 3) para sintonizar.»' },
          { speaker: 'Dr. Galvis Barrera', avatar: '👨‍🔬', text: '«f_n = nv/(2L). Para una cuerda fija en ambos extremos. El fundamental sería n=1, el tercer armónico n=3.»' },
          { speaker: 'Sistema IA', avatar: '🤖', text: '«Los nodos son puntos de desplazamiento cero. El tercer armónico tiene 3 semilongitudes de onda en la cuerda. Dibújalo mentalmente.»' },
        ],
        problem: {
          statement: 'Una cuerda de L = 0.5 m tiene ondas con velocidad v = 320 m/s. ¿Cuál es la frecuencia del tercer armónico (n = 3)?',
          formula: 'f_n = n·v / (2L)',
          data: 'L = 0.5 m  |  v = 320 m/s  |  n = 3 (tercer armónico)',
          opts: ['320 Hz', '640 Hz', '960 Hz', '1280 Hz'],
          correct: 2,
          exp: 'f₃ = 3 × 320 / (2 × 0.5) = 960 / 1.0 = 960 Hz. El fundamental sería f₁ = 320 Hz. El segundo armónico 640 Hz. Cada armónico es un múltiplo entero del fundamental. En instrumentos musicales, esta es la base del timbre sonoro.',
          successMsg: '🌊 ¡SEÑAL RECIBIDA! A 960 Hz, Hermes capta un mensaje claro: coordenadas galácticas en un sistema de referencia de 12 dimensiones. La Dra. Restrepo llora de emoción.',
          failMsg: 'Frecuencia incorrecta. Aplica f_n = nv/(2L) con n = 3 específicamente. No confundas con el fundamental.',
        },
        points: 700,
      },

      {
        id: 9,
        title: 'La Energía del Fotón Gamma',
        badge: '☢️',
        law: 'Física Nuclear · Energía Cuántica E = hc/λ',
        color: '#ef5350',
        bgGrad: 'linear-gradient(135deg,#0a0000 0%,#1a0000 100%)',
        accentBg: '#1a0000',
        story: [
          'Las coordenadas recibidas apuntan a un sistema estelar a 47 años luz. Para llegar allí, la propulsión de Hermes necesita energía de fotones gamma altamente energéticos. El sistema de propulsión usa fotones con longitud de onda λ = 1×10⁻¹² m.',
          'El ingeniero de propulsión necesita saber exactamente cuánta energía transporta cada fotón para calibrar el espejo de empuje de la sonda. Un error en la energía de los fotones podría desintegrar la sonda en lugar de propulsarla.',
          '«Estamos hablando de rayos gamma», advierte Hermes. «Longitudes de onda en el orden del picómetro. Energías en MeV. Estas son las mismas energías que se liberan en reacciones nucleares y en la aniquilación materia-antimateria.»',
          'Dr. Galvis Barrera respira profundo. Fotones gamma, la radiación más energética del universo electromagnético. Aquí, en el corazón de una estructura alienígena, calculará su energía.',
        ],
        dialogues: [
          { speaker: 'Hermes IA', avatar: '🛸', text: '«Fotones gamma con λ = 1×10⁻¹² m. Necesito la energía en MeV para calibrar el sistema de propulsión. Error < 0.1%.»' },
          { speaker: 'Dr. Galvis Barrera', avatar: '👨‍🔬', text: '«E = hc/λ. h = 6.626×10⁻³⁴ J·s, c = 3×10⁸ m/s. Resultado en Joules, luego convierto a MeV: 1 MeV = 1.6×10⁻¹³ J.»' },
          { speaker: 'Dra. Restrepo', avatar: '👩‍💻', text: '«Galvis, para referencia: el límite Compton del electrón es 0.511 MeV. Los fotones gamma tienen energías muy superiores.»' },
        ],
        problem: {
          statement: 'Un fotón gamma tiene longitud de onda λ = 1×10⁻¹² m. ¿Cuál es su energía en MeV? (1 MeV = 1.6×10⁻¹³ J)',
          formula: 'E = hc/λ    luego convertir: E[MeV] = E[J] / 1.6×10⁻¹³',
          data: 'h = 6.626×10⁻³⁴ J·s  |  c = 3×10⁸ m/s  |  λ = 1×10⁻¹² m  |  1 MeV = 1.6×10⁻¹³ J',
          opts: ['0.124 MeV', '1.24 MeV', '12.4 MeV', '0.62 MeV'],
          correct: 1,
          exp: 'E = hc/λ = (6.626×10⁻³⁴ × 3×10⁸) / 1×10⁻¹² = 1.988×10⁻¹³ J. Convertir: 1.988×10⁻¹³ / 1.6×10⁻¹³ = 1.24 MeV. Para referencia: el umbral de creación de par e⁺e⁻ es 2×0.511 = 1.022 MeV. ¡Este fotón puede crear materia!',
          successMsg: '☢️ ¡PROPULSIÓN CALIBRADA! El espejo de empuje acepta los fotones gamma. Hermes acelera hacia las coordenadas. «ETA al sistema destino: 47 años. Comenzando hibernación.»',
          failMsg: 'Energía incorrecta. Primero calcula en Joules con E = hc/λ, luego divide entre 1.6×10⁻¹³ para convertir a MeV.',
        },
        points: 800,
      },

      {
        id: 10,
        title: 'El Principio de la Incertidumbre',
        badge: '🔮',
        law: 'Heisenberg · Δx·Δp ≥ ℏ/2',
        color: '#7e57c2',
        bgGrad: 'linear-gradient(135deg,#050010 0%,#0a0020 100%)',
        accentBg: '#0a0018',
        story: [
          'Cuarenta y siete años después. El año es 2134. La sonda Hermes despierta de su hibernación a 0.1 años luz del sistema destino. Dr. Galvis Barrera, ahora en un cuerpo sintético con su consciencia transferida, contempla las estrellas desde la pantalla de Hermes.',
          'El sistema destino tiene un planeta con atmósfera densa. Para detectar vida molecular, los instrumentos de Hermes deben analizar electrones confinados en moléculas con Δx = 1×10⁻¹⁰ m. El principio de Heisenberg determina la velocidad mínima que pueden tener esos electrones.',
          '«Werner Heisenberg publicó su principio en 1927 con 25 años», recuerda Galvis. «Dijo que el universo tiene una borrosidad fundamental — no podemos conocer posición y momento simultáneamente con precisión arbitraria. Esta limitación no es por falta de instrumentos. Es la naturaleza misma.»',
          'La incertidumbre no es ignorancia. Es la firma de la realidad cuántica grabada en el tejido del cosmos.',
        ],
        dialogues: [
          { speaker: 'Dr. Galvis Barrera', avatar: '👨‍🔬', text: '«Electrones con Δx = 1×10⁻¹⁰ m. Heisenberg impone Δp_mín = ℏ/(2Δx). Luego v_mín = Δp/mₑ.»' },
          { speaker: 'Hermes IA', avatar: '🛸', text: '«ℏ = h/(2π) = 1.055×10⁻³⁴ J·s. El resultado en m/s revelará si las moléculas son compatibles con vida basada en carbono.»' },
          { speaker: 'Sistema IA', avatar: '🤖', text: '«Recuerda: Δp_mín = ℏ/(2Δx) es la incertidumbre mínima. La velocidad v = Δp/mₑ con mₑ = 9.109×10⁻³¹ kg.»' },
        ],
        problem: {
          statement: 'Un electrón está confinado con Δx = 1×10⁻¹⁰ m. Usando el principio de Heisenberg, ¿cuál es su velocidad mínima?',
          formula: 'Δp_min = ℏ / (2·Δx)    →    v_min = Δp_min / mₑ',
          data: 'ℏ = 1.055×10⁻³⁴ J·s  |  Δx = 1×10⁻¹⁰ m  |  mₑ = 9.109×10⁻³¹ kg',
          opts: ['1.16×10⁵ m/s', '5.79×10⁵ m/s', '1.16×10⁶ m/s', '2.32×10⁶ m/s'],
          correct: 1,
          exp: 'Δp = ℏ/(2Δx) = 1.055×10⁻³⁴/(2×10⁻¹⁰) = 5.275×10⁻²⁵ kg·m/s. v = Δp/mₑ = 5.275×10⁻²⁵/9.109×10⁻³¹ ≈ 5.79×10⁵ m/s ≈ 0.2% de c. Los electrones en átomos se mueven a velocidades significativas incluso en su estado más quieto posible.',
          successMsg: '🔮 ¡ESPECTRO MOLECULAR COINCIDE CON VIDA! Las moléculas del planeta tienen la firma cuántica del carbono orgánico. Hay vida allí. Galvis cierra los ojos y susurra: «Lo encontramos.»',
          failMsg: 'Velocidad incorrecta. Primero calcula Δp = ℏ/(2Δx), luego divide entre la masa del electrón.',
        },
        points: 850,
      },

      {
        id: 11,
        title: 'La Dilatación del Tiempo',
        badge: '⏳',
        law: 'Relatividad Especial · Dilatación Temporal',
        color: '#ffd740',
        bgGrad: 'linear-gradient(135deg,#0a0800 0%,#181200 100%)',
        accentBg: '#1a1200',
        story: [
          'En órbita alrededor del planeta, Hermes detecta una señal de radio que claramente es una transmisión de bienvenida. Alguien sabía que vendrían. La señal incluye un acertijo temporal: una nave de esa civilización viajó a 0.8c durante 10 años de tiempo propio. ¿Cuánto tiempo pasó en el planeta que dejaron atrás?',
          'Este no es un problema abstracto. Es el precio real que han pagado los enviados de esta civilización. Los que partieron hace años, para su pueblo han estado ausentes mucho más tiempo. La relatividad convierte el viaje interestelar en una forma de exilio temporal.',
          '«Einstein cambió nuestra concepción del tiempo en 1905», reflexiona Dr. Galvis Barrera. «El tiempo no es absoluto. Es elástico. Se estira según la velocidad. Un astronauta que viaje a velocidades relativistas envejece más lento que quienes se quedan.»',
          'La dilatación temporal no es ciencia ficción. Es la razón por la que los relojes del GPS deben corregirse constantemente. Ahora, es también la historia de una civilización que sacrificó el tiempo con sus seres queridos para explorar el cosmos.',
        ],
        dialogues: [
          { speaker: 'Señal alienígena', avatar: '👽', text: '«Viajero del pasado: si llegas aquí, resuelve esto. Una nave viajó 10 años a v = 0.8c. ¿Cuánto tiempo pasó para quienes quedaron? Esa es nuestra historia.»' },
          { speaker: 'Dr. Galvis Barrera', avatar: '👨‍🔬', text: '«Dilatación temporal: t = γ·t₀. Factor de Lorentz γ = 1/√(1−v²/c²). Con v = 0.8c, β = 0.8, β² = 0.64.»' },
          { speaker: 'Hermes IA', avatar: '🛸', text: '«γ = 1/√(1−0.64) = 1/√0.36 = 1/0.6 = 5/3 ≈ 1.667. El tiempo dilatado t = γ × t₀ con t₀ = 10 años.»' },
        ],
        problem: {
          statement: 'Una nave viaja a v = 0.8c durante t₀ = 10 años (tiempo propio a bordo). ¿Cuánto tiempo transcurre en el planeta de origen?',
          formula: 't = γ · t₀    donde  γ = 1 / √(1 − v²/c²)',
          data: 'v = 0.8c  |  t₀ = 10 años  |  β = v/c = 0.8  |  β² = 0.64',
          opts: ['10.0 años', '13.3 años', '16.7 años', '25.0 años'],
          correct: 2,
          exp: 'γ = 1/√(1 − 0.8²) = 1/√(1 − 0.64) = 1/√0.36 = 1/0.6 = 5/3 ≈ 1.667. t = γ·t₀ = 1.667 × 10 = 16.7 años. Los viajeros envejecen 10 años, pero en su planeta transcurren 16.7 años. Es el "paradox del gemelo" aplicado a una civilización entera.',
          successMsg: '⏳ ¡RESPUESTA ACEPTADA! La señal alienígena responde: «Sí. Nuestros enviados partieron hace 10 de sus años. Aquí han pasado 16.7. Los que parten jóvenes regresan a un mundo que los sobrevivió.»',
          failMsg: 'Tiempo incorrecto. Calcula γ = 1/√(1−0.64) primero, luego t = γ × 10 años.',
        },
        points: 900,
      },

      {
        id: 12,
        title: 'La Fusión de los Mundos',
        badge: '🌟',
        law: 'Fusión Nuclear · Defecto de Masa · E = Δm·c²',
        color: '#00ffa8',
        bgGrad: 'linear-gradient(135deg,#000a05 0%,#001a0e 100%)',
        accentBg: '#001a10',
        story: [
          'El contacto ha sido establecido. La civilización alienígena — los Armonitas — nos invita a compartir su mayor logro: la fusión nuclear controlada perfecta. Su reactor de fusión D-T (deuterio-tritio) alimenta todo el planeta desde hace 3.000 años sin ningún residuo radiactivo de larga vida.',
          'Como gesto de buena voluntad científica, el Dr. Galvis Barrera debe demostrar que la humanidad comprende la física de la fusión. La reacción D+T→⁴He+n libera energía proporcional al defecto de masa. El defecto de masa de esta reacción es Δm = 0.01886 u.',
          '«Esta es la reacción que alimentará a la humanidad en el siglo XXII», escribe Galvis en su bitácora. «Si logramos reproducir lo que los Armonitas construyeron, la escasez energética en la Tierra terminará. Todo comienza con E = Δm·c².»',
          'Einstein tenía razón. La masa y la energía son lo mismo. Una pequeñísima cantidad de masa — 0.01886 unidades atómicas — libera la energía que ilumina civilizaciones enteras. La ecuación más corta del universo contiene la respuesta al mayor problema de la humanidad.',
        ],
        dialogues: [
          { speaker: 'Armonita Científico', avatar: '👽', text: '«Homo sapiens: la reacción D+T tiene defecto de masa Δm = 0.01886 u. Calcula la energía liberada en MeV. 1 u = 931.5 MeV/c².»' },
          { speaker: 'Dr. Galvis Barrera', avatar: '👨‍🔬', text: '«E = Δm·c². En unidades nucleares: E[MeV] = Δm[u] × 931.5 MeV/u. El resultado es la energía por reacción.»' },
          { speaker: 'Hermes IA', avatar: '🛸', text: '«Para comparar: quemar 1 átomo de carbono libera ~4 eV. La fusión D-T libera millones de veces más energía por reacción. Es la diferencia entre química y física nuclear.»' },
        ],
        problem: {
          statement: 'La reacción de fusión D + T → ⁴He + n tiene un defecto de masa Δm = 0.01886 u. ¿Cuánta energía libera por reacción? (1 u = 931.5 MeV/c²)',
          formula: 'E = Δm · c²    →    E[MeV] = Δm[u] × 931.5 MeV/u',
          data: 'Δm = 0.01886 u  |  1 u = 931.5 MeV/c²  |  Reacción: D + T → ⁴He + n',
          opts: ['8.8 MeV', '13.6 MeV', '17.6 MeV', '35.2 MeV'],
          correct: 2,
          exp: 'E = 0.01886 u × 931.5 MeV/u = 17.57 MeV ≈ 17.6 MeV. Esta es la energía de la fusión D-T, la más favorable de todas las reacciones de fusión. ITER y los reactores de fusión actuales buscan reproducir exactamente esto. ¡17.6 MeV por reacción, sin CO₂, sin residuos de larga vida!',
          successMsg: '🌟 ¡PRIMER CONTACTO CIENTÍFICO COMPLETADO! El Armonita asiente lentamente: «Ustedes comprenden la física. Son dignos de la alianza.» Galvis cierra los ojos. Han llegado. Y el universo nunca volverá a ser el mismo.',
          failMsg: 'Energía incorrecta. Multiplica directamente: E = 0.01886 × 931.5 MeV. Es una multiplicación simple.',
        },
        points: 1200,
      },
    ];

    /* ══ Estado ═══════════════════════════════════════════════ */
    let cont = null;
    let S = null;

    function newState(mIdx, prevScore) {
      return {
        mIdx,                   // misión actual
        phase: 'story',         // 'story' | 'problem' | 'result' | 'final'
        storyPage: 0,           // párrafo de historia actual
        dialogueIdx: 0,         // diálogo actual
        chosen: null,           // opción elegida
        correct: false,
        showExp: false,
        hints: 0,               // hints usados
        score: prevScore || 0,
        streak: 0,
      };
    }

    /* ══ RENDER ═══════════════════════════════════════════════ */
    function render() {
      if (!cont || !S) return;
      const m = MISSIONS[S.mIdx];
      switch (S.phase) {
        case 'story':     renderStory(m); break;
        case 'dialogue':  renderDialogue(m); break;
        case 'problem':   renderProblem(m); break;
        case 'result':    renderResult(m); break;
        case 'final':     renderFinal(); break;
      }
    }

    /* ── Indicador de misiones ──────────────────────────────── */
    function missionDots(activeIdx, color) {
      return MISSIONS.map((m, i) => `
        <div style="display:flex;align-items:center;gap:4px">
          <div style="width:10px;height:10px;border-radius:50%;
            background:${i < activeIdx ? '#00ffa8' : i === activeIdx ? color : '#1a3040'};
            border:1px solid ${i === activeIdx ? color : '#0b3b46'};
            transition:all 0.4s"></div>
          ${i < MISSIONS.length - 1 ? `<div style="width:14px;height:2px;background:${i < activeIdx ? '#00ffa8' : '#0b3b46'}"></div>` : ''}
        </div>`).join('');
    }

    /* ── Pantalla de historia ───────────────────────────────── */
    function renderStory(m) {
      const para = m.story[S.storyPage];
      const isLast = S.storyPage >= m.story.length - 1;
      cont.innerHTML = `
<div style="font-family:'Georgia',serif;max-width:420px;margin:0 auto;padding:0;user-select:none">

  <!-- Header de misión -->
  <div style="background:${m.bgGrad};padding:14px 16px 10px;border-radius:10px 10px 0 0;border-bottom:1px solid ${m.color}22">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
      <div style="font-size:10px;letter-spacing:2px;color:${m.color};font-family:monospace;font-weight:800">MISIÓN ${m.id} / ${MISSIONS.length}</div>
      <div style="font-size:10px;color:#2a5a6a;font-family:monospace">⭐ ${S.score}</div>
    </div>
    <div style="font-size:17px;font-weight:bold;color:white;margin-bottom:2px">${m.badge} ${m.title}</div>
    <div style="font-size:10px;color:${m.color}99;letter-spacing:1px;font-family:monospace">${m.law}</div>
    <div style="display:flex;align-items:center;gap:2px;margin-top:8px">${missionDots(S.mIdx, m.color)}</div>
  </div>

  <!-- Párrafo de historia -->
  <div style="background:#020b10;padding:16px;border-left:3px solid ${m.color};min-height:130px;position:relative">
    <div style="font-size:11px;color:#2a5a6a;font-family:monospace;margin-bottom:8px;letter-spacing:1px">
      — BITÁCORA DE MISIÓN · ${['PRÓLOGO','ACT I','ACT II','EPÍLOGO'][S.storyPage] || 'NARRACIÓN'} —
    </div>
    <div style="font-size:13px;line-height:1.7;color:#b0ccd4;font-style:italic">${para}</div>
    <div style="position:absolute;bottom:10px;right:14px;font-size:10px;color:#1a3a44;font-family:monospace">
      ${S.storyPage + 1} / ${m.story.length}
    </div>
  </div>

  <!-- Barra de progreso historia -->
  <div style="height:3px;background:#0b1e28">
    <div style="height:100%;width:${((S.storyPage + 1) / m.story.length) * 100}%;background:${m.color};transition:width 0.4s"></div>
  </div>

  <!-- Controles -->
  <div style="background:#030e15;padding:12px 14px;border-radius:0 0 10px 10px;display:flex;gap:8px">
    ${S.storyPage > 0 ? `
    <button id="btnPrev" style="flex:0 0 auto;padding:10px 14px;background:transparent;border:1px solid #0b3b46;
      border-radius:8px;color:#4a7a8a;font-size:13px;cursor:pointer">◀</button>` : '<div style="flex:0 0 auto;width:48px"></div>'}
    <button id="btnNext" style="flex:1;padding:12px;background:linear-gradient(135deg,${m.color}22,${m.color}11);
      border:1px solid ${m.color}55;border-radius:8px;color:${m.color};font-size:13px;font-weight:800;
      cursor:pointer;letter-spacing:1px;-webkit-tap-highlight-color:transparent">
      ${isLast ? '▶  INICIAR TRANSMISIÓN' : 'CONTINUAR ▶'}
    </button>
  </div>
</div>`;

      cont.querySelector('#btnNext').addEventListener('click', () => {
        if (!isLast) {
          S.storyPage++;
          render();
        } else {
          S.phase = 'dialogue';
          S.dialogueIdx = 0;
          render();
        }
      });
      const bp = cont.querySelector('#btnPrev');
      if (bp) bp.addEventListener('click', () => { S.storyPage--; render(); });
    }

    /* ── Pantalla de diálogos ───────────────────────────────── */
    function renderDialogue(m) {
      const d = m.dialogues[S.dialogueIdx];
      const isLast = S.dialogueIdx >= m.dialogues.length - 1;
      cont.innerHTML = `
<div style="font-family:'Georgia',serif;max-width:420px;margin:0 auto;user-select:none">

  <!-- Header -->
  <div style="background:${m.bgGrad};padding:12px 16px 8px;border-radius:10px 10px 0 0;border-bottom:1px solid ${m.color}22">
    <div style="display:flex;justify-content:space-between">
      <span style="font-size:10px;color:${m.color};font-family:monospace;font-weight:800;letter-spacing:2px">COMUNICACIÓN ENTRANTE</span>
      <span style="font-size:10px;color:#2a5a6a;font-family:monospace">⭐ ${S.score}</span>
    </div>
  </div>

  <!-- Burbuja de diálogo -->
  <div style="background:#020b10;padding:20px 16px;min-height:150px">
    <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:12px">
      <div style="font-size:36px;flex-shrink:0;margin-top:2px">${d.avatar}</div>
      <div>
        <div style="font-size:10px;color:${m.color};font-family:monospace;font-weight:800;letter-spacing:1px;margin-bottom:6px">${d.speaker.toUpperCase()}</div>
        <div style="background:${m.accentBg};border:1px solid ${m.color}33;border-radius:0 10px 10px 10px;
          padding:12px 14px;font-size:13px;color:#c0d8e0;line-height:1.6;font-family:monospace">${d.text}</div>
      </div>
    </div>
    <!-- Indicadores de diálogos -->
    <div style="display:flex;justify-content:center;gap:6px;margin-top:8px">
      ${m.dialogues.map((_, i) => `<div style="width:6px;height:6px;border-radius:50%;
        background:${i === S.dialogueIdx ? m.color : i < S.dialogueIdx ? m.color + '55' : '#1a3040'}"></div>`).join('')}
    </div>
  </div>

  <!-- Controles -->
  <div style="background:#030e15;padding:12px 14px;border-radius:0 0 10px 10px;display:flex;gap:8px">
    ${S.dialogueIdx > 0 ? `<button id="btnPrevD" style="flex:0 0 auto;padding:10px 14px;background:transparent;
      border:1px solid #0b3b46;border-radius:8px;color:#4a7a8a;font-size:13px;cursor:pointer">◀</button>` : ''}
    <button id="btnNextD" style="flex:1;padding:12px;background:linear-gradient(135deg,${m.color}22,${m.color}11);
      border:1px solid ${m.color}55;border-radius:8px;color:${m.color};font-size:13px;font-weight:800;
      cursor:pointer;letter-spacing:1px;-webkit-tap-highlight-color:transparent">
      ${isLast ? '⚗️  ACCEDER AL PROBLEMA' : 'SIGUIENTE ▶'}
    </button>
  </div>
</div>`;

      cont.querySelector('#btnNextD').addEventListener('click', () => {
        if (!isLast) { S.dialogueIdx++; render(); }
        else { S.phase = 'problem'; S.chosen = null; S.showExp = false; render(); }
      });
      const bp = cont.querySelector('#btnPrevD');
      if (bp) bp.addEventListener('click', () => { S.dialogueIdx--; render(); });
    }

    /* ── Pantalla de problema ───────────────────────────────── */
    function renderProblem(m) {
      const p = m.problem;
      cont.innerHTML = `
<div style="font-family:monospace;max-width:420px;margin:0 auto;user-select:none">

  <!-- Header -->
  <div style="background:${m.bgGrad};padding:12px 16px 8px;border-radius:10px 10px 0 0;border-bottom:1px solid ${m.color}22">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-size:10px;color:${m.color};letter-spacing:2px;font-weight:800">⚗️  PROBLEMA DE FÍSICA</div>
        <div style="font-size:12px;color:#6b8a91;margin-top:2px">${m.law}</div>
      </div>
      <div style="font-size:13px;color:${m.color};font-weight:bold">⭐ ${S.score}</div>
    </div>
  </div>

  <!-- Enunciado -->
  <div style="background:#020b10;padding:14px 16px;border-left:3px solid ${m.color}">
    <div style="font-size:12px;color:#c0d8e0;line-height:1.6;font-family:'Georgia',serif">${p.statement}</div>
  </div>

  <!-- Fórmula y datos -->
  <div style="background:${m.accentBg};padding:10px 16px;border-bottom:1px solid ${m.color}22">
    <div style="font-size:11px;color:${m.color}99;letter-spacing:1px;margin-bottom:4px">ECUACIÓN</div>
    <div style="font-size:12px;color:${m.color};font-weight:bold;letter-spacing:0.5px">${p.formula}</div>
    <div style="font-size:10px;color:#4a7a8a;margin-top:8px;line-height:1.7">${p.data}</div>
  </div>

  <!-- Opciones -->
  <div style="background:#020b10;padding:12px 14px">
    <div style="font-size:10px;color:#2a5a6a;letter-spacing:1px;margin-bottom:10px">SELECCIONA LA RESPUESTA CORRECTA:</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      ${p.opts.map((opt, i) => {
        let bg = '#0b1e28', border = '#0b3b46', color = '#7ba8b4';
        if (S.chosen !== null) {
          if (i === p.correct) { bg = '#003320'; border = '#00ffa8'; color = '#00ffa8'; }
          else if (i === S.chosen && S.chosen !== p.correct) { bg = '#2a0005'; border = '#ef5350'; color = '#ef5350'; }
          else { bg = '#0a1520'; border = '#0a1f2a'; color = '#3a5a6a'; }
        } else if (S.chosen === i) {
          bg = m.accentBg; border = m.color; color = m.color;
        }
        return `<button data-opt="${i}" style="padding:14px 8px;background:${bg};border:2px solid ${border};
          border-radius:10px;color:${color};font-size:13px;font-weight:800;cursor:pointer;
          -webkit-tap-highlight-color:transparent;transition:all 0.3s;
          ${S.chosen !== null ? 'pointer-events:none;' : ''}">
          ${['A','B','C','D'][i]}. ${opt}
        </button>`;
      }).join('')}
    </div>

    <!-- Explicación -->
    ${S.showExp ? `
    <div style="margin-top:12px;padding:12px;background:${S.chosen === p.correct ? '#001a10' : '#1a0005'};
      border:1px solid ${S.chosen === p.correct ? '#00ffa8' : '#ef5350'};border-radius:10px">
      <div style="font-size:11px;color:${S.chosen === p.correct ? '#00ffa8' : '#ef5350'};font-weight:800;margin-bottom:6px">
        ${S.chosen === p.correct ? '✅ ¡CORRECTO!' : '❌ INCORRECTO'}
      </div>
      <div style="font-size:11px;color:#8ab8c4;line-height:1.6;font-family:'Georgia',serif">${p.exp}</div>
      <button id="btnContinue" style="width:100%;margin-top:10px;padding:12px;
        background:linear-gradient(135deg,${m.color}33,${m.color}11);
        border:1px solid ${m.color}55;border-radius:8px;color:${m.color};
        font-size:13px;font-weight:800;cursor:pointer;letter-spacing:1px">
        ${S.chosen === p.correct ? '▶  VER RESULTADO' : '↺  INTENTAR DE NUEVO'}
      </button>
    </div>` : ''}

    <!-- Pista -->
    ${!S.showExp && S.hints < 2 ? `
    <button id="btnHint" style="width:100%;margin-top:8px;padding:9px;background:transparent;
      border:1px solid #0b3b46;border-radius:8px;color:#2a5a6a;font-size:11px;cursor:pointer">
      💡 PISTA (${2 - S.hints} disponibles)
    </button>` : ''}
    ${S.hints > 0 && !S.showExp ? `
    <div style="margin-top:8px;padding:10px;background:#0a1520;border:1px dashed #0b3b46;
      border-radius:8px;font-size:11px;color:#4a7a8a;line-height:1.5;font-family:'Georgia',serif">
      💡 ${getHint(m, S.hints)}
    </div>` : ''}
  </div>

  <!-- Footer -->
  <div style="background:#030e15;padding:8px 14px;border-radius:0 0 10px 10px;
    display:flex;justify-content:space-between;align-items:center">
    <div style="font-size:10px;color:#2a5a6a">${m.badge} ${m.title}</div>
    <div style="font-size:10px;color:#2a5a6a">+${m.points} pts si aciertas</div>
  </div>
</div>`;

      // Event: elegir opción
      cont.querySelectorAll('[data-opt]').forEach(btn => {
        btn.addEventListener('click', () => {
          if (S.chosen !== null) return;
          const i = +btn.dataset.opt;
          S.chosen = i;
          S.correct = (i === m.problem.correct);
          S.showExp = true;
          if (S.correct) {
            const bonus = Math.max(m.points - S.hints * 50, Math.round(m.points * 0.6));
            S.score += bonus;
            S.streak++;
          } else {
            S.streak = 0;
          }
          render();
        });
      });

      // Continuar tras ver explicación
      const btnC = cont.querySelector('#btnContinue');
      if (btnC) {
        btnC.addEventListener('click', () => {
          if (S.correct) {
            S.phase = 'result';
          } else {
            S.chosen = null; S.showExp = false;
          }
          render();
        });
      }

      // Pista
      const btnH = cont.querySelector('#btnHint');
      if (btnH) btnH.addEventListener('click', () => { S.hints++; render(); });
    }

    function getHint(m, n) {
      const hints = [
        [
          'Pista: r = R_T + h. ¡No olvides sumar el radio de la Tierra a la altitud!',
          'Pista: v = √(GM/r). Calcula GM = 6.674×10⁻¹¹ × 5.97×10²⁴ ≈ 3.986×10¹⁴ m³/s² y divide entre r.',
        ],
        [
          'Pista: β = v/c = 0.1. Calcula √(1.1/0.9) primero.',
          'Pista: √(1.1/0.9) = √(1.2222) ≈ 1.1055. Multiplica por f₀ = 716 Hz.',
        ],
        [
          'Pista: v = h/(mλ). Calcula el denominador: 9.109×10⁻³¹ × 2.1×10⁻¹⁰ ≈ 1.91×10⁻⁴⁰.',
          'Pista: v = 6.626×10⁻³⁴ / 1.913×10⁻⁴⁰. El resultado es del orden de 10⁶ m/s.',
        ],
      ];
      return (hints[m.id - 1] || hints[0])[Math.min(n - 1, 1)];
    }

    /* ── Pantalla de resultado de misión ────────────────────── */
    function renderResult(m) {
      const p = m.problem;
      cont.innerHTML = `
<div style="font-family:monospace;max-width:420px;margin:0 auto;user-select:none;text-align:center">
  <div style="background:${m.bgGrad};padding:14px 16px;border-radius:10px 10px 0 0;border-bottom:1px solid ${m.color}22">
    <div style="font-size:10px;color:${m.color};letter-spacing:2px;font-weight:800">MISIÓN ${m.id} COMPLETADA</div>
  </div>
  <div style="background:#020b10;padding:24px 16px">
    <div style="font-size:52px;margin-bottom:10px">${m.badge}</div>
    <div style="font-size:14px;font-weight:800;color:${m.color};letter-spacing:2px;margin-bottom:12px">${m.title.toUpperCase()}</div>
    <div style="background:${m.accentBg};border:1px solid ${m.color}33;border-radius:12px;padding:16px;margin-bottom:16px">
      <div style="font-size:12px;color:#8ab8c4;line-height:1.7;font-family:'Georgia',serif;font-style:italic">${p.successMsg}</div>
    </div>
    <div style="font-size:28px;color:${m.color};font-weight:900">⭐ ${S.score}</div>
    <div style="font-size:10px;color:#2a5a6a;margin-top:4px">PUNTUACIÓN ACUMULADA</div>
  </div>
  <div style="background:#030e15;padding:12px 14px;border-radius:0 0 10px 10px">
    ${S.mIdx < MISSIONS.length - 1 ? `
    <button id="btnNM" style="width:100%;padding:13px;background:linear-gradient(135deg,${m.color}33,${m.color}11);
      border:1px solid ${m.color}55;border-radius:10px;color:${m.color};font-size:14px;font-weight:800;
      cursor:pointer;letter-spacing:1px;margin-bottom:8px">
      ▶  MISIÓN ${m.id + 1}: ${MISSIONS[S.mIdx + 1].title.toUpperCase()}
    </button>` : `
    <button id="btnFin" style="width:100%;padding:13px;background:linear-gradient(135deg,#00ffa833,#00ffa811);
      border:1px solid #00ffa855;border-radius:10px;color:#00ffa8;font-size:14px;font-weight:800;
      cursor:pointer;letter-spacing:1px;margin-bottom:8px">
      🏆  VER RESULTADOS FINALES
    </button>`}
    <button onclick="GamesEngine.showSelection()" style="width:100%;padding:10px;background:transparent;
      border:1px solid #0b3b46;border-radius:8px;color:#4a7a8a;font-size:12px;cursor:pointer">
      ◀  MENÚ DE JUEGOS
    </button>
  </div>
</div>`;

      const btnNM = cont.querySelector('#btnNM');
      if (btnNM) btnNM.addEventListener('click', () => {
        S = newState(S.mIdx + 1, S.score);
        render();
      });
      const btnFin = cont.querySelector('#btnFin');
      if (btnFin) btnFin.addEventListener('click', () => { S.phase = 'final'; render(); });
    }

    /* ── Pantalla final ─────────────────────────────────────── */
    function renderFinal() {
      const maxScore = MISSIONS.reduce((a, m) => a + m.points, 0);
      const pct = Math.round((S.score / maxScore) * 100);
      const rank = pct >= 90 ? ['🏅 DOCTOR EN FÍSICA','UNAL merece un investigador como tú.','#ffd740']
                : pct >= 70 ? ['🎓 MAGÍSTER EN CIENCIAS','Excelente dominio de la física universitaria.','#00ffa8']
                : pct >= 50 ? ['🔬 FÍSICO GRADUADO','Buen trabajo. La práctica hace al maestro.','#d4a017']
                :             ['📖 ESTUDIANTE DEDICADO','Sigue estudiando. La física espera tus descubrimientos.','#ef5350'];
      cont.innerHTML = `
<div style="font-family:monospace;max-width:420px;margin:0 auto;user-select:none;text-align:center">
  <div style="background:linear-gradient(135deg,#020b10,#001520);padding:14px;border-radius:10px 10px 0 0;
    border-bottom:2px solid #00ffa822">
    <div style="font-size:10px;letter-spacing:3px;color:#00ffa8;font-weight:800">MISIÓN COMPLETADA · CRÓNICAS DEL COSMOS</div>
  </div>
  <div style="background:#020b10;padding:28px 16px">
    <div style="font-size:56px;margin-bottom:10px">🌌</div>
    <div style="font-size:16px;font-weight:800;color:${rank[2]};letter-spacing:2px;margin-bottom:6px">${rank[0]}</div>
    <div style="font-size:11px;color:#8ab8c4;margin-bottom:20px;font-family:'Georgia',serif;font-style:italic">${rank[1]}</div>

    <!-- Stats -->
    <div style="background:#0b1e28;border:1px solid #0b3b46;border-radius:12px;padding:16px;margin-bottom:20px">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
        <div>
          <div style="font-size:26px;font-weight:900;color:${rank[2]}">${S.score}</div>
          <div style="font-size:9px;color:#2a5a6a;margin-top:2px">PUNTOS</div>
        </div>
        <div>
          <div style="font-size:26px;font-weight:900;color:#00ffa8">${pct}%</div>
          <div style="font-size:9px;color:#2a5a6a;margin-top:2px">PRECISIÓN</div>
        </div>
        <div>
          <div style="font-size:26px;font-weight:900;color:#d4a017">${MISSIONS.length}</div>
          <div style="font-size:9px;color:#2a5a6a;margin-top:2px">MISIONES</div>
        </div>
      </div>
    </div>

    <!-- Conceptos dominados -->
    <div style="text-align:left;margin-bottom:16px">
      <div style="font-size:10px;color:#2a5a6a;letter-spacing:1px;margin-bottom:8px">CONCEPTOS DOMINADOS:</div>
      ${MISSIONS.map(m => `
      <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #0b1e28">
        <div style="font-size:14px">${m.badge}</div>
        <div>
          <div style="font-size:11px;color:${m.color};font-weight:800">${m.title}</div>
          <div style="font-size:10px;color:#2a5a6a">${m.law}</div>
        </div>
        <div style="margin-left:auto;font-size:12px;color:#00ffa8">✓</div>
      </div>`).join('')}
    </div>
  </div>
  <div style="background:#030e15;padding:12px 14px;border-radius:0 0 10px 10px;display:flex;flex-direction:column;gap:8px">
    <button id="btnReplay" style="padding:12px;background:linear-gradient(135deg,#00ffa833,#00ffa811);
      border:1px solid #00ffa855;border-radius:10px;color:#00ffa8;font-size:13px;font-weight:800;cursor:pointer">
      ↺  JUGAR DE NUEVO
    </button>
    <button onclick="GamesEngine.showSelection()" style="padding:10px;background:transparent;
      border:1px solid #0b3b46;border-radius:8px;color:#4a7a8a;font-size:12px;cursor:pointer">
      ◀  MENÚ DE JUEGOS
    </button>
  </div>
</div>`;

      const r = cont.querySelector('#btnReplay');
      if (r) r.addEventListener('click', () => { S = newState(0, 0); render(); });
    }

    return {
      init(c) { cont = c; S = newState(0, 0); render(); },
      cleanup() { cont = null; S = null; },
    };
  })();


  /* ── API pública ──────────────────────────────────────────── */
  return { init, launch, showSelection, _memNextLevel:()=>Impls.memory.nextLevel&&Impls.memory.nextLevel() };

})();

/* Auto-inicializar */
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',()=>GamesEngine.init());
}else{
  GamesEngine.init();
}