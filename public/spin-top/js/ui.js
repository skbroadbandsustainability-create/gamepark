// 화면(메뉴, 선택, 강화, 전투 HUD, 결과)과 게임 흐름
window.ST = window.ST || {};

ST.UI = (function () {
  var D = ST.data;
  var $ = function (id) { return document.getElementById(id); };

  var app = {
    screen: 'title',
    selectMode: 'ai',      // 'ai' | 'pvp1' | 'pvp2' | 'upgrade'
    picked: 'aqua',
    p1: 'aqua', p2: 'flame',
    difficulty: 'normal',
    battle: null, ai: null,
    lastOpts: null,
    paused: false,
    resultShown: false,
    spinWarned: [false, false],
  };

  function show(id) {
    ['title', 'select'].forEach(function (s) { $(s).hidden = s !== id; });
    $('hud').hidden = id !== 'hud';
    $('touch').hidden = id !== 'hud';
    app.screen = id;
  }

  function hex(c) { return '#' + ('000000' + c.toString(16)).slice(-6); }

  // ---------------------------------------------------------------
  // 타이틀
  // ---------------------------------------------------------------
  function goTitle() {
    endBattle();
    show('title');
    $('titleCoins').textContent = ST.save.coins;
    ST.Render.setMenuShift(0);
    ST.Render.setMenu(app.picked);
  }

  // ---------------------------------------------------------------
  // 팽이 선택 / 강화 화면
  // ---------------------------------------------------------------
  function goSelect(mode) {
    endBattle();
    app.selectMode = mode;
    if (mode === 'pvp2') app.picked = app.p2;
    show('select');
    ST.Render.setMenuShift(0.27);
    var titles = { ai: '🤖 내 팽이 고르기', pvp1: '👤 1P 팽이 고르기', pvp2: '👤 2P 팽이 고르기', upgrade: '🔧 팽이 강화' };
    $('selTitle').textContent = titles[mode];
    $('selTitle').className = mode === 'pvp2' ? 'p2c' : mode === 'pvp1' ? 'p1c' : '';
    $('diffRow').hidden = mode !== 'ai';
    $('selGo').hidden = mode === 'upgrade';
    $('upRow').hidden = mode !== 'upgrade';
    $('selGo').textContent = mode === 'ai' ? '⚔️ 배틀 시작!' : mode === 'pvp1' ? '다음: 2P 고르기 ▶' : '⚔️ 배틀 시작!';
    buildGrid();
    pick(app.picked);
  }

  function buildGrid() {
    var grid = $('topGrid');
    grid.innerHTML = '';
    D.tops.forEach(function (t) {
      var b = document.createElement('button');
      b.className = 'topCard';
      b.dataset.id = t.id;
      b.innerHTML =
        '<span class="dot" style="background:' + hex(t.color) + ';box-shadow:0 0 0 4px ' + hex(t.ring) + ' inset"></span>' +
        '<span class="tn">' + t.name + '</span>' +
        '<span class="tl">' + t.emoji + ' Lv' + ST.save.level(t.id) + '</span>';
      b.addEventListener('click', function () { pick(t.id); });
      grid.appendChild(b);
    });
  }

  function statBar(label, v) {
    var pct = Math.max(4, Math.min(100, v * 100));
    return '<div class="stat"><span>' + label + '</span><div class="sbar"><i style="width:' + pct + '%"></i></div></div>';
  }

  function pick(id) {
    app.picked = id;
    $('selCoins').textContent = ST.save.coins;
    var t = ST.getTop(id), lv = ST.save.level(id), st = ST.calcStats(t, lv);
    var cards = document.querySelectorAll('.topCard');
    for (var i = 0; i < cards.length; i++) cards[i].classList.toggle('on', cards[i].dataset.id === id);
    var tr = D.traits[t.trait], sk = D.skills[t.skill];
    var html =
      '<div class="dHead"><b>' + t.emoji + ' ' + t.name + '</b><span class="badge">' + t.type + ' · Lv' + lv + '</span></div>' +
      '<div class="dDesc">' + t.desc + '</div>' +
      '<div class="stats">' +
      statBar('HP ' + st.maxHp, st.maxHp / 190) +
      statBar('공격', st.atk / 21) +
      statBar('방어', st.def / 21) +
      statBar('속도', st.spd / 28) +
      statBar('무게', st.mass / 1.7) +
      statBar('지구력', (2.3 - st.decay) / 1.2) +
      '</div>' +
      '<div class="ability"><b>' + tr.icon + ' 특성: ' + tr.name + '</b><br>' + tr.desc + '</div>' +
      '<div class="ability"><b>' + sk.icon + ' 기술: ' + sk.name + '</b> <small>(다시 쓰기 ' + sk.cooldown + '초)</small><br>' + sk.desc + '</div>';
    $('detail').innerHTML = html;
    ST.Render.setMenu(id);
    if (app.selectMode === 'upgrade') updateUpgrade();
  }

  function updateUpgrade() {
    var id = app.picked, lv = ST.save.level(id), cost = ST.save.upgradeCost(id);
    $('selCoins').textContent = ST.save.coins;
    var t = ST.getTop(id);
    if (cost === null) {
      $('upInfo').innerHTML = '최고 레벨이에요! 🏆';
      $('upBtn').disabled = true;
      $('upBtn').textContent = 'MAX';
      return;
    }
    var now = ST.calcStats(t, lv), next = ST.calcStats(t, lv + 1);
    $('upInfo').innerHTML = 'Lv' + lv + ' → <b>Lv' + (lv + 1) + '</b><br>' +
      'HP ' + now.maxHp + '→' + next.maxHp + ' · 공격 ' + now.atk.toFixed(1) + '→' + next.atk.toFixed(1) +
      ' · 방어 ' + now.def.toFixed(1) + '→' + next.def.toFixed(1);
    $('upBtn').disabled = ST.save.coins < cost;
    $('upBtn').textContent = '강화 🪙' + cost;
  }

  function doUpgrade() {
    if (ST.save.tryUpgrade(app.picked)) {
      buildGrid();
      pick(app.picked);
      toast('강화 성공! ✨ Lv' + ST.save.level(app.picked));
    }
  }

  function selectGo() {
    if (app.selectMode === 'ai') {
      app.p1 = app.picked;
      var others = D.tops.filter(function (t) { return t.id !== app.p1; });
      var aiTop = others[Math.floor(Math.random() * others.length)].id;
      var cfg = D.ai[app.difficulty];
      var myLv = ST.save.level(app.p1);
      var aiLv = cfg.levelMode === 'one' ? 1 : Math.min(D.upgrade.maxLevel, myLv + cfg.levelBonus);
      startBattle({ mode: 'ai', p1: app.p1, p2: aiTop, l1: myLv, l2: aiLv, difficulty: app.difficulty });
    } else if (app.selectMode === 'pvp1') {
      app.p1 = app.picked;
      goSelect('pvp2');
    } else if (app.selectMode === 'pvp2') {
      app.p2 = app.picked;
      app.picked = app.p1;
      startBattle({ mode: 'pvp', p1: app.p1, p2: app.p2, l1: ST.save.level(app.p1), l2: ST.save.level(app.p2) });
    }
  }

  // ---------------------------------------------------------------
  // 전투
  // ---------------------------------------------------------------
  function startBattle(opts) {
    endBattle();
    app.lastOpts = opts;
    app.battle = new ST.Battle(opts);
    app.ai = opts.mode === 'ai' ? new ST.AI(app.battle, 1, opts.difficulty) : null;
    app.paused = false;
    app.resultShown = false;
    app.spinWarned = [false, false];
    ST.Render.setBattle(app.battle);
    ST.Input.setBattle(app.battle);
    show('hud');
    var pvp = opts.mode === 'pvp';
    $('hud').classList.toggle('pvp', pvp);
    $('skill1').hidden = !pvp;
    $('panel1').classList.toggle('flip', pvp);
    $('msg1').hidden = !pvp;
    $('result').hidden = true;
    $('pause').hidden = true;
    for (var i = 0; i < 2; i++) {
      var f = app.battle.f[i];
      var who = pvp ? (i === 0 ? '1P' : '2P') : (i === 0 ? '나' : 'AI ' + D.ai[opts.difficulty].name);
      $('name' + i).innerHTML = '<em class="' + (i ? 'p2c' : 'p1c') + '">' + who + '</em> ' + f.def.emoji + ' ' + f.def.name + ' <small>Lv' + f.level + '</small>';
      var sk = D.skills[f.skill];
      $('skill' + i).querySelector('.si').textContent = sk.icon;
      $('skill' + i).querySelector('.sn').textContent = sk.name;
      $('trait' + i).textContent = D.traits[f.trait].icon + ' ' + D.traits[f.trait].name;
    }
    setMsg(0, pvp ? '아래로 당겼다 놓아서 발사!' : '화면을 아래로 당겼다 놓아서 발사!');
    setMsg(1, '내 쪽으로 당겼다 놓아서 발사!');
    $('floats').innerHTML = '';
  }

  function endBattle() {
    app.battle = null;
    app.ai = null;
    ST.Input.setBattle(null);
    $('result').hidden = true;
    $('pause').hidden = true;
    $('floats').innerHTML = '';
  }

  function setMsg(i, text, big) {
    var el = $('msg' + i);
    el.textContent = text || '';
    el.classList.toggle('big', !!big);
    el.style.opacity = text ? 1 : 0;
  }

  function useSkill(idx) {
    var b = app.battle;
    if (!b || app.paused) return;
    if (b.f[idx].isAI) return;
    b.useSkill(idx);
  }

  // 떠오르는 글씨 (피해 숫자 등)
  function float(x, z, text, cls) {
    var p = ST.Render.project(x, ST.Render.bowlY(x, z) + 1.4, z);
    var el = document.createElement('div');
    el.className = 'float ' + (cls || '');
    el.textContent = text;
    el.style.left = p.x + 'px';
    el.style.top = p.y + 'px';
    $('floats').appendChild(el);
    setTimeout(function () { el.remove(); }, 900);
  }

  function toast(text) {
    var el = $('toast');
    el.textContent = text;
    el.classList.add('on');
    clearTimeout(toast.t);
    toast.t = setTimeout(function () { el.classList.remove('on'); }, 1400);
  }

  function handleEvents(b) {
    var pvp = b.mode === 'pvp';
    for (var i = 0; i < b.events.length; i++) {
      var e = b.events[i];
      switch (e.type) {
        case 'launch':
          if (!b.f[e.idx].isAI) setMsg(e.idx, b.phase === 'launch' ? '발사! 상대를 기다리는 중...' : '');
          break;
        case 'start':
          setMsg(0, '배틀 시작!', true); setMsg(1, pvp ? '배틀 시작!' : '', true);
          setTimeout(function () { if (app.battle === b && b.phase === 'fight') { setMsg(0, ''); setMsg(1, ''); } }, 900);
          break;
        case 'dmg':
          if (e.amount >= 0.95) float(e.x, e.z, '-' + Math.round(e.amount), e.kind === 'hit' && e.amount > 9 ? 'dmg crit' : 'dmg');
          break;
        case 'heal': float(e.x, e.z, '+' + Math.round(e.amount), 'heal'); break;
        case 'item': {
          var it = D.items[e.item];
          float(b.f[e.idx].x, b.f[e.idx].z, it.emoji + ' ' + it.name + '!', 'info');
          break;
        }
        case 'skill': {
          var sk = D.skills[e.skill];
          float(e.x, e.z, sk.icon + ' ' + sk.name + '!', 'skillf ' + (e.idx ? 'p2b' : 'p1b'));
          break;
        }
        case 'trait': {
          var tr = D.traits[e.trait];
          float(e.x, e.z, tr.icon + ' ' + tr.name, 'info');
          break;
        }
        case 'ko': {
          var t = e.reason === 'time' ? '시간 끝!' : 'KO!';
          setMsg(0, t, true); setMsg(1, pvp ? t : '', true);
          break;
        }
        case 'over':
          showResult(b);
          break;
      }
    }
  }

  function updateHud(b) {
    for (var i = 0; i < 2; i++) {
      var f = b.f[i];
      var hp = f.hp / f.maxHp;
      $('hp' + i).style.width = (hp * 100) + '%';
      $('hp' + i).className = hp < 0.3 ? 'low' : '';
      $('hpt' + i).textContent = Math.ceil(f.hp) + ' / ' + f.maxHp;
      $('sp' + i).style.width = f.spin + '%';
      var st = '';
      if (f.t.shield > 0 || f.t.guard > 0) st += '🛡️';
      if (f.t.power > 0) st += '⭐';
      if (f.t.speed > 0) st += '💨';
      if (f.t.slow > 0) st += '🥶';
      if (f.t.stun > 0) st += '😵';
      if (f.charged) st += '🌪️';
      if (f.spin <= 0) st += '💫';
      $('status' + i).textContent = st;
      var btn = $('skill' + i);
      var cd = D.skills[f.skill].cooldown;
      var ready = b.phase === 'fight' && f.skillCd <= 0;
      btn.classList.toggle('ready', ready);
      btn.style.setProperty('--cd', (f.skillCd / cd * 360) + 'deg');
      btn.querySelector('.sc').textContent = f.skillCd > 0 ? Math.ceil(f.skillCd) : '';
      if (b.phase === 'fight' && f.spin <= 0 && !app.spinWarned[i]) {
        app.spinWarned[i] = true;
        float(f.x, f.z, '💫 회전이 멈췄어요!', 'info');
      }
    }
    $('timer').textContent = Math.ceil(b.time);
    $('timer').classList.toggle('hurry', b.time < 10 && b.phase === 'fight');
  }

  function showResult(b) {
    if (app.resultShown) return;
    app.resultShown = true;
    var pvp = b.mode === 'pvp';
    var w = b.winner, title, sub = '', coins = 0;
    if (pvp) {
      var r = D.rewards.pvp;
      title = w < 0 ? '무승부!' : (w === 0 ? '1P' : '2P') + ' 승리! 🎉';
      coins = w < 0 ? r.lose * 2 : r.win + r.lose;
      sub = '두 사람 모두 수고했어요!';
    } else {
      var rw = D.rewards[b.difficulty];
      if (w === 0) { title = '승리! 🎉'; coins = rw.win; ST.save.addWin(); sub = '멋진 배틀이었어요!'; }
      else if (w < 0) { title = '무승부!'; coins = rw.lose; sub = '아슬아슬했어요!'; }
      else { title = '아쉬워요... 😢'; coins = rw.lose; sub = '팽이를 강화하고 다시 도전해요!'; }
    }
    ST.save.addCoins(coins);
    $('resTitle').textContent = title;
    $('resTitle').className = pvp && w === 1 ? 'p2c' : pvp && w === 0 ? 'p1c' : '';
    $('resSub').textContent = sub;
    $('resCoins').textContent = '+' + coins + ' 🪙  (보유 ' + ST.save.coins + ')';
    $('result').hidden = false;
  }

  function togglePause(on) {
    if (!app.battle) return;
    app.paused = on;
    $('pause').hidden = !on;
  }

  function help(on) { $('help').hidden = !on; }

  function buildHelp() {
    var html = '<h3>🎮 하는 방법</h3>' +
      '<p><b>발사</b>: 화면을 손가락으로 누르고 <b>당겼다가 놓으면</b> 반대쪽으로 발사돼요. 많이 당길수록 세고 오래 돌아요.</p>' +
      '<p><b>조종</b>: 화면을 누른 채로 끌면 그 방향으로 팽이가 움직여요.</p>' +
      '<p><b>기술</b>: 기술 버튼을 누르면 팽이마다 다른 필살기를 써요. 쓰고 나면 잠깐 기다려야 해요.</p>' +
      '<p><b>승리</b>: 부딪칠 때마다 HP가 줄어요. 상대 HP를 0으로 만들면 이겨요! 빠르게 들이받을수록 피해가 커요. 회전력이 0이 되면 HP가 계속 줄어요.</p>' +
      '<p><b>2인 대전</b>: 휴대폰을 눕혀 놓고 마주 앉아요. 위쪽 절반은 2P, 아래쪽 절반은 1P 자리예요.</p>' +
      '<p><b>강화</b>: 배틀에서 얻은 코인 🪙 으로 팽이 레벨을 올려요. HP, 공격, 방어, 속도가 올라가요.</p>' +
      '<p><small>노트북 키보드: 1P = WASD 이동, 스페이스 발사/기술 · 2P = 방향키 이동, 엔터 발사/기술 (꾹 눌렀다 떼면 발사)</small></p>' +
      '<h3>🎁 아이템</h3><div class="itemList">';
    Object.keys(D.items).forEach(function (k) {
      var it = D.items[k];
      html += '<div><span>' + it.emoji + '</span><b>' + it.name + '</b> ' + it.desc + '</div>';
    });
    html += '</div>';
    $('helpBody').innerHTML = html;
  }

  // ---------------------------------------------------------------
  // 버튼 연결
  // ---------------------------------------------------------------
  function init() {
    $('btnAI').onclick = function () { goSelect('ai'); };
    $('btnPvp').onclick = function () { goSelect('pvp1'); };
    $('btnUp').onclick = function () { goSelect('upgrade'); };
    $('btnHelp').onclick = function () { help(true); };
    $('helpClose').onclick = function () { help(false); };
    $('selBack').onclick = function () {
      if (app.selectMode === 'pvp2') { app.picked = app.p1; goSelect('pvp1'); } else goTitle();
    };
    $('selGo').onclick = selectGo;
    $('upBtn').onclick = doUpgrade;
    var diffs = document.querySelectorAll('#diffRow button');
    for (var i = 0; i < diffs.length; i++) {
      diffs[i].onclick = function () {
        app.difficulty = this.dataset.d;
        for (var j = 0; j < diffs.length; j++) diffs[j].classList.toggle('on', diffs[j] === this);
      };
    }
    [0, 1].forEach(function (idx) {
      $('skill' + idx).addEventListener('pointerdown', function (e) { e.preventDefault(); e.stopPropagation(); useSkill(idx); });
    });
    $('pauseBtn').onclick = function () { togglePause(true); };
    $('pResume').onclick = function () { togglePause(false); };
    $('pRestart').onclick = function () { startBattle(app.lastOpts); };
    $('pQuit').onclick = goTitle;
    $('rAgain').onclick = function () { startBattle(app.lastOpts); };
    $('rChange').onclick = function () { goSelect(app.lastOpts.mode === 'pvp' ? 'pvp1' : 'ai'); };
    $('rHome').onclick = goTitle;

    if (/^https?:/.test(location.protocol)) $('btnPark').hidden = false;
    if (!ST.save.works) toast('이 브라우저에서는 저장이 안 될 수 있어요');
    buildHelp();
    goTitle();
  }

  return {
    init: init, app: app, handleEvents: handleEvents, updateHud: updateHud,
    useSkill: useSkill, togglePause: togglePause,
  };
})();
