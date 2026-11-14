# 게임파크 (gamepark)

아이들을 위한 미니게임 모음 웹앱이에요. 허브 화면에서 게임을 골라 바로 플레이할 수 있어요.

## 게임 목록

- **⭐ 별 잡기**: 떨어지는 별과 보석을 터치해서 점수를 모으는 미니게임 (30초 도전, 최고 점수 저장)
- **🌀 팽이 배틀**: 팽이를 발사해서 부딪쳐 싸우는 3D 대전 게임 (AI 대전, 한 휴대폰 2인 대전, 팽이 8종, 특성/기술, 아이템, 강화). `public/spin-top/`에 순수 HTML + JavaScript + Three.js로 따로 만들어서, Node.js 없이 `public/spin-top/index.html`을 크롬에서 더블클릭해도 실행돼요. 자세한 내용은 [public/spin-top/README.md](public/spin-top/README.md)를 봐요.
- **🦖 공룡 배틀**: 귀여운 공룡 5종이 점프하고 쿨타임 기술을 쓰며 싸우는 2D 액션 게임 (모험 9스테이지 + 보스, 한 기기 2인 대전, 코인으로 새 공룡/기술 해금). `public/dino-battle/`에 순수 HTML + JavaScript(캔버스)로 따로 만들어서, `public/dino-battle/index.html`을 더블클릭해도 실행돼요. 자세한 내용은 [public/dino-battle/README.md](public/dino-battle/README.md)를 봐요.
- 🃏 카드 짝맞추기, 📝 단어 퀴즈 등은 준비 중이에요.

## 새 게임 추가하기

1. `src/games/` 폴더에 새 게임 컴포넌트를 만들어요. `onExit: () => void` prop을 받아서, 허브로 돌아갈 때 호출해주면 돼요.
2. `src/games/registry.ts`에 게임 정보를 등록해요 (`status: 'ready'`로 설정하고 `Component`를 연결).

모든 데이터(최고 점수 등)는 기기(브라우저)에 저장돼요.

## 개발

```bash
npm install
npm run dev      # 개발 서버 실행
npm run build    # 프로덕션 빌드
npm run lint     # 린트 검사
```

React + TypeScript + Vite + Tailwind CSS로 만들었고, 태블릿 화면에 맞춰 반응형으로 디자인했어요.
