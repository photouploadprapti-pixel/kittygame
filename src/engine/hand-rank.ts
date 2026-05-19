import type { Card } from './types.js'
import { HandCategory, type EvaluatedHand } from './types.js'

/**
 * Generate all k-combinations from an array.
 * @param arr - Source array
 * @param k - Combination size
 */
export const combinations = <T>(arr: T[], k: number): T[][] => {
  if (k === 0) return [[]]
  if (arr.length < k) return []
  const [first, ...rest] = arr
  const withFirst = combinations(rest, k - 1).map((c) => [first, ...c])
  const withoutFirst = combinations(rest, k)
  return [...withFirst, ...withoutFirst]
}

const rankCounts = (cards: Card[]): Map<number, number> => {
  const counts = new Map<number, number>()
  for (const c of cards) {
    counts.set(c.rank, (counts.get(c.rank) ?? 0) + 1)
  }
  return counts
}

const sortedRanksDesc = (cards: Card[]): number[] =>
  [...cards].map((c) => c.rank).sort((a, b) => b - a)

const isFlush = (cards: Card[]): boolean => {
  const suit = cards[0].suit
  return cards.every((c) => c.suit === suit)
}

/**
 * Detect straight; returns high card of straight or 0 if none.
 * Ace can play low (A-2-3-4-5) or high.
 * @param ranks - Unique ranks sorted descending
 */
const straightHigh = (ranks: number[]): number => {
  const unique = [...new Set(ranks)].sort((a, b) => b - a)
  if (unique.includes(14)) {
    unique.push(1)
  }
  unique.sort((a, b) => b - a)
  for (let i = 0; i <= unique.length - 5; i++) {
    let ok = true
    for (let j = 1; j < 5; j++) {
      if (unique[i + j] !== unique[i] - j) {
        ok = false
        break
      }
    }
    if (ok) return unique[i] === 1 ? 5 : unique[i]
  }
  return 0
}

/**
 * Evaluate exactly five cards (no hole/board rules).
 * @param five - Five-card hand
 */
export const evaluateFive = (five: Card[]): EvaluatedHand => {
  if (five.length !== 5) {
    throw new Error(`evaluateFive requires 5 cards, got ${five.length}`)
  }
  const ranks = sortedRanksDesc(five)
  const counts = rankCounts(five)
  const countValues = [...counts.values()].sort((a, b) => b - a)
  const byCount = [...counts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1]
    return b[0] - a[0]
  })
  const flush = isFlush(five)
  const straight = straightHigh(ranks)

  let category: HandCategory
  let kickers: number[]

  if (flush && straight > 0) {
    category = HandCategory.STRAIGHT_FLUSH
    kickers = [straight]
  } else if (countValues[0] === 4) {
    category = HandCategory.FOUR_OF_A_KIND
    kickers = [byCount[0][0], byCount[1][0]]
  } else if (countValues[0] === 3 && countValues[1] === 2) {
    category = HandCategory.FULL_HOUSE
    kickers = [byCount[0][0], byCount[1][0]]
  } else if (flush) {
    category = HandCategory.FLUSH
    kickers = ranks
  } else if (straight > 0) {
    category = HandCategory.STRAIGHT
    kickers = [straight]
  } else if (countValues[0] === 3) {
    category = HandCategory.THREE_OF_A_KIND
    const trips = byCount[0][0]
    kickers = [trips, ...ranks.filter((r) => r !== trips)]
  } else if (countValues[0] === 2 && countValues[1] === 2) {
    category = HandCategory.TWO_PAIR
    const highPair = Math.max(byCount[0][0], byCount[1][0])
    const lowPair = Math.min(byCount[0][0], byCount[1][0])
    const kicker = ranks.find((r) => r !== highPair && r !== lowPair) ?? 0
    kickers = [highPair, lowPair, kicker]
  } else if (countValues[0] === 2) {
    category = HandCategory.ONE_PAIR
    const pair = byCount[0][0]
    kickers = [pair, ...ranks.filter((r) => r !== pair)]
  } else {
    category = HandCategory.HIGH_CARD
    kickers = ranks
  }

  const score =
    category * 1_000_000 +
    kickers.reduce((acc, k, i) => acc + k * Math.pow(15, 4 - i), 0)

  return { category, kickers, cards: five, score }
}

/**
 * Compare two evaluated hands. Positive if a wins, negative if b wins, 0 tie.
 * @param a - First hand
 * @param b - Second hand
 */
export const compareHands = (a: EvaluatedHand, b: EvaluatedHand): number =>
  a.score - b.score
