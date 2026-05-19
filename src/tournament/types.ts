import type { GameVariant } from '../engine/index.js'
import type { TableVisibility } from '../table/types.js'

/** Sit-n-go vs multi-table tournament */
export type TournamentType = 'SNG' | 'MTT'

/** Tournament lifecycle */
export type TournamentStatus =
  | 'DRAFT'
  | 'REGISTERING'
  | 'RUNNING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'CANCELLED'

/** Single blind level */
export interface BlindLevel {
  level: number
  smallBlind: number
  bigBlind: number
  ante: number
  /** Minutes before next level */
  durationMinutes: number
}

/** Prize payout row */
export interface PrizeTier {
  minPlace: number
  maxPlace: number
  /** Percentage of prize pool (0–100) */
  percent: number
}

/** Tournament configuration */
export interface TournamentConfig {
  id: string
  name: string
  variant: GameVariant
  type: TournamentType
  visibility: TableVisibility
  hostUserId: string | null
  buyIn: number
  fee: number
  startingStack: number
  maxPlayers: number
  playersPerTable: number
  blindStructure: BlindLevel[]
  prizeStructure: PrizeTier[]
  scheduledStartAt: Date | null
}

/** Registered player */
export interface TournamentPlayer {
  userId: string
  stack: number
  tableId: string | null
  seatIndex: number | null
  eliminatedAt: Date | null
  finishPlace: number | null
}

/** Runtime tournament state */
export interface TournamentState {
  config: TournamentConfig
  status: TournamentStatus
  players: TournamentPlayer[]
  currentBlindLevel: number
  prizePool: number
  startedAt: Date | null
  completedAt: Date | null
}
