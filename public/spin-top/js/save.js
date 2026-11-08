// 저장 (코인, 팽이 레벨) - localStorage 사용
window.ST = window.ST || {};

ST.save = (function () {
  var KEY = 'gamepark-spintop-save-v1';
  var D = ST.data;
  var state = { coins: D.startCoins, levels: {}, wins: 0 };
  var ok = true;

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var s = JSON.parse(raw);
        if (s && typeof s === 'object') {
          state.coins = typeof s.coins === 'number' ? s.coins : D.startCoins;
          state.levels = s.levels && typeof s.levels === 'object' ? s.levels : {};
          state.wins = typeof s.wins === 'number' ? s.wins : 0;
        }
      }
    } catch (e) {
      ok = false;
    }
  }

  function write() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      ok = false;
    }
  }

  function level(id) {
    var lv = state.levels[id];
    return typeof lv === 'number' && lv >= 1 ? Math.min(lv, D.upgrade.maxLevel) : 1;
  }

  function upgradeCost(id) {
    var lv = level(id);
    if (lv >= D.upgrade.maxLevel) return null;
    return D.upgrade.baseCost + D.upgrade.costStep * (lv - 1);
  }

  function tryUpgrade(id) {
    var cost = upgradeCost(id);
    if (cost === null || state.coins < cost) return false;
    state.coins -= cost;
    state.levels[id] = level(id) + 1;
    write();
    return true;
  }

  function addCoins(n) {
    state.coins += n;
    write();
  }

  function addWin() {
    state.wins += 1;
    write();
  }

  load();

  return {
    get coins() { return state.coins; },
    get wins() { return state.wins; },
    get works() { return ok; },
    level: level,
    upgradeCost: upgradeCost,
    tryUpgrade: tryUpgrade,
    addCoins: addCoins,
    addWin: addWin,
  };
})();

// 팽이 정의 + 레벨 → 실제 능력치
ST.getTop = function (id) {
  var list = ST.data.tops;
  for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
  return list[0];
};

ST.calcStats = function (def, level) {
  var p = ST.data.upgrade.perLevel;
  var l = (level || 1) - 1;
  return {
    maxHp: Math.round(def.hp * (1 + p.hp * l)),
    atk: def.atk * (1 + p.atk * l),
    def: def.def * (1 + p.def * l),
    spd: def.spd * (1 + p.spd * l),
    mass: def.mass,
    decay: def.decay,
    radius: def.radius,
  };
};
