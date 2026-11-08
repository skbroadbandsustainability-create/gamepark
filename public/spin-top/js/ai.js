// 컴퓨터(AI) 팽이 조종
window.ST = window.ST || {};

ST.AI = (function () {
  var D = ST.data;

  function len(x, z) { return Math.sqrt(x * x + z * z); }

  function AI(battle, idx, difficulty) {
    this.b = battle;
    this.idx = idx;
    this.p = D.ai[difficulty] || D.ai.normal;
    this.think = 0;
    this.launchDelay = 0.9 + Math.random() * 1.0;
    this.wobble = Math.random() * 6.28;
    this.goalX = 0;
    this.goalZ = 0;
  }

  AI.prototype.update = function (dt) {
    var b = this.b, me = b.f[this.idx], op = b.f[1 - this.idx];
    var R = D.config.arenaRadius;

    if (b.phase === 'launch') {
      if (me.launched) return;
      this.launchDelay -= dt;
      if (this.launchDelay <= 0) {
        var lp = this.p.launchPower;
        var power = lp[0] + Math.random() * (lp[1] - lp[0]);
        var ang = (Math.random() - 0.5) * 1.2;
        var dirZ = this.idx === 0 ? -1 : 1;
        b.launch(this.idx, Math.sin(ang), dirZ * Math.cos(ang), power);
      }
      return;
    }
    if (b.phase !== 'fight') { me.inX = 0; me.inZ = 0; return; }

    this.think -= dt;
    this.wobble += dt * 1.7;
    if (this.think <= 0) {
      this.think = this.p.think;
      this.decide(me, op, R);
    }

    // 목표 쪽으로 조종 + 쉬움일수록 흔들림
    var gx = this.goalX - me.x, gz = this.goalZ - me.z, gl = len(gx, gz) || 1;
    var aim = this.p.aim;
    var noise = (1 - aim) * 1.2;
    var ix = gx / gl + Math.cos(this.wobble) * noise;
    var iz = gz / gl + Math.sin(this.wobble * 1.3) * noise;
    // 벽 가까이에서는 안쪽으로
    var d = len(me.x, me.z);
    if (d > R - 1.6) { ix -= me.x / d * 0.8; iz -= me.z / d * 0.8; }
    var il = len(ix, iz) || 1;
    var strength = 0.55 + 0.45 * aim;
    me.inX = ix / il * strength;
    me.inZ = iz / il * strength;
  };

  AI.prototype.decide = function (me, op, R) {
    var b = this.b;
    var dist = len(op.x - me.x, op.z - me.z);
    var hpRatio = me.hp / me.maxHp;

    // 1) 목표 정하기: 기본은 상대를 예측해서 들이받기
    var lead = 0.25 + 0.2 * this.p.aim;
    var tx = op.x + op.vx * lead, tz = op.z + op.vz * lead;

    // 가까운 아이템이 있으면 먼저 먹으러 가기 (HP가 낮으면 하트 우선)
    var best = null, bestD = 1e9;
    for (var i = 0; i < b.items.length; i++) {
      var it = b.items[i];
      var di = len(it.x - me.x, it.z - me.z);
      var want = it.type === 'heart' ? (hpRatio < 0.6 ? 0.4 : 0.9) : it.type === 'battery' && me.spin < 50 ? 0.5 : 0.8;
      var score = di * want;
      if (score < bestD) { bestD = score; best = it; }
    }
    if (best && bestD < Math.max(3.5, dist * 0.7)) { tx = best.x; tz = best.z; }

    // 상대가 방패 중이면 잠깐 거리 두기
    if (op.t.shield > 0 && this.p.aim > 0.8) {
      var ax = me.x - op.x, az = me.z - op.z, al = len(ax, az) || 1;
      tx = me.x + ax / al * 3 - me.x * 0.3;
      tz = me.z + az / al * 3 - me.z * 0.3;
    }
    this.goalX = tx;
    this.goalZ = tz;

    // 2) 기술 쓰기
    if (!b.canUseSkill(this.idx) || Math.random() > this.p.skillChance) return;
    var s = D.skills[me.skill];
    var use = false;
    var approaching = (op.vx * (me.x - op.x) + op.vz * (me.z - op.z)) / (dist || 1) > 3;
    switch (s.ai) {
      case 'near': use = dist < 4.2; break;
      case 'range': use = dist < 11; break;
      case 'defend': use = dist < 3.5 && approaching; break;
      case 'heal': use = hpRatio < 0.6; break;
      case 'spin': use = me.spin < 55; break;
    }
    if (use) {
      // 돌진은 상대 쪽을 보고 쓰기
      if (me.skill === 'dash') {
        var dx = op.x - me.x, dz = op.z - me.z, dl = len(dx, dz) || 1;
        me.inX = dx / dl; me.inZ = dz / dl;
      }
      b.useSkill(this.idx);
    }
  };

  return AI;
})();
