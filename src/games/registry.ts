import type { GameDef } from '../types'
import StarCatch from './StarCatch'

// 새 게임을 추가하려면 이 배열에 항목을 하나 더 넣으면 돼요.
// status가 'soon'이면 허브에 "준비중" 카드로만 표시돼요.
export const GAMES: GameDef[] = [
  {
    id: 'star-catch',
    title: '별 잡기',
    emoji: '⭐',
    description: '떨어지는 별과 보석을 터치해서 점수를 모으는 미니게임',
    gradient: 'from-indigo-300 to-sky-300',
    status: 'ready',
    Component: StarCatch,
  },
  {
    id: 'spin-top',
    title: '팽이 배틀',
    emoji: '🌀',
    description: '팽이를 발사해서 부딪쳐 싸우는 3D 대전 게임 (AI 대전, 2인 대전)',
    gradient: 'from-sky-300 to-violet-300',
    status: 'ready',
    href: `${import.meta.env.BASE_URL}spin-top/`,
  },
  {
    id: 'dino-battle',
    title: '공룡 배틀',
    emoji: '🦖',
    description: '귀여운 공룡이 점프하고 기술을 쓰며 싸우는 2D 액션 게임 (모험 9스테이지, 2인 대전)',
    gradient: 'from-lime-300 to-emerald-300',
    status: 'ready',
    href: `${import.meta.env.BASE_URL}dino-battle/`,
  },
  {
    id: 'memory-match',
    title: '카드 짝맞추기',
    emoji: '🃏',
    description: '카드를 뒤집어 같은 그림끼리 짝을 찾는 게임',
    gradient: 'from-rose-300 to-amber-300',
    status: 'soon',
  },
  {
    id: 'word-quiz',
    title: '단어 퀴즈',
    emoji: '📝',
    description: '재미있는 문제를 풀며 실력을 키우는 퀴즈 게임',
    gradient: 'from-emerald-300 to-teal-300',
    status: 'soon',
  },
]
