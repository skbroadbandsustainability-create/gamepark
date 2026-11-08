// 터치/마우스/키보드 입력
// - 발사: 화면을 끌어서 당겼다가 놓으면 반대 방향으로 발사 (많이 당길수록 세게)
// - 조종: 화면을 누른 채 끌면 그 방향으로 팽이가 움직임
// - 2인 대전: 화면 위쪽 절반 = 2P, 아래쪽 절반 = 1P
// - 키보드(노트북 확인용): 1P = WASD 이동, 스페이스 발사/기술 / 2P = 방향키 이동, 엔터 발사/기술
window.ST = window.ST || {};

ST.Input = (function () {
  var layer, ctx, battle = null, pvp = false;
  var sticks = [null, null];   // 플레이어별 { id, sx, sy, cx, cy }
  var keys = {};
  var keyCharge = [0, 0], keyCharging = [false, false];
  var onSkill = null;
  var PLAYER_COLORS = ['#4da3ff', '#ff5d73'];

  function minDim() { return Math.min(window.innerWidth, window.innerHeight); }

  function init(canvasLayer, skillCallback) {
    layer = canvasLayer;
    ctx = layer.getContext('2d');
    onSkill = skillCallback;
    resize();
    window.addEventListener('resize', resize);

    var target = document.getElementById('touch');
    target.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    window.addEventListener('keydown', function (e) { keyDown(e); });
    window.addEventListener('keyup', function (e) { keyUp(e); });
  }

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    layer.width = window.innerWidth * dpr;
    layer.height = window.innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function setBattle(b) {
    battle = b;
    pvp = !!b && b.mode === 'pvp';
    sticks = [null, null];
    keyCharge = [0, 0]; keyCharging = [false, false];
  }

  function playerFor(y) {
    if (!pvp) return 0;
    return y < window.innerHeight / 2 ? 1 : 0;
  }

  function down(e) {
    if (!battle) return;
    var p = playerFor(e.clientY);
    var f = battle.f[p];
    if (f.isAI) return;
    if (sticks[p]) return; // 이미 손가락이 하나 있음
    if (battle.phase === 'launch' && f.launched) return;
    sticks[p] = { id: e.pointerId, sx: e.clientX, sy: e.clientY, cx: e.clientX, cy: e.clientY };
    e.preventDefault();
  }

  function move(e) {
    for (var p = 0; p < 2; p++) {
      var s = sticks[p];
      if (s && s.id === e.pointerId) { s.cx = e.clientX; s.cy = e.clientY; }
    }
  }

  function up(e) {
    for (var p = 0; p < 2; p++) {
      var s = sticks[p];
      if (!s || s.id !== e.pointerId) continue;
      if (battle && battle.phase === 'launch' && !battle.f[p].launched) {
        var dx = s.cx - s.sx, dy = s.cy - s.sy;
        var power = Math.min(1, Math.sqrt(dx * dx + dy * dy) / (minDim() * 0.28));
        if (power >= 0.12) battle.launch(p, -dx, -dy, power);
      }
      sticks[p] = null;
      if (battle) { battle.f[p].inX = 0; battle.f[p].inZ = 0; }
    }
  }

  // ---------------------------------------------------------------
  // 키보드
  // ---------------------------------------------------------------
  function keyDown(e) {
    var k = e.code || e.key;
    keys[k] = true;
    if (!battle) return;
    var p = k === 'Space' ? 0 : k === 'Enter' || k === 'NumpadEnter' ? 1 : -1;
    if (p < 0) return;
    if (p === 1 && !pvp) p = 0;
    e.preventDefault();
    if (battle.f[p].isAI || e.repeat) return;
    if (battle.phase === 'launch' && !battle.f[p].launched) {
      keyCharging[p] = true; keyCharge[p] = 0;
    } else if (battle.phase === 'fight' && onSkill) {
      onSkill(p);
    }
  }
  function keyUp(e) {
    var k = e.code || e.key;
    keys[k] = false;
    if (!battle) return;
    var p = k === 'Space' ? 0 : k === 'Enter' || k === 'NumpadEnter' ? 1 : -1;
    if (p < 0) return;
    if (p === 1 && !pvp) p = 0;
    if (keyCharging[p]) {
      keyCharging[p] = false;
      var pw = chargeValue(p);
      var ang = (Math.random() - 0.5) * 0.6;
      battle.launch(p, Math.sin(ang), (p === 0 ? -1 : 1) * Math.cos(ang), Math.max(0.15, pw));
    }
  }
  function chargeValue(p) {
    // 0 → 1 → 0 으로 왕복 (타이밍 맞춰 떼기)
    var t = keyCharge[p] % 2;
    return t < 1 ? t : 2 - t;
  }

  // ---------------------------------------------------------------
  // 매 프레임: 입력 → 팽이 조종값
  // ---------------------------------------------------------------
  function update(dt) {
    if (!battle) return;
    for (var p = 0; p < 2; p++) {
      var f = battle.f[p];
      if (f.isAI) continue;
      if (keyCharging[p]) keyCharge[p] += dt * 1.4;
      if (battle.phase !== 'fight') continue;
      var x = 0, z = 0;
      var s = sticks[p];
      if (s) {
        var dx = s.cx - s.sx, dy = s.cy - s.sy;
        var r = minDim() * 0.12;
        x = dx / r; z = dy / r;
        var l = Math.sqrt(x * x + z * z);
        if (l > 1) { x /= l; z /= l; }
        if (l < 0.08) { x = 0; z = 0; }
      }
      var kb = keyVector(p);
      if (kb.x || kb.z) { x = kb.x; z = kb.z; }
      f.inX = x; f.inZ = z;
    }
  }

  function keyVector(p) {
    var x = 0, z = 0;
    var useArrows = p === 1 || !pvp;
    if (p === 0) {
      if (keys.KeyA) x -= 1; if (keys.KeyD) x += 1;
      if (keys.KeyW) z -= 1; if (keys.KeyS) z += 1;
    }
    if (useArrows) {
      if (keys.ArrowLeft) x -= 1; if (keys.ArrowRight) x += 1;
      if (keys.ArrowUp) z -= 1; if (keys.ArrowDown) z += 1;
    }
    var l = Math.sqrt(x * x + z * z);
    return l > 0 ? { x: x / l, z: z / l } : { x: 0, z: 0 };
  }

  // ---------------------------------------------------------------
  // 조이스틱/발사 조준선 그리기
  // ---------------------------------------------------------------
  function draw() {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    if (!battle) return;
    for (var p = 0; p < 2; p++) {
      var f = battle.f[p];
      if (f.isAI) continue;
      var col = PLAYER_COLORS[p];
      var s = sticks[p];

      if (battle.phase === 'launch' && !f.launched) {
        var pos = ST.Render.project(f.x, ST.Render.bowlY(f.x, f.z) + 0.5, f.z);
        var power = 0, dirX = 0, dirY = 0;
        if (s) {
          var dx = s.cx - s.sx, dy = s.cy - s.sy, l = Math.sqrt(dx * dx + dy * dy);
          power = Math.min(1, l / (minDim() * 0.28));
          if (l > 1) { dirX = -dx / l; dirY = -dy / l; }
          // 당기는 줄
          ctx.strokeStyle = 'rgba(255,255,255,0.6)';
          ctx.lineWidth = 3;
          ctx.setLineDash([6, 6]);
          ctx.beginPath(); ctx.moveTo(s.sx, s.sy); ctx.lineTo(s.cx, s.cy); ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = col;
          ctx.beginPath(); ctx.arc(s.cx, s.cy, 14, 0, Math.PI * 2); ctx.fill();
        } else if (keyCharging[p]) {
          power = chargeValue(p);
          dirX = 0; dirY = p === 0 ? -1 : 1;
        }
        if (power > 0) {
          // 발사 방향 화살표
          var L = 40 + power * minDim() * 0.25;
          var ex = pos.x + dirX * L, ey = pos.y + dirY * L;
          ctx.strokeStyle = power >= 0.12 ? col : 'rgba(255,255,255,0.4)';
          ctx.lineWidth = 8;
          ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(pos.x, pos.y); ctx.lineTo(ex, ey); ctx.stroke();
          var ang = Math.atan2(dirY, dirX);
          ctx.fillStyle = ctx.strokeStyle;
          ctx.beginPath();
          ctx.moveTo(ex + Math.cos(ang) * 18, ey + Math.sin(ang) * 18);
          ctx.lineTo(ex + Math.cos(ang + 2.4) * 18, ey + Math.sin(ang + 2.4) * 18);
          ctx.lineTo(ex + Math.cos(ang - 2.4) * 18, ey + Math.sin(ang - 2.4) * 18);
          ctx.fill();
          // 힘 게이지 (팽이 둘레)
          ctx.strokeStyle = power > 0.85 ? '#ffd36b' : '#ffffff';
          ctx.lineWidth = 6;
          ctx.beginPath(); ctx.arc(pos.x, pos.y, 34, -Math.PI / 2, -Math.PI / 2 + power * Math.PI * 2); ctx.stroke();
        }
      } else if (battle.phase === 'fight' && s) {
        // 조이스틱
        var r = minDim() * 0.12;
        var jx = s.cx - s.sx, jy = s.cy - s.sy, jl = Math.sqrt(jx * jx + jy * jy);
        if (jl > r) { jx = jx / jl * r; jy = jy / jl * r; }
        ctx.strokeStyle = 'rgba(255,255,255,0.45)';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(s.sx, s.sy, r, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = col;
        ctx.globalAlpha = 0.8;
        ctx.beginPath(); ctx.arc(s.sx + jx, s.sy + jy, r * 0.38, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  return { init: init, setBattle: setBattle, update: update, draw: draw };
})();
