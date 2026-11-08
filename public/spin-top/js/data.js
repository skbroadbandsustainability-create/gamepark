// 팽이 배틀 게임 데이터
// 팽이 종류, 특성, 기술, 아이템, 강화, 보상, 밸런스 수치는 모두 여기서 조절한다.
window.ST = window.ST || {};

ST.data = {
  // ---------------------------------------------------------------
  // 경기장/물리 기본값
  // ---------------------------------------------------------------
  config: {
    arenaRadius: 9,        // 경기장 반지름
    bowlHeight: 0.035,     // 그릇 모양 기울기 (보기용 높이 = k * r^2)
    bowlPull: 1.5,         // 그릇 가운데로 끌어당기는 힘
    friction: 0.55,        // 초당 속도 감소율
    maxSpeed: 13,          // 최고 속도
    wallBounce: 0.85,      // 벽 반발력 (1에 가까울수록 잘 튕김)
    topBounce: 0.95,       // 팽이끼리 반발력
    spinPush: 2.5,         // 부딪칠 때 회전력으로 서로 밀어내는 힘
    hitBase: 1.5,            // 부딪칠 때 기본 피해
    hitSpeed: 0.5,         // 상대 쪽으로 달려간 속도 1당 추가 피해
    hitCooldown: 0.25,     // 연속 충돌 피해 간격(초)
    spinLossOnHit: 1.5,    // 부딪칠 때마다 줄어드는 회전력
    spinZeroDrain: 10,     // 회전이 멈추면 초당 줄어드는 HP
    matchTime: 90,         // 경기 시간(초). 끝나면 남은 HP 비율이 높은 쪽이 승리
    launchTimeout: 8,      // 이 시간 안에 발사하지 않으면 자동 발사
    launchMinSpeed: 4,
    launchMaxSpeed: 14,
    launchMinSpin: 55,     // 약하게 발사했을 때 회전력 (최대 100)
  },

  // ---------------------------------------------------------------
  // 특성 (패시브, 팽이마다 1개)
  // ---------------------------------------------------------------
  traits: {
    bubble: {
      name: '물방울 포탑', icon: '💧',
      desc: '벽에 세게 부딪치면 그 자리에 물방울 포탑이 생겨서 상대에게 물방울을 3번 쏴요.',
      maxTurrets: 3, shots: 3, interval: 1.1, damage: 4.5, speed: 10,
    },
    flametrail: {
      name: '불꽃 자국', icon: '🔥',
      desc: '빠르게 달리면 바닥에 불꽃이 남아요. 상대가 밟으면 계속 피해를 받아요.',
      minSpeed: 4.5, every: 0.12, life: 2.2, dps: 7, radius: 0.8,
    },
    thorns: {
      name: '가시 갑옷', icon: '🌵',
      desc: '부딪쳐서 받은 피해의 30%를 상대에게 돌려줘요.',
      reflect: 0.3,
    },
    static: {
      name: '정전기', icon: '⚡',
      desc: '부딪칠 때 35% 확률로 상대를 감전시켜 잠깐 움직이지 못하게 해요.',
      chance: 0.35, stun: 0.6,
    },
    frost: {
      name: '얼음 몸', icon: '❄️',
      desc: '부딪친 상대를 얼려서 2.5초 동안 느리게 만들어요.',
      slow: 2.5,
    },
    rebound: {
      name: '반동 가속', icon: '🌪️',
      desc: '벽에 부딪치면 더 빨라지고, 다음 충돌 피해가 1.7배가 돼요.',
      boost: 1.35, bonus: 1.7, cooldown: 0.5,
    },
    drain: {
      name: '덩굴 흡수', icon: '🌿',
      desc: '부딪쳐서 준 피해의 20%만큼 HP를 회복해요.',
      ratio: 0.2,
    },
    quake: {
      name: '지진 발걸음', icon: '🪨',
      desc: '벽에 세게 부딪치면 땅이 울려서 가까운 상대에게 피해를 줘요.',
      radius: 4.5, damage: 6, push: 9, cooldown: 1.5,
    },
  },

  // ---------------------------------------------------------------
  // 기술 (버튼을 눌러 쓰는 기술, 팽이마다 1개, 쿨타임 있음)
  // ai: AI가 언제 쓸지 ('near' 가까울 때, 'range' 멀어도, 'defend' 상대가 다가올 때, 'heal' HP 낮을 때, 'spin' 회전 낮을 때)
  // ---------------------------------------------------------------
  skills: {
    watercannon: {
      name: '물대포', icon: '🌊', cooldown: 6, ai: 'range',
      desc: '상대에게 물방울 3발을 쏴요.',
      count: 3, spread: 0.22, speed: 11, damage: 5,
    },
    dash: {
      name: '불꽃 돌진', icon: '☄️', cooldown: 5, ai: 'near',
      desc: '조종하는 방향으로 빠르게 돌진해요. 1초 동안 충돌 피해 1.6배!',
      power: 14, time: 1.0, bonus: 1.6,
    },
    shield: {
      name: '바위 방패', icon: '🛡️', cooldown: 9, ai: 'defend',
      desc: '3초 동안 받는 피해가 크게 줄어요.',
      time: 3, reduce: 0.4,
    },
    lightning: {
      name: '번개 낙하', icon: '🌩️', cooldown: 8, ai: 'range',
      desc: '상대에게 번개를 떨어뜨려 피해를 주고 잠깐 멈추게 해요.',
      damage: 10, stun: 0.8,
    },
    frostnova: {
      name: '서리 폭발', icon: '🧊', cooldown: 7, ai: 'near',
      desc: '주변에 서리를 터뜨려 가까운 상대에게 피해를 주고 밀어내며 느리게 해요.',
      radius: 4.5, damage: 8, push: 10, slow: 2.5,
    },
    vortex: {
      name: '회오리', icon: '🌀', cooldown: 8, ai: 'range',
      desc: '2초 동안 상대를 내 쪽으로 끌어당겨요.',
      time: 2, pull: 18,
    },
    heal: {
      name: '새싹 치유', icon: '🌱', cooldown: 10, ai: 'heal',
      desc: 'HP를 최대 HP의 18%만큼 회복하고 회전력도 조금 채워요.',
      ratio: 0.18, spin: 10,
    },
    spinup: {
      name: '회전 충전', icon: '🔁', cooldown: 8, ai: 'spin',
      desc: '회전력을 35 채우고 2초 동안 빨라져요.',
      spin: 35, speedTime: 2,
    },
  },

  // ---------------------------------------------------------------
  // 팽이 종류 (모두 오리지널)
  // hp: 체력, atk: 공격, def: 방어, spd: 조종 가속, mass: 무게(밀리지 않음), decay: 초당 회전 감소(낮을수록 오래 돎)
  // 모양: radius 크기, color 몸통, ring 테두리, blades 날개 개수, bladeType 'box' | 'spike' | 'round'
  // ---------------------------------------------------------------
  tops: [
    {
      id: 'aqua', name: '아쿠아핀', type: '물', emoji: '💧',
      desc: '물방울을 다루는 균형 잡힌 팽이',
      hp: 100, atk: 10, def: 10, spd: 17, mass: 1.0, decay: 1.6,
      radius: 0.8, color: 0x3aa8ff, ring: 0xd8f2ff, blades: 4, bladeType: 'round',
      trait: 'bubble', skill: 'watercannon',
    },
    {
      id: 'flame', name: '플레임스핀', type: '불', emoji: '🔥',
      desc: '빠르고 공격이 강한 불꽃 팽이',
      hp: 90, atk: 13, def: 8, spd: 19, mass: 0.95, decay: 1.9,
      radius: 0.78, color: 0xff5a2a, ring: 0xffd27a, blades: 3, bladeType: 'spike',
      trait: 'flametrail', skill: 'dash',
    },
    {
      id: 'rock', name: '락가드', type: '바위', emoji: '🪨',
      desc: '단단하고 무거운 방어형 팽이',
      hp: 115, atk: 8.5, def: 12.5, spd: 14, mass: 1.5, decay: 1.4,
      radius: 0.92, color: 0x9a8a78, ring: 0x5b5048, blades: 6, bladeType: 'box',
      trait: 'thorns', skill: 'shield',
    },
    {
      id: 'volt', name: '볼트윙', type: '번개', emoji: '⚡',
      desc: '가장 빠른 번개 팽이',
      hp: 95, atk: 11, def: 9, spd: 22, mass: 0.9, decay: 1.7,
      radius: 0.74, color: 0xffd23a, ring: 0x6a4cff, blades: 2, bladeType: 'spike',
      trait: 'static', skill: 'lightning',
    },
    {
      id: 'frost', name: '프로스트링', type: '얼음', emoji: '❄️',
      desc: '상대를 얼려 느리게 만드는 얼음 팽이',
      hp: 100, atk: 10, def: 10, spd: 16, mass: 1.1, decay: 1.5,
      radius: 0.82, color: 0x9be8ff, ring: 0xffffff, blades: 5, bladeType: 'spike',
      trait: 'frost', skill: 'frostnova',
    },
    {
      id: 'wind', name: '윈드커터', type: '바람', emoji: '🌪️',
      desc: '오래 돌고 벽을 타며 빨라지는 바람 팽이',
      hp: 105, atk: 12.5, def: 10.5, spd: 21, mass: 1.05, decay: 1.2,
      radius: 0.78, color: 0x7be0a0, ring: 0x2f8f6a, blades: 3, bladeType: 'round',
      trait: 'rebound', skill: 'vortex',
    },
    {
      id: 'leaf', name: '리프탑', type: '풀', emoji: '🌿',
      desc: '부딪칠수록 회복하는 끈질긴 풀 팽이',
      hp: 105, atk: 9, def: 10, spd: 16, mass: 1.0, decay: 1.5,
      radius: 0.82, color: 0x5cc04a, ring: 0xf2e86a, blades: 4, bladeType: 'round',
      trait: 'drain', skill: 'heal',
    },
    {
      id: 'quake', name: '어스크래커', type: '땅', emoji: '⛰️',
      desc: '벽을 울려 땅을 흔드는 묵직한 팽이',
      hp: 105, atk: 11.5, def: 10.5, spd: 15, mass: 1.4, decay: 1.7,
      radius: 0.88, color: 0xc07a3a, ring: 0x4a2f1a, blades: 4, bladeType: 'box',
      trait: 'quake', skill: 'spinup',
    },
  ],

  // ---------------------------------------------------------------
  // 경기장 아이템 (경기 중 바닥에 나타나고, 팽이가 닿으면 먹어요)
  // ---------------------------------------------------------------
  items: {
    heart:    { name: '하트',      emoji: '💖', desc: 'HP를 최대 HP의 15% 회복', weight: 3, heal: 0.15 },
    battery:  { name: '회전 배터리', emoji: '🔋', desc: '회전력 +30',              weight: 3, spin: 30 },
    power:    { name: '파워 별',    emoji: '⭐', desc: '6초 동안 공격력 1.5배',      weight: 2, time: 6, mul: 1.5 },
    guard:    { name: '방어 큐브',  emoji: '🛡️', desc: '4초 동안 받는 피해 감소',     weight: 2, time: 4 },
    boots:    { name: '바람 신발',  emoji: '💨', desc: '5초 동안 빨라짐',            weight: 2, time: 5 },
    recharge: { name: '기술 충전',  emoji: '🔄', desc: '기술을 바로 다시 쓸 수 있음', weight: 1 },
  },
  itemRules: {
    firstSpawn: 4,     // 경기 시작 후 첫 아이템까지(초)
    interval: 6,       // 아이템 등장 간격(초)
    maxOnField: 2,     // 바닥에 동시에 있을 수 있는 최대 개수
    life: 12,          // 안 먹으면 사라지는 시간(초)
    pickRadius: 0.9,
    speedMul: 1.4,     // 바람 신발/회전 충전 속도 배율
    guardReduce: 0.5,  // 방어 큐브 받는 피해 배율
  },

  // ---------------------------------------------------------------
  // 강화 (코인으로 팽이 레벨 올리기)
  // ---------------------------------------------------------------
  upgrade: {
    maxLevel: 10,
    baseCost: 30,      // Lv1 → Lv2 비용
    costStep: 25,      // 레벨마다 늘어나는 비용
    perLevel: { hp: 0.06, atk: 0.05, def: 0.05, spd: 0.02 }, // 레벨당 능력치 증가율
  },

  // ---------------------------------------------------------------
  // 보상과 AI 난이도
  // ---------------------------------------------------------------
  rewards: {
    easy:   { win: 20, lose: 5 },
    normal: { win: 35, lose: 10 },
    hard:   { win: 60, lose: 15 },
    pvp:    { win: 15, lose: 5 },
  },
  startCoins: 50,
  ai: {
    easy:   { name: '쉬움',   think: 0.5,  aim: 0.55, skillChance: 0.25, levelMode: 'one',  levelBonus: 0, launchPower: [0.4, 0.7] },
    normal: { name: '보통',   think: 0.25, aim: 0.85, skillChance: 0.6,  levelMode: 'same', levelBonus: 0, launchPower: [0.6, 0.9] },
    hard:   { name: '어려움', think: 0.12, aim: 1.0,  skillChance: 0.95, levelMode: 'same', levelBonus: 2, launchPower: [0.85, 1.0] },
  },
};
