// 저장: 코인, 해금한 공룡과 기술, 깬 스테이지 (localStorage)
window.DB = window.DB || {};

DB.save = (function () {
  var KEY = 'gamepark-dino-save-v1';
  var state = { coins: 0, dinos: {}, skills: {}, equip: {}, cleared: 0, muted: false };
  var ok = true;

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return;
      var s = JSON.parse(raw);
      if (!s || typeof s !== 'object') return;
      if (typeof s.coins === 'number' && s.coins >= 0) state.coins = Math.floor(s.coins);
      if (s.dinos && typeof s.dinos === 'object') state.dinos = s.dinos;
      if (s.skills && typeof s.skills === 'object') state.skills = s.skills;
      if (s.equip && typeof s.equip === 'object') state.equip = s.equip;
      if (typeof s.cleared === 'number') state.cleared = Math.max(0, Math.min(DB.data.stages.length, s.cleared));
      state.muted = !!s.muted;
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

  // 공룡이 열렸는지: 처음부터 열림 / 스테이지를 깨서 열림 / 코인으로 삼
  function dinoOpen(id) {
    var sp = DB.getSpecies(id);
    if (sp.enemyOnly) return false;
    if (!sp.unlock || sp.unlock.stage === 0) return true;
    if (state.cleared >= sp.unlock.stage) return true;
    return !!state.dinos[id];
  }

  function buyDino(id) {
    var sp = DB.getSpecies(id);
    if (dinoOpen(id) || state.coins < sp.unlock.cost) return false;
    state.coins -= sp.unlock.cost;
    state.dinos[id] = true;
    write();
    return true;
  }

  function skillOpen(spId, skillId) {
    var sp = DB.getSpecies(spId);
    if (sp.skills[0] === skillId) return true;
    return !!(state.skills[spId] && state.skills[spId][skillId]);
  }

  function buySkill(spId, skillId) {
    var def = DB.data.skills[skillId];
    if (skillOpen(spId, skillId) || state.coins < (def.cost || 0)) return false;
    state.coins -= def.cost || 0;
    if (!state.skills[spId]) state.skills[spId] = {};
    state.skills[spId][skillId] = true;
    state.equip[spId] = skillId; // 새로 산 기술을 바로 장착
    write();
    return true;
  }

  function equipped(spId) {
    var id = state.equip[spId];
    var sp = DB.getSpecies(spId);
    if (id && sp.skills.indexOf(id) >= 0 && skillOpen(spId, id)) return id;
    return sp.skills[0];
  }

  function setEquip(spId, skillId) {
    if (!skillOpen(spId, skillId)) return;
    state.equip[spId] = skillId;
    write();
  }

  function stageOpen(idx) {
    return idx <= state.cleared;
  }

  // 스테이지를 깼을 때: 처음 깼는지와 새로 열린 공룡을 알려줌
  function clearStage(idx) {
    var first = idx + 1 > state.cleared;
    var before = DB.playable().filter(function (s) { return dinoOpen(s.id); }).map(function (s) { return s.id; });
    if (first) state.cleared = idx + 1;
    var newly = DB.playable().filter(function (s) { return dinoOpen(s.id) && before.indexOf(s.id) < 0; });
    write();
    return { first: first, newDinos: newly };
  }

  function addCoins(n) {
    state.coins += n;
    write();
  }

  function setMuted(m) {
    state.muted = !!m;
    write();
  }

  load();

  return {
    get coins() { return state.coins; },
    get cleared() { return state.cleared; },
    get muted() { return state.muted; },
    get works() { return ok; },
    dinoOpen: dinoOpen,
    buyDino: buyDino,
    skillOpen: skillOpen,
    buySkill: buySkill,
    equipped: equipped,
    setEquip: setEquip,
    stageOpen: stageOpen,
    clearStage: clearStage,
    addCoins: addCoins,
    setMuted: setMuted,
  };
})();
