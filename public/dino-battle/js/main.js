// 게임 루프와 화면 크기 맞추기, 앱 설치(오프라인) 연결
(function () {
  var cv = document.getElementById('cv');
  var ctx = cv.getContext('2d');
  var view = { cw: 1, ch: 1, dpr: 1 };

  function resize() {
    view.dpr = Math.min(window.devicePixelRatio || 1, 2);
    view.cw = window.innerWidth;
    view.ch = window.innerHeight;
    cv.width = Math.round(view.cw * view.dpr);
    cv.height = Math.round(view.ch * view.dpr);
  }
  window.addEventListener('resize', resize);
  resize();

  DB.input.init();
  DB.ui.init();

  var last = performance.now();
  var t = 0;
  var STEP = 1 / 120;

  function frame(now) {
    var dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    t += dt;
    var G = DB.game.G;
    try {
      if (DB.ui.inGame) {
        view.reserve = DB.input.reserve();
        if (G.running && !DB.ui.paused) {
          DB.input.apply(G.players);
          var n = Math.max(1, Math.ceil(dt / STEP));
          var sub = dt / n;
          for (var i = 0; i < n; i++) DB.game.update(sub);
        }
        DB.draw.render(ctx, view, t);
        DB.input.updateButtons(G.players);
      } else {
        view.reserve = 0;
        DB.draw.renderMenu(ctx, view, t, dt);
      }
      DB.ui.tick(dt);
    } catch (e) {
      var el = document.getElementById('error');
      el.hidden = false;
      el.textContent = '앗, 문제가 생겼어요: ' + (e && e.message) + '\n' + ((e && e.stack) || '').split('\n').slice(0, 3).join('\n');
      throw e;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // 글꼴이 늦게 오면 한 번 더 그리기 위해 기다림 (없어도 동작)
  if (document.fonts && document.fonts.load) document.fonts.load('20px Jua').catch(function () {});

  // 홈 화면에 추가하면 인터넷 없이도 실행되도록
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }
})();
