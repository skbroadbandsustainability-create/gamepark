// 3D 화면 그리기 (Three.js r149 전역 빌드)
window.ST = window.ST || {};

ST.Render = (function () {
  var D = ST.data;
  var R = D.config.arenaRadius;
  var K = D.config.bowlHeight;
  var PLAYER_COLORS = [0x4da3ff, 0xff5d73];

  var renderer, scene, camera, canvas;
  var dyn;              // 전투마다 새로 만드는 물체들
  var fighters = [];    // 팽이 모델
  var showcaseTop = null;
  var mode = 'menu', pvp = false;
  var camBase = new THREE.Vector3(), camLook = new THREE.Vector3();
  var shake = 0;
  var meshMaps = { proj: new Map(), turret: new Map(), patch: new Map(), item: new Map() };
  var sparks = [], rings = [], bolts = [];
  var emojiTex = {};
  var time = 0;

  function bowlY(x, z) { return K * (x * x + z * z); }

  // ---------------------------------------------------------------
  // 초기화
  // ---------------------------------------------------------------
  function init(cv) {
    canvas = cv;
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1d2547);
    camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x3a4566, 0.95));
    var sun = new THREE.DirectionalLight(0xffffff, 0.75);
    sun.position.set(6, 14, 8);
    scene.add(sun);

    buildArena();
    dyn = new THREE.Group();
    scene.add(dyn);
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', function () { setTimeout(resize, 200); });
  }

  function buildArena() {
    // 바깥 바닥
    var ground = new THREE.Mesh(new THREE.CircleGeometry(40, 48), new THREE.MeshLambertMaterial({ color: 0x2b3566 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.4;
    scene.add(ground);

    // 그릇 모양 경기장
    var pts = [];
    for (var i = 0; i <= 24; i++) {
      var r = (R + 0.2) * i / 24;
      pts.push(new THREE.Vector2(r, K * r * r));
    }
    var bowl = new THREE.Mesh(new THREE.LatheGeometry(pts, 64),
      new THREE.MeshStandardMaterial({ color: 0xe9eef8, roughness: 0.85, metalness: 0.0, side: THREE.DoubleSide }));
    scene.add(bowl);

    // 바닥 무늬 (원)
    [2.5, 5, 7.5].forEach(function (r, i) {
      var ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.06, r + 0.06, 64),
        new THREE.MeshBasicMaterial({ color: i === 1 ? 0xffb84d : 0xb9c6e6, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = K * r * r + 0.02;
      scene.add(ring);
    });
    var center = new THREE.Mesh(new THREE.CircleGeometry(1.1, 32), new THREE.MeshBasicMaterial({ color: 0xffd36b }));
    center.rotation.x = -Math.PI / 2;
    center.position.y = 0.02;
    scene.add(center);
    var star = new THREE.Mesh(new THREE.CircleGeometry(0.6, 5), new THREE.MeshBasicMaterial({ color: 0xff8a3d }));
    star.rotation.x = -Math.PI / 2;
    star.position.y = 0.03;
    scene.add(star);

    // 벽
    var wallY = K * R * R;
    var wall = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.25, R + 0.25, 1.3, 72, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x5b6fd6, roughness: 0.6, side: THREE.DoubleSide, transparent: true, opacity: 0.92 }));
    wall.position.y = wallY + 0.45;
    scene.add(wall);
    var rim = new THREE.Mesh(new THREE.TorusGeometry(R + 0.25, 0.18, 10, 72),
      new THREE.MeshStandardMaterial({ color: 0xffd36b, roughness: 0.4 }));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = wallY + 1.1;
    scene.add(rim);
    // 벽 장식 기둥
    for (var p = 0; p < 12; p++) {
      var a = p / 12 * Math.PI * 2;
      var post = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.5, 0.35),
        new THREE.MeshStandardMaterial({ color: p % 2 ? 0xff7aa8 : 0x7ad8ff }));
      post.position.set(Math.cos(a) * (R + 0.45), wallY + 0.45, Math.sin(a) * (R + 0.45));
      scene.add(post);
    }
  }

  // ---------------------------------------------------------------
  // 팽이 모델 (기본 도형 조합)
  // ---------------------------------------------------------------
  function buildTop(def, playerIdx) {
    var r = def.radius;
    var root = new THREE.Group();
    var tilt = new THREE.Group();
    var spin = new THREE.Group();
    root.add(tilt);
    tilt.add(spin);
    var mats = [];
    function mat(color, extra) {
      var m = new THREE.MeshStandardMaterial(Object.assign({ color: color, roughness: 0.45, metalness: 0.25 }, extra || {}));
      mats.push(m);
      return m;
    }
    var bodyMat = mat(def.color), ringMat = mat(def.ring), darkMat = mat(0x333a4a);

    // 끝(심)
    var tip = new THREE.Mesh(new THREE.ConeGeometry(r * 0.22, 0.32, 12), darkMat);
    tip.rotation.x = Math.PI;
    tip.position.y = 0.16;
    spin.add(tip);
    // 아래 몸통
    var lower = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.85, r * 0.3, 0.32, 24), bodyMat);
    lower.position.y = 0.46;
    spin.add(lower);
    // 테두리 링
    var ring = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.14, 32), ringMat);
    ring.position.y = 0.66;
    spin.add(ring);
    // 날개
    var n = def.blades;
    for (var i = 0; i < n; i++) {
      var a = i / n * Math.PI * 2;
      var blade;
      if (def.bladeType === 'spike') {
        blade = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 6), bodyMat);
        blade.rotation.z = -Math.PI / 2;
        blade.position.set(r + 0.12, 0.66, 0);
      } else if (def.bladeType === 'round') {
        blade = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), bodyMat);
        blade.position.set(r * 0.92, 0.7, 0);
      } else {
        blade = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.3), bodyMat);
        blade.position.set(r * 0.95, 0.66, 0);
      }
      var holder = new THREE.Group();
      holder.rotation.y = a;
      holder.add(blade);
      spin.add(holder);
    }
    // 위 덮개
    var cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.8, 0.2, 24), bodyMat);
    cap.position.y = 0.83;
    spin.add(cap);
    var gem = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.28, r * 0.32, 0.12, 6), ringMat);
    gem.position.y = 0.98;
    spin.add(gem);
    // 무늬 (돌 때 잘 보이게)
    var stripe = new THREE.Mesh(new THREE.BoxGeometry(r * 1.1, 0.03, 0.12), mat(0xffffff));
    stripe.position.y = 0.94;
    spin.add(stripe);

    // 플레이어 표시 바닥 링
    var marker = null;
    if (playerIdx === 0 || playerIdx === 1) {
      marker = new THREE.Mesh(new THREE.RingGeometry(r + 0.12, r + 0.3, 32),
        new THREE.MeshBasicMaterial({ color: PLAYER_COLORS[playerIdx], transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
      marker.rotation.x = -Math.PI / 2;
      root.add(marker);
    }
    // 방패
    var shield = new THREE.Mesh(new THREE.SphereGeometry(r + 0.35, 20, 14),
      new THREE.MeshBasicMaterial({ color: 0x8fd0ff, transparent: true, opacity: 0.3, depthWrite: false }));
    shield.position.y = 0.55;
    shield.visible = false;
    root.add(shield);
    // 감전 표시
    var stun = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.05, 6, 16), new THREE.MeshBasicMaterial({ color: 0xfff066 }));
    stun.rotation.x = Math.PI / 2;
    stun.position.y = 1.35;
    stun.visible = false;
    root.add(stun);
    // 파워 표시
    var aura = new THREE.Mesh(new THREE.RingGeometry(r + 0.32, r + 0.55, 32),
      new THREE.MeshBasicMaterial({ color: 0xffa020, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
    aura.rotation.x = -Math.PI / 2;
    aura.position.y = 0.02;
    aura.visible = false;
    root.add(aura);

    return { root: root, tilt: tilt, spin: spin, mats: mats, marker: marker, shield: shield, stun: stun, aura: aura, def: def };
  }

  // ---------------------------------------------------------------
  // 카메라
  // ---------------------------------------------------------------
  function resize() {
    var w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    placeCamera();
  }

  function placeCamera() {
    var aspect = camera.aspect;
    var halfV = Math.tan(camera.fov * Math.PI / 360);
    var halfH = halfV * aspect;
    if (mode === 'menu') {
      var dist = aspect < 1 ? 7.5 / Math.max(0.55, aspect) : 7.5;
      camBase.set(0, 3.4 + dist * 0.25, dist);
      camLook.set(0, 0.9, 0);
    } else if (pvp) {
      // 2인: 위에서 똑바로 내려다보기 (양쪽 모두 공평하게)
      var need = R + 1.2;
      var hgt = need / Math.min(halfV, halfH) + 2.5;
      camBase.set(0, hgt, 0.01);
      camLook.set(0, 0, 0);
    } else {
      // AI 대전: 내 쪽(아래)에서 비스듬히 보기
      var need2 = R + 1.0;
      var d2 = need2 / Math.min(halfV * 0.92, halfH) + 1.5;
      var dir = new THREE.Vector3(0, 0.88, 0.48).normalize();
      camBase.copy(dir).multiplyScalar(d2);
      camLook.set(0, 0, 0.8);
    }
    camera.up.set(0, 1, 0);
    if (mode !== 'menu' && pvp) camera.up.set(0, 0, -1);
    camera.position.copy(camBase);
    camera.lookAt(camLook);
    applyViewOffset();
  }

  // 메뉴 화면에서 팽이가 보일 위치 (화면 높이 비율만큼 위로 올림)
  var menuShift = 0;
  function setMenuShift(f) { menuShift = f; applyViewOffset(); }
  function applyViewOffset() {
    var w = window.innerWidth, h = window.innerHeight;
    if (mode === 'menu' && menuShift) camera.setViewOffset(w, h, 0, h * menuShift, w, h);
    else camera.clearViewOffset();
  }

  function setMenu(defId) {
    mode = 'menu';
    clearBattle();
    if (showcaseTop) { scene.remove(showcaseTop.root); showcaseTop = null; }
    var def = ST.getTop(defId);
    showcaseTop = buildTop(def, -1);
    showcaseTop.root.scale.setScalar(1.7);
    scene.add(showcaseTop.root);
    placeCamera();
  }

  // ---------------------------------------------------------------
  // 전투 준비
  // ---------------------------------------------------------------
  function clearBattle() {
    for (var i = dyn.children.length - 1; i >= 0; i--) dyn.remove(dyn.children[i]);
    fighters = [];
    Object.keys(meshMaps).forEach(function (k) { meshMaps[k].clear(); });
    sparks = []; rings = []; bolts = [];
  }

  function setBattle(battle) {
    mode = 'battle';
    pvp = battle.mode === 'pvp';
    clearBattle();
    if (showcaseTop) { scene.remove(showcaseTop.root); showcaseTop = null; }
    for (var i = 0; i < 2; i++) {
      var t = buildTop(battle.f[i].def, i);
      dyn.add(t.root);
      fighters.push(t);
    }
    placeCamera();
  }

  // ---------------------------------------------------------------
  // 이펙트
  // ---------------------------------------------------------------
  var sparkGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
  function addSparks(x, y, z, color, count, speed) {
    for (var i = 0; i < count; i++) {
      var m = new THREE.Mesh(sparkGeo, new THREE.MeshBasicMaterial({ color: color, transparent: true }));
      m.position.set(x, y, z);
      var a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.8);
      m.userData = { vx: Math.cos(a) * s, vy: 2 + Math.random() * 4, vz: Math.sin(a) * s, life: 0.45 + Math.random() * 0.3 };
      dyn.add(m);
      sparks.push(m);
    }
  }

  function addRing(x, z, radius, color, life) {
    var m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48),
      new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, bowlY(x, z) + 0.1, z);
    m.userData = { radius: radius, life: life || 0.45, max: life || 0.45 };
    m.scale.setScalar(0.2);
    dyn.add(m);
    rings.push(m);
  }

  function addBolt(x, z) {
    var y = bowlY(x, z);
    var g = new THREE.Group();
    var segs = 6, px = x, pz = z, py = y + 9;
    for (var i = 0; i < segs; i++) {
      var nx = x + (i === segs - 1 ? 0 : (Math.random() - 0.5) * 1.2);
      var nz = z + (i === segs - 1 ? 0 : (Math.random() - 0.5) * 1.2);
      var ny = py - 9 / segs;
      var a = new THREE.Vector3(px, py, pz), b = new THREE.Vector3(nx, ny, nz);
      var l = a.distanceTo(b);
      var seg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, l, 5), new THREE.MeshBasicMaterial({ color: 0xfff27a, transparent: true }));
      seg.position.copy(a).add(b).multiplyScalar(0.5);
      seg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      g.add(seg);
      px = nx; py = ny; pz = nz;
    }
    g.userData = { life: 0.3 };
    dyn.add(g);
    bolts.push(g);
    addRing(x, z, 1.8, 0xfff27a, 0.35);
  }

  function getEmojiTexture(emoji) {
    if (emojiTex[emoji]) return emojiTex[emoji];
    var c = document.createElement('canvas');
    c.width = c.height = 128;
    var g = c.getContext('2d');
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2); g.fill();
    g.font = '80px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(emoji, 64, 70);
    var t = new THREE.CanvasTexture(c);
    emojiTex[emoji] = t;
    return t;
  }

  function handleEvents(battle) {
    var ev = battle.events;
    for (var i = 0; i < ev.length; i++) {
      var e = ev[i];
      switch (e.type) {
        case 'hit':
          addSparks(e.x, bowlY(e.x, e.z) + 0.6, e.z, e.big ? 0xffe14d : 0xffffff, e.big ? 18 : 10, 3 + e.power * 0.4);
          break;
        case 'wall':
          if (e.speed > 4) addSparks(e.x, bowlY(e.x, e.z) + 0.5, e.z, 0xbfd4ff, 6, 2.5);
          break;
        case 'ring': addRing(e.x, e.z, e.radius, e.color, 0.45); break;
        case 'bolt': addBolt(e.x, e.z); break;
        case 'shake': shake = Math.max(shake, e.amount); break;
        case 'splash': addSparks(e.x, bowlY(e.x, e.z) + 0.5, e.z, 0x7fd0ff, 6, 2); break;
        case 'item': addRing(e.x, e.z, 1.6, 0xffffff, 0.35); break;
        case 'heal': addSparks(e.x, bowlY(e.x, e.z) + 0.8, e.z, 0x7dff8a, 8, 1.5); break;
        case 'skill': {
          var s = battle.f[e.idx].skill;
          if (s === 'dash') addSparks(e.x, bowlY(e.x, e.z) + 0.5, e.z, 0xff7a2a, 14, 3);
          if (s === 'vortex') addRing(e.x, e.z, 3, 0x7be0a0, 0.6);
          if (s === 'spinup') addRing(e.x, e.z, 2, 0xffd36b, 0.4);
          break;
        }
      }
    }
  }

  // 배열(투사체 등)과 메시를 id로 맞춰주기
  function syncList(map, list, make, update) {
    var seen = {};
    for (var i = 0; i < list.length; i++) {
      var o = list[i];
      seen[o.id] = true;
      var m = map.get(o.id);
      if (!m) { m = make(o); map.set(o.id, m); dyn.add(m); }
      update(m, o);
    }
    map.forEach(function (m, id) {
      if (!seen[id]) { dyn.remove(m); map.delete(id); }
    });
  }

  var projGeo = new THREE.SphereGeometry(0.28, 12, 8);
  var turretGeo = new THREE.SphereGeometry(0.42, 16, 12);
  var patchGeo = new THREE.CircleGeometry(0.8, 16);

  // ---------------------------------------------------------------
  // 매 프레임
  // ---------------------------------------------------------------
  function frame(battle, dt) {
    time += dt;
    if (mode === 'menu' && showcaseTop) {
      showcaseTop.root.position.set(0, 0, 0);
      showcaseTop.spin.rotation.y += dt * 14;
      showcaseTop.tilt.rotation.z = Math.sin(time * 1.3) * 0.06;
      showcaseTop.tilt.rotation.x = Math.cos(time * 1.1) * 0.06;
      camera.position.copy(camBase);
      camera.lookAt(camLook);
    }

    if (mode === 'battle' && battle) {
      handleEvents(battle);
      for (var i = 0; i < 2; i++) {
        var f = battle.f[i], t = fighters[i];
        t.root.position.set(f.x, bowlY(f.x, f.z), f.z);
        t.spin.rotation.y = (i === 0 ? 1 : -1) * f.spinAngle;
        var low = 1 - f.spin / 100;
        var wob = low * low * 0.4 + (f.hp <= 0 ? 0.5 : 0);
        var wa = f.spinAngle * 0.35;
        t.tilt.rotation.x = f.vz * 0.025 + Math.cos(wa) * wob;
        t.tilt.rotation.z = -f.vx * 0.025 + Math.sin(wa) * wob;
        t.shield.visible = f.t.shield > 0 || f.t.guard > 0;
        t.stun.visible = f.t.stun > 0;
        t.stun.rotation.z += dt * 8;
        t.aura.visible = f.t.power > 0 || f.t.dash > 0 || f.charged;
        if (t.aura.visible) t.aura.material.color.setHex(f.t.dash > 0 ? 0xff5a2a : f.charged ? 0x7be0a0 : 0xffa020);
        var flash = f.flash > 0 ? 0.8 : f.t.slow > 0 ? 0.25 : 0;
        var ec = f.flash > 0 ? 0xffffff : 0x66ccff;
        for (var m = 0; m < t.mats.length; m++) {
          t.mats[m].emissive.setHex(flash > 0 ? ec : 0x000000);
          t.mats[m].emissiveIntensity = flash;
        }
      }

      syncList(meshMaps.proj, battle.projectiles, function (p) {
        return new THREE.Mesh(projGeo, new THREE.MeshStandardMaterial({ color: p.kind === 'bubble' ? 0xa8e6ff : 0x3aa8ff, transparent: true, opacity: 0.85, emissive: 0x1a5fa0, emissiveIntensity: 0.4 }));
      }, function (m, p) { m.position.set(p.x, bowlY(p.x, p.z) + 0.6, p.z); });

      syncList(meshMaps.turret, battle.turrets, function () {
        return new THREE.Mesh(turretGeo, new THREE.MeshStandardMaterial({ color: 0x7fd0ff, transparent: true, opacity: 0.7, emissive: 0x1a6fb0, emissiveIntensity: 0.5 }));
      }, function (m, t) {
        m.position.set(t.x, bowlY(t.x, t.z) + 0.7 + Math.sin(time * 5 + t.id) * 0.12, t.z);
        m.scale.setScalar(0.7 + 0.15 * t.shots);
      });

      syncList(meshMaps.patch, battle.patches, function () {
        var mm = new THREE.Mesh(patchGeo, new THREE.MeshBasicMaterial({ color: 0xff6a1a, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
        mm.rotation.x = -Math.PI / 2;
        return mm;
      }, function (m, p) {
        m.position.set(p.x, bowlY(p.x, p.z) + 0.05, p.z);
        var k = p.life / p.maxLife;
        m.material.opacity = 0.75 * k;
        m.scale.setScalar(0.6 + 0.4 * k + Math.sin(time * 20 + p.id) * 0.05);
      });

      syncList(meshMaps.item, battle.items, function (it) {
        var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: getEmojiTexture(D.items[it.type].emoji), transparent: true }));
        sp.scale.setScalar(1.15);
        return sp;
      }, function (m, it) {
        m.position.set(it.x, bowlY(it.x, it.z) + 0.9 + Math.sin(time * 3 + it.id) * 0.15, it.z);
        m.material.opacity = it.life < 2 ? (Math.sin(time * 20) > 0 ? 1 : 0.3) : 1;
      });

      // 이펙트 업데이트
      var j;
      for (j = sparks.length - 1; j >= 0; j--) {
        var s = sparks[j], u = s.userData;
        u.life -= dt; u.vy -= 14 * dt;
        s.position.x += u.vx * dt; s.position.y += u.vy * dt; s.position.z += u.vz * dt;
        s.material.opacity = Math.max(0, u.life * 2);
        if (u.life <= 0) { dyn.remove(s); s.material.dispose(); sparks.splice(j, 1); }
      }
      for (j = rings.length - 1; j >= 0; j--) {
        var r = rings[j], ru = r.userData;
        ru.life -= dt;
        var k2 = 1 - ru.life / ru.max;
        r.scale.setScalar(0.2 + (ru.radius - 0.2) * k2);
        r.material.opacity = 0.9 * (1 - k2);
        if (ru.life <= 0) { dyn.remove(r); r.geometry.dispose(); r.material.dispose(); rings.splice(j, 1); }
      }
      for (j = bolts.length - 1; j >= 0; j--) {
        var b = bolts[j];
        b.userData.life -= dt;
        b.visible = Math.sin(time * 60) > -0.5;
        if (b.userData.life <= 0) { dyn.remove(b); bolts.splice(j, 1); }
      }

      // 카메라 흔들림
      shake = Math.max(0, shake - dt * 1.5);
      var sh = dt > 0 ? shake : 0;
      camera.position.set(
        camBase.x + (Math.random() - 0.5) * sh,
        camBase.y + (Math.random() - 0.5) * sh,
        camBase.z + (Math.random() - 0.5) * sh);
      camera.lookAt(camLook);
    }

    renderer.render(scene, camera);
  }

  // 3D 위치 → 화면 좌표
  var tmpV = new THREE.Vector3();
  function project(x, y, z) {
    tmpV.set(x, y, z).project(camera);
    return { x: (tmpV.x + 1) / 2 * window.innerWidth, y: (1 - tmpV.y) / 2 * window.innerHeight };
  }

  return {
    init: init, setMenu: setMenu, setMenuShift: setMenuShift, setBattle: setBattle, frame: frame, project: project,
    bowlY: bowlY, resize: resize,
  };
})();
