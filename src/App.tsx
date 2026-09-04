import { useState } from 'react'
import Hub from './components/Hub'
import { GAMES } from './games/registry'

function App() {
  const [gameId, setGameId] = useState<string | null>(null)
  const game = GAMES.find((g) => g.id === gameId)
  const GameComponent = game?.Component

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-sky-50/40 to-white">
      {GameComponent ? (
        <GameComponent onExit={() => setGameId(null)} />
      ) : (
        <Hub onSelect={setGameId} />
      )}
    </div>
  )
}

export default App
