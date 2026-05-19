import { randomInt } from 'node:crypto'
import type { Card, Rank, Suit } from './types.js'
import { cardToString } from './card.js'

const SUITS: Suit[] = ['c', 'd', 'h', 's']
const RANKS: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]

/**
 * Build a standard 52-card deck.
 */
export const createDeck = (): Card[] => {
  const deck: Card[] = []
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit })
    }
  }
  return deck
}

/**
 * Fisher–Yates shuffle using crypto-secure randomness.
 * @param deck - Deck to shuffle (mutated in place)
 */
export const shuffleDeck = (deck: Card[]): Card[] => {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1)
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return deck
}

/**
 * Create and shuffle a fresh deck.
 */
export const newShuffledDeck = (): Card[] => shuffleDeck(createDeck())

/**
 * Deal `count` cards from the top of the deck (mutates deck).
 * @param deck - Source deck
 * @param count - Number of cards to deal
 */
export const dealCards = (deck: Card[], count: number): Card[] => {
  if (deck.length < count) {
    throw new Error(`Not enough cards: need ${count}, have ${deck.length}`)
  }
  return deck.splice(0, count)
}

/**
 * Serialize deck to string array for storage.
 * @param deck - Cards to serialize
 */
export const deckToStrings = (deck: Card[]): string[] =>
  deck.map(cardToString)
