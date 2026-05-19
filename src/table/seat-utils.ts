import type { TableSeat } from './types.js'

/**
 * Get seats with active players (not empty, not sitting out).
 * @param seats - All table seats
 */
export const activeSeats = (seats: TableSeat[]): TableSeat[] =>
  seats.filter((s) => s.userId && !s.isSittingOut)

/**
 * Get seats still in the current hand (not folded).
 * @param seats - All table seats
 */
export const inHandSeats = (seats: TableSeat[]): TableSeat[] =>
  activeSeats(seats).filter((s) => !s.hasFolded)

/**
 * Count players with chips who can still act (not all-in).
 * @param seats - All table seats
 */
export const canActCount = (seats: TableSeat[]): number =>
  inHandSeats(seats).filter((s) => !s.isAllIn && s.stack > 0).length

/**
 * Next occupied seat index clockwise from `from`.
 * @param seats - All seats
 * @param from - Starting seat index (exclusive)
 */
export const nextOccupiedSeat = (
  seats: TableSeat[],
  from: number,
): number | null => {
  const max = seats.length
  for (let i = 1; i <= max; i++) {
    const idx = (from + i) % max
    const seat = seats[idx]
    if (seat?.userId && !seat.isSittingOut) return idx
  }
  return null
}

/**
 * Next seat that can act (in hand, has chips, not all-in).
 * @param seats - All seats
 * @param from - Starting seat index
 */
export const nextActionSeat = (
  seats: TableSeat[],
  from: number,
): number | null => {
  const max = seats.length
  for (let i = 1; i <= max; i++) {
    const idx = (from + i) % max
    const seat = seats[idx]
    if (
      seat?.userId &&
      !seat.hasFolded &&
      !seat.isSittingOut &&
      !seat.isAllIn &&
      seat.stack > 0
    ) {
      return idx
    }
  }
  return null
}
