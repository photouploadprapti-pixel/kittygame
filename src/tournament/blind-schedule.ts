import type { BlindLevel } from './types.js'

/**
 * Build a standard escalating blind structure.
 * @param startingSb - Level 1 small blind
 * @param levelCount - Number of levels
 * @param durationMinutes - Minutes per level
 */
export const buildBlindStructure = (
  startingSb: number,
  levelCount: number,
  durationMinutes = 10,
): BlindLevel[] => {
  const levels: BlindLevel[] = []
  let sb = startingSb
  for (let i = 1; i <= levelCount; i++) {
    const bb = sb * 2
    levels.push({
      level: i,
      smallBlind: sb,
      bigBlind: bb,
      ante: i >= 5 ? Math.floor(bb / 10) : 0,
      durationMinutes,
    })
    sb = Math.floor(sb * 1.5)
    if (sb < 2) sb = 2
  }
  return levels
}

/**
 * Get blind level by index (1-based).
 * @param structure - Full blind schedule
 * @param level - Level number
 */
export const getBlindLevel = (
  structure: BlindLevel[],
  level: number,
): BlindLevel => {
  const found = structure.find((l) => l.level === level)
  if (!found) {
    return structure[structure.length - 1]
  }
  return found
}

/**
 * Check if blind level should advance based on elapsed time.
 * @param startedAt - Tournament start time
 * @param structure - Blind schedule
 * @param currentLevel - Current level (1-based)
 * @param now - Current time
 */
export const shouldAdvanceBlindLevel = (
  startedAt: Date,
  structure: BlindLevel[],
  currentLevel: number,
  now: Date = new Date(),
): boolean => {
  let elapsedMs = now.getTime() - startedAt.getTime()
  for (const level of structure) {
    if (level.level < currentLevel) {
      elapsedMs -= level.durationMinutes * 60 * 1000
      continue
    }
    if (level.level === currentLevel) {
      return elapsedMs >= level.durationMinutes * 60 * 1000
    }
    break
  }
  return false
}
