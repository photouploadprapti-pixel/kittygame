import type { Card } from './types.js'
import type { EvaluatedHand } from './types.js'
import { combinations, compareHands, evaluateFive } from './hand-rank.js'

/**
 * Best 5-card PLO4 hand: exactly 2 hole + exactly 3 board.
 * @param hole - Four hole cards
 * @param board - Community cards (3–5 for showdown)
 */
export const evaluatePlo4 = (hole: Card[], board: Card[]): EvaluatedHand => {
  if (hole.length !== 4) {
    throw new Error(`PLO4 requires 4 hole cards, got ${hole.length}`)
  }
  if (board.length < 3) {
    throw new Error(`PLO4 needs at least 3 board cards, got ${board.length}`)
  }
  let best: EvaluatedHand | null = null
  for (const holeCombo of combinations(hole, 2)) {
    for (const boardCombo of combinations(board, 3)) {
      const five = [...holeCombo, ...boardCombo]
      const evaluated = evaluateFive(five)
      if (!best || compareHands(evaluated, best) > 0) {
        best = evaluated
      }
    }
  }
  return best!
}
