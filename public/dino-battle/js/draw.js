// 그리기: 귀여운 공룡, 배경, 이펙트, 화면 위 정보(HUD)
// 그림 파일 없이 캔버스로 직접 그려요.
window.DB = window.DB || {};

DB.draw = (function () {
  var D = DB.data;
  var LW = 2.6; // 테두리 두께
  var FONT = '"Jua", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';

  // ---------- 색 도우미 ----------
  function hexToRgb(h) {
    var n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function shade(h, amt) {
    var c = hexToRgb(h);
    var t = amt < 0 ? 0 : 255, p = Math.abs(amt);
    return 'rgb(' + c.map(function (v) { return Math.round((t - v) * p + v); }).join(',') + ')';
  }
  var palCache = {};
  function palette(sp, flash) {
    if (flash) return { c: '#ffffff', b: '#ffffff', a: '#ffffff', a2: '#ffffff', l: '#ffe9a8', dark: '#ffffff', eye: '#ffffff' };
    if (!palCache[sp.id]) {
      palCache[sp.id] = { c: sp.color, b: sp.belly, a: sp.accent, a2: shade(sp.accent, 0.35), l: sp.line, dark: shade(sp.color, -0.14), eye: '#ffffff' };
    }
    return palCache[sp.id];
  }

  // ---------- 모양 도우미 ----------
  function ell(ctx, x, y, rx, ry, rot) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2);
  }
  function fs(ctx, fill, line) {
    ctx.fillStyle = fill;
    ctx.fill();
    if (line) { ctx.strokeStyle = line; ctx.lineWidth = LW; ctx.stroke(); }
  }
  // 여러 도형을 하나로 이어 붙여 바깥 테두리만 그리기
  function blob(ctx, shapes, fill, line) {
    ctx.strokeStyle = line;
    ctx.lineWidth = LW * 2;
    shapes.forEach(function (s) { s(); ctx.stroke(); });
    ctx.fillStyle = fill;
    shapes.forEach(function (s) { s(); ctx.fill(); });
  }
  function thick(ctx, x1, y1, x2, y2, w, fill, line) {
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = line;
    ctx.lineWidth = w + LW * 2;
    ctx.stroke();
    ctx.strokeStyle = fill;
    ctx.lineWidth = w;
    ctx.stroke();
  }
  function tri(ctx, ax, ay, bx, by, cx, cy) {
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.lineTo(cx, cy);
    ctx.closePath();
  }

  // 눈: 보통 / 깜빡 / 아야(><) / 기절(X)
  function eye(ctx, x, y, r, A, p) {
    ctx.lineCap = 'round';
    if (A.dead) {
      ctx.strokeStyle = '#2b2233';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.7, y - r * 0.7); ctx.lineTo(x + r * 0.7, y + r * 0.7);
      ctx.moveTo(x + r * 0.7, y - r * 0.7); ctx.lineTo(x - r * 0.7, y + r * 0.7);
      ctx.stroke();
      return;
    }
    if (A.hurt) {
      ctx.strokeStyle = '#2b2233';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.7, y - r * 0.7); ctx.lineTo(x + r * 0.5, y); ctx.lineTo(x - r * 0.7, y + r * 0.7);
      ctx.stroke();
      return;
    }
    if (A.blink) {
      ctx.strokeStyle = '#2b2233';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(x, y - r * 0.2, r * 0.75, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
      return;
    }
    ell(ctx, x, y, r, r * 1.08);
    fs(ctx, p.eye, '#2b2233');
    ell(ctx, x + r * 0.28, y + r * 0.08, r * 0.62, r * 0.7);
    ctx.fillStyle = '#2b2233';
    ctx.fill();
    ell(ctx, x + r * 0.45, y - r * 0.3, r * 0.26, r * 0.26);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    if (A.angry) {
      ctx.strokeStyle = '#2b2233';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.9, y - r * 1.5);
      ctx.lineTo(x + r * 0.9, y - r * 1.0);
      ctx.stroke();
    }
  }
  function cheek(ctx, x, y, r) {
    ell(ctx, x, y, r * 1.2, r * 0.8);
    ctx.fillStyle = 'rgba(255,120,150,0.45)';
    ctx.fill();
  }
  function smile(ctx, x, y, r, open) {
    if (open) {
      ell(ctx, x, y + 1, r * 0.9, r * 0.8);
      fs(ctx, '#c2304a', '#2b2233');
      ell(ctx, x, y + r * 0.45, r * 0.5, r * 0.3);
      ctx.fillStyle = '#ff8fa0';
      ctx.fill();
      return;
    }
    ctx.strokeStyle = '#2b2233';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(x, y - r * 0.4, r * 0.7, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();
  }

  // ---------- 공룡별 그림 (오른쪽을 보는 모습, 발 가운데가 (0,0)) ----------
  // 머리 꼭대기 위치 (왕관, 기절 별에 사용)
  var HEAD = { trex: [16, -58], trike: [14, -52], ptera: [8, -56], stego: [24, -30], brachio: [20, -76], raptor: [10, -46] };

  var SPECIES = {
    trex: function (ctx, p, A) {
      var b = A.bob, s = A.swing, w = A.wag;
      thick(ctx, -9, -16 + b, -9 - s, -5, 10, p.dark, p.l);
      blob(ctx, [
        function () { ell(ctx, -2, -28 + b, 19, 16); },
        function () { ctx.beginPath(); ctx.moveTo(-12, -38 + b); ctx.quadraticCurveTo(-30, -32 + b + w, -40, -22 + b + w); ctx.quadraticCurveTo(-26, -17 + b, -8, -18 + b); ctx.closePath(); },
      ], p.c, p.l);
      ell(ctx, 3, -24 + b, 11, 10); ctx.fillStyle = p.b; ctx.fill();
      // 등 가시
      [[-14, -40], [-6, -43.5]].forEach(function (q) {
        tri(ctx, q[0] - 4, q[1] + 3 + b, q[0] + 4, q[1] + 3 + b, q[0], q[1] - 5 + b); fs(ctx, p.a, p.l);
      });
      thick(ctx, 6, -16 + b, 6 + s, -5, 10, p.c, p.l);
      thick(ctx, 10, -27 + b, 16, -23 + b, 5, p.c, p.l);
      blob(ctx, [
        function () { ell(ctx, 15, -44 + b, 16, 13); },
        function () { ell(ctx, 26, -39 + b, 10, 8); },
      ], p.c, p.l);
      eye(ctx, 17, -47 + b, 5.5, A, p);
      cheek(ctx, 22, -38 + b, 3.5);
      smile(ctx, 30, -36 + b, 5, A.mouth);
    },

    trike: function (ctx, p, A) {
      var b = A.bob, s = A.swing, w = A.wag;
      thick(ctx, -18, -14 + b, -18 - s, -5, 10, p.dark, p.l);
      thick(ctx, 6, -14 + b, 6 + s, -5, 10, p.dark, p.l);
      blob(ctx, [
        function () { ell(ctx, -4, -26 + b, 24, 15); },
        function () { ctx.beginPath(); ctx.moveTo(-24, -30 + b); ctx.quadraticCurveTo(-36, -24 + b + w, -42, -16 + b + w); ctx.quadraticCurveTo(-30, -15 + b, -20, -18 + b); ctx.closePath(); },
      ], p.c, p.l);
      ell(ctx, -1, -21 + b, 15, 8); ctx.fillStyle = p.b; ctx.fill();
      thick(ctx, -8, -14 + b, -8 + s, -5, 10, p.c, p.l);
      thick(ctx, 14, -14 + b, 14 - s, -5, 10, p.c, p.l);
      // 목 장식(프릴)
      ell(ctx, 13, -35 + b, 15, 16, -0.3); fs(ctx, p.a, p.l);
      [[8, -44], [5, -34], [12, -27]].forEach(function (q) { ell(ctx, q[0], q[1] + b, 2.6, 2.6); ctx.fillStyle = p.a2; ctx.fill(); });
      // 뿔
      tri(ctx, 18, -37 + b, 24, -38 + b, 31, -55 + b); fs(ctx, '#fff4d6', p.l);
      tri(ctx, 13, -37 + b, 18, -39 + b, 20, -52 + b); fs(ctx, '#fff4d6', p.l);
      tri(ctx, 33, -31 + b, 38, -30 + b, 40, -40 + b); fs(ctx, '#fff4d6', p.l);
      blob(ctx, [
        function () { ell(ctx, 24, -28 + b, 13, 11); },
        function () { ell(ctx, 34, -26 + b, 7, 7); },
      ], p.c, p.l);
      eye(ctx, 25, -31 + b, 5, A, p);
      cheek(ctx, 30, -22 + b, 3.3);
      smile(ctx, 36, -22 + b, 4.5, A.mouth);
    },

    ptera: function (ctx, p, A) {
      var b = A.bob;
      var flap = Math.sin(A.t * (A.air ? 18 : 5)) * (A.air ? 14 : 4);
      thick(ctx, -4, -14 + b, -4 - A.swing * 0.6, -4, 5, p.dark, p.l);
      // 뒤쪽 날개
      ctx.beginPath(); ctx.moveTo(-2, -34 + b); ctx.quadraticCurveTo(-24, -50 + b + flap, -38, -44 + b + flap); ctx.quadraticCurveTo(-24, -30 + b, -10, -20 + b); ctx.closePath();
      fs(ctx, p.dark, p.l);
      blob(ctx, [function () { ell(ctx, 0, -28 + b, 12, 14); }], p.c, p.l);
      ell(ctx, 3, -24 + b, 7, 9); ctx.fillStyle = p.b; ctx.fill();
      thick(ctx, 4, -14 + b, 4 + A.swing * 0.6, -4, 5, p.c, p.l);
      // 앞쪽 날개
      ctx.beginPath(); ctx.moveTo(4, -34 + b); ctx.quadraticCurveTo(-16, -46 + b + flap * 1.2, -32, -38 + b + flap * 1.2); ctx.quadraticCurveTo(-16, -26 + b, -2, -20 + b); ctx.closePath();
      fs(ctx, p.c, p.l);
      // 볏과 부리
      tri(ctx, 5, -50 + b, -14, -58 + b, 4, -40 + b); fs(ctx, p.a, p.l);
      if (A.mouth) {
        tri(ctx, 15, -48 + b, 34, -47 + b, 15, -42 + b); fs(ctx, p.a, p.l);
        tri(ctx, 15, -41 + b, 30, -34 + b, 14, -37 + b); fs(ctx, p.a, p.l);
      } else {
        tri(ctx, 15, -47 + b, 35, -42 + b, 15, -38 + b); fs(ctx, p.a, p.l);
      }
      blob(ctx, [function () { ell(ctx, 9, -44 + b, 10, 10); }], p.c, p.l);
      eye(ctx, 11, -46 + b, 4.6, A, p);
      cheek(ctx, 13, -39 + b, 3);
    },

    stego: function (ctx, p, A) {
      var b = A.bob, s = A.swing, w = A.wag;
      thick(ctx, -20, -13 + b, -20 - s, -5, 10, p.dark, p.l);
      thick(ctx, 4, -13 + b, 4 + s, -5, 10, p.dark, p.l);
      // 등판
      [-22, -12, -1, 9].forEach(function (x, i) {
        var dx = (x + 4) / 25;
        var top = -24 - 14 * Math.sqrt(Math.max(0, 1 - dx * dx)) + b;
        var hh = i === 1 || i === 2 ? 15 : 11;
        ctx.beginPath();
        ctx.moveTo(x - 7, top + 5); ctx.lineTo(x - 5, top - hh * 0.6); ctx.lineTo(x, top - hh); ctx.lineTo(x + 5, top - hh * 0.6); ctx.lineTo(x + 7, top + 5);
        ctx.closePath();
        fs(ctx, i % 2 ? p.a2 : p.a, p.l);
      });
      // 꼬리 가시
      tri(ctx, -40, -24 + b + w, -35, -24 + b + w, -40, -35 + b + w); fs(ctx, '#fff4d6', p.l);
      tri(ctx, -46, -21 + b + w, -41, -22 + b + w, -48, -31 + b + w); fs(ctx, '#fff4d6', p.l);
      blob(ctx, [
        function () { ell(ctx, -4, -23 + b, 25, 14); },
        function () { ctx.beginPath(); ctx.moveTo(-24, -27 + b); ctx.quadraticCurveTo(-38, -24 + b + w, -48, -18 + b + w); ctx.quadraticCurveTo(-34, -13 + b, -22, -15 + b); ctx.closePath(); },
        function () { ell(ctx, 24, -20 + b, 10, 8); },
      ], p.c, p.l);
      ell(ctx, -2, -18 + b, 16, 7); ctx.fillStyle = p.b; ctx.fill();
      thick(ctx, -10, -13 + b, -10 + s, -5, 10, p.c, p.l);
      thick(ctx, 14, -13 + b, 14 - s, -5, 10, p.c, p.l);
      eye(ctx, 26, -23 + b, 4.6, A, p);
      cheek(ctx, 29, -16 + b, 3);
      smile(ctx, 31, -18 + b, 4, A.mouth);
    },

    brachio: function (ctx, p, A) {
      var b = A.bob, s = A.swing, w = A.wag;
      var nb = Math.sin(A.t * 3) * 1.5;
      thick(ctx, -18, -20 + b, -18 - s, -5, 11, p.dark, p.l);
      thick(ctx, 4, -20 + b, 4 + s, -5, 11, p.dark, p.l);
      // 긴 목
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(6, -36 + b); ctx.quadraticCurveTo(20, -48 + b, 18, -64 + b + nb);
      ctx.strokeStyle = p.l; ctx.lineWidth = 14 + LW * 2; ctx.stroke();
      ctx.strokeStyle = p.c; ctx.lineWidth = 14; ctx.stroke();
      blob(ctx, [
        function () { ell(ctx, -4, -33 + b, 22, 15); },
        function () { ctx.beginPath(); ctx.moveTo(-22, -37 + b); ctx.quadraticCurveTo(-36, -30 + b + w, -46, -16 + b + w); ctx.quadraticCurveTo(-32, -20 + b, -20, -25 + b); ctx.closePath(); },
      ], p.c, p.l);
      // 목과 몸 이음새 다시 칠하기
      ctx.beginPath(); ctx.moveTo(6, -36 + b); ctx.quadraticCurveTo(14, -42 + b, 15, -50 + b);
      ctx.strokeStyle = p.c; ctx.lineWidth = 14; ctx.stroke();
      ell(ctx, -2, -28 + b, 14, 7); ctx.fillStyle = p.b; ctx.fill();
      [[-14, -38], [-4, -42], [-10, -31]].forEach(function (q) { ell(ctx, q[0], q[1] + b, 3.4, 2.6); ctx.fillStyle = p.a; ctx.fill(); });
      thick(ctx, -8, -20 + b, -8 + s, -5, 11, p.c, p.l);
      thick(ctx, 12, -20 + b, 12 - s, -5, 11, p.c, p.l);
      blob(ctx, [
        function () { ell(ctx, 20, -67 + b + nb, 11, 8.5); },
        function () { ell(ctx, 28, -64 + b + nb, 6.5, 6); },
      ], p.c, p.l);
      eye(ctx, 21, -70 + b + nb, 4.6, A, p);
      cheek(ctx, 27, -63 + b + nb, 3);
      smile(ctx, 31, -63 + b + nb, 3.6, A.mouth);
    },

    raptor: function (ctx, p, A) {
      var b = A.bob, s = A.swing, w = A.wag;
      thick(ctx, -6, -14 + b, -6 - s, -4, 7, p.dark, p.l);
      blob(ctx, [
        function () { ell(ctx, -2, -24 + b, 14, 11); },
        function () { ctx.beginPath(); ctx.moveTo(-10, -30 + b); ctx.quadraticCurveTo(-26, -32 + b + w, -38, -34 + b + w); ctx.quadraticCurveTo(-26, -24 + b, -10, -18 + b); ctx.closePath(); },
      ], p.c, p.l);
      ell(ctx, 2, -21 + b, 8, 7); ctx.fillStyle = p.b; ctx.fill();
      ctx.strokeStyle = p.a; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
      [-10, -4, 2].forEach(function (x) { ctx.beginPath(); ctx.moveTo(x, -34 + b); ctx.lineTo(x - 2, -29 + b); ctx.stroke(); });
      thick(ctx, 4, -14 + b, 4 + s, -4, 7, p.c, p.l);
      thick(ctx, 8, -23 + b, 13, -19 + b, 4, p.c, p.l);
      // 머리 깃털
      [[4, -44, 0], [0, -42, 0], [-3, -39, 0]].forEach(function (q) { tri(ctx, q[0] + 3, q[1] + 6 + b, q[0] + 7, q[1] + 6 + b, q[0] - 4, q[1] + b); fs(ctx, p.a, p.l); });
      blob(ctx, [
        function () { ell(ctx, 11, -34 + b, 11, 8.5); },
        function () { ell(ctx, 20, -31 + b, 7, 5.5); },
      ], p.c, p.l);
      eye(ctx, 12, -36 + b, 4.3, A, p);
      cheek(ctx, 16, -30 + b, 2.6);
      smile(ctx, 23, -30 + b, 3.6, A.mouth);
    },
  };

  function crown(ctx, x, y) {
    ctx.beginPath();
    ctx.moveTo(x - 10, y);
    ctx.lineTo(x - 11, y - 11);
    ctx.lineTo(x - 5, y - 5);
    ctx.lineTo(x, y - 13);
    ctx.lineTo(x + 5, y - 5);
    ctx.lineTo(x + 11, y - 11);
    ctx.lineTo(x + 10, y);
    ctx.closePath();
    fs(ctx, '#ffd23f', '#a36b00');
    ell(ctx, x, y - 4, 2.2, 2.2);
    ctx.fillStyle = '#ff5d73';
    ctx.fill();
  }

  function star(ctx, x, y, r, color) {
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var a = -Math.PI / 2 + i * Math.PI / 5;
      var rr = i % 2 ? r * 0.45 : r;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  // 공룡 하나 그리기. o: {face, scale, t, run, air, mouth, hurt, dead, deadT, flash, boss, spin, squash, stun, angry}
  function dino(ctx, sp, x, y, o) {
    var fn = SPECIES[sp.id] || SPECIES.trex;
    var t = o.t || 0;
    var run = o.run || 0;
    var phase = t * 14;
    var A = {
      t: t,
      air: !!o.air,
      bob: o.air ? 0 : -Math.abs(Math.sin(phase)) * 2.5 * run + Math.sin(t * 3) * 0.6 * (1 - run),
      swing: o.air ? 5 : Math.sin(phase) * 6 * run,
      wag: Math.sin(t * 5) * 2.5,
      mouth: !!o.mouth,
      hurt: !!o.hurt,
      dead: !!o.dead,
      blink: !o.hurt && !o.dead && (t % 3.3) < 0.12,
      angry: !!o.angry,
    };
    var p = palette(sp, o.flash);
    var sc = o.scale || 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(sc * (o.face || 1), sc);
    var sq = o.squash || 0;
    if (sq) ctx.scale(1 + sq, 1 - sq);
    if (o.dead) {
      var k = Math.min(1, (o.deadT || 0) * 4);
      ctx.translate(0, -sp.h * 0.4);
      ctx.rotate(-1.5 * k);
      ctx.translate(0, sp.h * 0.4);
    } else if (o.spin) {
      ctx.translate(0, -sp.h * 0.5);
      ctx.rotate(o.spin);
      ctx.translate(0, sp.h * 0.5);
    }
    ctx.lineJoin = 'round';
    fn(ctx, p, A);
    var hd = HEAD[sp.id] || [0, -sp.h];
    if (o.boss) crown(ctx, hd[0], hd[1] + A.bob);
    if (o.stun && !o.dead) {
      for (var i = 0; i < 3; i++) {
        var a = t * 6 + i * Math.PI * 2 / 3;
        star(ctx, hd[0] + Math.cos(a) * 16, hd[1] - 6 + Math.sin(a) * 5, 5, '#ffe14d');
      }
    }
    ctx.restore();
  }

  // ---------- 배경 ----------
  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function hills(ctx, baseY, amp, color, seed, freq) {
    var r = rng(seed);
    var p1 = r() * 6, p2 = r() * 6;
    ctx.beginPath();
    ctx.moveTo(0, D.H);
    for (var x = 0; x <= D.W; x += 10) {
      var y = baseY - (Math.sin(x * freq + p1) * 0.6 + Math.sin(x * freq * 2.3 + p2) * 0.4) * amp - amp;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(D.W, D.H);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  function palm(ctx, x, y, h, lean) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#a0703f';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + lean * 0.5, y - h * 0.5, x + lean, y - h);
    ctx.stroke();
    var tx = x + lean, ty = y - h;
    ctx.fillStyle = '#3f9a52';
    for (var i = 0; i < 6; i++) {
      var a = -Math.PI / 2 + (i - 2.5) * 0.55;
      ctx.beginPath();
      ctx.ellipse(tx + Math.cos(a) * 26, ty + Math.sin(a) * 14 + 8, 30, 9, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#7a4a2a';
    ell(ctx, tx - 5, ty + 6, 5, 5); ctx.fill();
    ell(ctx, tx + 5, ty + 7, 5, 5); ctx.fill();
  }

  function cactus(ctx, x, y, h) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#4f9d5a';
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x, y - h);
    ctx.moveTo(x, y - h * 0.45); ctx.lineTo(x - 16, y - h * 0.45); ctx.lineTo(x - 16, y - h * 0.75);
    ctx.moveTo(x, y - h * 0.6); ctx.lineTo(x + 15, y - h * 0.6); ctx.lineTo(x + 15, y - h * 0.85);
    ctx.stroke();
    ctx.fillStyle = '#ff8fb1';
    ell(ctx, x, y - h - 8, 5, 4); ctx.fill();
  }

  function roundTree(ctx, x, y, h, color) {
    ctx.fillStyle = '#9a6b42';
    ctx.fillRect(x - 5, y - h * 0.5, 10, h * 0.5);
    ctx.fillStyle = color;
    ell(ctx, x, y - h * 0.65, h * 0.32, h * 0.3); ctx.fill();
    ell(ctx, x - h * 0.2, y - h * 0.5, h * 0.22, h * 0.2); ctx.fill();
    ell(ctx, x + h * 0.2, y - h * 0.52, h * 0.22, h * 0.2); ctx.fill();
  }

  function platform(ctx, pl, wd, id) {
    var x = pl.x, y = pl.y, w = pl.w, h = 22;
    var r = 10;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w - 8, y + h);
    ctx.lineTo(x + 8, y + h);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fillStyle = wd.dirt;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    if (id === 'volcano') {
      ctx.strokeStyle = '#ff8a3d';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + w * 0.3, y + 6); ctx.lineTo(x + w * 0.36, y + 14); ctx.lineTo(x + w * 0.32, y + 20);
      ctx.moveTo(x + w * 0.7, y + 5); ctx.lineTo(x + w * 0.64, y + 13);
      ctx.stroke();
    }
    ctx.fillStyle = wd.ground;
    ctx.beginPath();
    ctx.moveTo(x + r, y - 1);
    ctx.lineTo(x + w - r, y - 1);
    ctx.quadraticCurveTo(x + w + 1, y - 1, x + w + 1, y + 7);
    for (var i = w; i >= 0; i -= 12) ctx.lineTo(x + i, y + 7 + (i / 12 % 2 ? 3 : 0));
    ctx.quadraticCurveTo(x - 1, y - 1, x + r, y - 1);
    ctx.closePath();
    ctx.fill();
  }

  var bgCache = {};
  function bgCanvas(id) {
    if (bgCache[id]) return bgCache[id];
    var wd = D.worlds[id];
    var c = document.createElement('canvas');
    var S = 2;
    c.width = D.W * S;
    c.height = D.H * S;
    var ctx = c.getContext('2d');
    ctx.scale(S, S);
    var g = ctx.createLinearGradient(0, 0, 0, D.groundY);
    g.addColorStop(0, wd.sky[0]);
    g.addColorStop(1, wd.sky[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, D.W, D.H);
    var r = rng(id.length * 97 + 13);

    if (id === 'volcano') {
      // 화산
      ctx.fillStyle = wd.far;
      ctx.beginPath();
      ctx.moveTo(380, D.groundY);
      ctx.lineTo(590, 120);
      ctx.lineTo(660, 120);
      ctx.lineTo(880, D.groundY);
      ctx.closePath();
      ctx.fill();
      var lg = ctx.createRadialGradient(625, 120, 5, 625, 120, 120);
      lg.addColorStop(0, 'rgba(255,170,80,0.9)');
      lg.addColorStop(1, 'rgba(255,120,60,0)');
      ctx.fillStyle = lg;
      ctx.fillRect(480, 0, 300, 260);
      ctx.fillStyle = '#ff7a2e';
      ctx.beginPath();
      ctx.moveTo(592, 122); ctx.lineTo(658, 122); ctx.lineTo(648, 150); ctx.lineTo(635, 135); ctx.lineTo(620, 170); ctx.lineTo(608, 140); ctx.closePath();
      ctx.fill();
      hills(ctx, D.groundY - 10, 30, wd.near, 7, 0.012);
    } else if (id === 'desert') {
      ctx.fillStyle = 'rgba(255,255,230,0.9)';
      ell(ctx, 760, 110, 46, 46); ctx.fill();
      // 평평한 바위산
      ctx.fillStyle = wd.far;
      [[60, 300, 150], [560, 280, 180], [300, 330, 110]].forEach(function (m) {
        ctx.beginPath();
        ctx.moveTo(m[0] - 30, D.groundY);
        ctx.lineTo(m[0], m[1]);
        ctx.lineTo(m[0] + m[2], m[1]);
        ctx.lineTo(m[0] + m[2] + 30, D.groundY);
        ctx.closePath();
        ctx.fill();
      });
      hills(ctx, D.groundY - 8, 18, wd.near, 3, 0.01);
      cactus(ctx, 70, D.groundY, 60);
      cactus(ctx, 520, D.groundY, 46);
      cactus(ctx, 900, D.groundY, 70);
    } else {
      ctx.fillStyle = 'rgba(255,250,200,0.95)';
      ell(ctx, 820, 90, 36, 36); ctx.fill();
      hills(ctx, D.groundY - 60, 40, wd.far, 11, 0.008);
      hills(ctx, D.groundY - 14, 26, wd.near, 5, 0.014);
      if (id === 'jungle') {
        palm(ctx, 50, D.groundY, 170, 20);
        palm(ctx, 470, D.groundY, 130, -18);
        palm(ctx, 915, D.groundY, 190, -24);
      } else {
        roundTree(ctx, 60, D.groundY, 150, '#6fc27d');
        roundTree(ctx, 900, D.groundY, 170, '#5db06c');
        for (var f = 0; f < 40; f++) {
          ctx.fillStyle = ['#ff8fb1', '#fff27a', '#ffffff', '#b99cff'][f % 4];
          ell(ctx, r() * D.W, D.groundY - 4 - r() * 12, 3, 3); ctx.fill();
        }
      }
    }

    // 땅
    ctx.fillStyle = wd.dirt;
    ctx.fillRect(0, D.groundY, D.W, D.H - D.groundY);
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    for (var i = 0; i < 40; i++) {
      ell(ctx, r() * D.W, D.groundY + 22 + r() * 46, 3 + r() * 5, 2 + r() * 3); ctx.fill();
    }
    ctx.fillStyle = wd.ground;
    ctx.beginPath();
    ctx.moveTo(0, D.groundY - 2);
    ctx.lineTo(D.W, D.groundY - 2);
    for (var x = D.W; x >= 0; x -= 14) ctx.lineTo(x, D.groundY + 12 + (x / 14 % 2 ? 4 : 0));
    ctx.closePath();
    ctx.fill();
    if (id === 'volcano') {
      ctx.fillStyle = '#ff7a2e';
      for (var k = 0; k < 5; k++) { ell(ctx, 80 + k * 200 + r() * 40, D.groundY + 44 + r() * 14, 26, 5); ctx.fill(); }
    }

    wd.platforms.forEach(function (pl) { platform(ctx, pl, wd, id); });
    bgCache[id] = c;
    return c;
  }

  // 움직이는 배경 (구름, 화산 불씨)
  function bgDynamic(ctx, id, t) {
    if (id === 'volcano') {
      for (var i = 0; i < 14; i++) {
        var px = (i * 137 + Math.sin(t + i) * 30) % D.W;
        var py = D.groundY - ((t * 40 + i * 53) % D.groundY);
        ctx.fillStyle = 'rgba(255,' + (140 + (i * 7) % 80) + ',60,' + (0.4 + (i % 3) * 0.15) + ')';
        ell(ctx, px, py, 2.5, 2.5); ctx.fill();
      }
      for (var s = 0; s < 4; s++) {
        var sy = 110 - ((t * 18 + s * 30) % 120);
        ctx.fillStyle = 'rgba(80,60,70,' + (0.35 * (sy + 10) / 120) + ')';
        ell(ctx, 625 + Math.sin(t * 0.8 + s) * 14, sy, 22 + (110 - sy) * 0.2, 14 + (110 - sy) * 0.1); ctx.fill();
      }
      return;
    }
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (var c = 0; c < 4; c++) {
      var cx = ((c * 280 + t * (10 + c * 3)) % (D.W + 200)) - 100;
      var cy = 60 + (c % 2) * 50;
      ell(ctx, cx, cy, 34, 16); ctx.fill();
      ell(ctx, cx + 24, cy - 8, 24, 16); ctx.fill();
      ell(ctx, cx - 22, cy + 2, 20, 12); ctx.fill();
    }
  }

  // ---------- 게임 화면 ----------
  function fighterOpts(f, t) {
    var running = f.onGround && Math.abs(f.vx) > 30 && !f.dead;
    var a = f.action;
    var spin = a && a.type === 'spin' ? t * 22 : 0;
    var diveTilt = a && a.type === 'dive' && a.phase === 1;
    return {
      face: f.face,
      scale: f.scale,
      t: f.animT,
      run: running ? Math.min(1, Math.abs(f.vx) / 200) : 0,
      air: !f.onGround && !f.dead,
      mouth: f.mouthT > 0 || (a && (a.type === 'roar' || a.type === 'dash')),
      hurt: f.hurtT > 0 || f.stunT > 0,
      dead: f.dead,
      deadT: f.deadT,
      flash: f.flashT > 0,
      boss: f.boss,
      spin: spin || (diveTilt ? 0.6 : 0),
      squash: f.squash > 0 ? Math.sin(f.squash / 0.18 * Math.PI) * 0.12 : 0,
      stun: f.stunT > 0,
      angry: !f.isPlayer && f.team === 1,
    };
  }

  function teamColor(f) {
    if (DB.game.G.mode === 'pvp') return f.pIndex === 0 ? '#4da3ff' : '#ff5d73';
    return f.team === 0 ? '#4da3ff' : '#ff5d73';
  }

  function drawFighter(ctx, f, t) {
    var alpha = f.dead && f.deadT > 1.4 ? Math.max(0, 1 - (f.deadT - 1.4) / 0.8) : 1;
    if (f.isPlayer && f.dead) alpha = 1;
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    // 발밑 표시
    if (!f.dead) {
      ell(ctx, f.x, f.y, f.w * 0.42, 6);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fill();
      if (f.isPlayer || DB.game.G.mode === 'pvp') {
        ctx.strokeStyle = teamColor(f);
        ctx.lineWidth = 3;
        ell(ctx, f.x, f.y, f.w * 0.42, 6);
        ctx.stroke();
      }
    }
    // 돌진 바람선
    if (f.action && (f.action.type === 'dash' || (f.action.type === 'dive' && f.action.phase === 1))) {
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      for (var i = 0; i < 3; i++) {
        var yy = f.y - f.h * (0.3 + i * 0.22);
        ctx.beginPath();
        ctx.moveTo(f.x - f.face * f.w * 0.6, yy);
        ctx.lineTo(f.x - f.face * (f.w * 0.6 + 26 + i * 8), yy);
        ctx.stroke();
      }
    }
    if (f.invT > 0 && !f.dead && Math.floor(t * 20) % 2) ctx.globalAlpha = alpha * 0.5;
    dino(ctx, f.sp, f.x, f.y, fighterOpts(f, t));
    ctx.globalAlpha = alpha;
    // 가시 방패
    if (f.shieldT > 0 && !f.dead) {
      var cx = f.x, cy = f.y - f.h * 0.5, rr = Math.max(f.w, f.h) * 0.68;
      ctx.fillStyle = 'rgba(255,140,200,0.18)';
      ctx.strokeStyle = 'rgba(255,120,190,0.85)';
      ctx.lineWidth = 3;
      ell(ctx, cx, cy, rr, rr * 0.9);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ff7eb0';
      for (var k = 0; k < 8; k++) {
        var a = k * Math.PI / 4 + t * 2;
        var bx = cx + Math.cos(a) * rr, by = cy + Math.sin(a) * rr * 0.9;
        tri(ctx, bx + Math.cos(a + 1.57) * 5, by + Math.sin(a + 1.57) * 5, bx - Math.cos(a + 1.57) * 5, by - Math.sin(a + 1.57) * 5, bx + Math.cos(a) * 10, by + Math.sin(a) * 10);
        ctx.fill();
      }
    }
    // 회오리 효과
    if (f.action && f.action.type === 'spin') {
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 4;
      var r2 = f.action.d.radius * f.scale * 0.8;
      for (var q = 0; q < 2; q++) {
        ctx.beginPath();
        ctx.ellipse(f.x, f.y - f.h * 0.5, r2, r2 * 0.45, 0, t * 14 + q * Math.PI, t * 14 + q * Math.PI + 2.2);
        ctx.stroke();
      }
    }
    ctx.restore();

    // 머리 위 표시
    if (f.dead) return;
    var topY = f.y - f.h - 14;
    var G = DB.game.G;
    if (G.mode === 'pvp') {
      label(ctx, f.x, topY - 4, f.pIndex === 0 ? '1P' : '2P', teamColor(f), 16);
    } else if (f.isPlayer) {
      ctx.fillStyle = '#4da3ff';
      tri(ctx, f.x - 7, topY - 12, f.x + 7, topY - 12, f.x, topY - 3);
      ctx.fill();
    } else if (!f.boss) {
      var bw = 42 * Math.max(1, f.scale);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      rrect(ctx, f.x - bw / 2 - 1, topY - 2, bw + 2, 8, 4); ctx.fill();
      ctx.fillStyle = '#ff5d73';
      rrect(ctx, f.x - bw / 2, topY - 1, bw * Math.max(0, f.hp / f.maxHp), 6, 3); ctx.fill();
    }
  }

  function rrect(ctx, x, y, w, h, r) {
    r = Math.min(r, h / 2, w / 2);
    if (w <= 0) { ctx.beginPath(); return; }
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function label(ctx, x, y, text, color, size) {
    ctx.font = size + 'px ' + FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  function outlined(ctx, text, x, y, size, fill, stroke, align) {
    ctx.font = size + 'px ' + FONT;
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(3, size * 0.18);
    ctx.strokeStyle = stroke;
    ctx.strokeText(text, x, y);
    ctx.fillStyle = fill;
    ctx.fillText(text, x, y);
  }

  function drawProjectile(ctx, p, t) {
    if (p.kind === 'fire') {
      var g = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, p.r * 1.4);
      g.addColorStop(0, '#fff6b0');
      g.addColorStop(0.45, '#ffb347');
      g.addColorStop(1, 'rgba(255,90,40,0)');
      ctx.fillStyle = g;
      ell(ctx, p.x, p.y, p.r * 1.5, p.r * 1.25); ctx.fill();
    } else if (p.kind === 'feather') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.atan2(p.vy, p.vx));
      ell(ctx, 0, 0, 13, 4.5);
      fs(ctx, '#e3f4ff', '#33709c');
      ctx.strokeStyle = '#33709c';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(12, 0); ctx.stroke();
      ctx.restore();
    } else if (p.kind === 'boulder') {
      ctx.save();
      ctx.translate(p.x, p.y - p.r);
      ctx.rotate(p.x / p.r);
      ell(ctx, 0, 0, p.r, p.r);
      fs(ctx, '#a8957e', '#5f5244');
      ctx.fillStyle = '#8a7a66';
      ell(ctx, -p.r * 0.3, -p.r * 0.25, p.r * 0.25, p.r * 0.2); ctx.fill();
      ell(ctx, p.r * 0.35, p.r * 0.3, p.r * 0.2, p.r * 0.16); ctx.fill();
      ctx.restore();
    } else if (p.kind === 'wave') {
      var k = Math.max(0, p.life / 0.95);
      ctx.fillStyle = 'rgba(255,230,150,' + (0.4 + k * 0.5) + ')';
      ctx.strokeStyle = 'rgba(160,110,40,' + (0.5 + k * 0.4) + ')';
      ctx.lineWidth = 2.5;
      var dir = p.vx > 0 ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(p.x - dir * 22, p.y);
      ctx.quadraticCurveTo(p.x - dir * 6, p.y - 34, p.x + dir * 12, p.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  function drawItem(ctx, it, t) {
    if (it.life < 2 && Math.floor(t * 8) % 2) return;
    var y = it.y - 16 + (it.vy === 0 ? Math.sin(t * 4 + it.x) * 3 : 0);
    ell(ctx, it.x, it.y - 1, 12, 4);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ell(ctx, it.x, y, 17, 17); ctx.fill();
    ctx.font = '22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(it.kind === 'meat' ? D.items.meat.icon : D.items.bolt.icon, it.x, y + 1);
  }

  function drawParticle(ctx, p) {
    var k = Math.max(0, p.life / p.max);
    if (p.kind === 'text') {
      ctx.globalAlpha = Math.min(1, k * 2);
      outlined(ctx, p.text, p.x, p.y, p.size, p.color, 'rgba(40,30,50,0.85)');
      ctx.globalAlpha = 1;
    } else if (p.kind === 'star') {
      ctx.globalAlpha = k;
      star(ctx, p.x, p.y, p.size, p.color);
      ctx.globalAlpha = 1;
    } else {
      ctx.globalAlpha = k;
      ell(ctx, p.x, p.y, p.size * (0.5 + k * 0.5), p.size * (0.5 + k * 0.5));
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // ---------- HUD ----------
  function hpColor(r) {
    return r > 0.5 ? '#5fd36a' : r > 0.25 ? '#ffc93d' : '#ff5d5d';
  }

  function hpBar(ctx, x, y, w, h, r, flip) {
    ctx.fillStyle = 'rgba(40,30,60,0.35)';
    rrect(ctx, x, y, w, h, h / 2); ctx.fill();
    var fw = Math.max(0, w * r);
    ctx.fillStyle = hpColor(r);
    rrect(ctx, flip ? x + w - fw : x, y, fw, h, h / 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    rrect(ctx, flip ? x + w - fw + 3 : x + 3, y + 2, Math.max(0, fw - 6), h * 0.3, h * 0.15); ctx.fill();
  }

  function skillDial(ctx, x, y, s) {
    var r = 15;
    ell(ctx, x, y, r, r);
    ctx.fillStyle = s.cd > 0 ? 'rgba(80,70,100,0.8)' : '#ffe07a';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = s.cd > 0 ? 0.55 : 1;
    ctx.fillText(s.def.icon, x, y + 1);
    ctx.globalAlpha = 1;
    if (s.cd > 0) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (s.cd / s.def.cd));
      ctx.closePath();
      ctx.fillStyle = 'rgba(20,10,40,0.45)';
      ctx.fill();
    }
  }

  function playerPanel(ctx, f, x, y, right, t) {
    var w = 300, h = 56;
    var px = right ? x - w : x;
    ctx.fillStyle = 'rgba(255,255,255,0.86)';
    rrect(ctx, px, y, w, h, 18); ctx.fill();
    ctx.save();
    rrect(ctx, right ? px + w - 58 : px + 4, y + 4, 54, 48, 14);
    ctx.fillStyle = right ? '#ffe3e8' : '#e3f0ff';
    ctx.fill();
    ctx.clip();
    var s = 0.62 * Math.min(1, 58 / f.sp.h);
    dino(ctx, f.sp, right ? px + w - 31 : px + 31, y + 48 + (f.sp.id === 'brachio' ? 6 : 0), { face: right ? -1 : 1, scale: s, t: t, hurt: f.hurtT > 0, dead: f.dead, deadT: 0 });
    ctx.restore();
    var tx = right ? px + w - 66 : px + 66;
    var G = DB.game.G;
    var nm = G.mode === 'pvp' ? (f.pIndex === 0 ? '1P ' : '2P ') + f.sp.name : f.sp.name;
    ctx.font = '17px ' + FONT;
    ctx.textAlign = right ? 'right' : 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = G.mode === 'pvp' ? teamColor(f) : '#2b2440';
    ctx.fillText(nm, tx, y + 16);
    ctx.fillStyle = '#6a6080';
    ctx.font = '13px ' + FONT;
    ctx.fillText(Math.ceil(f.hp) + ' / ' + f.maxHp, right ? tx - 92 : tx + 92, y + 16);
    hpBar(ctx, right ? px + 46 : tx, y + 30, 186, 15, f.hp / f.maxHp, right);
    skillDial(ctx, right ? px + 22 : px + w - 22, y + 37, f.skills[0]);
  }

  function hud(ctx, t) {
    var G = DB.game.G;
    if (G.mode === 'stage') {
      playerPanel(ctx, G.players[0], 12, 10, false, t);
      ctx.fillStyle = 'rgba(255,255,255,0.86)';
      rrect(ctx, D.W - 232, 10, 220, 50, 18); ctx.fill();
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#2b2440';
      ctx.font = '17px ' + FONT;
      ctx.fillText('스테이지 ' + (G.stageIdx + 1) + ' · ' + G.stage.name, D.W - 26, 27);
      ctx.fillStyle = '#6a6080';
      ctx.font = '14px ' + FONT;
      ctx.fillText('무리 ' + (G.waveIdx + 1) + ' / ' + G.stage.waves.length, D.W - 26, 46);
      var boss = null;
      G.fighters.forEach(function (f) { if (f.boss && !f.dead) boss = f; });
      if (boss) {
        var bw = 340, bx = D.W / 2 - bw / 2, by = 72;
        ctx.fillStyle = 'rgba(255,255,255,0.86)';
        rrect(ctx, bx - 10, by - 4, bw + 20, 40, 14); ctx.fill();
        ctx.textAlign = 'center';
        ctx.fillStyle = '#c2304a';
        ctx.font = '15px ' + FONT;
        ctx.fillText('👑 ' + boss.name, D.W / 2, by + 8);
        ctx.fillStyle = 'rgba(40,30,60,0.35)';
        rrect(ctx, bx, by + 18, bw, 12, 6); ctx.fill();
        ctx.fillStyle = '#ff5d73';
        rrect(ctx, bx, by + 18, bw * Math.max(0, boss.hp / boss.maxHp), 12, 6); ctx.fill();
      }
    } else {
      playerPanel(ctx, G.players[0], 12, 10, false, t);
      playerPanel(ctx, G.players[1], D.W - 12, 10, true, t);
      ell(ctx, D.W / 2, 38, 30, 30);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fill();
      var tt = Math.ceil(Math.max(0, G.timer));
      outlined(ctx, String(tt), D.W / 2, 39, 28, tt <= 10 ? '#ff5d73' : '#2b2440', '#ffffff');
    }
  }

  function banner(ctx) {
    var G = DB.game.G;
    var b = G.banner;
    if (!b) return;
    var k = b.t / b.dur;
    var pop = Math.min(1, b.t / 0.18);
    var s = 0.6 + 0.4 * (1 - Math.pow(1 - pop, 3)) + (pop < 1 ? 0 : Math.max(0, 0.08 - b.t * 0.1));
    var alpha = k > 0.8 ? (1 - k) / 0.2 : 1;
    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.translate(D.W / 2, D.H * 0.4);
    ctx.scale(s, s);
    outlined(ctx, b.text, 0, 0, 64, '#ffffff', '#3b2a5a');
    if (b.sub) outlined(ctx, b.sub, 0, 54, 26, '#fff3a0', '#3b2a5a');
    ctx.restore();
  }

  // view: {cw, ch, dpr} 화면 크기
  // view.reserve: 화면 아래 터치 버튼 높이. 공룡이 서는 땅선이 버튼보다 위에 오도록 맞춰요.
  function fitTransform(view) {
    var r = view.reserve || 0;
    var s = Math.min(view.cw / D.W, view.ch / D.H);
    if (r > 0) s = Math.min(s, (view.ch - r) / D.groundY);
    var oy = (view.ch - D.H * s) / 2;
    if (r > 0) oy = Math.max(0, Math.min(oy, view.ch - r - D.groundY * s));
    return { s: s, ox: (view.cw - D.W * s) / 2, oy: oy };
  }

  function letterbox(ctx, view, fit, wd) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    var gy = (fit.oy + D.groundY * fit.s) * view.dpr;
    ctx.fillStyle = wd.sky[1];
    ctx.fillRect(0, 0, view.cw * view.dpr, gy);
    ctx.fillStyle = wd.dirt;
    ctx.fillRect(0, gy, view.cw * view.dpr, view.ch * view.dpr - gy);
  }

  function setWorldTransform(ctx, view, fit, sx, sy) {
    var k = view.dpr * fit.s;
    ctx.setTransform(k, 0, 0, k, view.dpr * fit.ox + sx * k, view.dpr * fit.oy + sy * k);
  }

  function render(ctx, view, t) {
    var G = DB.game.G;
    var fit = fitTransform(view);
    var wd = D.worlds[G.worldId];
    letterbox(ctx, view, fit, wd);
    var sx = G.shake > 0 ? (Math.random() - 0.5) * G.shake : 0;
    var sy = G.shake > 0 ? (Math.random() - 0.5) * G.shake : 0;
    setWorldTransform(ctx, view, fit, sx, sy);
    ctx.drawImage(bgCanvas(G.worldId), 0, 0, D.W, D.H);
    bgDynamic(ctx, G.worldId, t);
    G.items.forEach(function (it) { drawItem(ctx, it, t); });
    var order = G.fighters.slice().sort(function (a, b) {
      var ka = (a.dead ? 0 : 2) + (a.isPlayer ? 1 : 0);
      var kb = (b.dead ? 0 : 2) + (b.isPlayer ? 1 : 0);
      return ka - kb;
    });
    order.forEach(function (f) { drawFighter(ctx, f, t); });
    G.projectiles.forEach(function (p) { drawProjectile(ctx, p, t); });
    G.rings.forEach(function (r) {
      var k = r.t / r.dur;
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = 1 - k;
      ctx.lineWidth = 5 * (1 - k) + 1;
      ell(ctx, r.x, r.y, r.r * (0.3 + 0.7 * k), r.r * (0.3 + 0.7 * k));
      ctx.stroke();
      ctx.globalAlpha = 1;
    });
    G.particles.forEach(function (p) { drawParticle(ctx, p); });
    setWorldTransform(ctx, view, fit, 0, 0);
    hud(ctx, t);
    banner(ctx);
  }

  // ---------- 메뉴 배경 (공룡들이 산책) ----------
  var walkers = null;
  function initWalkers() {
    walkers = DB.playable().map(function (sp, i) {
      return { sp: sp, x: 120 + i * 170, y: D.groundY, vy: 0, dir: i % 2 ? -1 : 1, spd: 50 + Math.random() * 40, t: Math.random() * 5, hopT: 1 + Math.random() * 4 };
    });
  }
  function renderMenu(ctx, view, t, dt) {
    if (!walkers) initWalkers();
    var fit = fitTransform(view);
    var wd = D.worlds.jungle;
    letterbox(ctx, view, fit, wd);
    setWorldTransform(ctx, view, fit, 0, 0);
    ctx.drawImage(bgCanvas('jungle'), 0, 0, D.W, D.H);
    bgDynamic(ctx, 'jungle', t);
    walkers.forEach(function (w) {
      w.t += dt;
      w.x += w.dir * w.spd * dt;
      if (w.x < 50) { w.x = 50; w.dir = 1; }
      if (w.x > D.W - 50) { w.x = D.W - 50; w.dir = -1; }
      w.hopT -= dt;
      if (w.hopT <= 0 && w.y >= D.groundY) { w.vy = -420; w.hopT = 2 + Math.random() * 4; }
      w.vy += D.gravity * dt;
      w.y = Math.min(D.groundY, w.y + w.vy * dt);
      if (w.y >= D.groundY) w.vy = 0;
      ell(ctx, w.x, D.groundY, w.sp.w * 0.4, 6);
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fill();
      dino(ctx, w.sp, w.x, w.y, { face: w.dir, t: w.t, run: 0.5, air: w.y < D.groundY - 1 });
    });
  }

  // 작은 캔버스에 공룡 미리보기 (선택 화면용)
  function preview(canvas, sp, t, opts) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var cw = canvas.clientWidth || canvas.width, ch = canvas.clientHeight || canvas.height;
    if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
    }
    var ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    var s = Math.min(cw / 110, ch / 90) * dpr * (opts && opts.zoom || 1);
    ctx.setTransform(s, 0, 0, s, canvas.width / 2 + 2 * s, canvas.height - 8 * dpr);
    dino(ctx, sp, 0, 0, { face: 1, t: t || 0, run: opts && opts.run || 0, mouth: opts && opts.mouth, scale: sp.h > 60 ? 0.85 : 1 });
  }

  return { dino: dino, render: render, renderMenu: renderMenu, preview: preview, bgCanvas: bgCanvas };
})();
