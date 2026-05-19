import type { BettingRound, Card, GameVariant, PlayerActionType } from '../engine/index.js'

/** Maximum seats per table (9 players + dealer button rotation among them) */
export const MAX_SEATS = 10

/** Minimum players to start a hand */
export const MIN_PLAYERS_TO_DEAL = 2

/** Table visibility */
export type TableVisibility = 'PUBLIC' | 'PRIVATE'

/** Cash / tournament table status */
export type TableStatus = 'OPEN' | 'RUNNING' | 'PAUSED' | 'CLOSED'

/** Seat occupancy */
export interface TableSeat {
  seatIndex: number
  userId: string | null
  stack: number
  /** Chips committed this hand (blinds + bets) */
  betThisRound: number
  totalBetThisHand: number
  holeCards: Card[]
  hasFolded: boolean
  isAllIn: boolean
  isSittingOut: boolean
  /** Last action this street */
  lastAction: PlayerActionType | null
}

/** Side pot for all-in scenarios */
export interface SidePot {
  amount: number
  eligibleSeatIndexes: number[]
}

/** Serialized player action */
export interface PlayerAction {
  seatIndex: number
  type: PlayerActionType
  amount?: number
  timestamp: number
}

/** Table configuration */
export interface TableConfig {
  id: string
  variant: GameVariant
  visibility: TableVisibility
  hostUserId: string | null
  inviteCode: string | null
  maxSeats: number
  smallBlind: number
  bigBlind: number
  minBuyIn: number
  maxBuyIn: number
  /** Optional tournament link */
  tournamentId: string | null
}

/** Public table state snapshot */
export interface TableState {
  config: TableConfig
  status: TableStatus
  seats: TableSeat[]
  dealerSeatIndex: number
  smallBlindSeatIndex: number
  bigBlindSeatIndex: number
  board: Card[]
  potTotal: number
  sidePots: SidePot[]
  currentBet: number
  minRaise: number
  actionSeatIndex: number | null
  bettingRound: BettingRound | null
  handNumber: number
  handInProgress: boolean
}
