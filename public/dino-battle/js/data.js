// 게임 데이터: 공룡, 기술, 스테이지, 밸런스 수치
// 숫자를 바꾸면 게임 난이도와 느낌을 쉽게 조절할 수 있어요.
window.DB = window.DB || {};

DB.data = {
  // 화면(논리 좌표) 크기와 물리
  W: 960,
  H: 540,
  groundY: 470,
  gravity: 2000,
  runSpeed: 270, // 기본 달리기 속도 (공룡 빠르기와 곱해짐)
  jumpPower: 780, // 기본 점프 힘 (공룡 점프와 곱해짐)
  maxFall: 1100,

  // 기본 공격
  attack: {
    time: 0.3, // 공격 동작 시간
    cooldown: 0.4, // 다음 공격까지 기다리는 시간
    hitFrom: 0.05, // 이 시간부터
    hitTo: 0.2, // 이 시간까지 맞을 수 있음
    knockX: 260,
    knockY: -220,
    stun: 0.3,
  },

  pvpTime: 99, // 2인 대전 제한 시간(초)
  waveHeal: 0.3, // 무리를 물리치면 회복하는 체력 비율

  // 공룡 5종 + 적 전용 랩터
  // hp 체력, atk 힘, spd 빠르기, jump 점프, reach 공격 거리, w/h 몸 크기
  // unlock.stage: 이 스테이지를 깨면 무료로 열림, unlock.cost: 코인으로 열기
  species: [
    {
      id: 'trex', name: '티라노', emoji: '🦖',
      color: '#ff8a5c', belly: '#ffe3bf', accent: '#e85d3a', line: '#9c3a22',
      w: 62, h: 58, hp: 110, atk: 10, spd: 1.0, jump: 1.0, reach: 46,
      skills: ['fireball', 'roar'],
      unlock: { stage: 0, cost: 0 },
      desc: '힘이 센 꼬마 티라노. 입에서 불꽃을 뿜어요!',
    },
    {
      id: 'trike', name: '트리케라', emoji: '🦕',
      color: '#7fd06b', belly: '#e6f7c8', accent: '#f2a43a', line: '#3f7a32',
      w: 66, h: 52, hp: 130, atk: 9, spd: 0.92, jump: 0.92, reach: 48,
      skills: ['hornDash', 'boulder'],
      unlock: { stage: 0, cost: 0 },
      desc: '단단한 뿔이 세 개! 튼튼하고 돌진이 강해요.',
    },
    {
      id: 'ptera', name: '프테라', emoji: '🪽',
      color: '#7cc8ff', belly: '#e3f4ff', accent: '#ffb347', line: '#33709c',
      w: 54, h: 54, hp: 88, atk: 8, spd: 1.15, jump: 1.08, reach: 44,
      maxJumps: 3, glide: true,
      skills: ['dive', 'feathers'],
      unlock: { stage: 3, cost: 150 },
      desc: '하늘을 나는 친구. 세 번 점프하고, 점프를 꾹 누르면 천천히 내려와요.',
    },
    {
      id: 'stego', name: '스테고', emoji: '🛡️',
      color: '#b99cff', belly: '#efe6ff', accent: '#ff7eb0', line: '#6446a8',
      w: 68, h: 50, hp: 140, atk: 9, spd: 0.86, jump: 0.92, reach: 50,
      skills: ['spikeShield', 'tailSpin'],
      unlock: { stage: 5, cost: 250 },
      desc: '등에 뾰족한 판이 가득! 가시 방패로 몸을 지켜요.',
    },
    {
      id: 'brachio', name: '브라키오', emoji: '🌿',
      color: '#ffd45e', belly: '#fff3c4', accent: '#ff9b4a', line: '#a87d1a',
      w: 60, h: 74, hp: 150, atk: 9, spd: 0.82, jump: 0.95, reach: 50,
      skills: ['stomp', 'heal'],
      unlock: { stage: 7, cost: 350 },
      desc: '목이 아주 긴 친구. 땅을 쿵 굴러서 충격파를 보내요.',
    },
    {
      id: 'raptor', name: '아기 랩터', emoji: '🦎',
      color: '#a7c47e', belly: '#eef6dc', accent: '#ff8f6b', line: '#5c7440',
      w: 46, h: 46, hp: 50, atk: 6, spd: 1.2, jump: 1.0, reach: 38,
      skills: ['pounce'],
      enemyOnly: true,
      desc: '재빠른 아기 랩터.',
    },
  ],

  // 기술 (cd = 쿨타임 초, cost = 해금 코인, 첫 번째 기술은 처음부터 사용 가능)
  skills: {
    fireball: { name: '불꽃 숨', icon: '🔥', cd: 4, type: 'projectile', dmg: 14, speed: 540, r: 15, color: '#ff7b2e', desc: '불덩이를 앞으로 쏴요.' },
    roar: { name: '우렁찬 포효', icon: '📢', cd: 8, type: 'roar', dmg: 6, radius: 190, stun: 1.4, cost: 100, desc: '가까운 적을 깜짝 놀라게 해서 잠깐 멈추게 해요.' },
    hornDash: { name: '뿔 돌진', icon: '💨', cd: 5, type: 'dash', dmg: 16, speed: 700, time: 0.38, kb: 520, desc: '앞으로 쌩 달려가며 들이받아요.' },
    boulder: { name: '바위 굴리기', icon: '🪨', cd: 6, type: 'boulder', dmg: 18, speed: 380, r: 20, cost: 100, desc: '커다란 바위를 데굴데굴 굴려요.' },
    dive: { name: '급강하', icon: '🦅', cd: 5, type: 'dive', dmg: 17, desc: '높이 날아올랐다가 비스듬히 내리꽂아요.' },
    feathers: { name: '깃털 폭풍', icon: '🪶', cd: 5, type: 'spread', dmg: 8, speed: 560, count: 3, cost: 100, desc: '날카로운 깃털 세 개를 부채꼴로 날려요.' },
    spikeShield: { name: '가시 방패', icon: '🛡️', cd: 9, type: 'shield', time: 3, dmg: 6, desc: '3초 동안 받는 피해가 줄고, 닿은 적은 따끔!' },
    tailSpin: { name: '꼬리 회오리', icon: '🌀', cd: 6, type: 'spin', dmg: 7, time: 0.66, radius: 85, cost: 100, desc: '빙글빙글 돌면서 양쪽 적을 여러 번 쳐요.' },
    stomp: { name: '땅 쿵쿵', icon: '💥', cd: 6, type: 'stomp', dmg: 14, speed: 430, desc: '땅을 굴러 양쪽으로 충격파를 보내요. 점프하면 피할 수 있어요.' },
    heal: { name: '열매 냠냠', icon: '🍎', cd: 12, type: 'heal', amount: 0.3, cost: 100, desc: '맛있는 열매를 먹고 체력을 30% 회복해요.' },
    pounce: { name: '덮치기', icon: '⚡', cd: 4, type: 'dash', dmg: 9, speed: 600, time: 0.3, kb: 300, vy: -380, desc: '폴짝 뛰어 덮쳐요.' },
  },

  // 배경 세계와 발판
  worlds: {
    jungle: {
      name: '정글', sky: ['#9fe3ff', '#d9f6ff'], ground: '#8ad05a', dirt: '#b9824f', far: '#6dbb7e', near: '#4fa463',
      platforms: [{ x: 110, y: 350, w: 210 }, { x: 640, y: 350, w: 210 }, { x: 380, y: 240, w: 200 }],
    },
    desert: {
      name: '사막', sky: ['#ffd59a', '#fff1d6'], ground: '#f2cf7b', dirt: '#d9a25a', far: '#f0b778', near: '#e39b5b',
      platforms: [{ x: 160, y: 340, w: 180 }, { x: 620, y: 340, w: 180 }, { x: 390, y: 225, w: 180 }],
    },
    volcano: {
      name: '화산', sky: ['#5b3a6e', '#ff9a6b'], ground: '#6b5a5a', dirt: '#4a3b3e', far: '#7b4b5a', near: '#5a3a44',
      platforms: [{ x: 80, y: 335, w: 190 }, { x: 690, y: 335, w: 190 }, { x: 360, y: 245, w: 240 }],
    },
    meadow: {
      name: '꽃밭', sky: ['#b8e6ff', '#fff0f6'], ground: '#9ee07a', dirt: '#c08a5a', far: '#a3d9a5', near: '#7cc98a',
      platforms: [{ x: 130, y: 345, w: 230 }, { x: 600, y: 345, w: 230 }, { x: 400, y: 230, w: 160 }],
    },
  },

  // 스테이지: waves = 차례로 나오는 적 무리, lv = 적 세기
  stages: [
    { world: 'jungle', name: '아기 랩터 등장', lv: 1.0, waves: [[{ sp: 'raptor' }], [{ sp: 'raptor' }]] },
    { world: 'jungle', name: '랩터 무리', lv: 1.15, waves: [[{ sp: 'raptor' }, { sp: 'raptor' }], [{ sp: 'trike' }]] },
    { world: 'jungle', name: '정글 대장', lv: 1.3, waves: [[{ sp: 'raptor' }, { sp: 'raptor' }], [{ sp: 'trike', boss: true }]], boss: '정글 대장 뿔뿔이' },
    { world: 'desert', name: '모래 바람', lv: 1.45, waves: [[{ sp: 'raptor' }, { sp: 'ptera' }], [{ sp: 'ptera' }, { sp: 'raptor' }]] },
    { world: 'desert', name: '사막 결투', lv: 1.6, waves: [[{ sp: 'stego' }], [{ sp: 'trex' }, { sp: 'raptor' }]] },
    { world: 'desert', name: '사막 대장', lv: 1.75, waves: [[{ sp: 'raptor' }, { sp: 'raptor' }], [{ sp: 'ptera', boss: true }]], boss: '사막 대장 휘익이' },
    { world: 'volcano', name: '뜨거운 화산', lv: 1.9, waves: [[{ sp: 'trex' }, { sp: 'raptor' }], [{ sp: 'brachio' }, { sp: 'raptor' }]] },
    { world: 'volcano', name: '화산 친구들', lv: 2.05, waves: [[{ sp: 'stego' }, { sp: 'trike' }], [{ sp: 'ptera' }, { sp: 'trex' }]] },
    { world: 'volcano', name: '최종 보스', lv: 2.2, waves: [[{ sp: 'raptor' }, { sp: 'raptor' }], [{ sp: 'trex', boss: true }]], boss: '화산 대왕 쿠앙이', final: true },
  ],

  // 적 세기 계산 (lv에 따라)
  enemy: {
    hpBase: 0.6, hpPerLv: 0.2,
    atkBase: 0.55, atkPerLv: 0.12,
    bossHp: 2.2, bossAtk: 1.1, bossScale: 1.6,
    reactBase: 0.45, reactPerLv: 0.1, reactMin: 0.16, // 생각하는 간격(초) - 작을수록 빠름
    aggrBase: 0.35, aggrPerLv: 0.15, // 가까이 있을 때 공격할 확률
  },

  // 보상
  reward: { base: 15, perStage: 10, firstClearMul: 2, pvp: 0 },

  // 아이템
  items: {
    every: [11, 17], // 이 사이 초마다 하나씩 떨어짐
    meat: { icon: '🍖', heal: 20 },
    bolt: { icon: '⚡' }, // 기술 쿨타임 바로 채우기
  },
};

DB.getSpecies = function (id) {
  var list = DB.data.species;
  for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
  return list[0];
};

DB.playable = function () {
  return DB.data.species.filter(function (s) { return !s.enemyOnly; });
};
