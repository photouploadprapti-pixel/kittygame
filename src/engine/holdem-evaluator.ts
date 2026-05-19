import type { Card } from './types.js'
import type { EvaluatedHand } from './types.js'
import { combinations, compareHands, evaluateFive } from './hand-rank.js'

/**
 * Best 5-card hand from 2 hole + up to 5 board (Texas Hold'em).
 * @param hole - Two hole cards
 * @param board - Community cards (0–5)
 */
export const evaluateHoldem = (hole: Card[], board: Card[]): EvaluatedHand => {
  if (hole.length !== 2) {
    throw new Error(`Hold'em requires 2 hole cards, got ${hole.length}`)
  }
  if (board.length > 5) {
    throw new Error(`Board cannot exceed 5 cards, got ${board.length}`)
  }
  const all = [...hole, ...board]
  if (all.length < 5) {
    throw new Error('Need at least 5 total cards to evaluate')
  }
  let best: EvaluatedHand | null = null
  for (const combo of combinations(all, 5)) {
    const evaluated = evaluateFive(combo)
    if (!best || compareHands(evaluated, best) > 0) {
      best = evaluated
    }
  }
  return best!
}
