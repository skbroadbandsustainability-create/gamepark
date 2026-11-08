import type { ComponentType } from 'react'

export interface GamePlayProps {
  onExit: () => void
}

export interface GameDef {
  id: string
  title: string
  emoji: string
  description: string
  gradient: string // 카드 배경 그라디언트 (tailwind 클래스)
  status: 'ready' | 'soon'
  Component?: ComponentType<GamePlayProps>
  href?: string // 따로 만든 게임(public 폴더)으로 이동할 주소. 있으면 Component 대신 이 주소로 이동해요.
}

export const HIGH_SCORE_PREFIX = 'gamepark-highscore-'

export function getHighScore(gameId: string): number {
  const raw = localStorage.getItem(HIGH_SCORE_PREFIX + gameId)
  return raw ? Number(raw) || 0 : 0
}

export function setHighScore(gameId: string, score: number): void {
  localStorage.setItem(HIGH_SCORE_PREFIX + gameId, String(score))
}
