// 효과음: 파일 없이 Web Audio로 간단한 소리를 만들어요
window.DB = window.DB || {};

DB.sound = (function () {
  var ac = null;
  var master = null;

  function ensure() {
    if (ac) return ac;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ac = new AC();
      master = ac.createGain();
      master.gain.value = 0.35;
      master.connect(ac.destination);
    } catch (e) {
      ac = null;
    }
    return ac;
  }

  // 첫 터치/키 입력 때 오디오를 깨워야 소리가 나요 (브라우저 규칙)
  function unlock() {
    var a = ensure();
    if (a && a.state === 'suspended') a.resume();
  }

  function tone(freq, dur, type, vol, slideTo, delay) {
    if (DB.save.muted) return;
    var a = ensure();
    if (!a || a.state !== 'running') return;
    var t0 = a.currentTime + (delay || 0);
    var o = a.createOscillator();
    var g = a.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.3, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  var lastHit = 0;
  var sfx = {
    jump: function () { tone(380, 0.13, 'square', 0.12, 720); },
    attack: function () { tone(260, 0.08, 'triangle', 0.22, 140); },
    hit: function () {
      var now = performance.now();
      if (now - lastHit < 40) return;
      lastHit = now;
      tone(180, 0.12, 'square', 0.2, 60);
    },
    skill: function () { tone(300, 0.22, 'sawtooth', 0.14, 900); },
    fire: function () { tone(140, 0.25, 'sawtooth', 0.16, 70); },
    roar: function () { tone(120, 0.45, 'sawtooth', 0.22, 60); tone(90, 0.45, 'square', 0.12, 50); },
    heal: function () { [523, 659, 784].forEach(function (f, i) { tone(f, 0.15, 'sine', 0.2, null, i * 0.08); }); },
    boom: function () { tone(90, 0.35, 'square', 0.22, 35); },
    ko: function () { tone(520, 0.5, 'square', 0.18, 90); },
    item: function () { tone(880, 0.1, 'sine', 0.2, 1320); },
    click: function () { tone(660, 0.06, 'sine', 0.18); },
    coin: function () { tone(988, 0.08, 'square', 0.12); tone(1319, 0.18, 'square', 0.12, null, 0.08); },
    win: function () { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0.22, 'square', 0.14, null, i * 0.13); }); },
    lose: function () { [392, 330, 262].forEach(function (f, i) { tone(f, 0.3, 'triangle', 0.2, null, i * 0.2); }); },
    start: function () { tone(440, 0.12, 'square', 0.14); tone(880, 0.25, 'square', 0.14, null, 0.15); },
  };

  return { unlock: unlock, play: function (name) { if (sfx[name]) sfx[name](); } };
})();
