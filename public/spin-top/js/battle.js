// 전투 로직: 물리, 충돌 피해, 특성, 기술, 아이템, 승패
// 화면 그리기와 분리되어 있고, 렌더러는 state와 events를 읽어서 그린다.
window.ST = window.ST || {};

ST.Battle = (function () {
  var D = ST.data;
  var C = D.config;
  var nextId = 1;

  function len(x, z) { return Math.sqrt(x * x + z * z); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function makeFighter(idx, topId, level, isAI) {
    var def = ST.getTop(topId);
    var st = ST.calcStats(def, level);
    var startZ = idx === 0 ? 5 : -5;
    return {
      idx: idx, def: def, level: level, isAI: !!isAI,
      trait: def.trait, skill: def.skill,
      maxHp: st.maxHp, hp: st.maxHp, atk: st.atk, defense: st.def, spd: st.spd,
      mass: st.mass, decay: st.decay, radius: st.radius,
      spin: 100,
      x: 0, z: startZ, vx: 0, vz: 0,
      inX: 0, inZ: 0,
      launched: false,
      skillCd: 0,
      t: { shield: 0, guard: 0, power: 0, speed: 0, slow: 0, stun: 0, dash: 0, vortex: 0, traitCd: 0 },
      charged: false,
      trailTimer: 0,
      spinAngle: Math.random() * 6.28,
      flash: 0,
    };
  }

  function Battle(opts) {
    // opts: { mode: 'ai'|'pvp', p1: topId, p2: topId, l1, l2, difficulty }
    this.mode = opts.mode;
    this.difficulty = opts.difficulty || 'normal';
    this.f = [
      makeFighter(0, opts.p1, opts.l1, false),
      makeFighter(1, opts.p2, opts.l2, opts.mode === 'ai'),
    ];
    this.phase = 'launch';   // launch → fight → ko → over
    this.time = C.matchTime;
    this.launchTime = 0;
    this.koTimer = 0;
    this.winner = -1;
    this.projectiles = [];
    this.turrets = [];
    this.patches = [];
    this.items = [];
    this.itemTimer = D.itemRules.firstSpawn;
    this.events = [];
    this.pairCd = 0;
    this.timeScale = 1;
  }

  var P = Battle.prototype;

  P.emit = function (e) { this.events.push(e); };
  P.other = function (f) { return this.f[1 - f.idx]; };

  // ---------------------------------------------------------------
  // 발사
  // ---------------------------------------------------------------
  P.launch = function (idx, dirX, dirZ, power) {
    var f = this.f[idx];
    if (this.phase !== 'launch' || f.launched) return;
    power = clamp(power, 0, 1);
    var l = len(dirX, dirZ);
    if (l < 0.001) { dirX = 0; dirZ = idx === 0 ? -1 : 1; l = 1; }
    var sp = C.launchMinSpeed + (C.launchMaxSpeed - C.launchMinSpeed) * power;
    f.vx = dirX / l * sp;
    f.vz = dirZ / l * sp;
    f.spin = C.launchMinSpin + (100 - C.launchMinSpin) * power;
    f.launched = true;
    this.emit({ type: 'launch', idx: idx, power: power });
    if (this.f[0].launched && this.f[1].launched) {
      this.phase = 'fight';
      this.emit({ type: 'start' });
    }
  };

  // ---------------------------------------------------------------
  // 피해 계산
  // kind: 'hit'(충돌) | 'skill' | 'proj' | 'trait' | 'fire' | 'drain'
  // ---------------------------------------------------------------
  P.attackMul = function (a, kind) {
    var m = a.atk / 10;
    if (a.t.power > 0) m *= D.items.power.mul;
    if (kind === 'hit') {
      m *= 0.5 + 0.5 * (a.spin / 100);
      if (a.t.dash > 0) m *= D.skills.dash.bonus;
      if (a.charged) m *= D.traits.rebound.bonus;
    }
    return m;
  };

  P.damage = function (target, raw, attacker, kind) {
    if (this.phase !== 'fight' || target.hp <= 0) return 0;
    var amount = raw;
    if (attacker && kind !== 'drain') amount *= this.attackMul(attacker, kind);
    amount /= target.defense / 10;
    if (target.t.shield > 0) amount *= D.skills.shield.reduce;
    if (target.t.guard > 0) amount *= D.itemRules.guardReduce;
    amount = Math.max(0.5, amount);
    target.hp = Math.max(0, target.hp - amount);
    target.flash = 0.15;
    this.emit({ type: 'dmg', idx: target.idx, amount: amount, x: target.x, z: target.z, kind: kind });
    return amount;
  };

  P.heal = function (f, amount) {
    if (f.hp <= 0) return;
    var before = f.hp;
    f.hp = Math.min(f.maxHp, f.hp + amount);
    if (f.hp - before >= 0.5) this.emit({ type: 'heal', idx: f.idx, amount: f.hp - before, x: f.x, z: f.z });
  };

  P.push = function (f, fromX, fromZ, power) {
    var dx = f.x - fromX, dz = f.z - fromZ;
    var l = len(dx, dz) || 1;
    f.vx += dx / l * power / f.mass;
    f.vz += dz / l * power / f.mass;
  };

  // ---------------------------------------------------------------
  // 기술
  // ---------------------------------------------------------------
  P.canUseSkill = function (idx) {
    var f = this.f[idx];
    return this.phase === 'fight' && f.skillCd <= 0 && f.hp > 0 && f.t.stun <= 0;
  };

  P.useSkill = function (idx) {
    if (!this.canUseSkill(idx)) return false;
    var f = this.f[idx], o = this.other(f);
    var s = D.skills[f.skill];
    f.skillCd = s.cooldown;
    var dx = o.x - f.x, dz = o.z - f.z, dist = len(dx, dz) || 1;
    this.emit({ type: 'skill', idx: idx, skill: f.skill, x: f.x, z: f.z });

    switch (f.skill) {
      case 'watercannon': {
        var base = Math.atan2(dz, dx);
        for (var i = 0; i < s.count; i++) {
          var a = base + (i - (s.count - 1) / 2) * s.spread;
          this.addProjectile(f, f.x + Math.cos(a) * f.radius, f.z + Math.sin(a) * f.radius,
            Math.cos(a) * s.speed, Math.sin(a) * s.speed, s.damage, 'water');
        }
        break;
      }
      case 'dash': {
        var ix = f.inX, iz = f.inZ, il = len(ix, iz);
        if (il < 0.2) { ix = dx; iz = dz; il = dist; }
        f.vx += ix / il * s.power;
        f.vz += iz / il * s.power;
        f.t.dash = s.time;
        break;
      }
      case 'shield':
        f.t.shield = s.time;
        break;
      case 'lightning':
        this.emit({ type: 'bolt', x: o.x, z: o.z });
        this.damage(o, s.damage, f, 'skill');
        o.t.stun = Math.max(o.t.stun, s.stun);
        break;
      case 'frostnova':
        this.emit({ type: 'ring', x: f.x, z: f.z, radius: s.radius, color: 0x9be8ff });
        if (dist < s.radius + o.radius) {
          this.damage(o, s.damage, f, 'skill');
          this.push(o, f.x, f.z, s.push);
          o.t.slow = Math.max(o.t.slow, s.slow);
        }
        break;
      case 'vortex':
        f.t.vortex = s.time;
        break;
      case 'heal':
        this.heal(f, f.maxHp * s.ratio);
        f.spin = Math.min(100, f.spin + s.spin);
        break;
      case 'spinup':
        f.spin = Math.min(100, f.spin + s.spin);
        f.t.speed = Math.max(f.t.speed, s.speedTime);
        break;
    }
    return true;
  };

  P.addProjectile = function (owner, x, z, vx, vz, damage, kind) {
    this.projectiles.push({ id: nextId++, owner: owner.idx, x: x, z: z, vx: vx, vz: vz, damage: damage, kind: kind, life: 2.5, r: 0.28 });
  };

  // ---------------------------------------------------------------
  // 특성: 벽 충돌
  // ---------------------------------------------------------------
  P.onWallHit = function (f, nx, nz, speed) {
    var R = C.arenaRadius;
    var wx = nx * R, wz = nz * R;
    this.emit({ type: 'wall', x: wx, z: wz, speed: speed, idx: f.idx });
    var o = this.other(f);

    if (f.trait === 'bubble' && speed > 3) {
      var tr = D.traits.bubble, mine = 0;
      for (var i = 0; i < this.turrets.length; i++) if (this.turrets[i].owner === f.idx) mine++;
      if (mine < tr.maxTurrets) {
        this.turrets.push({ id: nextId++, owner: f.idx, x: nx * (R - 0.45), z: nz * (R - 0.45), shots: tr.shots, timer: 0.5 });
        this.emit({ type: 'trait', idx: f.idx, trait: 'bubble', x: wx, z: wz });
      }
    }
    if (f.trait === 'rebound' && f.t.traitCd <= 0 && speed > 3) {
      var rb = D.traits.rebound;
      f.vx *= rb.boost; f.vz *= rb.boost;
      f.charged = true;
      f.t.traitCd = rb.cooldown;
      this.emit({ type: 'trait', idx: f.idx, trait: 'rebound', x: f.x, z: f.z });
    }
    if (f.trait === 'quake' && f.t.traitCd <= 0 && speed > 3) {
      var q = D.traits.quake;
      f.t.traitCd = q.cooldown;
      this.emit({ type: 'ring', x: wx * 0.95, z: wz * 0.95, radius: q.radius, color: 0xc07a3a });
      this.emit({ type: 'shake', amount: 0.35 });
      if (len(o.x - wx, o.z - wz) < q.radius + o.radius) {
        this.damage(o, q.damage, f, 'trait');
        this.push(o, wx, wz, q.push);
      }
    }
  };

  // ---------------------------------------------------------------
  // 특성: 팽이끼리 충돌
  // ---------------------------------------------------------------
  P.onTopHit = function (a, b, dealtToB, dealtToA) {
    // a의 특성이 b에게 (그리고 반대로) 적용된다
    var pairs = [[a, b, dealtToB, dealtToA], [b, a, dealtToA, dealtToB]];
    for (var i = 0; i < 2; i++) {
      var me = pairs[i][0], you = pairs[i][1], dealt = pairs[i][2], taken = pairs[i][3];
      switch (me.trait) {
        case 'thorns':
          if (taken > 0) this.damage(you, taken * D.traits.thorns.reflect * (me.defense / 10), null, 'trait');
          break;
        case 'drain':
          if (dealt > 0) this.heal(me, dealt * D.traits.drain.ratio);
          break;
        case 'static':
          if (Math.random() < D.traits.static.chance) {
            you.t.stun = Math.max(you.t.stun, D.traits.static.stun);
            this.emit({ type: 'trait', idx: me.idx, trait: 'static', x: you.x, z: you.z });
          }
          break;
        case 'frost':
          you.t.slow = Math.max(you.t.slow, D.traits.frost.slow);
          break;
      }
      if (me.charged) me.charged = false;
    }
  };

  // ---------------------------------------------------------------
  // 아이템
  // ---------------------------------------------------------------
  P.spawnItem = function () {
    var keys = Object.keys(D.items), total = 0, k;
    for (k = 0; k < keys.length; k++) total += D.items[keys[k]].weight;
    var r = Math.random() * total, type = keys[0];
    for (k = 0; k < keys.length; k++) {
      r -= D.items[keys[k]].weight;
      if (r <= 0) { type = keys[k]; break; }
    }
    // 두 팽이에게서 너무 가깝지 않은 자리를 고른다
    var best = null, bestScore = -1;
    for (var tries = 0; tries < 8; tries++) {
      var ang = Math.random() * Math.PI * 2;
      var rad = Math.sqrt(Math.random()) * (C.arenaRadius - 2);
      var x = Math.cos(ang) * rad, z = Math.sin(ang) * rad;
      var s = Math.min(len(x - this.f[0].x, z - this.f[0].z), len(x - this.f[1].x, z - this.f[1].z));
      if (s > bestScore) { bestScore = s; best = { x: x, z: z }; }
    }
    this.items.push({ id: nextId++, type: type, x: best.x, z: best.z, life: D.itemRules.life });
  };

  P.pickItem = function (f, it) {
    var d = D.items[it.type];
    switch (it.type) {
      case 'heart': this.heal(f, f.maxHp * d.heal); break;
      case 'battery': f.spin = Math.min(100, f.spin + d.spin); break;
      case 'power': f.t.power = d.time; break;
      case 'guard': f.t.guard = d.time; break;
      case 'boots': f.t.speed = Math.max(f.t.speed, d.time); break;
      case 'recharge': f.skillCd = 0; break;
    }
    this.emit({ type: 'item', idx: f.idx, item: it.type, x: it.x, z: it.z });
  };

  // ---------------------------------------------------------------
  // 메인 업데이트
  // ---------------------------------------------------------------
  P.update = function (realDt) {
    var dt = realDt * this.timeScale;
    if (this.phase === 'launch') {
      this.launchTime += realDt;
      for (var i = 0; i < 2; i++) this.f[i].spinAngle += realDt * 2;
      if (this.launchTime > C.launchTimeout) {
        for (var j = 0; j < 2; j++) if (!this.f[j].launched) this.launch(j, 0, j === 0 ? -1 : 1, 0.5);
      }
      return;
    }
    if (this.phase === 'over') {
      for (var m = 0; m < 2; m++) this.f[m].spinAngle += dt * (this.f[m].spin / 100) * 25;
      return;
    }
    if (this.phase === 'ko') {
      this.koTimer -= realDt;
      if (this.koTimer <= 0) { this.phase = 'over'; this.timeScale = 1; this.emit({ type: 'over', winner: this.winner }); }
    }

    // 작은 단계로 나눠 계산 (빠른 충돌도 놓치지 않게)
    var steps = Math.max(1, Math.ceil(dt / (1 / 120)));
    var h = dt / steps;
    for (var s = 0; s < steps; s++) this.step(h);

    if (this.phase === 'fight') {
      this.time -= dt;
      if (this.time <= 0) {
        this.time = 0;
        var r0 = this.f[0].hp / this.f[0].maxHp, r1 = this.f[1].hp / this.f[1].maxHp;
        this.finish(r0 === r1 ? (this.f[0].spin >= this.f[1].spin ? 0 : 1) : r0 > r1 ? 0 : 1, 'time');
      }
    }
  };

  P.finish = function (winner, reason) {
    if (this.phase !== 'fight') return;
    this.winner = winner;
    this.phase = 'ko';
    this.koTimer = 1.6;
    this.timeScale = 0.3;
    this.emit({ type: 'ko', winner: winner, reason: reason });
  };

  P.step = function (dt) {
    var R = C.arenaRadius;
    var fighting = this.phase === 'fight';
    var i, f, o, k;

    for (i = 0; i < 2; i++) {
      f = this.f[i]; o = this.f[1 - i];
      // 타이머
      for (k in f.t) if (f.t[k] > 0) f.t[k] = Math.max(0, f.t[k] - dt);
      if (f.skillCd > 0) f.skillCd = Math.max(0, f.skillCd - dt);
      if (f.flash > 0) f.flash -= dt;

      // 회전력
      if (fighting) {
        f.spin = Math.max(0, f.spin - f.decay * dt);
        if (f.spin <= 0) {
          f.hp = Math.max(0, f.hp - C.spinZeroDrain * dt);
        }
      }
      f.spinAngle += dt * (8 + 22 * f.spin / 100);

      // 조종
      var ax = 0, az = 0;
      if (fighting && f.t.stun <= 0 && f.hp > 0) {
        var il = len(f.inX, f.inZ);
        var ix = f.inX, iz = f.inZ;
        if (il > 1) { ix /= il; iz /= il; }
        var mul = f.spd * (0.4 + 0.6 * f.spin / 100);
        if (f.t.speed > 0) mul *= D.itemRules.speedMul;
        if (f.t.slow > 0) mul *= 0.55;
        ax += ix * mul; az += iz * mul;
      }
      // 그릇 가운데로 끌림
      ax -= f.x * C.bowlPull;
      az -= f.z * C.bowlPull;
      // 상대의 회오리
      if (o.t.vortex > 0) {
        var vx = o.x - f.x, vz = o.z - f.z, vl = len(vx, vz) || 1;
        ax += vx / vl * D.skills.vortex.pull / f.mass;
        az += vz / vl * D.skills.vortex.pull / f.mass;
      }

      f.vx += ax * dt; f.vz += az * dt;
      var damp = Math.max(0, 1 - C.friction * dt);
      f.vx *= damp; f.vz *= damp;
      var maxSp = C.maxSpeed * (f.t.speed > 0 ? D.itemRules.speedMul : 1) * (f.t.dash > 0 ? 1.4 : 1);
      var sp = len(f.vx, f.vz);
      if (sp > maxSp) { f.vx *= maxSp / sp; f.vz *= maxSp / sp; }

      f.x += f.vx * dt; f.z += f.vz * dt;

      // 벽
      var d = len(f.x, f.z);
      if (d + f.radius > R) {
        var nx = f.x / d, nz = f.z / d;
        f.x = nx * (R - f.radius); f.z = nz * (R - f.radius);
        var vn = f.vx * nx + f.vz * nz;
        if (vn > 0) {
          f.vx -= (1 + C.wallBounce) * vn * nx;
          f.vz -= (1 + C.wallBounce) * vn * nz;
          if (vn > 2.5 && fighting) this.onWallHit(f, nx, nz, vn);
        }
      }

      // 불꽃 자국
      if (fighting && f.trait === 'flametrail') {
        var ft = D.traits.flametrail;
        f.trailTimer -= dt;
        if (f.trailTimer <= 0 && len(f.vx, f.vz) > ft.minSpeed) {
          f.trailTimer = ft.every;
          this.patches.push({ id: nextId++, owner: f.idx, x: f.x, z: f.z, life: ft.life, maxLife: ft.life, tick: 0 });
          if (this.patches.length > 50) this.patches.shift();
        }
      }
    }

    this.collideTops(dt);

    if (!fighting && this.phase !== 'ko') return;

    // 투사체
    for (i = this.projectiles.length - 1; i >= 0; i--) {
      var p = this.projectiles[i];
      p.x += p.vx * dt; p.z += p.vz * dt; p.life -= dt;
      var tgt = this.f[1 - p.owner];
      var remove = p.life <= 0 || len(p.x, p.z) > R;
      if (!remove && len(tgt.x - p.x, tgt.z - p.z) < tgt.radius + p.r) {
        this.damage(tgt, p.damage, this.f[p.owner], 'proj');
        tgt.vx += p.vx * 0.25 / tgt.mass; tgt.vz += p.vz * 0.25 / tgt.mass;
        this.emit({ type: 'splash', x: p.x, z: p.z, kind: p.kind });
        remove = true;
      }
      if (remove) this.projectiles.splice(i, 1);
    }

    // 물방울 포탑
    var bt = D.traits.bubble;
    for (i = this.turrets.length - 1; i >= 0; i--) {
      var t = this.turrets[i];
      t.timer -= dt;
      if (t.timer <= 0 && fighting) {
        var target = this.f[1 - t.owner];
        var tx = target.x - t.x, tz = target.z - t.z, tl = len(tx, tz) || 1;
        this.addProjectile(this.f[t.owner], t.x, t.z, tx / tl * bt.speed, tz / tl * bt.speed, bt.damage, 'bubble');
        t.shots--;
        t.timer = bt.interval;
        if (t.shots <= 0) { this.emit({ type: 'splash', x: t.x, z: t.z, kind: 'bubble' }); this.turrets.splice(i, 1); }
      }
    }

    // 불꽃 바닥
    var fd = D.traits.flametrail;
    for (i = this.patches.length - 1; i >= 0; i--) {
      var pa = this.patches[i];
      pa.life -= dt;
      if (pa.life <= 0) { this.patches.splice(i, 1); continue; }
      var vic = this.f[1 - pa.owner];
      pa.tick -= dt;
      if (pa.tick <= 0 && len(vic.x - pa.x, vic.z - pa.z) < fd.radius + vic.radius * 0.5) {
        pa.tick = 0.25;
        if (!vic.burnLock || vic.burnLock <= 0) {
          this.damage(vic, fd.dps * 0.25, this.f[pa.owner], 'fire');
          vic.burnLock = 0.24;
        }
      }
    }
    for (i = 0; i < 2; i++) if (this.f[i].burnLock > 0) this.f[i].burnLock -= dt;

    // 아이템
    if (fighting) {
      this.itemTimer -= dt;
      if (this.itemTimer <= 0) {
        this.itemTimer = D.itemRules.interval;
        if (this.items.length < D.itemRules.maxOnField) this.spawnItem();
      }
    }
    for (i = this.items.length - 1; i >= 0; i--) {
      var it = this.items[i];
      it.life -= dt;
      if (it.life <= 0) { this.items.splice(i, 1); continue; }
      if (!fighting) continue;
      for (var q = 0; q < 2; q++) {
        var ff = this.f[q];
        if (len(ff.x - it.x, ff.z - it.z) < ff.radius + D.itemRules.pickRadius * 0.6) {
          this.pickItem(ff, it);
          this.items.splice(i, 1);
          break;
        }
      }
    }

    // 승패
    if (fighting) {
      var dead0 = this.f[0].hp <= 0, dead1 = this.f[1].hp <= 0;
      if (dead0 || dead1) this.finish(dead0 && dead1 ? -1 : dead0 ? 1 : 0, 'ko');
    }
  };

  P.collideTops = function (dt) {
    var a = this.f[0], b = this.f[1];
    if (this.pairCd > 0) this.pairCd -= dt;
    if (this.phase === 'launch') return;
    var dx = b.x - a.x, dz = b.z - a.z;
    var dist = len(dx, dz), minD = a.radius + b.radius;
    if (dist >= minD || dist < 0.0001) return;
    var nx = dx / dist, nz = dz / dist;
    // 겹친 만큼 밀어내기 (무거운 팽이는 덜 밀림)
    var overlap = minD - dist;
    var ia = 1 / a.mass, ib = 1 / b.mass, sum = ia + ib;
    a.x -= nx * overlap * ia / sum; a.z -= nz * overlap * ia / sum;
    b.x += nx * overlap * ib / sum; b.z += nz * overlap * ib / sum;

    var aToward = Math.max(0, a.vx * nx + a.vz * nz);
    var bToward = Math.max(0, -(b.vx * nx + b.vz * nz));
    var rel = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
    if (rel <= 0) return;

    var j = (1 + C.topBounce) * rel / sum;
    a.vx -= j * ia * nx; a.vz -= j * ia * nz;
    b.vx += j * ib * nx; b.vz += j * ib * nz;
    // 회전력끼리 튕겨내는 힘
    var push = C.spinPush * (0.5 + 0.5 * (a.spin + b.spin) / 200);
    a.vx -= nx * push * ia; a.vz -= nz * push * ia;
    b.vx += nx * push * ib; b.vz += nz * push * ib;

    if (this.phase !== 'fight' || this.pairCd > 0 || rel < 1) return;
    this.pairCd = C.hitCooldown;

    var toB = this.damage(b, C.hitBase + aToward * C.hitSpeed, a, 'hit');
    var toA = this.damage(a, C.hitBase + bToward * C.hitSpeed, b, 'hit');
    a.spin = Math.max(0, a.spin - C.spinLossOnHit);
    b.spin = Math.max(0, b.spin - C.spinLossOnHit);
    var cx = a.x + nx * a.radius, cz = a.z + nz * a.radius;
    this.emit({ type: 'hit', x: cx, z: cz, power: rel, big: toA + toB > 14 });
    this.emit({ type: 'shake', amount: Math.min(0.5, rel * 0.03) });
    this.onTopHit(a, b, toB, toA);
  };

  return Battle;
})();
