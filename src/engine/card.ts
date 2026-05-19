import type { Card, Rank, Suit } from './types.js'

const RANK_CHARS = '23456789TJQKA'
const SUIT_CHARS: Record<string, Suit> = {
  c: 'c',
  d: 'd',
  h: 'h',
  s: 's',
  C: 'c',
  D: 'd',
  H: 'h',
  S: 's',
}

/**
 * Parse a card string like "Ah" or "Td" into a Card object.
 * @param raw - Two-character card notation
 */
export const parseCard = (raw: string): Card => {
  const trimmed = raw.trim()
  if (trimmed.length < 2) {
    throw new Error(`Invalid card: ${raw}`)
  }
  const rankChar = trimmed[0].toUpperCase()
  const suitChar = trimmed.slice(-1)
  const rankIndex = RANK_CHARS.indexOf(rankChar)
  if (rankIndex === -1) {
    throw new Error(`Invalid rank: ${rankChar}`)
  }
  const suit = SUIT_CHARS[suitChar]
  if (!suit) {
    throw new Error(`Invalid suit: ${suitChar}`)
  }
  return { rank: (rankIndex + 2) as Rank, suit }
}

/**
 * Serialize a card to standard notation (e.g. "Ah").
 * @param card - Card to serialize
 */
export const cardToString = (card: Card): string => {
  const rankChar = RANK_CHARS[card.rank - 2]
  return `${rankChar}${card.suit}`
}

/**
 * Parse multiple cards from a space- or comma-separated string.
 * @param raw - Card list string
 */
export const parseCards = (raw: string): Card[] => {
  return raw
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(parseCard)
}

/**
 * Check whether two cards are equal.
 * @param a - First card
 * @param b - Second card
 */
export const cardsEqual = (a: Card, b: Card): boolean =>
  a.rank === b.rank && a.suit === b.suit

/**
 * Remove cards from a list by identity (rank + suit).
 * @param deck - Source card list
 * @param toRemove - Cards to exclude
 */
export const removeCards = (deck: Card[], toRemove: Card[]): Card[] => {
  return deck.filter(
    (c) => !toRemove.some((r) => cardsEqual(c, r)),
  )
}
