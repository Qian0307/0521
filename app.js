/* ================================================================
   APP.JS — 互動邏輯
   ================================================================ */

/* ─── State ─── */
const state = { scores: {}, matchSel: {}, answered: new Set() };

/* ─── Helpers ─── */
const $ = id => document.getElementById(id);
const el = (tag, cls, html='') => { const e = document.createElement(tag); if(cls) e.className=cls; if(html) e.innerHTML=html; return e; };
function norm(s){ return s.trim().replace(/\s/g,''); }
function scoreKey(partId, secIdx){ return `${partId}-${secIdx}`; }

/* ─── Nav ─── */
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    renderView(btn.dataset.part);
  });
});

/* ─── Main render dispatcher ─── */
function renderView(part) {
  const main = $('content');
  main.innerHTML = '';
  if (part === 'games') { renderGames(main); return; }
  const p = PARTS.find(x => String(x.id) === part);
  if (!p) return;
  renderPart(main, p);
}

const PART_DECOS = { 1:'🔡', 2:'🎤', 3:'🎵', 4:'🔄', 5:'⭐' };
const PART_GRADS = {
  1:'linear-gradient(135deg,#FF8DC7,#FF6BAE)',
  2:'linear-gradient(135deg,#FFB96B,#FF9B43)',
  3:'linear-gradient(135deg,#6BCB77,#10C888)',
  4:'linear-gradient(135deg,#74B9FF,#4D96FF)',
  5:'linear-gradient(135deg,#D48AFF,#C77DFF)'
};
const SECTION_EMOJIS = { mc:'🎯', fill:'✏️', fill2:'✏️', error:'🔍', match:'🎀', circle:'⭕', sentence:'🌈' };

/* ─── Part renderer ─── */
function renderPart(container, p) {
  const hdr = el('div', 'part-header');
  hdr.style.background = PART_GRADS[p.id] || p.color;
  hdr.innerHTML = `
    <span class="ph-deco">${PART_DECOS[p.id]||'📚'}</span>
    <h2>${p.title}</h2>
    <p>${p.subtitle}</p>`;
  container.appendChild(hdr);

  p.sections.forEach((sec, si) => {
    const card = el('div','section');
    const emoji = SECTION_EMOJIS[sec.type] || '📖';
    const title = el('span','section-title', emoji + ' ' + sec.title);
    title.style.background = PART_GRADS[p.id] || p.color;
    const scoreSpan = el('span','section-score','得分：<b id="ss-'+p.id+'-'+si+'">0</b> 分');
    const titleRow = el('div');
    titleRow.appendChild(title);
    titleRow.appendChild(scoreSpan);
    card.appendChild(titleRow);
    const rangeEl = el('p','',`<small style="color:#C0A0CC;font-weight:600">${sec.range}，每題 2 分</small>`);
    card.appendChild(rangeEl);

    if (sec.type === 'mc')       renderMC(card, sec.questions, p.id, si, p.color);
    if (sec.type === 'fill')     renderFill(card, sec.questions, p.id, si);
    if (sec.type === 'fill2')    renderFill2(card, sec.questions, p.id, si);
    if (sec.type === 'error')    renderError(card, sec.questions, p.id, si);
    if (sec.type === 'match')    renderMatch(card, sec, p.id, si);
    if (sec.type === 'circle')   renderCircle(card, sec.questions, p.id, si);
    if (sec.type === 'sentence') renderSentence(card, sec.questions, p.id, si, p.color);

    container.appendChild(card);
  });
}

/* ─── MC ─── */
function renderMC(container, qs, partId, si, color) {
  let correct = 0, total = qs.length;
  qs.forEach(q => {
    const block = el('div','q-block');
    block.innerHTML = `<span class="q-num">${q.id}</span><span class="q-text">${q.q}</span>`;
    const optRow = el('div','options');
    let done = false;
    q.opts.forEach((opt, i) => {
      const btn = el('button','opt-btn', opt);
      btn.addEventListener('click', () => {
        if (done) return;
        done = true;
        optRow.querySelectorAll('.opt-btn').forEach((b,j) => {
          b.disabled = true;
          if (j === q.ans) b.classList.add('correct');
        });
        if (i === q.ans) {
          btn.classList.add('correct');
          correct++;
          updateScore(partId, si, correct, total);
        } else {
          btn.classList.add('wrong');
        }
      });
      optRow.appendChild(btn);
    });
    block.appendChild(optRow);
    container.appendChild(block);
  });
}

/* ─── Fill (single blank) ─── */
function renderFill(container, qs, partId, si) {
  let correct = 0, total = qs.length;
  qs.forEach(q => {
    const block = el('div','q-block');
    block.innerHTML = `<span class="q-num">${q.id}</span><span class="q-text">${q.q}</span>`;
    const row = el('div','fill-row');
    const hint = el('span','',`<small style="color:#94A3B8">（${q.hint}）</small>`);
    const inp = el('input','fill-input'); inp.placeholder='填入';
    const btn = el('button','check-btn','確認');
    const fb  = el('span','feedback','');
    let done = false;
    btn.addEventListener('click', () => {
      if (done) return;
      const val = norm(inp.value);
      if (val === norm(q.ans)) {
        inp.classList.add('correct'); fb.className='feedback ok'; fb.textContent='✓ 正確！';
        correct++; done = true; updateScore(partId, si, correct, total);
      } else {
        inp.classList.add('wrong'); fb.className='feedback err'; fb.textContent=`✗ 正確答案：${q.ans}`;
        done = true; updateScore(partId, si, correct, total);
      }
      btn.disabled = true;
    });
    row.append(hint, inp, btn, fb);
    block.appendChild(row);
    container.appendChild(block);
  });
}

/* ─── Fill2 (multiple blanks per question) ─── */
function renderFill2(container, qs, partId, si) {
  let correct = 0, total = qs.reduce((a,q)=>a+q.blanks.length,0);
  qs.forEach(q => {
    const block = el('div','q-block');
    block.innerHTML = `<span class="q-num">${q.id}</span><span class="q-text">${q.q}</span>`;
    const row = el('div','fill-row');
    q.blanks.forEach((b, bi) => {
      const hint = el('span','',`<small style="color:#94A3B8">（${b.hint}）</small>`);
      const inp = el('input','fill-input'); inp.placeholder='填入';
      const btn = el('button','check-btn','確認');
      const fb  = el('span','feedback','');
      let done = false;
      btn.addEventListener('click', () => {
        if (done) return;
        const val = norm(inp.value);
        if (val === norm(b.ans)) {
          inp.classList.add('correct'); fb.className='feedback ok'; fb.textContent='✓';
          correct++; done=true; updateScore(partId, si, correct, total);
        } else {
          inp.classList.add('wrong'); fb.className='feedback err'; fb.textContent=`✗ ${b.ans}`;
          done=true; updateScore(partId, si, correct, total);
        }
        btn.disabled=true;
      });
      row.append(hint, inp, btn, fb);
    });
    block.appendChild(row);
    container.appendChild(block);
  });
}

/* ─── Error correction ─── */
function renderError(container, qs, partId, si) {
  let correct = 0, total = qs.length;
  qs.forEach(q => {
    const block = el('div','q-block');
    block.innerHTML = `<span class="q-num">${q.id}</span><span class="q-text">${q.q}</span>`;
    const row = el('div','error-row');
    const lbl1 = el('label','','錯字：');
    const inp1 = el('input','error-input'); inp1.placeholder='錯字';
    const arr  = el('span','','→');
    const lbl2 = el('label','','正確字：');
    const inp2 = el('input','error-input'); inp2.placeholder='正確字';
    const btn  = el('button','check-btn','確認');
    const fb   = el('span','feedback','');
    let done = false;
    btn.addEventListener('click', () => {
      if (done) return;
      const v1 = norm(inp1.value), v2 = norm(inp2.value);
      const ok = v1 === norm(q.errChar) && v2 === norm(q.corrChar);
      if (ok) {
        fb.className='feedback ok'; fb.textContent=`✓ 正確！（${q.note}）`;
        correct++; done=true; updateScore(partId, si, correct, total);
      } else {
        fb.className='feedback err'; fb.textContent=`✗ 應為：錯字「${q.errChar}」→ 正確「${q.corrChar}」`;
        done=true; updateScore(partId, si, correct, total);
      }
      btn.disabled=true;
    });
    row.append(lbl1, inp1, arr, lbl2, inp2, btn, fb);
    block.appendChild(row);
    container.appendChild(block);
  });
}

/* ─── Matching ─── */
function renderMatch(container, sec, partId, si) {
  const wrapper = el('div','match-container');
  const leftCol  = el('div','match-col');
  const rightCol = el('div','match-col');
  let matchedCount = 0;
  let selLeft = null, selRight = null;

  sec.left.forEach((text, i) => {
    const item = el('div','match-item', text);
    item.dataset.idx = i;
    item.addEventListener('click', () => {
      if (item.classList.contains('matched')) return;
      leftCol.querySelectorAll('.match-item').forEach(x=>x.classList.remove('selected'));
      item.classList.add('selected');
      selLeft = i;
      tryMatch();
    });
    leftCol.appendChild(item);
  });

  sec.right.forEach((text, j) => {
    const item = el('div','match-item', text);
    item.dataset.idx = j;
    item.addEventListener('click', () => {
      if (item.classList.contains('matched')) return;
      rightCol.querySelectorAll('.match-item').forEach(x=>x.classList.remove('selected'));
      item.classList.add('selected');
      selRight = j;
      tryMatch();
    });
    rightCol.appendChild(item);
  });

  function tryMatch() {
    if (selLeft === null || selRight === null) return;
    const correctRight = sec.ans[selLeft];
    const leftItems  = leftCol.querySelectorAll('.match-item');
    const rightItems = rightCol.querySelectorAll('.match-item');
    if (selRight === correctRight) {
      leftItems[selLeft].classList.replace('selected','matched');
      rightItems[selRight].classList.replace('selected','matched');
      matchedCount++;
      updateScore(partId, si, matchedCount, sec.left.length);
    } else {
      leftItems[selLeft].classList.add('wrong-flash');
      rightItems[selRight].classList.add('wrong-flash');
      setTimeout(()=>{
        leftItems[selLeft].classList.remove('wrong-flash','selected');
        rightItems[selRight].classList.remove('wrong-flash','selected');
      }, 600);
    }
    selLeft = null; selRight = null;
  }

  wrapper.append(leftCol, rightCol);
  container.appendChild(wrapper);
  const note = el('p','',`<small style="color:#C0A0CC;margin-top:10px;display:block;font-weight:600">💡 先點左邊的字，再點右邊的解釋，配對正確會變綠色 💚</small>`);
  container.appendChild(note);
}

/* ─── Circle (多音字) ─── */
function renderCircle(container, qs, partId, si) {
  let correct = 0, total = qs.length;
  qs.forEach(q => {
    const block = el('div','q-block');
    block.innerHTML = `<span class="q-num">${q.id}</span><span class="q-text">${q.q}</span>`;
    const optRow = el('div','options');
    let done = false;
    q.opts.forEach((opt, i) => {
      const btn = el('button','opt-btn', opt);
      btn.addEventListener('click', () => {
        if (done) return; done = true;
        optRow.querySelectorAll('.opt-btn').forEach((b,j) => {
          b.disabled=true;
          if (j === q.ans) b.classList.add('correct');
        });
        if (i === q.ans) { btn.classList.add('correct'); correct++; updateScore(partId, si, correct, total); }
        else { btn.classList.add('wrong'); updateScore(partId, si, correct, total); }
      });
      optRow.appendChild(btn);
    });
    block.appendChild(optRow);
    container.appendChild(block);
  });
}

/* ─── Sentence writing ─── */
function renderSentence(container, qs, partId, si, color) {
  qs.forEach(q => {
    const block = el('div','q-block');
    block.innerHTML = `<span class="q-num">${q.id}</span><span class="q-text">請用 <strong>${q.keyword}</strong> 造一個句子：</span>`;
    const ta = el('textarea','sentence-area'); ta.placeholder='在這裡寫下你的句子…';
    const showBtn = el('button','show-example-btn','💡 看參考答案');
    const example = el('div','example-answer',`參考：${q.example}`);
    showBtn.addEventListener('click', () => {
      example.style.display = example.style.display === 'block' ? 'none' : 'block';
    });
    block.appendChild(ta);
    block.appendChild(showBtn);
    block.appendChild(example);
    container.appendChild(block);
  });
}

/* ─── Score update ─── */
function updateScore(partId, si, correct, total) {
  const key = scoreKey(partId, si);
  const pts = correct * 2;
  state.scores[key] = pts;
  const el2 = $('ss-'+partId+'-'+si);
  if (el2) {
    el2.textContent = pts;
    if (correct === total && total > 0) {
      const chip = el2.closest('.section-score');
      if (chip && !chip.dataset.celebrated) {
        chip.dataset.celebrated = '1';
        chip.style.background = 'linear-gradient(135deg,#FFD93D,#FF9B43)';
        chip.style.color = '#fff';
        chip.style.border = 'none';
        chip.innerHTML = `🎉 滿分 ${pts} 分！`;
      }
    }
  }
  refreshTotalScore();
}

function refreshTotalScore() {
  const total = Object.values(state.scores).reduce((a,b)=>a+b,0);
  $('total-score-val').textContent = total;
}

/* ═════════════════════════════════════════════════════════════
   GAMES RENDERER
   ═════════════════════════════════════════════════════════════ */
function renderGames(container) {
  const hdr = el('div','part-header');
  hdr.style.background = 'linear-gradient(135deg,#FF8DC7,#C77DFF,#74B9FF)';
  hdr.innerHTML = `
    <span class="ph-deco">🎮</span>
    <h2>🎮 遊戲區</h2>
    <p>錯字偵探・配對王・闖關挑戰——三個遊戲等著你！</p>`;
  container.appendChild(hdr);

  renderDetectiveGame(container);
  renderKingGame(container);
  renderChallengeGame(container);
}

/* ── Detective game ── */
function renderDetectiveGame(container) {
  const g = GAMES.detective;
  const card = el('div','game-card');
  card.innerHTML = `<div class="game-title">${g.title}</div>
    <div class="game-subtitle">${g.subtitle}</div>
    <div class="game-instructions">${g.instructions}</div>`;

  let correct = 0, total = g.questions.length;
  const scoreEl = el('div','score-display');
  scoreEl.innerHTML = `偵探得分：<b id="det-score">0</b> / ${total*10} 分`;
  card.appendChild(scoreEl);

  g.questions.forEach(q => {
    const block = el('div','q-block');
    block.innerHTML = `<span class="q-num">${q.id}</span><span class="q-text">${q.q}</span>`;
    const row = el('div','error-row');
    const lbl1 = el('label','','錯字：');
    const inp1 = el('input','error-input'); inp1.placeholder='錯字';
    const arr  = el('span','','→');
    const lbl2 = el('label','','正確字：');
    const inp2 = el('input','error-input'); inp2.placeholder='正確字';
    const btn  = el('button','check-btn','確認');
    const fb   = el('span','feedback','');
    let done = false;
    btn.addEventListener('click', () => {
      if (done) return;
      const ok = norm(inp1.value)===norm(q.errChar) && norm(inp2.value)===norm(q.corrChar);
      if (ok) {
        fb.className='feedback ok'; fb.textContent=`✓ +10分！（${q.note}）`;
        correct++;
      } else {
        fb.className='feedback err'; fb.textContent=`✗ 應為：「${q.errChar}」→「${q.corrChar}」`;
      }
      done=true; btn.disabled=true;
      $('det-score').textContent = correct*10;
      // badge
      if (correct === total) showBadge(card,'gold','超級偵探長！滿分 100 分！');
      else if (correct >= 8) showBadge(card,'silver','優秀偵探！繼續加油！');
    });
    row.append(lbl1,inp1,arr,lbl2,inp2,btn,fb);
    block.appendChild(row);
    card.appendChild(block);
  });

  container.appendChild(card);
}

/* ── King match game ── */
function renderKingGame(container) {
  const g = GAMES.king;
  const card = el('div','game-card');
  card.innerHTML = `<div class="game-title">${g.title}</div>
    <div class="game-subtitle">${g.subtitle}</div>
    <div class="game-instructions">${g.instructions}</div>`;

  let totalMatched = 0;
  const scoreEl = el('div','score-display');
  scoreEl.id = 'king-score-el';
  scoreEl.innerHTML = '配對得分：<b id="king-score">0</b> / 200 分';
  card.appendChild(scoreEl);

  [g.group1, g.group2].forEach((grp, gi) => {
    const title = el('h4','',`<br>${grp.title}`);
    card.appendChild(title);
    const note = el('p','',`<small style="color:#94A3B8">先點左邊，再點右邊，配對正確才算分！</small>`);
    card.appendChild(note);

    const area = el('div','king-match-area');
    const leftCol  = el('div','king-col');
    const rightCol = el('div','king-col');
    let selLeft = null, selRight = null;
    let gMatched = 0;

    grp.left.forEach((text, i) => {
      const item = el('div','king-item', text);
      item.dataset.i = i;
      item.dataset.g = gi;
      item.addEventListener('click', () => {
        if (item.classList.contains('matched')) return;
        leftCol.querySelectorAll('.king-item').forEach(x=>x.classList.remove('selected'));
        item.classList.add('selected'); selLeft = i; tryKing();
      });
      leftCol.appendChild(item);
    });

    grp.right.forEach((text, j) => {
      const item = el('div','king-item', text);
      item.dataset.j = j;
      item.dataset.g = gi;
      item.addEventListener('click', () => {
        if (item.classList.contains('matched')) return;
        rightCol.querySelectorAll('.king-item').forEach(x=>x.classList.remove('selected'));
        item.classList.add('selected'); selRight = j; tryKing();
      });
      rightCol.appendChild(item);
    });

    function tryKing() {
      if (selLeft===null||selRight===null) return;
      const leftEls  = leftCol.querySelectorAll('.king-item');
      const rightEls = rightCol.querySelectorAll('.king-item');
      if (selRight === grp.ans[selLeft]) {
        leftEls[selLeft].classList.replace('selected','matched');
        rightEls[selRight].classList.replace('selected','matched');
        gMatched++; totalMatched++;
        $('king-score').textContent = totalMatched * 10;
      } else {
        leftEls[selLeft].classList.add('wrong-flash');
        rightEls[selRight].classList.add('wrong-flash');
        setTimeout(()=>{
          leftEls[selLeft].classList.remove('wrong-flash','selected');
          rightEls[selRight].classList.remove('wrong-flash','selected');
        },600);
      }
      selLeft=null; selRight=null;
    }

    area.append(leftCol, rightCol);
    card.appendChild(area);
  });

  container.appendChild(card);
}

/* ── Challenge game ── */
function renderChallengeGame(container) {
  const g = GAMES.challenge;
  const card = el('div','game-card');
  card.innerHTML = `<div class="game-title">${g.title}</div>
    <div class="game-subtitle">${g.subtitle}</div>
    <div class="game-instructions">${g.instructions}</div>`;

  const lvls = [g.level1, g.level2, g.level3];
  const passReqs = [4,4,4];
  const passes = [false,false,false];
  const scoreEl = el('div','score-display');
  scoreEl.id='chal-score-el';
  scoreEl.innerHTML='闖關進度：<b id="chal-pass">0</b> / 3 關通過';
  card.appendChild(scoreEl);

  lvls.forEach((lv, li) => {
    const box = el('div','challenge-level');
    const badge = el('span','level-badge', lv.badge);
    badge.style.background = lv.color;
    box.appendChild(badge);
    let correct = 0, total = lv.questions.length;
    const lvScore = el('p','',`<small style="color:#94A3B8">（${passReqs[li]}題以上正確即可過關）&nbsp;&nbsp;得分：<b id="lv-score-${li}">0</b>/${total}</small>`);
    box.appendChild(lvScore);

    if (lv.type === 'fill') {
      lv.questions.forEach(q => {
        const block = el('div','q-block');
        block.innerHTML = `<span class="q-num">${q.id}</span><span class="q-text">${q.q}</span>`;
        const row = el('div','fill-row');
        const hint = el('span','',`<small style="color:#94A3B8">（${q.hint}）</small>`);
        const inp = el('input','fill-input'); inp.placeholder='填入';
        const btn = el('button','check-btn','確認');
        const fb  = el('span','feedback','');
        let done = false;
        btn.addEventListener('click', () => {
          if(done)return;
          if(norm(inp.value)===norm(q.ans)){
            inp.classList.add('correct');fb.className='feedback ok';fb.textContent='✓ 正確！';
            correct++;
          } else {
            inp.classList.add('wrong');fb.className='feedback err';fb.textContent=`✗ 答案：${q.ans}`;
          }
          done=true;btn.disabled=true;
          $('lv-score-'+li).textContent=correct;
          checkPass(li, correct, total);
        });
        row.append(hint,inp,btn,fb);
        block.appendChild(row); box.appendChild(block);
      });
    }

    if (lv.type === 'mc') {
      lv.questions.forEach(q => {
        const block = el('div','q-block');
        block.innerHTML = `<span class="q-num">${q.id}</span><span class="q-text">${q.q}</span>`;
        const optRow = el('div','options');
        let done=false;
        q.opts.forEach((opt,i)=>{
          const btn = el('button','opt-btn',opt);
          btn.addEventListener('click',()=>{
            if(done)return;done=true;
            optRow.querySelectorAll('.opt-btn').forEach((b,j)=>{
              b.disabled=true; if(j===q.ans)b.classList.add('correct');
            });
            if(i===q.ans){btn.classList.add('correct');correct++;}
            else btn.classList.add('wrong');
            $('lv-score-'+li).textContent=correct;
            checkPass(li,correct,total);
          });
          optRow.appendChild(btn);
        });
        block.appendChild(optRow); box.appendChild(block);
      });
    }

    if (lv.type === 'error') {
      lv.questions.forEach(q => {
        const block = el('div','q-block');
        block.innerHTML = `<span class="q-num">${q.id}</span><span class="q-text">${q.q}</span>`;
        const row = el('div','error-row');
        const lbl1=el('label','','錯字：');
        const inp1=el('input','error-input');inp1.placeholder='錯字';
        const arr=el('span','','→');
        const lbl2=el('label','','正確字：');
        const inp2=el('input','error-input');inp2.placeholder='正確字';
        const btn=el('button','check-btn','確認');
        const fb=el('span','feedback','');
        let done=false;
        btn.addEventListener('click',()=>{
          if(done)return;
          const ok=norm(inp1.value)===norm(q.errChar)&&norm(inp2.value)===norm(q.corrChar);
          if(ok){fb.className='feedback ok';fb.textContent=`✓ 正確！`;correct++;}
          else{fb.className='feedback err';fb.textContent=`✗ 應為：「${q.errChar}」→「${q.corrChar}」`;}
          done=true;btn.disabled=true;
          $('lv-score-'+li).textContent=correct;
          checkPass(li,correct,total);
        });
        row.append(lbl1,inp1,arr,lbl2,inp2,btn,fb);
        block.appendChild(row);box.appendChild(block);
      });
    }

    card.appendChild(box);
  });

  function checkPass(li, correct, total) {
    if (!passes[li] && correct >= passReqs[li]) {
      passes[li] = true;
      const passCount = passes.filter(Boolean).length;
      $('chal-pass').textContent = passCount;
      if (passCount === 3) showBadge(card,'gold','🏆 語文小英雄！三關全部通過！');
      else if (passCount >= 2) showBadge(card,'silver','🥈 通過兩關！繼續加油！');
    }
  }

  container.appendChild(card);
}

/* ── Badge helper ── */
function showBadge(container, type, text) {
  const existing = container.querySelector('.badge');
  if (existing) existing.remove();
  const b = el('div','badge badge-'+type, text);
  container.appendChild(b);
}

/* ═════════════════════════════════════════════════════════════
   (解答已移除)
   ═════════════════════════════════════════════════════════════ */
function renderAnswers_REMOVED(container) {
  const hdr = el('div','part-header');
  hdr.style.background = '#64748B';
  hdr.innerHTML = '<h2>✅ 完整解答</h2><p>對照答案，看看你做對了幾題！</p>';
  container.appendChild(hdr);

  const answerData = [
    { title:"第一部分：形近字 — 選擇題（第1～20題）", items:[
      "1→B（己）","2→C（已）","3→B（多一點）","4→C（本）","5→C（末）",
      "6→A（目比日多一橫）","7→B（王比工多一橫）","8→C（百）",
      "9→A（自比白多一撇）","10→C（千）","11→A（牛有撇）","12→B（正比止多一橫）",
      "13→A（少比小多一撇）","14→A（土上短下長）","15→A（入左撇短）","16→C（力）",
      "17→A（由比田多一豎）","18→C（目）","19→C（犬）","20→A（目光）"
    ]},
    { title:"形近字 — 填空題（第21～35題）", items:[
      "21→已","22→自","23→太","24→木","25→本","26→末","27→王","28→工",
      "29→百","30→白","31→牛","32→午","33→正","34→止","35→土"
    ]},
    { title:"形近字 — 改錯題（第36～45題）", items:[
      "36→己改已","37→末改木","38→牛改午","39→百改自","40→百改白",
      "41→大改王","42→刀改力","43→正改止","44→午改牛","45→入改八"
    ]},
    { title:"形近字 — 配對題（第46～50）", items:[
      "已→B（已經）","己→C（自己）","木→D（木頭）","本→A（一本書）","末→E（週末）"
    ]},
    { title:"第二部分：音近字 — 選擇題（第51～70題）", items:[
      "51→A（在）","52→B（再）","53→A（做）","54→A（作）","55→B（已）",
      "56→A（以）","57→A（他）","58→B（她）","59→C（牠）","60→B（哪）",
      "61→A（那）","62→A（季）","63→A（記）","64→A（份）","65→B（分）",
      "66→A（圓）","67→B（原）","68→B（是）","69→A（事）","70→B（她）"
    ]},
    { title:"音近字 — 填空題（第71～85題）", items:[
      "71→在","72→再","73→在","74→做","75→作","76→以","77→以",
      "78→他","79→她","80→牠","81→哪","82→那","83→季","84→記","85→份"
    ]},
    { title:"音近字 — 改錯題（第86～95題）", items:[
      "86→再改在","87→在改再","88→作改做","89→做改作","90→已改以",
      "91→他改她","92→那改哪","93→哪改那","94→事改是","95→他改牠"
    ]},
    { title:"音近字 — 配對題（第96～100）", items:[
      "在→B（地點）","再→C（重複）","做→D（行動）","作→E（書面語）","以→A（可以）"
    ]},
    { title:"第三部分：聲調 — 選擇題（第101～115題）", items:[
      "101→A（一聲）","102→B（三聲）","103→C（四聲）","104→B（三聲）","105→C（四聲）",
      "106→B（三聲）","107→C（四聲）","108→A（一聲）","109→B（二聲）","110→C（三聲）",
      "111→D（四聲）","112→D（四聲）","113→A（一聲）","114→B（二聲）","115→C（三聲）"
    ]},
    { title:"聲調 — 填空題（第116～125題）", items:[
      "116→一","117→三","118→四","119→三","120→四",
      "121→三","122→二","123→三","124→一","125→四"
    ]},
    { title:"聲調 — 配對題（第126～130）", items:[
      "媽→C（ㄇㄚ）","馬→B（ㄇㄚˇ）","罵→E（ㄇㄚˋ）","買→D（ㄇㄞˇ）","賣→A（ㄇㄞˋ）"
    ]},
    { title:"第四部分：多音字 — 選擇題（第131～145題）", items:[
      "131→A（ㄒㄧㄥˊ）","132→B（ㄏㄤˊ）","133→A（ㄓㄤˇ）","134→B（ㄔㄤˊ）",
      "135→A（ㄌㄜˋ）","136→B（ㄩㄝˋ）","137→A（ㄕㄨˋ）","138→B（ㄕㄨˇ）",
      "139→A（ㄓㄨㄥ）","140→B（ㄓㄨㄥˋ）","141→A（ㄓㄨㄥˋ）","142→B（ㄔㄨㄥˊ）",
      "143→A（ㄓㄜ˙）","144→B（ㄓㄠˊ）","145→B（ㄐㄧㄚˋ）"
    ]},
    { title:"多音字 — 填空/圈題（第146～160題）", items:[
      "146→ㄒㄧㄥˊ","147→ㄏㄤˊ","148→ㄔㄤˊ","149→ㄓㄤˇ","150→ㄩㄝˋ",
      "151→ㄌㄜˋ","152→ㄕㄨˇ","153→ㄕㄨˋ","154→ㄓㄜ˙","155→ㄓㄠˊ",
      "156→ㄒㄧㄥˊ","157→ㄏㄤˊ","158→ㄔㄤˊ","159→ㄩㄝˋ","160→ㄓㄜ˙"
    ]},
    { title:"第五部分：綜合 — 選擇題（第161～170題）", items:[
      "161→A（在）","162→B（再）","163→A（力）","164→A（做）","165→A（午）",
      "166→B（本）","167→B（哪）","168→A（那）","169→B（ㄔㄤˊ）","170→A（ㄓㄤˇ）"
    ]},
    { title:"綜合 — 填空題（第171～180題）", items:[
      "171→已、以","172→在、再","173→作、做","174→他","175→她","176→牠",
      "177→買","178→賣","179→帶","180→自"
    ]},
    { title:"綜合 — 改錯題（第181～190題）", items:[
      "181→在改再","182→再改在","183→做改作（作者）","184→他改牠",
      "185→牛改午","186→白改自","187→那改哪","188→百改白","189→己改已","190→她改牠"
    ]},
    { title:"造句題（第191～200題）參考答案", items:[
      "191→我已經完成今天的作業了。",
      "192→我吃完飯，再去洗碗。",
      "193→媽媽在廚房做飯。",
      "194→媽媽去市場買新鮮的蔬菜。",
      "195→這家店賣好吃的麵包。",
      "196→你的書包放在哪裡？",
      "197→這條路很長，走了好久才到。",
      "198→小花每天喝牛奶，長大了很健康。",
      "199→今天太陽很大，出門要帶帽子。",
      "200→我每天自己整理書包，不要媽媽幫忙。"
    ]},
    { title:"遊戲一：錯字偵探", items:[
      "D1→己改已","D2→牛改午","D3→落改樂","D4→末改木","D5→做改作",
      "D6→他改她","D7→那改哪","D8→他改牠","D9→百改自","D10→在改再"
    ]},
    { title:"遊戲二：配對王 — 第一組", items:[
      "媽→ㄇㄚ","馬→ㄇㄚˇ","罵→ㄇㄚˋ","買→ㄇㄞˇ","賣→ㄇㄞˋ",
      "書→ㄕㄨ","熟→ㄕㄨˊ","鼠→ㄕㄨˇ","樹→ㄕㄨˋ","行（走路）→ㄒㄧㄥˊ"
    ]},
    { title:"遊戲二：配對王 — 第二組", items:[
      "在→地點","再→重複","做→動詞行動","作→書面語","他→男性",
      "她→女性","牠→動物","已→表示完成","以→可以/以前","哪→問句"
    ]},
    { title:"遊戲三：闖關挑戰", items:[
      "L1-1→ㄇㄞˇ","L1-2→ㄇㄞˋ","L1-3→ㄔㄤˊ","L1-4→ㄓㄤˇ","L1-5→ㄌㄜˋ",
      "L2-1→在","L2-2→做","L2-3→她","L2-4→哪","L2-5→已",
      "L3-1→己改已","L3-2→他改她","L3-3→他改牠","L3-4→落改樂","L3-5→牛改午"
    ]}
  ];

  answerData.forEach(sec => {
    const card = el('div','answer-section');
    card.innerHTML = `<h3>${sec.title}</h3>`;
    const grid = el('div','answer-grid');
    sec.items.forEach(item => {
      const chip = el('div','answer-chip');
      const [num, ...rest] = item.split('→');
      chip.innerHTML = `<div class="anum">題號 ${num}</div><div class="aval">${rest.join('→')}</div>`;
      grid.appendChild(chip);
    });
    card.appendChild(grid);
    container.appendChild(card);
  });
}

/* ─── Init ─── */
renderView('1');
