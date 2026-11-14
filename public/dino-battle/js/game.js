// 전투: 물리, 공격, 기술, 아이템, 적 인공지능, 스테이지 진행, 승패
window.DB = window.DB || {};

DB.game = (function () {
  var D = DB.data;
  var snd = function (n) { DB.sound.play(n); };

  var G = {
    running: false,
    mode: null, // 'stage' | 'pvp'
    cfg: null,
    world: null,
    worldId: 'jungle',
    stage: null,
    stageIdx: 0,
    fighters: [],
    players: [],
    projectiles: [],
    particles: [],
    items: [],
    rings: [],
    waveIdx: 0,
    waveT: 0,
    time: 0,
    timer: 0,
    startT: 0,
    endT: 0,
    over: false,
    result: null,
    shake: 0,
    hitStop: 0,
    banner: null,
    itemT: 0,
    nextId: 1,
    onEnd: null,
  };

  function rand(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function newCtrl() {
    return { left: false, right: false, jump: false, jumpP: false, attackP: false, skillP: false, skillIdx: 0 };
  }

  // ---------- 공룡 만들기 ----------
  function makeFighter(spId, o) {
    var sp = DB.getSpecies(spId);
    var E = D.enemy;
    var scale = o.boss ? E.bossScale : 1;
    var hpMul = (o.hpMul || 1) * (o.boss ? E.bossHp : 1);
    var atkMul = (o.atkMul || 1) * (o.boss ? E.bossAtk : 1);
    var maxHp = Math.round(sp.hp * hpMul);
    var f = {
      id: G.nextId++,
      sp: sp,
      team: o.team,
      isPlayer: !!o.player,
      pIndex: o.pIndex === undefined ? -1 : o.pIndex,
      boss: !!o.boss,
      name: o.name || sp.name,
      scale: scale,
      w: sp.w * scale,
      h: sp.h * scale,
      x: o.x,
      y: o.y === undefined ? D.groundY : o.y,
      vx: 0,
      vy: 0,
      face: o.face || 1,
      maxHp: maxHp,
      hp: maxHp,
      atk: sp.atk * atkMul,
      spd: sp.spd,
      jumpV: D.jumpPower * sp.jump,
      maxJumps: sp.maxJumps || 2,
      jumpsLeft: 0,
      onGround: false,
      skills: o.skills.map(function (id) { return { id: id, def: D.skills[id], cd: 1.2 }; }),
      attackT: 0,
      attackCd: 0,
      attackHits: null,
      mouthT: 0,
      hurtT: 0,
      stunT: 0,
      shieldT: 0,
      action: null,
      flashT: 0,
      invT: 0,
      dead: false,
      deadT: 0,
      animT: Math.random() * 10,
      squash: 0,
      contactCd: {},
      ctrl: newCtrl(),
      ai: o.ai || null,
    };
    return f;
  }

  function aiFor(lv) {
    var E = D.enemy;
    return {
      t: rand(0.3, 0.8),
      react: Math.max(E.reactMin, E.reactBase - E.reactPerLv * (lv - 1)),
      aggr: clamp(E.aggrBase + E.aggrPerLv * (lv - 1), 0, 0.95),
      skillChance: clamp(0.35 + 0.15 * (lv - 1), 0, 0.9),
      dodge: clamp(0.15 + 0.2 * (lv - 1), 0, 0.7),
      wander: Math.random() < 0.5 ? -1 : 1,
      backT: 0,
    };
  }

  // ---------- 시작 ----------
  // cfg: { mode:'stage', stageIdx, p1:{sp, skill} } 또는 { mode:'pvp', p1, p2, world }
  function start(cfg, onEnd) {
    G.cfg = cfg;
    G.onEnd = onEnd;
    G.mode = cfg.mode;
    G.fighters = [];
    G.players = [];
    G.projectiles = [];
    G.particles = [];
    G.items = [];
    G.rings = [];
    G.time = 0;
    G.over = false;
    G.result = null;
    G.shake = 0;
    G.hitStop = 0;
    G.endT = 0;
    G.startT = 1.6;
    G.waveIdx = 0;
    G.waveT = 0;
    G.itemT = rand(D.items.every[0], D.items.every[1]);

    if (cfg.mode === 'stage') {
      G.stageIdx = cfg.stageIdx;
      G.stage = D.stages[cfg.stageIdx];
      G.worldId = G.stage.world;
      var p = makeFighter(cfg.p1.sp, { team: 0, player: true, pIndex: 0, x: 200, face: 1, skills: [cfg.p1.skill] });
      G.fighters.push(p);
      G.players.push(p);
      spawnWave(0);
      showBanner('스테이지 ' + (cfg.stageIdx + 1), G.stage.name);
    } else {
      G.stage = null;
      G.worldId = cfg.world || 'meadow';
      G.timer = D.pvpTime;
      var a = makeFighter(cfg.p1.sp, { team: 0, player: true, pIndex: 0, x: 220, face: 1, skills: [cfg.p1.skill], name: '1P' });
      var b = makeFighter(cfg.p2.sp, { team: 1, player: true, pIndex: 1, x: 740, face: -1, skills: [cfg.p2.skill], name: '2P' });
      G.fighters.push(a, b);
      G.players.push(a, b);
      showBanner('준비!', '1P ' + a.sp.name + '  VS  2P ' + b.sp.name);
    }
    G.world = D.worlds[G.worldId];
    G.running = true;
  }

  function spawnWave(i) {
    var wave = G.stage.waves[i];
    var lv = G.stage.lv;
    var E = D.enemy;
    var player = G.players[0];
    var right = !player || player.x < D.W / 2;
    wave.forEach(function (e, k) {
      var x = right ? D.W - 140 - k * 90 : 140 + k * 90;
      var f = makeFighter(e.sp, {
        team: 1,
        x: x,
        y: -60 - k * 60,
        face: right ? -1 : 1,
        boss: e.boss,
        name: e.boss ? G.stage.boss : null,
        hpMul: E.hpBase + E.hpPerLv * lv,
        atkMul: E.atkBase + E.atkPerLv * lv,
        // 보스는 기술 두 개를 모두 써요
        skills: e.boss ? DB.getSpecies(e.sp).skills.slice() : [DB.getSpecies(e.sp).skills[0]],
        ai: aiFor(e.boss ? lv - 0.2 : lv),
      });
      f.invT = 0.6;
      G.fighters.push(f);
    });
    if (i > 0) {
      var hasBoss = wave.some(function (e) { return e.boss; });
      if (hasBoss) showBanner('보스 등장!', G.stage.boss);
      else showBanner((i + 1) + '번째 무리!', '');
    }
  }

  function showBanner(text, sub) {
    G.banner = { text: text, sub: sub || '', t: 0, dur: 1.6 };
  }

  // ---------- 충돌 상자 ----------
  function body(f) {
    var w = f.w * 0.8;
    return { x: f.x - w / 2, y: f.y - f.h, w: w, h: f.h };
  }
  function overlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }
  function circleRect(cx, cy, r, b) {
    var nx = clamp(cx, b.x, b.x + b.w);
    var ny = clamp(cy, b.y, b.y + b.h);
    var dx = cx - nx, dy = cy - ny;
    return dx * dx + dy * dy <= r * r;
  }
  function enemiesOf(f) {
    return G.fighters.filter(function (o) { return o.team !== f.team && !o.dead; });
  }

  // 땅과 발판 위에 착지 (위에서 떨어질 때만 발판에 닿아요)
  function landOnSurfaces(o, prevY, halfW) {
    var landed = false;
    if (o.y >= D.groundY) {
      o.y = D.groundY;
      landed = true;
    } else if (o.vy >= 0) {
      var plats = G.world.platforms;
      for (var i = 0; i < plats.length; i++) {
        var p = plats[i];
        if (prevY <= p.y + 0.5 && o.y >= p.y && o.x + halfW > p.x && o.x - halfW < p.x + p.w) {
          o.y = p.y;
          landed = true;
          break;
        }
      }
    }
    return landed;
  }

  // ---------- 맞았을 때 ----------
  function hit(att, tgt, dmg, kbx, kby, stun, opts) {
    if (!tgt || tgt.dead || tgt.invT > 0 || tgt.team === att.team) return false;
    opts = opts || {};
    if (tgt.shieldT > 0) {
      dmg *= 0.3; kbx *= 0.3; kby *= 0.3; stun = 0;
      if (opts.melee && !att.dead) {
        hit(tgt, att, 4, (att.x < tgt.x ? -1 : 1) * 300, -200, 0.25);
      }
    }
    if (tgt.boss) { kbx *= 0.35; kby *= 0.5; stun *= 0.4; }
    dmg = Math.max(1, Math.round(dmg));
    tgt.hp -= dmg;
    tgt.flashT = 0.12;
    tgt.vx = kbx;
    if (kby < 0) { tgt.vy = kby; tgt.onGround = false; }
    if (stun > 0) {
      tgt.hurtT = Math.max(tgt.hurtT, stun);
      tgt.attackT = 0;
      if (tgt.action && !tgt.boss) tgt.action = null;
    }
    var hx = (att.x + tgt.x) / 2;
    var hy = tgt.y - tgt.h * 0.6;
    burst(hx, hy, '#fff6a8', 7, 260);
    textPop(tgt.x, tgt.y - tgt.h - 10, '-' + dmg, tgt.isPlayer ? '#ff5d73' : '#ffffff', 22);
    G.shake = Math.min(14, G.shake + 3 + dmg * 0.3);
    G.hitStop = Math.max(G.hitStop, 0.045);
    snd('hit');
    if (tgt.hp <= 0) die(tgt, att);
    return true;
  }

  function die(f, by) {
    f.hp = 0;
    f.dead = true;
    f.deadT = 0;
    f.action = null;
    f.shieldT = 0;
    f.vy = -520;
    f.vx = (by && f.x < by.x ? -1 : 1) * 260;
    f.onGround = false;
    burst(f.x, f.y - f.h / 2, '#ffd36b', 16, 380);
    G.shake = 16;
    snd('ko');
  }

  // ---------- 이펙트 ----------
  function burst(x, y, color, n, spd) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2;
      var s = rand(0.3, 1) * spd;
      G.particles.push({ kind: 'dot', x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, life: rand(0.3, 0.6), max: 0.6, size: rand(3, 6), color: color, g: 600 });
    }
  }
  function dust(x, y, n) {
    for (var i = 0; i < n; i++) {
      G.particles.push({ kind: 'dot', x: x + rand(-14, 14), y: y - 2, vx: rand(-90, 90), vy: rand(-80, -20), life: rand(0.25, 0.45), max: 0.45, size: rand(4, 8), color: 'rgba(255,255,255,0.8)', g: 0 });
    }
  }
  function textPop(x, y, text, color, size) {
    G.particles.push({ kind: 'text', x: x, y: y, vx: rand(-20, 20), vy: -90, life: 0.8, max: 0.8, text: text, color: color, size: size || 20, g: 0 });
  }
  function sparkle(x, y, color, n) {
    for (var i = 0; i < n; i++) {
      G.particles.push({ kind: 'star', x: x + rand(-25, 25), y: y + rand(-30, 10), vx: rand(-30, 30), vy: rand(-120, -40), life: rand(0.5, 0.9), max: 0.9, size: rand(5, 9), color: color, g: 0 });
    }
  }
  function ring(x, y, r, color, dur) {
    G.rings.push({ x: x, y: y, r: r, color: color, t: 0, dur: dur || 0.4 });
  }

  // ---------- 기술 ----------
  function atkMul(f) { return f.atk / 10; }

  function useSkill(f, idx) {
    var s = f.skills[idx];
    if (!s || s.cd > 0) return false;
    var d = s.def;
    var m = atkMul(f);
    s.cd = d.cd * (f.boss ? 1.6 : 1);
    var cx = f.x, cy = f.y - f.h * 0.5;
    switch (d.type) {
      case 'projectile':
        G.projectiles.push({ kind: 'fire', owner: f, team: f.team, x: f.x + f.face * f.w * 0.5, y: f.y - f.h * 0.62, vx: f.face * d.speed, vy: 0, r: d.r * f.scale, dmg: d.dmg * m, kbx: f.face * 320, kby: -260, stun: 0.4, life: 1.8, t: 0 });
        f.mouthT = 0.3;
        snd('fire');
        break;
      case 'spread':
        for (var i = 0; i < d.count; i++) {
          var ang = (i - (d.count - 1) / 2) * 0.22;
          G.projectiles.push({ kind: 'feather', owner: f, team: f.team, x: f.x + f.face * f.w * 0.4, y: f.y - f.h * 0.6, vx: f.face * d.speed * Math.cos(ang), vy: d.speed * Math.sin(ang), r: 10 * f.scale, dmg: d.dmg * m, kbx: f.face * 200, kby: -160, stun: 0.25, life: 1.3, t: 0 });
        }
        snd('skill');
        break;
      case 'roar':
        f.action = { type: 'roar', t: 0.5 };
        f.mouthT = 0.5;
        ring(cx, cy, d.radius * f.scale, 'rgba(255,240,150,0.9)', 0.5);
        enemiesOf(f).forEach(function (e) {
          var dx = e.x - f.x, dy = (e.y - e.h / 2) - cy;
          if (dx * dx + dy * dy <= Math.pow(d.radius * f.scale, 2)) {
            if (hit(f, e, d.dmg * m, (dx >= 0 ? 1 : -1) * 220, -200, 0.3) && e.shieldT <= 0) {
              e.stunT = Math.max(e.stunT, e.boss ? d.stun * 0.4 : d.stun);
            }
          }
        });
        G.shake = Math.max(G.shake, 10);
        snd('roar');
        break;
      case 'dash':
        f.action = { type: 'dash', t: d.time, d: d, hits: {} };
        f.vx = f.face * d.speed;
        if (d.vy) { f.vy = d.vy; f.onGround = false; }
        snd('skill');
        break;
      case 'boulder':
        G.projectiles.push({ kind: 'boulder', owner: f, team: f.team, x: f.x + f.face * f.w * 0.6, y: f.y, vx: f.face * d.speed, vy: 0, r: d.r * f.scale, dmg: d.dmg * m, kbx: f.face * 420, kby: -320, stun: 0.5, life: 4, t: 0, pierce: true, hits: {} });
        snd('boom');
        break;
      case 'dive':
        f.action = { type: 'dive', phase: 0, t: 0.24, d: d, hits: {}, total: 0 };
        f.vy = -640;
        f.onGround = false;
        snd('skill');
        break;
      case 'shield':
        f.shieldT = d.time;
        f.contactCd = {};
        sparkle(cx, cy, '#ff9ccc', 8);
        snd('skill');
        break;
      case 'spin':
        f.action = { type: 'spin', t: d.time, tick: 0, d: d };
        snd('skill');
        break;
      case 'stomp':
        if (f.onGround) {
          stompWave(f, d);
          f.action = { type: 'pose', t: 0.3 };
        } else {
          f.action = { type: 'stomp', d: d, total: 0 };
          f.vy = 1300;
        }
        break;
      case 'heal':
        var amount = Math.round(f.maxHp * d.amount);
        f.hp = Math.min(f.maxHp, f.hp + amount);
        textPop(f.x, f.y - f.h - 10, '+' + amount, '#5fdc6a', 24);
        sparkle(cx, cy, '#7dff8a', 12);
        snd('heal');
        break;
    }
    if (f.isPlayer) textPop(f.x, f.y - f.h - 34, d.icon + ' ' + d.name, '#fff3a0', 18);
    return true;
  }

  function stompWave(f, d) {
    var m = atkMul(f);
    [-1, 1].forEach(function (dir) {
      G.projectiles.push({ kind: 'wave', owner: f, team: f.team, x: f.x + dir * f.w * 0.4, y: f.y, vx: dir * d.speed, vy: 0, r: 18 * f.scale, dmg: d.dmg * m, kbx: dir * 300, kby: -420, stun: 0.5, life: 0.95, t: 0, pierce: true, hits: {}, ground: true });
    });
    dust(f.x, f.y, 12);
    G.shake = Math.max(G.shake, 10);
    snd('boom');
  }

  function updateAction(f, dt) {
    var a = f.action;
    var c = f.ctrl;
    if (a.type === 'roar' || a.type === 'pose') {
      f.vx *= Math.pow(0.001, dt);
      a.t -= dt;
      if (a.t <= 0) f.action = null;
    } else if (a.type === 'dash') {
      f.vx = f.face * a.d.speed;
      var bb = body(f);
      bb.x -= 6; bb.w += 12;
      enemiesOf(f).forEach(function (e) {
        if (a.hits[e.id]) return;
        if (overlap(bb, body(e))) {
          a.hits[e.id] = true;
          hit(f, e, a.d.dmg * atkMul(f), f.face * a.d.kb, -320, 0.5, { melee: true });
        }
      });
      if (Math.random() < 0.6) dust(f.x - f.face * f.w * 0.4, f.y, 1);
      a.t -= dt;
      if (a.t <= 0) { f.action = null; f.vx *= 0.3; }
    } else if (a.type === 'dive') {
      a.total += dt;
      if (a.phase === 0) {
        a.t -= dt;
        if (a.t <= 0) { a.phase = 1; }
      } else {
        f.vx = f.face * 560;
        f.vy = 900;
        var db = body(f);
        enemiesOf(f).forEach(function (e) {
          if (a.hits[e.id]) return;
          if (overlap(db, body(e))) {
            a.hits[e.id] = true;
            hit(f, e, a.d.dmg * atkMul(f), f.face * 380, -360, 0.5, { melee: true });
          }
        });
      }
      if (a.total > 1.6) f.action = null;
    } else if (a.type === 'spin') {
      var mv = (c.right ? 1 : 0) - (c.left ? 1 : 0);
      f.vx += (mv * D.runSpeed * f.spd * 0.6 - f.vx) * Math.min(1, dt * 10);
      a.tick -= dt;
      if (a.tick <= 0) {
        a.tick = 0.2;
        var r = a.d.radius * f.scale;
        var sx = f.x, sy = f.y - f.h * 0.5;
        enemiesOf(f).forEach(function (e) {
          if (circleRect(sx, sy, r, body(e))) {
            hit(f, e, a.d.dmg * atkMul(f), (e.x >= f.x ? 1 : -1) * 300, -240, 0.3, { melee: true });
          }
        });
      }
      a.t -= dt;
      if (a.t <= 0) f.action = null;
    } else if (a.type === 'stomp') {
      a.total += dt;
      f.vy = 1300;
      f.vx *= Math.pow(0.01, dt);
      if (a.total > 1.5) f.action = null;
    }
  }

  // 착지할 때 기술 마무리
  function onLand(f, wasAir, fallV) {
    if (!wasAir) return;
    f.jumpsLeft = f.maxJumps - 1;
    if (fallV > 500) { dust(f.x, f.y, 5); f.squash = 0.18; }
    var a = f.action;
    if (!a) return;
    if (a.type === 'dive' && a.phase === 1) {
      f.action = { type: 'pose', t: 0.18 };
      f.vx *= 0.2;
      dust(f.x, f.y, 10);
      G.shake = Math.max(G.shake, 6);
    } else if (a.type === 'stomp') {
      stompWave(f, a.d);
      f.action = { type: 'pose', t: 0.25 };
      f.vx = 0;
    }
  }

  // ---------- 공룡 한 마리 움직이기 ----------
  function updateFighter(f, dt) {
    f.animT += dt;
    f.attackCd -= dt;
    f.hurtT -= dt;
    f.stunT -= dt;
    f.shieldT -= dt;
    f.flashT -= dt;
    f.invT -= dt;
    f.mouthT -= dt;
    f.squash = Math.max(0, f.squash - dt);
    for (var i = 0; i < f.skills.length; i++) if (f.skills[i].cd > 0) f.skills[i].cd -= dt;
    for (var k in f.contactCd) f.contactCd[k] -= dt;

    var c = f.ctrl;
    var prevY = f.y;
    var wasAir = !f.onGround;
    var gravityOn = true;

    if (f.dead) {
      f.deadT += dt;
      f.vx *= Math.pow(0.3, dt);
      c.jumpP = c.attackP = c.skillP = false;
    } else if (f.action) {
      updateAction(f, dt);
      if (f.action && f.action.type === 'dive' && f.action.phase === 1) gravityOn = false;
      if (f.action && f.action.type === 'stomp') gravityOn = false;
      // 돌진 중 점프는 안 되지만, 회오리 중에는 점프할 수 있어요
      if (f.action && f.action.type === 'spin' && c.jumpP) doJump(f);
    } else if (f.hurtT > 0 || f.stunT > 0) {
      f.vx *= Math.pow(f.onGround ? 0.02 : 0.4, dt);
    } else {
      var mv = (c.right ? 1 : 0) - (c.left ? 1 : 0);
      var target = mv * D.runSpeed * f.spd * (f.attackT > 0 && f.onGround ? 0.35 : 1);
      f.vx += (target - f.vx) * Math.min(1, dt * (f.onGround ? 14 : 7));
      if (mv !== 0 && f.attackT <= 0) f.face = mv;
      if (c.jumpP) doJump(f);
      if (c.attackP && f.attackCd <= 0) {
        f.attackT = D.attack.time;
        f.attackCd = D.attack.cooldown;
        f.attackHits = {};
        f.mouthT = D.attack.time;
        snd('attack');
      }
      if (c.skillP) useSkill(f, c.skillIdx || 0);
    }
    c.jumpP = c.attackP = c.skillP = false;

    // 기본 공격 판정
    if (f.attackT > 0 && !f.dead) {
      var A = D.attack;
      var el = A.time - f.attackT;
      f.attackT -= dt;
      if (el >= A.hitFrom && el <= A.hitTo) {
        var reach = f.sp.reach * f.scale;
        var hb = { x: f.face > 0 ? f.x + f.w * 0.15 : f.x - f.w * 0.15 - reach, y: f.y - f.h * 0.9, w: reach, h: f.h * 0.8 };
        enemiesOf(f).forEach(function (e) {
          if (f.attackHits[e.id]) return;
          if (overlap(hb, body(e))) {
            f.attackHits[e.id] = true;
            hit(f, e, f.atk * rand(0.9, 1.1), f.face * A.knockX, A.knockY, A.stun, { melee: true });
          }
        });
      }
    }

    // 가시 방패에 닿으면 따끔
    if (f.shieldT > 0 && !f.dead) {
      var sb = body(f);
      sb.x -= 8; sb.w += 16;
      enemiesOf(f).forEach(function (e) {
        if ((f.contactCd[e.id] || 0) > 0) return;
        if (overlap(sb, body(e))) {
          f.contactCd[e.id] = 0.5;
          hit(f, e, D.skills.spikeShield.dmg * atkMul(f), (e.x >= f.x ? 1 : -1) * 350, -250, 0.3);
        }
      });
    }

    // 중력, 글라이드
    if (gravityOn) {
      f.vy += D.gravity * dt;
      if (f.sp.glide && c.jump && f.vy > 0 && !f.dead && !f.action) f.vy = Math.min(f.vy, 130);
      if (f.vy > D.maxFall) f.vy = D.maxFall;
    }

    var fallV = f.vy;
    f.x += f.vx * dt;
    f.y += f.vy * dt;

    // 벽
    var half = f.w * 0.4;
    if (f.x < half) { f.x = half; if (f.vx < 0) f.vx = f.hurtT > 0 ? -f.vx * 0.3 : 0; }
    if (f.x > D.W - half) { f.x = D.W - half; if (f.vx > 0) f.vx = f.hurtT > 0 ? -f.vx * 0.3 : 0; }

    // 죽어서 날아가는 공룡은 땅을 뚫고 떨어지지 않게 땅에만 닿아요
    var landed;
    if (f.dead) {
      landed = f.y >= D.groundY;
      if (landed) f.y = D.groundY;
    } else {
      landed = landOnSurfaces(f, prevY, f.w * 0.3);
    }
    if (landed && f.vy >= 0) {
      f.vy = 0;
      f.onGround = true;
      if (!f.dead) onLand(f, wasAir, fallV);
    } else {
      f.onGround = false;
    }
    if (f.y < -300) f.y = -300;
  }

  function doJump(f) {
    if (f.onGround) {
      f.vy = -f.jumpV;
      f.onGround = false;
      f.jumpsLeft = f.maxJumps - 1;
      dust(f.x, f.y, 4);
      f.squash = -0.15;
      snd('jump');
    } else if (f.jumpsLeft > 0) {
      f.jumpsLeft--;
      f.vy = -f.jumpV * 0.88;
      ring(f.x, f.y - 6, 22, 'rgba(255,255,255,0.9)', 0.25);
      snd('jump');
    }
  }

  // 공룡끼리 너무 겹치지 않게 살짝 밀어내기
  function separate(dt) {
    var list = G.fighters;
    for (var i = 0; i < list.length; i++) {
      for (var j = i + 1; j < list.length; j++) {
        var a = list[i], b = list[j];
        if (a.dead || b.dead) continue;
        if (a.y - a.h > b.y || b.y - b.h > a.y) continue;
        var dx = b.x - a.x;
        var minD = (a.w + b.w) * 0.3;
        if (Math.abs(dx) < minD) {
          var push = (minD - Math.abs(dx)) * Math.min(1, dt * 8);
          var dir = dx === 0 ? (Math.random() < 0.5 ? -1 : 1) : dx > 0 ? 1 : -1;
          var wa = a.boss ? 0.2 : 0.5, wb = b.boss ? 0.2 : 0.5;
          a.x -= dir * push * wa;
          b.x += dir * push * wb;
        }
      }
    }
  }

  // ---------- 날아가는 것들 ----------
  function updateProjectiles(dt) {
    var keep = [];
    for (var i = 0; i < G.projectiles.length; i++) {
      var p = G.projectiles[i];
      p.t += dt;
      p.life -= dt;
      var prevY = p.y;
      if (p.kind === 'boulder') {
        p.vy += D.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (landOnSurfaces(p, prevY, 4) && p.vy >= 0) p.vy = 0;
        if (p.x < p.r || p.x > D.W - p.r) {
          burst(p.x, p.y - p.r, '#b59a7a', 10, 220);
          snd('boom');
          continue;
        }
      } else {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
      if (p.kind === 'fire' && Math.random() < 0.7) {
        G.particles.push({ kind: 'dot', x: p.x - Math.sign(p.vx) * 8, y: p.y + rand(-5, 5), vx: -p.vx * 0.1, vy: rand(-40, 0), life: 0.3, max: 0.3, size: rand(4, 7), color: Math.random() < 0.5 ? '#ffb347' : '#ff6a3d', g: 0 });
      }
      if (p.kind === 'wave' && Math.random() < 0.8) dust(p.x, p.y, 1);
      if (p.life <= 0 || p.x < -60 || p.x > D.W + 60 || p.y > D.H + 60) continue;

      // 맞히기
      var used = false;
      var targets = G.fighters;
      for (var j = 0; j < targets.length; j++) {
        var e = targets[j];
        if (e.team === p.team || e.dead) continue;
        if (p.hits && p.hits[e.id]) continue;
        var b = body(e);
        var touch;
        if (p.ground) touch = e.onGround && Math.abs(e.y - p.y) < 14 && Math.abs(e.x - p.x) < p.r + e.w * 0.4;
        else if (p.kind === 'boulder') touch = circleRect(p.x, p.y - p.r, p.r, b);
        else touch = circleRect(p.x, p.y, p.r, b);
        if (!touch) continue;
        var kbDir = p.vx >= 0 ? 1 : -1;
        hit(p.owner, e, p.dmg, kbDir * Math.abs(p.kbx), p.kby, p.stun);
        if (p.pierce) {
          p.hits[e.id] = true;
        } else {
          burst(p.x, p.y, p.kind === 'fire' ? '#ff9a3d' : '#ffffff', 8, 200);
          used = true;
          break;
        }
      }
      if (!used) keep.push(p);
    }
    G.projectiles = keep;
  }

  // ---------- 아이템 ----------
  function updateItems(dt) {
    G.itemT -= dt;
    if (G.itemT <= 0) {
      G.itemT = rand(D.items.every[0], D.items.every[1]);
      var kind = Math.random() < 0.6 ? 'meat' : 'bolt';
      G.items.push({ kind: kind, x: rand(80, D.W - 80), y: -30, vy: 0, life: 10, t: 0 });
    }
    var keep = [];
    for (var i = 0; i < G.items.length; i++) {
      var it = G.items[i];
      it.t += dt;
      it.life -= dt;
      var prevY = it.y;
      it.vy = Math.min(it.vy + D.gravity * 0.5 * dt, 600);
      it.y += it.vy * dt;
      if (landOnSurfaces(it, prevY, 8)) it.vy = 0;
      if (it.life <= 0) continue;
      var taken = false;
      for (var j = 0; j < G.players.length; j++) {
        var f = G.players[j];
        if (f.dead) continue;
        var b = body(f);
        if (circleRect(it.x, it.y - 16, 18, b)) {
          taken = true;
          if (it.kind === 'meat') {
            var heal = Math.min(D.items.meat.heal, f.maxHp - f.hp);
            f.hp += heal;
            textPop(f.x, f.y - f.h - 10, '+' + Math.round(heal), '#5fdc6a', 22);
            sparkle(f.x, f.y - f.h / 2, '#7dff8a', 8);
          } else {
            f.skills.forEach(function (s) { s.cd = 0; });
            textPop(f.x, f.y - f.h - 10, '⚡ 기술 충전!', '#ffe14d', 20);
            sparkle(f.x, f.y - f.h / 2, '#ffe14d', 8);
          }
          snd('item');
          break;
        }
      }
      if (!taken) keep.push(it);
    }
    G.items = keep;
  }

  // ---------- 적 인공지능 ----------
  function nearestEnemy(f) {
    var best = null, bd = 1e9;
    G.fighters.forEach(function (o) {
      if (o.team === f.team || o.dead) return;
      var d = Math.abs(o.x - f.x) + Math.abs(o.y - f.y) * 0.7;
      if (d < bd) { bd = d; best = o; }
    });
    return best;
  }

  function skillGood(f, d, t, dx, dy) {
    var adx = Math.abs(dx), ady = Math.abs(dy);
    switch (d.type) {
      case 'projectile': case 'spread': return adx < 520 && ady < 60;
      case 'roar': return adx < d.radius * f.scale * 0.8 && ady < 100;
      case 'dash': return adx > 50 && adx < 320 && ady < 40;
      case 'boulder': return adx < 600 && ady < 30 && f.onGround;
      case 'dive': return adx < 330 && dy > -40;
      case 'shield': return adx < 130 || f.hp < f.maxHp * 0.4;
      case 'spin': return adx < d.radius * f.scale && ady < 80;
      case 'stomp': return t.onGround && ady < 25 && adx < 450;
      case 'heal': return f.hp < f.maxHp * 0.5;
    }
    return false;
  }

  function aiThink(f, dt) {
    var ai = f.ai;
    var c = f.ctrl;
    var t = nearestEnemy(f);
    // 프테라는 떨어질 때 점프를 꾹 눌러 글라이드
    c.jump = !!(f.sp.glide && t && !f.onGround && f.vy > 0 && t.y < f.y + 40);
    ai.t -= dt;
    ai.backT -= dt;
    if (ai.t > 0) return;
    ai.t = ai.react * rand(0.7, 1.3);
    c.left = c.right = false;
    if (!t || f.dead) return;
    if (f.action || f.hurtT > 0 || f.stunT > 0) return;

    var dx = t.x - f.x, dy = t.y - f.y, adx = Math.abs(dx);
    var reach = f.sp.reach * f.scale + t.w * 0.4;
    var dir = dx >= 0 ? 1 : -1;

    // 가끔 뒤로 물러나기
    if (ai.backT > 0) {
      if (dir > 0) c.left = true; else c.right = true;
    } else if (adx > reach * 0.85) {
      if (dir > 0) c.right = true; else c.left = true;
    } else {
      f.face = dir;
      if (Math.abs(dy) < f.h * 0.9 && Math.random() < ai.aggr) c.attackP = true;
      if (Math.random() < 0.08) ai.backT = rand(0.3, 0.7);
    }

    // 상대가 위에 있으면 점프, 아래 발판 아래로 내려가려면 걸어 나가기
    if (dy < -50 && adx < 260) {
      if (f.onGround && Math.random() < 0.7) c.jumpP = true;
      else if (!f.onGround && f.vy > -100 && f.jumpsLeft > 0 && Math.random() < 0.5) c.jumpP = true;
    }
    if (dy > 50 && f.onGround && adx < 40) {
      c.left = ai.wander < 0;
      c.right = ai.wander > 0;
      if (Math.random() < 0.1) ai.wander *= -1;
    }
    if (f.onGround && Math.random() < 0.03) c.jumpP = true;

    // 날아오는 공격 피하기
    for (var i = 0; i < G.projectiles.length; i++) {
      var p = G.projectiles[i];
      if (p.team === f.team) continue;
      var toward = (p.vx > 0 && p.x < f.x) || (p.vx < 0 && p.x > f.x);
      if (toward && Math.abs(p.x - f.x) < 170 && Math.abs(p.y - (f.y - f.h / 2)) < 60 && f.onGround && Math.random() < ai.dodge) {
        c.jumpP = true;
        break;
      }
    }

    // 기술
    for (var s = 0; s < f.skills.length; s++) {
      var sk = f.skills[s];
      if (sk.cd > 0) continue;
      if (skillGood(f, sk.def, t, dx, dy) && Math.random() < ai.skillChance) {
        f.face = dir;
        c.skillP = true;
        c.skillIdx = s;
        break;
      }
    }
  }

  // ---------- 한 프레임 ----------
  function update(dt) {
    if (!G.running) return;
    G.time += dt;
    if (G.banner) {
      G.banner.t += dt;
      if (G.banner.t > G.banner.dur) G.banner = null;
    }
    updateParticles(dt);
    G.shake = Math.max(0, G.shake - dt * 40);

    if (G.hitStop > 0) { G.hitStop -= dt; return; }

    if (G.startT > 0) {
      var before = G.startT;
      G.startT -= dt;
      if (before > 0 && G.startT <= 0) { showBanner('시작!', ''); snd('start'); }
      // 시작 전에는 떨어지기만 (조작 X)
      G.fighters.forEach(function (f) {
        f.ctrl.jumpP = f.ctrl.attackP = f.ctrl.skillP = false;
        f.ctrl.left = f.ctrl.right = false;
        updateFighter(f, dt);
      });
      return;
    }

    G.fighters.forEach(function (f) { if (f.ai && !G.over) aiThink(f, dt); });
    if (G.over) {
      G.fighters.forEach(function (f) { f.ctrl.left = f.ctrl.right = f.ctrl.jump = false; f.ctrl.jumpP = f.ctrl.attackP = f.ctrl.skillP = false; });
    }
    G.fighters.forEach(function (f) { updateFighter(f, dt); });
    separate(dt);
    updateProjectiles(dt);
    updateItems(dt);
    G.rings = G.rings.filter(function (r) { r.t += dt; return r.t < r.dur; });

    // 쓰러진 적은 잠시 뒤 사라져요
    G.fighters = G.fighters.filter(function (f) { return f.isPlayer || !f.dead || f.deadT < 2.2; });

    checkEnd(dt);
  }

  function updateParticles(dt) {
    var keep = [];
    for (var i = 0; i < G.particles.length; i++) {
      var p = G.particles[i];
      p.life -= dt;
      if (p.life <= 0) continue;
      p.vy += (p.g || 0) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      keep.push(p);
    }
    G.particles = keep;
  }

  function checkEnd(dt) {
    if (G.over) {
      G.endT -= dt;
      if (G.endT <= 0 && G.running) {
        G.running = false;
        if (G.onEnd) G.onEnd(G.result);
      }
      return;
    }
    if (G.mode === 'stage') {
      var p = G.players[0];
      if (p.dead && p.deadT > 1.0) return finish({ win: false });
      var alive = G.fighters.some(function (f) { return f.team === 1 && !f.dead; });
      var dying = G.fighters.some(function (f) { return f.team === 1 && f.dead && f.deadT < 0.8; });
      if (!alive && !dying && !p.dead) {
        if (G.waveIdx < G.stage.waves.length - 1) {
          if (G.waveT <= 0) {
            G.waveT = 1.2;
            var heal = Math.round(p.maxHp * D.waveHeal);
            var real = Math.min(heal, p.maxHp - p.hp);
            if (real > 0) {
              p.hp += real;
              textPop(p.x, p.y - p.h - 10, '+' + real, '#5fdc6a', 22);
            }
          }
          G.waveT -= dt;
          if (G.waveT <= 0) {
            G.waveIdx++;
            spawnWave(G.waveIdx);
          }
        } else {
          finish({ win: true });
        }
      }
    } else {
      G.timer -= dt;
      var a = G.players[0], b = G.players[1];
      if ((a.dead && a.deadT > 1.0) || (b.dead && b.deadT > 1.0)) {
        return finish({ winner: a.dead && b.dead ? 0 : a.dead ? 2 : 1 });
      }
      if (G.timer <= 0 && !a.dead && !b.dead) {
        G.timer = 0;
        var ra = a.hp / a.maxHp, rb = b.hp / b.maxHp;
        finish({ winner: Math.abs(ra - rb) < 0.001 ? 0 : ra > rb ? 1 : 2, timeUp: true });
      }
    }
  }

  function finish(res) {
    G.over = true;
    G.result = res;
    G.endT = 1.6;
    if (G.mode === 'stage') {
      showBanner(res.win ? '승리!' : '앗, 쓰러졌어요', '');
      snd(res.win ? 'win' : 'lose');
    } else {
      showBanner(res.timeUp ? '시간 끝!' : res.winner === 0 ? '무승부!' : res.winner + 'P 승리!', '');
      snd('win');
    }
  }

  function stop() {
    G.running = false;
    G.over = true;
  }

  return { G: G, start: start, update: update, stop: stop };
})();
