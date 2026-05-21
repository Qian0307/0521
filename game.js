/* ================================================================
   GAME.JS — 漢字大冒險 遊戲引擎
   ================================================================ */

const WORLD_META = [
  { name:'形近字森林',   icon:'🌲', enemy:'🐛', enemyName:'混亂小蟲',   g1:'#22C55E', g2:'#16A34A', wc1:'#22C55E', wc2:'#16A34A', desc:'長得很像的字，要仔細分辨！' },
  { name:'音近字城堡',   icon:'🏰', enemy:'👻', enemyName:'迷惑幽靈',   g1:'#A855F7', g2:'#7C3AED', wc1:'#A855F7', wc2:'#7C3AED', desc:'聽起來很像，意思差很多！' },
  { name:'聲調山谷',     icon:'🎵', enemy:'🦜', enemyName:'調皮鸚鵡',   g1:'#F59E0B', g2:'#D97706', wc1:'#F59E0B', wc2:'#D97706', desc:'聲調不同，意思全變了！' },
  { name:'多音字迷宮',   icon:'🗺️', enemy:'🦊', enemyName:'狡猾狐狸',  g1:'#3B82F6', g2:'#1D4ED8', wc1:'#3B82F6', wc2:'#1D4ED8', desc:'同一個字，不同的讀法！' },
  { name:'綜合應用王國', icon:'👑', enemy:'🐉', enemyName:'終極大龍',   g1:'#EC4899', g2:'#9333EA', wc1:'#EC4899', wc2:'#9333EA', desc:'綜合前面所有學過的！' },
];

const GS = {
  screen: 'map', worldIdx: 0, stageIdx: 0, qIdx: 0,
  hp: 100, wrongCount: 0, comboCount: 0, maxCombo: 0,
  currentStageQs: [], progress: {}
};

let WORLDS = [];

/* ── flatten one PART into game questions ── */
function flattenPart(part) {
  const qs = [];
  for (const sec of part.sections) {
    if (sec.type === 'sentence') continue;

    if (sec.type === 'match') {
      const cleanR = sec.right.map(r => r.replace(/^（[A-Za-z]）\s*/, ''));
      sec.left.forEach((l, i) => {
        const cleanL = l.replace(/^（\d+）\s*/, '');
        qs.push({ type:'mc', q:'「' + cleanL + '」對應哪一個？', opts: cleanR, ans: sec.ans[i] });
      });
    } else if (sec.type === 'fill2') {
      sec.questions.forEach(q => {
        qs.push({ type:'fill', q: q.q, hint: q.blanks[0].hint, ans: q.blanks[0].ans });
      });
    } else if (sec.type === 'error') {
      sec.questions.forEach(q => {
        qs.push({ type:'fill', q: '改錯：' + q.q + '\n錯字是「' + q.errChar + '」，請填入正確的字：', hint: q.note, ans: q.corrChar });
      });
    } else if (sec.type === 'circle') {
      sec.questions.forEach(q => qs.push({ type:'mc', q: q.q, opts: q.opts, ans: q.ans }));
    } else {
      sec.questions.forEach(q => qs.push({ type: sec.type, q: q.q, opts: q.opts, hint: q.hint, ans: q.ans }));
    }
  }
  return qs;
}

function buildWorlds() {
  WORLDS = PARTS.map((part, wi) => {
    const allQs = flattenPart(part);
    const stages = [];
    for (let i = 0; i < allQs.length; i += 10) {
      stages.push(allQs.slice(i, i + 10));
    }
    return { meta: WORLD_META[wi], stages };
  });
}

/* ── progress helpers ── */
function saveProgress() {
  try { localStorage.setItem('hanzi_prog', JSON.stringify(GS.progress)); } catch(e) {}
}
function loadProgress() {
  try { const s = localStorage.getItem('hanzi_prog'); if (s) GS.progress = JSON.parse(s); } catch(e) {}
}
function stageKey(wi, si) { return wi + '-' + si; }
function isUnlocked(wi, si) {
  if (wi === 0 && si === 0) return true;
  if (si > 0) return stageKey(wi, si - 1) in GS.progress;
  return stageKey(wi - 1, WORLDS[wi - 1].stages.length - 1) in GS.progress;
}
function totalStars() { return Object.values(GS.progress).reduce((a, b) => a + b, 0); }

/* ── DOM helpers ── */
function $app() { return document.getElementById('app'); }
function setTopScore() {
  const el = document.getElementById('tb-score');
  if (el) el.textContent = '⭐ ' + totalStars() + ' 顆星';
}
function render(html) {
  const a = $app();
  a.innerHTML = html;
  a.className = 'screen-fade-in';
}

/* ════════════════════════════════════
   MAP SCREEN
════════════════════════════════════ */
function showMap() {
  GS.screen = 'map';
  setTopScore();

  const cards = WORLDS.map((w, wi) => {
    const m = w.meta;
    const cleared = w.stages.filter((_, si) => stageKey(wi, si) in GS.progress).length;
    const total   = w.stages.length;
    const pct     = Math.round(cleared / total * 100);
    const unlocked = isUnlocked(wi, 0);
    const allDone  = cleared === total;
    return `
      <div class="world-card ${unlocked ? 'unlocked' : 'locked'}"
           style="--g1:${m.g1};--g2:${m.g2}"
           ${unlocked ? 'onclick="showWorld(' + wi + ')"' : ''}>
        ${allDone ? '<span class="wc-crown">👑</span>' : (unlocked ? '' : '<span class="wc-lock">🔒</span>')}
        <span class="wc-icon">${m.icon}</span>
        <div class="wc-name">${m.name}</div>
        <div class="wc-desc">${m.desc}</div>
        <div class="wc-progress-wrap"><div class="wc-progress-bar" style="width:${pct}%"></div></div>
        <div class="wc-count">${cleared} / ${total} 關完成</div>
      </div>`;
  }).join('');

  render(`
    <div class="map-hero">
      <span class="map-mascot">🐣</span>
      <h2>漢字大冒險</h2>
      <p>選擇一個世界，開始挑戰吧！</p>
      <div class="map-score-chip">⭐ 累計獲得 ${totalStars()} 顆星</div>
    </div>
    <div class="map-grid">${cards}</div>
  `);
}

/* ════════════════════════════════════
   WORLD / STAGE LIST
════════════════════════════════════ */
function showWorld(wi) {
  GS.worldIdx = wi;
  const w = WORLDS[wi];
  const m = w.meta;

  const nodes = w.stages.map((_, si) => {
    const key     = stageKey(wi, si);
    const stars   = GS.progress[key] ?? -1;
    const unlocked = isUnlocked(wi, si);
    const isBoss  = si === w.stages.length - 1;
    const starStr = stars >= 0 ? ['☆☆☆','⭐☆☆','⭐⭐☆','⭐⭐⭐'][stars] : '尚未挑戰';
    const btnBg   = `background:linear-gradient(135deg,${m.wc1},${m.wc2})`;

    return (si > 0 ? `<div class="stage-connector ${unlocked ? 'active' : ''}"></div>` : '') + `
      <div class="stage-node ${unlocked ? 'unlocked' : 'locked'} ${isBoss ? 'boss-node' : ''}"
           style="--wc1:${m.wc1};--wc2:${m.wc2}">
        <div class="sn-num">${isBoss ? '👑' : si + 1}</div>
        <div class="sn-mid">
          <div class="sn-label">${isBoss ? 'BOSS 關卡' : '第 ' + (si + 1) + ' 關'}</div>
          <div class="sn-stars">${starStr}</div>
        </div>
        ${unlocked
          ? `<button class="play-btn" style="${btnBg}" onclick="startLevel(${wi},${si})">${stars >= 0 ? '再玩' : '開始'} ▶</button>`
          : '<span style="font-size:22px;opacity:.45">🔒</span>'}
      </div>`;
  }).join('');

  render(`
    <div class="world-header" style="background:linear-gradient(135deg,${m.g1},${m.g2})">
      <button class="wh-back" onclick="showMap()">← 返回地圖</button>
      <span class="wh-icon">${m.icon}</span>
      <div class="wh-name">${m.name}</div>
      <div class="wh-enemy">關卡敵人：${m.enemy} ${m.enemyName}</div>
    </div>
    <div class="stage-list">${nodes}</div>
  `);
}

/* ════════════════════════════════════
   GAMEPLAY
════════════════════════════════════ */
function startLevel(wi, si) {
  GS.worldIdx = wi; GS.stageIdx = si; GS.qIdx = 0;
  GS.wrongCount = 0; GS.comboCount = 0; GS.maxCombo = 0;
  GS.currentStageQs = WORLDS[wi].stages[si];
  GS.hp = 100;
  renderPlayScreen();
}

function renderPlayScreen() {
  const wi = GS.worldIdx, si = GS.stageIdx;
  const m     = WORLDS[wi].meta;
  const total = GS.currentStageQs.length;
  const pct   = Math.round(GS.qIdx / total * 100);

  render(`
    <div class="play-hud">
      <button class="hud-back-btn" onclick="showWorld(${wi})" title="返回選關">←</button>
      <div class="hud-center">
        <div class="hud-label">${m.name} · 第 ${si + 1} 關</div>
        <div class="hud-prog-wrap"><div class="hud-prog-bar" id="prog-bar" style="width:${pct}%"></div></div>
        <div class="hud-qcount">第 ${GS.qIdx + 1} / ${total} 題</div>
      </div>
      <div id="combo-slot"></div>
    </div>
    <div class="monster-area">
      <span class="monster-emoji" id="monster">${m.enemy}</span>
      <div class="monster-name">${m.enemyName}</div>
      <div class="hp-wrap">
        <span class="hp-label">HP</span>
        <div class="hp-bar-bg"><div class="hp-bar" id="hp-bar" style="width:100%;background:linear-gradient(90deg,#22C55E,#10B981)"></div></div>
        <span class="hp-num" id="hp-num">100%</span>
      </div>
    </div>
    <div class="q-area" id="q-area"></div>
  `);

  showQuestion();
}

function showQuestion() {
  const q     = GS.currentStageQs[GS.qIdx];
  const total = GS.currentStageQs.length;
  const m     = WORLDS[GS.worldIdx].meta;
  const qArea = document.getElementById('q-area');
  if (!qArea || !q) return;

  const badge = `<div class="q-num-badge">第 ${GS.qIdx + 1} 題 / 共 ${total} 題</div>`;

  if (q.type === 'mc') {
    const letters = ['A','B','C','D','E'];
    const opts = (q.opts || []).map((o, i) => `
      <button class="opt-card" style="--oc:${m.wc1}"
              onclick="handleMC(this,${i},${q.ans})">
        <span class="opt-letter">${letters[i]}</span>${o}
      </button>`).join('');
    qArea.innerHTML = `
      <div class="q-card" id="q-card">
        ${badge}
        <div class="q-text">${q.q}</div>
        <div class="opt-grid" style="${(q.opts||[]).length > 4 ? 'grid-template-columns:1fr' : ''}">${opts}</div>
      </div>`;
  } else {
    qArea.innerHTML = `
      <div class="q-card" id="q-card">
        ${badge}
        <div class="q-text">${q.q}</div>
        ${q.hint ? `<div class="fill-hint">提示：${q.hint}</div>` : ''}
        <input id="fill-input" class="game-input" placeholder="在這裡填寫答案…" autocomplete="off">
        <button id="submit-btn" class="submit-btn" onclick="handleFill()">確認答案 ✓</button>
        <div id="fill-fb"></div>
      </div>`;
    const inp = document.getElementById('fill-input');
    if (inp) {
      inp.focus();
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') handleFill(); });
    }
  }
}

/* ── answer handlers ── */
function handleMC(btn, chosen, correct) {
  document.querySelectorAll('.opt-card').forEach(c => { c.disabled = true; c.onclick = null; });
  const isCorrect = chosen === correct;
  btn.classList.add(isCorrect ? 'correct-anim' : 'wrong-anim');
  if (!isCorrect) {
    const cards = document.querySelectorAll('.opt-card');
    if (cards[correct]) cards[correct].classList.add('show-correct');
  }
  afterAnswer(isCorrect);
  setTimeout(nextQuestion, 1100);
}

function handleFill() {
  const inp = document.getElementById('fill-input');
  const submitBtn = document.getElementById('submit-btn');
  const fb  = document.getElementById('fill-fb');
  if (!inp || inp.disabled) return;

  const val = inp.value.trim();
  const q   = GS.currentStageQs[GS.qIdx];
  const isCorrect = val === q.ans;

  inp.disabled = true;
  if (submitBtn) submitBtn.disabled = true;

  if (fb) {
    fb.innerHTML = isCorrect
      ? `<div class="game-feedback fb-ok">✓ 答對了！正確答案是「${q.ans}」🎉</div>`
      : `<div class="game-feedback fb-wrong">✗ 差一點！正確答案是「${q.ans}」</div>`;
  }

  afterAnswer(isCorrect);
  setTimeout(nextQuestion, 1400);
}

function afterAnswer(isCorrect) {
  if (isCorrect) {
    GS.comboCount++;
    GS.maxCombo = Math.max(GS.maxCombo, GS.comboCount);
    hitMonster();
    floatMsg(true);
  } else {
    GS.wrongCount++;
    GS.comboCount = 0;
    GS.hp = Math.max(0, GS.hp - Math.ceil(100 / GS.currentStageQs.length));
    updateHP();
    const card = document.getElementById('q-card');
    if (card) { card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake'); }
    floatMsg(false);
  }
  const slot = document.getElementById('combo-slot');
  if (slot) {
    slot.innerHTML = GS.comboCount >= 2
      ? `<div class="hud-combo">${GS.comboCount} 連擊🔥</div>` : '';
  }
}

function hitMonster() {
  const m = document.getElementById('monster');
  if (!m) return;
  m.classList.remove('hit'); void m.offsetWidth; m.classList.add('hit');
}

function updateHP() {
  const bar = document.getElementById('hp-bar');
  const num = document.getElementById('hp-num');
  const pct = GS.hp;
  if (bar) {
    bar.style.width = pct + '%';
    bar.style.background = pct > 50
      ? 'linear-gradient(90deg,#22C55E,#10B981)'
      : pct > 20 ? 'linear-gradient(90deg,#F59E0B,#FBBF24)'
      : 'linear-gradient(90deg,#EF4444,#DC2626)';
  }
  if (num) num.textContent = pct + '%';
}

function floatMsg(ok) {
  const msgs = ok
    ? ['答對了！', '太棒了！', '完美！', '好厲害！', '繼續！']
    : ['加油！', '再試試！', '差一點！', '繼續努力！'];
  const el = document.createElement('div');
  el.className = 'float-fb ' + (ok ? 'float-ok' : 'float-err');
  el.textContent = msgs[Math.floor(Math.random() * msgs.length)];
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

function nextQuestion() {
  GS.qIdx++;
  const total = GS.currentStageQs.length;
  if (GS.qIdx >= total) { showLevelComplete(); return; }

  const bar = document.getElementById('prog-bar');
  if (bar) bar.style.width = Math.round(GS.qIdx / total * 100) + '%';
  const qcount = document.querySelector('.hud-qcount');
  if (qcount) qcount.textContent = '第 ' + (GS.qIdx + 1) + ' / ' + total + ' 題';

  showQuestion();
}

/* ════════════════════════════════════
   LEVEL COMPLETE
════════════════════════════════════ */
function showLevelComplete() {
  const wi = GS.worldIdx, si = GS.stageIdx;
  const m     = WORLDS[wi].meta;
  const total = GS.currentStageQs.length;
  const right = total - GS.wrongCount;
  const acc   = Math.round(right / total * 100);
  const stars = acc >= 100 ? 3 : acc >= 80 ? 2 : acc >= 60 ? 1 : 0;

  const key  = stageKey(wi, si);
  if ((GS.progress[key] ?? -1) < stars) GS.progress[key] = stars;
  else if (!(key in GS.progress)) GS.progress[key] = stars;
  saveProgress();
  setTopScore();

  if (stars >= 2) launchConfetti();

  const starHtml = [0,1,2].map(i =>
    `<span class="done-star ${i < stars ? 'lit' : 'dim'}">⭐</span>`).join('');

  const isLastStage = si === WORLDS[wi].stages.length - 1;
  const isLastWorld = wi === WORLDS.length - 1;

  let nextBtn = '';
  if (!isLastStage) {
    nextBtn = `<button class="done-btn next"
      style="background:linear-gradient(135deg,${m.wc1},${m.wc2})"
      onclick="startLevel(${wi},${si + 1})">下一關 ▶</button>`;
  } else if (!isLastWorld) {
    nextBtn = `<button class="done-btn next"
      style="background:linear-gradient(135deg,${WORLD_META[wi+1].g1},${WORLD_META[wi+1].g2})"
      onclick="showWorld(${wi + 1})">下一個世界 ▶</button>`;
  }

  const worldClearBanner = isLastStage && stars > 0
    ? `<div class="world-clear-banner">🏆 ${m.name} 全部通關！</div>` : '';

  render(`
    <div class="done-screen">
      <div class="done-burst">${stars >= 3 ? '🏆' : stars >= 2 ? '🎉' : stars >= 1 ? '👍' : '💪'}</div>
      <div class="done-title">${stars >= 3 ? '完美！滿分通關！' : stars >= 2 ? '太棒了！' : stars >= 1 ? '通關了！繼續加油！' : '繼續努力，你可以的！'}</div>
      <div class="done-subtitle">${stars >= 2 ? '你打敗了 ' + m.enemyName + '！' : '再挑戰一次會更好的！'}</div>
      <div class="done-stars">${starHtml}</div>
      ${worldClearBanner}
      <div class="done-stats">
        <div class="stat-box"><div class="stat-val">${right}</div><div class="stat-lbl">答對題數</div></div>
        <div class="stat-box"><div class="stat-val">${acc}%</div><div class="stat-lbl">正確率</div></div>
        <div class="stat-box"><div class="stat-val">${GS.maxCombo}</div><div class="stat-lbl">最高連擊</div></div>
      </div>
      <div class="done-btns">
        <button class="done-btn retry" onclick="startLevel(${wi},${si})">🔄 再挑戰</button>
        ${nextBtn}
        <button class="done-btn retry" onclick="showWorld(${wi})">📋 選關畫面</button>
      </div>
    </div>
  `);
}

/* ════════════════════════════════════
   CONFETTI
════════════════════════════════════ */
function launchConfetti() {
  const emojis = ['⭐','🌸','🎊','✨','🌟','💫','🎉','🎈','🌺','🍀'];
  for (let i = 0; i < 35; i++) {
    setTimeout(() => {
      const el = document.createElement('span');
      el.className = 'confetti-piece';
      el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      el.style.cssText = 'left:' + (Math.random() * 100) + 'vw;'
        + 'font-size:' + (14 + Math.random() * 16) + 'px;'
        + 'animation-duration:' + (2 + Math.random() * 2.5) + 's;'
        + 'animation-delay:' + (Math.random() * 0.6) + 's;';
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 5000);
    }, i * 55);
  }
}

/* ════════════════════════════════════
   INIT
════════════════════════════════════ */
buildWorlds();
loadProgress();
showMap();
