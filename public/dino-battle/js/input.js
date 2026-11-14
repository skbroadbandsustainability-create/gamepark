// 조작: 키보드 + 화면 터치 버튼 (여러 손가락 동시에 OK)
window.DB = window.DB || {};

DB.input = (function () {
  var held = [{}, {}]; // 플레이어별로 누르고 있는 버튼
  var pressed = [{}, {}]; // 이번에 새로 누른 버튼 (점프/공격/기술)
  var touchHeld = [{}, {}];
  var mode = 'stage';
  var layer = null;
  var pointers = {}; // pointerId -> {p, k}
  var EDGE = { jump: 'jumpP', attack: 'attackP', skill: 'skillP' };

  // 1인용: 두 손 어느 쪽 키든 1P / 2인용: 왼쪽 키 1P, 오른쪽 키 2P
  var KEYS_P1 = { KeyA: 'left', KeyD: 'right', KeyW: 'jump', KeyF: 'attack', KeyG: 'skill' };
  var KEYS_P2 = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'jump', KeyK: 'attack', KeyL: 'skill', Numpad1: 'attack', Numpad2: 'skill' };
  var KEYS_SOLO_EXTRA = { Space: 'jump', KeyJ: 'attack', KeyK: 'attack', KeyL: 'skill', KeyZ: 'attack', KeyX: 'skill' };

  function mapKey(code) {
    if (KEYS_P1[code]) return { p: 0, k: KEYS_P1[code] };
    if (mode === 'pvp') {
      if (code === 'Space') return { p: 0, k: 'jump' };
      if (KEYS_P2[code]) return { p: 1, k: KEYS_P2[code] };
      return null;
    }
    if (KEYS_SOLO_EXTRA[code]) return { p: 0, k: KEYS_SOLO_EXTRA[code] };
    if (KEYS_P2[code]) return { p: 0, k: KEYS_P2[code] };
    return null;
  }

  var keyDown = {};
  function onKey(e, down) {
    var m = mapKey(e.code);
    if (!m) return;
    if (!DB.game.G.running) return;
    e.preventDefault();
    if (down) {
      if (keyDown[e.code]) return; // 꾹 누를 때 반복 입력 무시
      keyDown[e.code] = true;
      held[m.p][m.k] = (held[m.p][m.k] || 0) + 1;
      if (EDGE[m.k]) pressed[m.p][m.k] = true;
    } else {
      if (!keyDown[e.code]) return;
      keyDown[e.code] = false;
      held[m.p][m.k] = Math.max(0, (held[m.p][m.k] || 0) - 1);
    }
  }

  window.addEventListener('keydown', function (e) {
    DB.sound.unlock();
    if ((e.code === 'Escape' || e.code === 'KeyP') && DB.ui) { DB.ui.togglePause(); return; }
    onKey(e, true);
  });
  window.addEventListener('keyup', function (e) { onKey(e, false); });
  window.addEventListener('blur', function () { reset(); });

  // ---------- 터치 버튼 ----------
  var BTN = {
    left: '◀', right: '▶', jump: '⤒', attack: '👊', skill: '✨',
  };

  function btn(p, k, cls) {
    var b = document.createElement('div');
    b.className = 'tb ' + k + ' ' + (cls || '');
    b.dataset.p = p;
    b.dataset.k = k;
    var label = document.createElement('span');
    label.textContent = BTN[k];
    b.appendChild(label);
    if (k === 'jump') { var s = document.createElement('small'); s.textContent = '점프'; b.appendChild(s); }
    if (k === 'attack') { var s2 = document.createElement('small'); s2.textContent = '공격'; b.appendChild(s2); }
    if (k === 'skill') { var s3 = document.createElement('small'); s3.textContent = '기술'; b.appendChild(s3); b.classList.add('skillBtn'); }
    return b;
  }

  function cluster(p, side, cls) {
    var wrap = document.createElement('div');
    wrap.className = 'cluster ' + side + ' ' + cls;
    var move = document.createElement('div');
    move.className = 'move';
    move.appendChild(btn(p, 'left'));
    move.appendChild(btn(p, 'right'));
    var act = document.createElement('div');
    act.className = 'act';
    act.appendChild(btn(p, 'skill'));
    act.appendChild(btn(p, 'attack'));
    act.appendChild(btn(p, 'jump'));
    return { wrap: wrap, move: move, act: act };
  }

  function build(m) {
    mode = m;
    layer = document.getElementById('touch');
    layer.innerHTML = '';
    if (m === 'pvp') {
      // 2인용: 왼쪽 절반 1P, 오른쪽 절반 2P
      var a = cluster(0, 'left', 'duo p1');
      a.wrap.appendChild(a.move);
      a.wrap.appendChild(a.act);
      var b = cluster(1, 'right', 'duo p2');
      b.wrap.appendChild(b.act);
      b.wrap.appendChild(b.move);
      layer.appendChild(a.wrap);
      layer.appendChild(b.wrap);
    } else {
      var c = cluster(0, 'left', 'solo');
      var left = document.createElement('div');
      left.className = 'cluster left solo';
      left.appendChild(c.move);
      var right = document.createElement('div');
      right.className = 'cluster right solo';
      right.appendChild(c.act);
      layer.appendChild(left);
      layer.appendChild(right);
    }
    reset();
  }

  function btnAt(x, y) {
    var el = document.elementFromPoint(x, y);
    while (el && el !== layer && !(el.dataset && el.dataset.k)) el = el.parentElement;
    if (!el || el === layer) return null;
    return { p: +el.dataset.p, k: el.dataset.k, el: el };
  }

  function recompute() {
    touchHeld = [{}, {}];
    var els = layer ? layer.querySelectorAll('.tb') : [];
    for (var i = 0; i < els.length; i++) els[i].classList.remove('on');
    for (var id in pointers) {
      var q = pointers[id];
      if (!q) continue;
      touchHeld[q.p][q.k] = true;
      q.el.classList.add('on');
    }
  }

  function onDown(e) {
    DB.sound.unlock();
    var q = btnAt(e.clientX, e.clientY);
    if (!q) return;
    e.preventDefault();
    pointers[e.pointerId] = q;
    if (EDGE[q.k]) pressed[q.p][q.k] = true;
    recompute();
  }
  function onMove(e) {
    if (!(e.pointerId in pointers)) return;
    var q = btnAt(e.clientX, e.clientY);
    var old = pointers[e.pointerId];
    // 이동 버튼끼리만 손가락을 미끄러뜨려 바꿀 수 있어요
    if (q && old && (q.el !== old.el) && (q.k === 'left' || q.k === 'right') && (old.k === 'left' || old.k === 'right') && q.p === old.p) {
      pointers[e.pointerId] = q;
      recompute();
    }
  }
  function onUp(e) {
    if (!(e.pointerId in pointers)) return;
    delete pointers[e.pointerId];
    recompute();
  }

  function init() {
    layer = document.getElementById('touch');
    layer.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    layer.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }

  function reset() {
    held = [{}, {}];
    pressed = [{}, {}];
    touchHeld = [{}, {}];
    pointers = {};
    keyDown = {};
    if (layer) {
      var els = layer.querySelectorAll('.tb');
      for (var i = 0; i < els.length; i++) els[i].classList.remove('on');
    }
  }

  // 매 프레임: 입력을 공룡 조작값으로 옮기기
  function apply(players) {
    for (var p = 0; p < players.length && p < 2; p++) {
      var f = players[p];
      var c = f.ctrl;
      var h = held[p], t = touchHeld[p], pr = pressed[p];
      c.left = !!(h.left || t.left);
      c.right = !!(h.right || t.right);
      c.jump = !!(h.jump || t.jump);
      if (pr.jump) c.jumpP = true;
      if (pr.attack) c.attackP = true;
      if (pr.skill) { c.skillP = true; c.skillIdx = 0; }
      pressed[p] = {};
    }
  }

  // 기술 버튼 쿨타임 표시
  function updateButtons(players) {
    if (!layer) return;
    var btns = layer.querySelectorAll('.skillBtn');
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      var f = players[+b.dataset.p];
      if (!f) continue;
      var s = f.skills[0];
      var ratio = s.cd > 0 ? s.cd / s.def.cd : 0;
      var key = Math.round(ratio * 40);
      if (b._k !== key) {
        b._k = key;
        b.style.setProperty('--cd', (ratio * 360).toFixed(0) + 'deg');
        b.classList.toggle('ready', ratio <= 0);
      }
      var icon = s.def.icon;
      if (b._icon !== icon) { b._icon = icon; b.firstChild.textContent = icon; }
    }
  }

  // 터치 버튼이 차지하는 아래쪽 높이(px)
  function reserve() {
    if (!layer || layer.hidden) return 0;
    return mode === 'pvp' ? 74 : 104;
  }

  return { reserve: reserve, init: init, build: build, apply: apply, reset: reset, updateButtons: updateButtons };
})();
