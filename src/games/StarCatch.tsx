import { useCallback, useEffect, useRef, useState } from 'react'
import confetti from 'canvas-confetti'
import type { GamePlayProps } from '../types'
import { getHighScore, setHighScore } from '../types'

const GAME_ID = 'star-catch'
const GAME_SECONDS = 30

type ItemKind = 'star' | 'gem' | 'bomb'

interface FallingItem {
  id: number
  left: number // %
  duration: number // s
  kind: ItemKind
  popped: boolean
}

const KIND_INFO: Record<ItemKind, { emoji: string; points: number; weight: number }> = {
  star: { emoji: '⭐', points: 1, weight: 70 },
  gem: { emoji: '💎', points: 3, weight: 18 },
  bomb: { emoji: '💣', points: -2, weight: 12 },
}

function pickKind(): ItemKind {
  const total = Object.values(KIND_INFO).reduce((sum, k) => sum + k.weight, 0)
  let r = Math.random() * total
  for (const [kind, info] of Object.entries(KIND_INFO) as [ItemKind, (typeof KIND_INFO)[ItemKind]][]) {
    if (r < info.weight) return kind
    r -= info.weight
  }
  return 'star'
}

export default function StarCatch({ onExit }: GamePlayProps) {
  const [phase, setPhase] = useState<'ready' | 'playing' | 'ended'>('ready')
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(GAME_SECONDS)
  const [items, setItems] = useState<FallingItem[]>([])
  const [highScore, setHigh] = useState(() => getHighScore(GAME_ID))
  const nextId = useRef(0)
  const scoreRef = useRef(0)

  useEffect(() => {
    scoreRef.current = score
  }, [score])

  const spawn = useCallback(() => {
    const kind = pickKind()
    const item: FallingItem = {
      id: nextId.current++,
      left: 6 + Math.random() * 84,
      duration: 2.6 + Math.random() * 1.8,
      kind,
      popped: false,
    }
    setItems((prev) => [...prev, item])
  }, [])

  const removeItem = useCallback((id: number) => {
    setItems((prev) => prev.filter((it) => it.id !== id))
  }, [])

  const catchItem = useCallback(
    (item: FallingItem) => {
      if (item.popped) return
      const points = KIND_INFO[item.kind].points
      setScore((s) => Math.max(0, s + points))
      setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, popped: true } : it)))
      window.setTimeout(() => removeItem(item.id), 250)
    },
    [removeItem],
  )

  // 스폰 루프
  useEffect(() => {
    if (phase !== 'playing') return
    const interval = window.setInterval(spawn, 650)
    return () => window.clearInterval(interval)
  }, [phase, spawn])

  // 카운트다운
  useEffect(() => {
    if (phase !== 'playing') return
    if (timeLeft <= 0) {
      setPhase('ended')
      setItems([])
      const finalScore = scoreRef.current
      if (finalScore > highScore) {
        setHigh(finalScore)
        setHighScore(GAME_ID, finalScore)
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } })
      }
      return
    }
    const timer = window.setTimeout(() => setTimeLeft((t) => t - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [phase, timeLeft, highScore])

  function start() {
    setScore(0)
    setTimeLeft(GAME_SECONDS)
    setItems([])
    setPhase('playing')
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-0px)] max-w-3xl flex-col px-4 pb-6 pt-4 sm:px-6">
      <div className="flex items-center justify-between">
        <button
          onClick={onExit}
          className="rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-500 shadow active:scale-95"
        >
          ← 게임파크로
        </button>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-white px-3 py-1 text-sm font-bold text-indigo-500 shadow">
            ⏱ {timeLeft}초
          </span>
          <span className="rounded-full bg-white px-3 py-1 text-sm font-bold text-amber-500 shadow">
            점수 {score}
          </span>
        </div>
      </div>

      <div className="no-select relative mt-4 flex-1 overflow-hidden rounded-[2rem] border-2 border-white bg-gradient-to-b from-sky-100 via-indigo-50 to-white shadow-inner">
        {phase === 'ready' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
            <p className="text-6xl">⭐💎💣</p>
            <h2 className="font-display text-2xl text-slate-700">별 잡기</h2>
            <p className="max-w-xs text-sm font-bold text-slate-400">
              떨어지는 별⭐과 보석💎을 터치해서 점수를 모으세요! 폭탄💣은 피해야 해요.
              {' '}
              {GAME_SECONDS}초 동안 최대한 높은 점수를 노려보세요.
            </p>
            <button
              onClick={start}
              className="font-display mt-2 rounded-2xl bg-indigo-400 px-8 py-3 text-xl text-white shadow-lg shadow-indigo-200 active:scale-95"
            >
              시작하기 🎮
            </button>
            {highScore > 0 && (
              <p className="text-sm font-bold text-slate-400">🏆 최고 점수: {highScore}점</p>
            )}
          </div>
        )}

        {phase === 'playing' &&
          items.map((item) => (
            <button
              key={item.id}
              onClick={() => catchItem(item)}
              aria-label={item.kind}
              className={`absolute top-0 flex h-14 w-14 -translate-x-1/2 items-center justify-center text-4xl leading-none animate-fall ${
                item.popped ? 'animate-catch-pop' : ''
              }`}
              style={{
                left: `${item.left}%`,
                animationDuration: `${item.duration}s`,
                animationPlayState: item.popped ? 'paused' : 'running',
              }}
              onAnimationEnd={(e) => {
                // fall 애니메이션이 끝났는데 못 잡았으면 그냥 사라짐
                if (e.animationName === 'fall') removeItem(item.id)
              }}
            >
              {KIND_INFO[item.kind].emoji}
            </button>
          ))}

        {phase === 'ended' && (
          <div className="animate-pop-in absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-5xl">{score >= highScore && score > 0 ? '🎉' : '🌟'}</p>
            <h2 className="font-display text-2xl text-slate-700">게임 끝!</h2>
            <p className="font-display text-4xl text-indigo-500">{score}점</p>
            <p className="text-sm font-bold text-slate-400">🏆 최고 점수: {highScore}점</p>
            <div className="mt-2 flex gap-3">
              <button
                onClick={start}
                className="font-display rounded-2xl bg-indigo-400 px-6 py-3 text-lg text-white shadow-lg shadow-indigo-200 active:scale-95"
              >
                다시하기
              </button>
              <button
                onClick={onExit}
                className="font-display rounded-2xl bg-white px-6 py-3 text-lg text-slate-500 shadow active:scale-95"
              >
                게임파크로
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
