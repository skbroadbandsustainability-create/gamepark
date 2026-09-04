import { GAMES } from '../games/registry'
import { getHighScore } from '../types'

interface HubProps {
  onSelect: (gameId: string) => void
}

export default function Hub({ onSelect }: HubProps) {
  return (
    <div className="mx-auto max-w-3xl px-4 pb-8 pt-6 sm:px-6">
      <div className="rounded-[2rem] bg-gradient-to-br from-indigo-300 via-sky-200 to-pink-200 p-6 text-center shadow-lg">
        <p className="font-display text-3xl text-white drop-shadow-sm sm:text-4xl">🎮 게임파크</p>
        <p className="mt-2 font-bold text-white/90">하고 싶은 게임을 골라서 바로 놀아보세요!</p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {GAMES.map((game) => {
          const ready = game.status === 'ready'
          const highScore = ready ? getHighScore(game.id) : 0
          return (
            <button
              key={game.id}
              disabled={!ready}
              onClick={() => ready && onSelect(game.id)}
              className={`group relative overflow-hidden rounded-3xl border-2 border-white p-5 text-left shadow transition-transform ${
                ready ? 'active:scale-95' : 'cursor-not-allowed opacity-60'
              }`}
            >
              <div className={`absolute inset-0 -z-10 bg-gradient-to-br ${game.gradient}`} />
              <div className="absolute inset-0 -z-10 bg-white/55" />
              <div className="flex items-center justify-between">
                <span className="text-4xl">{game.emoji}</span>
                {!ready && (
                  <span className="rounded-full bg-slate-700/80 px-3 py-1 text-xs font-bold text-white">
                    준비중
                  </span>
                )}
                {ready && highScore > 0 && (
                  <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-bold text-amber-600">
                    🏆 {highScore}점
                  </span>
                )}
              </div>
              <p className="font-display mt-3 text-xl text-slate-800">{game.title}</p>
              <p className="mt-1 text-sm font-bold text-slate-600">{game.description}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
