/** Supported poker variants */
export type GameVariant = 'TEXAS_HOLDEM' | 'PLO4'

/** Card rank 2–14 (Ace = 14) */
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14

/** Card suit */
export type Suit = 'c' | 'd' | 'h' | 's'

/** Single playing card */
export interface Card {
  rank: Rank
  suit: Suit
}

/** Hand category from high to low */
export enum HandCategory {
  HIGH_CARD = 0,
  ONE_PAIR = 1,
  TWO_PAIR = 2,
  THREE_OF_A_KIND = 3,
  STRAIGHT = 4,
  FLUSH = 5,
  FULL_HOUSE = 6,
  FOUR_OF_A_KIND = 7,
  STRAIGHT_FLUSH = 8,
}

/** Comparable hand strength (higher = better) */
export interface EvaluatedHand {
  category: HandCategory
  /** Tie-breaker values, highest significance first */
  kickers: number[]
  /** Best five cards forming the hand */
  cards: Card[]
  /** Numeric score for quick comparison */
  score: number
}

/** Player action at the table */
export type PlayerActionType =
  | 'FOLD'
  | 'CHECK'
  | 'CALL'
  | 'BET'
  | 'RAISE'
  | 'ALL_IN'

/** Street in a hand */
export type BettingRound = 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER' | 'SHOWDOWN'

/** Table / hand lifecycle */
export type HandPhase =
  | 'WAITING'
  | 'DEALING'
  | 'BETTING'
  | 'SHOWDOWN'
  | 'COMPLETE'
