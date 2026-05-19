import type { PrizeTier } from './types.js'

/** Payout for a finishing place */
export interface Payout {
  place: number
  amount: number
  percent: number
}

/**
 * Default payout structure by player count (top-heavy).
 * @param playerCount - Registered players
 */
export const defaultPrizeStructure = (playerCount: number): PrizeTier[] => {
  if (playerCount <= 6) {
    return [{ minPlace: 1, maxPlace: 1, percent: 100 }]
  }
  if (playerCount <= 18) {
    return [
      { minPlace: 1, maxPlace: 1, percent: 70 },
      { minPlace: 2, maxPlace: 2, percent: 30 },
    ]
  }
  return [
    { minPlace: 1, maxPlace: 1, percent: 50 },
    { minPlace: 2, maxPlace: 2, percent: 30 },
    { minPlace: 3, maxPlace: 3, percent: 20 },
  ]
}

/**
 * Calculate prize pool from buy-ins and fees.
 * @param buyIn - Per-player buy-in (credits)
 * @param fee - House fee per player
 * @param playerCount - Number of players
 */
export const calculatePrizePool = (
  buyIn: number,
  fee: number,
  playerCount: number,
): number => playerCount * (buyIn - fee)

/**
 * Distribute prize pool across places using tier percentages.
 * @param prizePool - Total pool
 * @param tiers - Payout tiers
 * @param playerCount - Finished / registered count
 */
export const distributePrizes = (
  prizePool: number,
  tiers: PrizeTier[],
  playerCount: number,
): Payout[] => {
  const payouts: Payout[] = []
  let remaining = prizePool

  for (const tier of tiers) {
    const placesInTier =
      Math.min(tier.maxPlace, playerCount) - tier.minPlace + 1
    if (placesInTier <= 0) continue

    const tierTotal = Math.floor((prizePool * tier.percent) / 100)
    const perPlace = Math.floor(tierTotal / placesInTier)
    let leftover = tierTotal - perPlace * placesInTier

    for (let place = tier.minPlace; place <= tier.maxPlace; place++) {
      if (place > playerCount) break
      const extra = leftover > 0 ? 1 : 0
      if (leftover > 0) leftover--
      const amount = perPlace + extra
      remaining -= amount
      payouts.push({ place, amount, percent: tier.percent })
    }
  }

  if (remaining > 0 && payouts.length > 0) {
    payouts[0].amount += remaining
  }

  return payouts
}
