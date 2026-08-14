/* Widget "Gợi ý hôm nay" + "Nghỉ 5 phút" (câu đố, nhắc nghỉ, mini game) — thuần client-side */
(function(){
  const D = window.FUN_DATA;
  if(!D) return;

  function esc(s){ return (s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  // seed theo ngày (giờ địa phương) → cả phòng thấy cùng nội dung trong 1 ngày
  const now = new Date();
  const dayKey = `${now.getFullYear()}-${now.getMonth()+1}-${now.getDate()}`;
  let seed = 0;
  for(const c of dayKey) seed = (seed*31 + c.charCodeAt(0)) >>> 0;
  const pick = (arr, salt) => arr[(seed + salt*2654435761) % arr.length];

  /* ---------- Gợi ý hôm nay ---------- */
  document.getElementById('dailyBody').innerHTML = `
    <div class="daily-item"><span class="daily-tag" style="background:var(--col-link);color:var(--col-link-ink)">Châm ngôn</span><p>“${esc(pick(D.quotes, 1))}”</p></div>
    <div class="daily-item"><span class="daily-tag" style="background:var(--col-taily);color:var(--col-taily-ink)">Tip nghiệp vụ</span><p>${esc(pick(D.tips, 2))}</p></div>
    <div class="daily-item"><span class="daily-tag" style="background:var(--col-viec);color:var(--col-viec-ink)">Mẹo nhỏ</span><p>${esc(pick(D.hacks, 3))}</p></div>
  `;

  /* ---------- Câu đố hôm nay ---------- */
  const quiz = pick(D.quiz, 4);
  const quizEl = document.getElementById('funQuiz');
  quizEl.innerHTML = `
    <p class="fun-quiz-q">🤔 ${esc(quiz.q)}</p>
    <button class="fun-btn" id="quizReveal">Xem đáp án</button>
    <p class="fun-quiz-a" id="quizAnswer" style="display:none">💡 ${esc(quiz.a)}</p>
  `;
  document.getElementById('quizReveal').addEventListener('click', () => {
    document.getElementById('quizAnswer').style.display = 'block';
    document.getElementById('quizReveal').style.display = 'none';
  });

  /* ---------- Nhắc nghỉ + đếm ngược 5 phút ---------- */
  const remEl = document.getElementById('funReminder');
  let remIdx = (seed + new Date().getHours()) % D.reminders.length;
  function renderReminder(){
    remEl.innerHTML = `
      <p class="fun-rem-text">${esc(D.reminders[remIdx])}</p>
      <div class="fun-rem-actions">
        <button class="fun-btn" id="remNext" title="Gợi ý khác">↻</button>
        <button class="fun-btn" id="remTimer">⏱ Bấm giờ 5:00</button>
      </div>
      <p class="fun-timer" id="remClock"></p>
    `;
    document.getElementById('remNext').addEventListener('click', () => {
      remIdx = (remIdx + 1) % D.reminders.length;
      renderReminder();
    });
    document.getElementById('remTimer').addEventListener('click', startBreakTimer);
  }
  let breakTimer = null;
  function startBreakTimer(){
    clearInterval(breakTimer);
    let left = 5*60;
    const clock = document.getElementById('remClock');
    const tick = () => {
      const m = Math.floor(left/60), s = left%60;
      clock.textContent = left > 0
        ? `⏳ Còn ${m}:${String(s).padStart(2,'0')} — nghỉ đi, việc vẫn ở đó thôi!`
        : '✅ Hết 5 phút — quay lại chiến tiếp nào!';
      if(left <= 0) clearInterval(breakTimer);
      left--;
    };
    tick();
    breakTimer = setInterval(tick, 1000);
  }
  renderReminder();

  /* ---------- Game hôm nay: mỗi ngày một game, cả phòng thấy cùng nhau ---------- */
  const gameBody = document.getElementById('gameBody');
  const GAMES = [
    {id:'guess', label:'🎯 Đoán số', render:renderGuess},
    {id:'simon', label:'🎨 Simon', render:renderSimon},
    {id:'puzzle', label:'🔢 Xếp số', render:renderPuzzle}
  ];
  const todayGame = pick(GAMES, 5);
  const tabsEl = document.getElementById('gameTabs');
  tabsEl.innerHTML = `
    <span class="game-of-day">🎮 Game hôm nay</span>
    <button data-g="${todayGame.id}">${todayGame.label} — Chơi</button>
  `;
  const gameBtn = tabsEl.querySelector('button');
  let gameOpen = false;
  gameBtn.addEventListener('click', () => {
    gameOpen = !gameOpen;
    gameBtn.classList.toggle('on', gameOpen);
    gameBtn.textContent = gameOpen ? `${todayGame.label} — Đóng` : `${todayGame.label} — Chơi`;
    if(gameOpen) todayGame.render();
    else gameBody.innerHTML = '';
  });

  /* --- Đoán số 1–100 --- */
  function renderGuess(){
    let secret = 1 + Math.floor(Math.random()*100);
    let tries = 0;
    gameBody.innerHTML = `
      <p class="fun-game-hint">Mình đang nghĩ một số từ 1 đến 100. Đoán xem!</p>
      <div class="fun-guess-row">
        <input type="number" min="1" max="100" id="guessInput" placeholder="1–100">
        <button class="fun-btn" id="guessBtn">Đoán</button>
      </div>
      <p class="fun-game-msg" id="guessMsg"></p>
    `;
    const input = document.getElementById('guessInput');
    const msg = document.getElementById('guessMsg');
    const check = () => {
      const v = parseInt(input.value, 10);
      if(!v || v < 1 || v > 100){ msg.textContent = 'Nhập số từ 1 đến 100 nhé.'; return; }
      tries++;
      if(v === secret){
        msg.innerHTML = `🎉 Chuẩn luôn! Số <b>${secret}</b> — bạn đoán ${tries} lần. <button class="fun-btn" id="guessAgain">Chơi lại</button>`;
        document.getElementById('guessAgain').addEventListener('click', renderGuess);
      } else {
        msg.textContent = (v < secret ? '📈 Cao hơn nữa!' : '📉 Thấp hơn!') + ` (lần ${tries})`;
        input.value = ''; input.focus();
      }
    };
    document.getElementById('guessBtn').addEventListener('click', check);
    input.addEventListener('keydown', e => { if(e.key === 'Enter') check(); });
    input.focus();
  }

  /* --- Simon: ghi nhớ dãy màu --- */
  function renderSimon(){
    const COLORS = ['#E4574B','#3E9B75','#3C7DBF','#E7A93B'];
    let seq = [], pos = 0, playing = false, best = 0;
    gameBody.innerHTML = `
      <p class="fun-game-hint">Nhớ thứ tự các ô sáng rồi bấm lại đúng thứ tự.</p>
      <div class="simon-grid" id="simonGrid">
        ${COLORS.map((c,i) => `<button class="simon-cell" data-i="${i}" style="background:${c}"></button>`).join('')}
      </div>
      <p class="fun-game-msg" id="simonMsg"><button class="fun-btn" id="simonStart">▶ Bắt đầu</button></p>
    `;
    const cells = [...document.querySelectorAll('.simon-cell')];
    const msg = document.getElementById('simonMsg');
    const flash = (i, ms=380) => new Promise(res => {
      cells[i].classList.add('lit');
      setTimeout(() => { cells[i].classList.remove('lit'); setTimeout(res, 140); }, ms);
    });
    async function playSeq(){
      playing = true;
      msg.textContent = `Vòng ${seq.length} — nhìn kỹ nhé...`;
      await new Promise(r => setTimeout(r, 500));
      for(const i of seq) await flash(i);
      msg.textContent = 'Đến lượt bạn!';
      pos = 0; playing = false;
    }
    function nextRound(){
      seq.push(Math.floor(Math.random()*4));
      playSeq();
    }
    document.getElementById('simonStart').addEventListener('click', () => { seq = []; nextRound(); });
    cells.forEach(cell => cell.addEventListener('click', async () => {
      if(playing || !seq.length) return;
      const i = +cell.dataset.i;
      await flash(i, 180);
      if(i === seq[pos]){
        pos++;
        if(pos === seq.length){
          best = Math.max(best, seq.length);
          msg.textContent = '✔ Chính xác!';
          setTimeout(nextRound, 700);
        }
      } else {
        msg.innerHTML = `💥 Sai rồi! Bạn nhớ được <b>${seq.length-1}</b> bước (kỷ lục: ${best}). <button class="fun-btn" id="simonStart2">Chơi lại</button>`;
        seq = [];
        document.getElementById('simonStart2').addEventListener('click', () => { seq = []; nextRound(); });
      }
    }));
  }

  /* --- 15-puzzle bản 3×3 (xếp 1–8) --- */
  function renderPuzzle(){
    let tiles, blank, moves;
    function shuffle(){
      tiles = [1,2,3,4,5,6,7,8,0];
      blank = 8; moves = 0;
      // xáo bằng các nước đi hợp lệ → luôn giải được
      for(let k=0; k<200; k++){
        const opts = neighbors(blank);
        const pickI = opts[Math.floor(Math.random()*opts.length)];
        [tiles[blank], tiles[pickI]] = [tiles[pickI], tiles[blank]];
        blank = pickI;
      }
    }
    function neighbors(i){
      const r = Math.floor(i/3), c = i%3, out = [];
      if(r > 0) out.push(i-3);
      if(r < 2) out.push(i+3);
      if(c > 0) out.push(i-1);
      if(c < 2) out.push(i+1);
      return out;
    }
    const won = () => tiles.every((t, i) => t === (i === 8 ? 0 : i+1));
    function draw(){
      gameBody.innerHTML = `
        <p class="fun-game-hint">Bấm ô cạnh ô trống để xếp về thứ tự 1→8.</p>
        <div class="puzzle-grid">
          ${tiles.map((t, i) => t === 0
            ? `<span class="puzzle-cell blank"></span>`
            : `<button class="puzzle-cell" data-i="${i}">${t}</button>`).join('')}
        </div>
        <p class="fun-game-msg" id="puzzleMsg">${won()
          ? `🎉 Xong trong <b>${moves}</b> nước! <button class="fun-btn" id="puzzleAgain">Chơi lại</button>`
          : `Số nước: ${moves} <button class="fun-btn" id="puzzleShuffle">↻ Xáo lại</button>`}</p>
      `;
      gameBody.querySelectorAll('.puzzle-cell[data-i]').forEach(btn => btn.addEventListener('click', () => {
        const i = +btn.dataset.i;
        if(neighbors(blank).includes(i)){
          [tiles[blank], tiles[i]] = [tiles[i], tiles[blank]];
          blank = i; moves++;
          draw();
        }
      }));
      const again = document.getElementById('puzzleAgain') || document.getElementById('puzzleShuffle');
      if(again) again.addEventListener('click', () => { shuffle(); draw(); });
    }
    shuffle();
    draw();
  }
})();
