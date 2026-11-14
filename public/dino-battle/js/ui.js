// 화면: 타이틀, 모험 지도, 공룡 고르기(해금), 결과, 일시정지
window.DB = window.DB || {};

DB.ui = (function () {
  var D = DB.data;
  var S = DB.save;
  var $ = function (id) { return document.getElementById(id); };
  var SCREENS = ['title', 'stages', 'select', 'result', 'pause', 'help'];
  var WORLD_ICON = { jungle: '🌴', desert: '🌵', volcano: '🌋', meadow: '🌼' };

  var state = 'title'; // title | stages | select | play | result | help
  var paused = false;
  var isTouch = false;
  var sel = { mode: 'stage', stageIdx: 0, step: 0, focus: 'trex', picks: [] };
  var last = null; // 마지막 경기 설정 (다시 하기용)
  var cardCanvases = [];
  var previewT = 0;
  var resultSp = null;

  function click() { DB.sound.play('click'); }

  function show(name) {
    SCREENS.forEach(function (s) { $(s).hidden = s !== name; });
    state = name || 'play';
    refreshCoins();
  }

  function refreshCoins() {
    var els = document.querySelectorAll('[data-coins]');
    for (var i = 0; i < els.length; i++) els[i].textContent = '🪙 ' + S.coins;
  }

  var toastTimer = null;
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 1800);
  }

  // ---------- 모험 지도 ----------
  function buildStages() {
    var list = $('stageList');
    list.innerHTML = '';
    var worlds = [];
    D.stages.forEach(function (st, i) {
      if (worlds.indexOf(st.world) < 0) worlds.push(st.world);
    });
    worlds.forEach(function (wid) {
      var box = document.createElement('div');
      box.className = 'world ' + wid;
      var h = document.createElement('h3');
      h.textContent = WORLD_ICON[wid] + ' ' + D.worlds[wid].name;
      box.appendChild(h);
      D.stages.forEach(function (st, i) {
        if (st.world !== wid) return;
        var b = document.createElement('button');
        b.className = 'stg';
        var open = S.stageOpen(i);
        var cleared = i < S.cleared;
        b.disabled = !open;
        b.innerHTML = '<span class="num">' + (i + 1) + '</span><span class="nm"></span><span class="st"></span>';
        b.querySelector('.nm').textContent = st.name;
        b.querySelector('.st').textContent = !open ? '🔒' : cleared ? '⭐' : st.boss ? '👑' : '▶';
        b.addEventListener('click', function () {
          click();
          openSelect('stage', i);
        });
        box.appendChild(b);
      });
      list.appendChild(box);
    });
  }

  // ---------- 공룡 고르기 ----------
  function openSelect(mode, stageIdx) {
    sel.mode = mode;
    sel.stageIdx = stageIdx || 0;
    sel.step = 0;
    sel.picks = [];
    var firstOpen = DB.playable().filter(function (s) { return S.dinoOpen(s.id); })[0];
    if (!S.dinoOpen(sel.focus)) sel.focus = firstOpen.id;
    buildCards();
    renderDetail();
    show('select');
  }

  function selTitle() {
    if (sel.mode === 'stage') return '스테이지 ' + (sel.stageIdx + 1) + ' · 공룡을 골라요';
    return sel.step === 0 ? '🔵 1P 공룡을 골라요' : '🔴 2P 공룡을 골라요';
  }

  function buildCards() {
    var row = $('dinoRow');
    row.innerHTML = '';
    cardCanvases = [];
    DB.playable().forEach(function (sp) {
      var c = document.createElement('button');
      c.className = 'dcard';
      c.dataset.id = sp.id;
      var cv = document.createElement('canvas');
      c.appendChild(cv);
      var nm = document.createElement('div');
      nm.textContent = sp.name;
      c.appendChild(nm);
      var lock = document.createElement('span');
      lock.className = 'lock';
      c.appendChild(lock);
      var tag = document.createElement('span');
      tag.className = 'tag';
      c.appendChild(tag);
      c.addEventListener('click', function () {
        click();
        sel.focus = sp.id;
        renderDetail();
      });
      row.appendChild(c);
      cardCanvases.push({ cv: cv, sp: sp, el: c });
    });
  }

  function updateCards() {
    cardCanvases.forEach(function (o) {
      var open = S.dinoOpen(o.sp.id);
      o.el.classList.toggle('sel', o.sp.id === sel.focus);
      o.el.classList.toggle('locked', !open);
      o.el.querySelector('.lock').textContent = open ? '' : '🔒';
      var tag = o.el.querySelector('.tag');
      tag.className = 'tag';
      tag.textContent = '';
      if (sel.mode === 'pvp' && sel.picks[0] && sel.picks[0].sp === o.sp.id) { tag.textContent = '1P'; tag.classList.add('p1'); }
      DB.draw.preview(o.cv, o.sp, 0.5, { zoom: 0.95 });
    });
  }

  function statRow(label, v) {
    return '<span>' + label + '</span><span class="sb"><i style="width:' + Math.round(Math.max(0.08, Math.min(1, v)) * 100) + '%"></i></span>';
  }

  function renderDetail() {
    var sp = DB.getSpecies(sel.focus);
    var open = S.dinoOpen(sp.id);
    $('selTitle').textContent = selTitle();
    $('dName').textContent = sp.emoji + ' ' + sp.name;
    $('dDesc').textContent = sp.desc;
    $('dStats').innerHTML =
      statRow('체력', (sp.hp - 60) / 100) +
      statRow('힘', (sp.atk - 5) / 6) +
      statRow('빠르기', (sp.spd - 0.6) / 0.6) +
      statRow('점프', ((sp.maxJumps || 2) - 1) / 2.2 + (sp.jump - 0.9) * 0.6);

    var box = $('dSkills');
    box.innerHTML = '';
    var eq = S.equipped(sp.id);
    sp.skills.forEach(function (sid, idx) {
      var def = D.skills[sid];
      var owned = S.skillOpen(sp.id, sid);
      var b = document.createElement('button');
      b.className = 'chip' + (owned && eq === sid ? ' on' : '') + (owned ? '' : ' lock');
      var title = def.icon + ' ' + def.name + ' <small class="d">' + def.desc + '</small><small>다시 쓰기 ' + def.cd + '초</small>';
      var tail = '';
      if (!owned) tail = '<small>🔒 ' + def.cost + '🪙로 열기</small>';
      else if (eq === sid) tail = '<small>✅ 장착 중</small>';
      else tail = '<small>👉 눌러서 장착</small>';
      b.innerHTML = title + tail;
      b.addEventListener('click', function () {
        if (!open) { toast('먼저 이 공룡을 열어야 해요'); return; }
        if (owned) {
          click();
          S.setEquip(sp.id, sid);
        } else if (S.buySkill(sp.id, sid)) {
          DB.sound.play('coin');
          toast('새 기술 ' + def.name + '을(를) 배웠어요!');
        } else {
          toast('코인이 ' + (def.cost - S.coins) + '개 더 필요해요');
          return;
        }
        refreshCoins();
        renderDetail();
      });
      box.appendChild(b);
    });

    var go = $('goBtn');
    var hint = $('goHint');
    hint.textContent = '';
    if (!open) {
      go.className = 'big buy';
      go.textContent = '🔒 ' + sp.unlock.cost + '🪙로 열기';
      hint.textContent = '스테이지 ' + sp.unlock.stage + '를 깨면 무료로 열려요!';
    } else {
      go.className = 'big go';
      if (sel.mode === 'stage') go.textContent = '▶ 출발!';
      else go.textContent = sel.step === 0 ? '1P 결정!' : '2P 결정! 대전 시작';
    }
    updateCards();
  }

  function onGo() {
    var sp = DB.getSpecies(sel.focus);
    if (!S.dinoOpen(sp.id)) {
      if (S.buyDino(sp.id)) {
        DB.sound.play('coin');
        toast(sp.name + '이(가) 친구가 되었어요!');
        refreshCoins();
        renderDetail();
      } else {
        toast('코인이 ' + (sp.unlock.cost - S.coins) + '개 더 필요해요');
      }
      return;
    }
    click();
    var pick = { sp: sp.id, skill: S.equipped(sp.id) };
    if (sel.mode === 'stage') {
      startGame({ mode: 'stage', stageIdx: sel.stageIdx, p1: pick });
    } else if (sel.step === 0) {
      sel.picks[0] = pick;
      sel.step = 1;
      renderDetail();
    } else {
      sel.picks[1] = pick;
      var worlds = ['meadow', 'jungle', 'desert', 'volcano'];
      startGame({ mode: 'pvp', p1: sel.picks[0], p2: sel.picks[1], world: worlds[Math.floor(Math.random() * worlds.length)] });
    }
  }

  function onSelBack() {
    click();
    if (sel.mode === 'pvp' && sel.step === 1) {
      sel.step = 0;
      sel.picks = [];
      renderDetail();
      return;
    }
    if (sel.mode === 'stage') { buildStages(); show('stages'); }
    else show('title');
  }

  // ---------- 경기 ----------
  function startGame(cfg) {
    last = cfg;
    paused = false;
    show(null);
    state = 'play';
    DB.input.build(cfg.mode);
    $('touch').hidden = !isTouch;
    $('pauseBtn').hidden = false;
    document.body.classList.toggle('kb', !isTouch);
    DB.game.start(cfg, onEnd);
  }

  function endPlayUi() {
    $('touch').hidden = true;
    $('pauseBtn').hidden = true;
    DB.input.reset();
  }

  function onEnd(res) {
    endPlayUi();
    var cfg = last;
    var title = $('resTitle'), text = $('resText'), coins = $('resCoins'), nw = $('resNew'), btns = $('resBtns');
    coins.textContent = '';
    nw.textContent = '';
    btns.innerHTML = '';
    if (cfg.mode === 'stage') {
      var idx = cfg.stageIdx;
      resultSp = DB.getSpecies(cfg.p1.sp);
      if (res.win) {
        var info = S.clearStage(idx);
        var gain = D.reward.base + D.reward.perStage * (idx + 1);
        if (info.first) gain *= D.reward.firstClearMul;
        S.addCoins(gain);
        title.textContent = D.stages[idx].final ? '🏆 모험 완료!' : '🎉 승리!';
        text.textContent = D.stages[idx].final ? '화산 대왕을 물리쳤어요! 최고의 공룡이에요!' : '스테이지 ' + (idx + 1) + ' · ' + D.stages[idx].name + ' 클리어!';
        coins.textContent = '🪙 +' + gain + (info.first ? ' (처음 깨서 두 배!)' : '');
        if (info.newDinos.length) nw.textContent = '🥚 새 친구: ' + info.newDinos.map(function (s) { return s.name; }).join(', ') + '이(가) 열렸어요!';
        DB.sound.play('coin');
        if (idx + 1 < D.stages.length) addBtn('▶ 다음 스테이지', 'go wide', function () { startGame({ mode: 'stage', stageIdx: idx + 1, p1: freshPick(cfg.p1.sp) }); });
      } else {
        S.addCoins(5);
        title.textContent = '😢 아쉬워요';
        text.textContent = '조금만 더 하면 이길 수 있어요! 기술을 잘 써 봐요.';
        coins.textContent = '🪙 +5 (도전 코인)';
      }
      addBtn('🔄 다시 하기', '', function () { startGame({ mode: 'stage', stageIdx: idx, p1: freshPick(cfg.p1.sp) }); });
      addBtn('🦖 공룡 바꾸기', '', function () { openSelect('stage', idx); });
      addBtn('🗺️ 모험 지도', 'wide', function () { buildStages(); show('stages'); });
    } else {
      if (res.winner === 0) {
        title.textContent = '🤝 무승부!';
        text.textContent = '둘 다 정말 잘했어요!';
        resultSp = null;
      } else {
        var w = res.winner === 1 ? cfg.p1 : cfg.p2;
        resultSp = DB.getSpecies(w.sp);
        title.textContent = (res.winner === 1 ? '🔵 1P' : '🔴 2P') + ' 승리!';
        text.textContent = resultSp.name + '의 승리예요!' + (res.timeUp ? ' (시간 끝, 체력이 더 많았어요)' : '');
      }
      addBtn('🔄 다시 대전', 'go wide', function () { startGame({ mode: 'pvp', p1: cfg.p1, p2: cfg.p2, world: cfg.world }); });
      addBtn('🦖 공룡 바꾸기', '', function () { openSelect('pvp'); });
      addBtn('🏠 처음으로', '', function () { show('title'); });
    }
    show('result');
  }

  function freshPick(spId) {
    return { sp: spId, skill: S.equipped(spId) };
  }

  function addBtn(label, cls, fn) {
    var b = document.createElement('button');
    b.className = 'big ' + cls;
    b.textContent = label;
    b.addEventListener('click', function () { click(); fn(); });
    $('resBtns').appendChild(b);
  }

  function togglePause() {
    if (state === 'play' && DB.game.G.running && !DB.game.G.over) {
      paused = true;
      state = 'pause';
      DB.input.reset();
      $('pause').hidden = false;
    } else if (state === 'pause') {
      resume();
    }
  }
  function resume() {
    paused = false;
    state = 'play';
    $('pause').hidden = true;
    DB.input.reset();
  }

  // ---------- 매 프레임 ----------
  function tick(dt) {
    previewT += dt;
    if (state === 'select') {
      var sp = DB.getSpecies(sel.focus);
      DB.draw.preview($('bigPrev'), sp, previewT, { run: 0.6, mouth: (previewT % 2.4) < 0.3 });
    } else if (state === 'result') {
      var c = $('resPrev');
      if (resultSp) DB.draw.preview(c, resultSp, previewT, { run: 0, mouth: (previewT % 1.2) < 0.4 });
      else c.getContext('2d').clearRect(0, 0, c.width, c.height);
    }
  }

  function checkRotate() {
    var portrait = window.innerHeight > window.innerWidth * 1.1;
    var r = $('rotate');
    if (portrait && isTouch && !checkRotate.dismissed) r.hidden = false;
    else r.hidden = true;
  }

  function init() {
    isTouch = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || ('ontouchstart' in window);
    window.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'touch' && !isTouch) {
        isTouch = true;
        document.body.classList.remove('kb');
        if (state === 'play' || state === 'pause') $('touch').hidden = false;
      }
    });
    $('bAdv').addEventListener('click', function () { click(); buildStages(); show('stages'); });
    $('bPvp').addEventListener('click', function () { click(); openSelect('pvp'); });
    $('bHelp').addEventListener('click', function () { click(); show('help'); });
    var snd = $('bSound');
    function soundLabel() { snd.textContent = S.muted ? '🔇 소리 꺼짐' : '🔊 소리 켜짐'; }
    soundLabel();
    snd.addEventListener('click', function () { S.setMuted(!S.muted); soundLabel(); click(); });
    document.querySelectorAll('[data-go]').forEach(function (b) {
      b.addEventListener('click', function () { click(); show(b.dataset.go); });
    });
    $('selBack').addEventListener('click', onSelBack);
    $('goBtn').addEventListener('click', onGo);
    $('pauseBtn').addEventListener('click', function () { click(); togglePause(); });
    $('pResume').addEventListener('click', function () { click(); resume(); });
    $('pRetry').addEventListener('click', function () {
      click();
      $('pause').hidden = true;
      DB.game.stop();
      var cfg = last;
      if (cfg.mode === 'stage') cfg = { mode: 'stage', stageIdx: cfg.stageIdx, p1: freshPick(cfg.p1.sp) };
      startGame(cfg);
    });
    $('pQuit').addEventListener('click', function () {
      click();
      paused = false;
      DB.game.stop();
      endPlayUi();
      if (last && last.mode === 'stage') { buildStages(); show('stages'); }
      else show('title');
    });
    $('rotOk').addEventListener('click', function () { checkRotate.dismissed = true; checkRotate(); });
    window.addEventListener('resize', checkRotate);
    checkRotate();
    if (!S.works) toast('이 브라우저에서는 기록이 저장되지 않을 수 있어요');
    show('title');
  }

  return {
    init: init,
    tick: tick,
    togglePause: togglePause,
    get paused() { return paused; },
    get state() { return state; },
    get inGame() { return state === 'play' || state === 'pause' || state === 'result'; },
  };
})();
