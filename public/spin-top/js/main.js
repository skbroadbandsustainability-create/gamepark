// 진입점: 초기화와 게임 루프
window.ST = window.ST || {};

(function () {
  function start() {
    if (typeof THREE === 'undefined') {
      document.getElementById('error').hidden = false;
      document.getElementById('error').textContent = 'Three.js를 불러오지 못했어요. libs/three.min.js 파일이 있는지 확인해 주세요.';
      return;
    }
    ST.Render.init(document.getElementById('gl'));
    ST.Input.init(document.getElementById('overlay'), function (idx) { ST.UI.useSkill(idx); });
    ST.UI.init();

    var last = performance.now();
    function loop(now) {
      var dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      var app = ST.UI.app, b = app.battle;
      if (b && !app.paused) {
        ST.Input.update(dt);
        if (app.ai) app.ai.update(dt);
        b.update(dt);
        ST.Render.frame(b, dt);
        ST.UI.handleEvents(b);
        b.events.length = 0;
        ST.UI.updateHud(b);
      } else {
        ST.Render.frame(b, b ? 0 : dt);
      }
      ST.Input.draw();
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);

    // 다른 앱으로 넘어가면 자동 일시정지
    document.addEventListener('visibilitychange', function () {
      var app = ST.UI.app;
      if (document.hidden && app.battle && app.battle.phase === 'fight') ST.UI.togglePause(true);
    });
    // 길게 누르기 메뉴, 두 손가락 확대 막기
    document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
    document.addEventListener('dblclick', function (e) { e.preventDefault(); });

    // 휴대폰 앱처럼 설치 (인터넷 주소로 열었을 때만. file://에서는 동작하지 않음)
    if (/^https?:/.test(location.protocol)) {
      var link = document.createElement('link');
      link.rel = 'manifest';
      link.href = 'manifest.webmanifest';
      document.head.appendChild(link);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(function () {});
      }
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
