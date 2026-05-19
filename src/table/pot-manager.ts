import type { SidePot } from './types.js'
import type { TableSeat } from './types.js'

/**
 * Build main pot and side pots from seat contributions.
 * @param seats - Active seats with totalBetThisHand
 */
export const calculatePots = (seats: TableSeat[]): {
  mainPot: number
  sidePots: SidePot[]
} => {
  const active = seats.filter((s) => s.userId && s.totalBetThisHand > 0)

  if (active.length === 0) {
    return { mainPot: 0, sidePots: [] }
  }

  const sorted = [...active].sort(
    (a, b) => a.totalBetThisHand - b.totalBetThisHand,
  )

  const pots: SidePot[] = []
  let processed = 0

  for (let i = 0; i < sorted.length; i++) {
    const seat = sorted[i]
    const level = seat.totalBetThisHand - processed
    if (level <= 0) continue

    const eligible = sorted
      .slice(i)
      .filter((s) => !s.hasFolded)
      .map((s) => s.seatIndex)

    const contributorsAtLevel = sorted.filter(
      (s) => s.totalBetThisHand >= seat.totalBetThisHand,
    )
    const amount = level * contributorsAtLevel.length
    pots.push({ amount, eligibleSeatIndexes: eligible })
    processed = seat.totalBetThisHand
  }

  if (pots.length === 0) {
    return { mainPot: 0, sidePots: [] }
  }

  const [first, ...rest] = pots
  return { mainPot: first.amount, sidePots: rest }
}

/**
 * Sum total chips in all pots.
 * @param mainPot - Main pot amount
 * @param sidePots - Side pots
 */
export const totalPotAmount = (
  mainPot: number,
  sidePots: SidePot[],
): number => mainPot + sidePots.reduce((sum, p) => sum + p.amount, 0)
