import { TableManager } from '../table/table-manager.js'
import type { TableConfig } from '../table/types.js'
import { getBlindLevel, shouldAdvanceBlindLevel } from './blind-schedule.js'
import {
  calculatePrizePool,
  distributePrizes,
  type Payout,
} from './prize-pool.js'
import type {
  TournamentConfig,
  TournamentPlayer,
  TournamentState,
  TournamentStatus,
} from './types.js'

/**
 * Orchestrates tournament registration, table assignment, blind levels, and payouts.
 */
export class TournamentManager {
  private config: TournamentConfig
  private status: TournamentStatus = 'DRAFT'
  private players: Map<string, TournamentPlayer> = new Map()
  private tables: Map<string, TableManager> = new Map()
  private currentBlindLevel = 1
  private startedAt: Date | null = null
  private completedAt: Date | null = null

  /**
   * @param config - Tournament configuration
   */
  constructor(config: TournamentConfig) {
    this.config = config
  }

  /** Current tournament snapshot */
  getState(): TournamentState {
    const playerList = [...this.players.values()]
    return {
      config: this.config,
      status: this.status,
      players: playerList,
      currentBlindLevel: this.currentBlindLevel,
      prizePool: calculatePrizePool(
        this.config.buyIn,
        this.config.fee,
        playerList.length,
      ),
      startedAt: this.startedAt,
      completedAt: this.completedAt,
    }
  }

  /**
   * Open registration.
   */
  openRegistration(): void {
    if (this.status !== 'DRAFT') {
      throw new Error('Can only open registration from DRAFT')
    }
    this.status = 'REGISTERING'
  }

  /**
   * Register a player for the tournament.
   * @param userId - Player id
   */
  registerPlayer(userId: string): void {
    if (this.status !== 'REGISTERING') {
      throw new Error('Registration is not open')
    }
    if (this.players.size >= this.config.maxPlayers) {
      throw new Error('Tournament is full')
    }
    if (this.players.has(userId)) {
      throw new Error('Already registered')
    }

    this.players.set(userId, {
      userId,
      stack: this.config.startingStack,
      tableId: null,
      seatIndex: null,
      eliminatedAt: null,
      finishPlace: null,
    })
  }

  /**
   * Unregister before start.
   * @param userId - Player id
   */
  unregisterPlayer(userId: string): void {
    if (this.status !== 'REGISTERING') {
      throw new Error('Cannot unregister after start')
    }
    this.players.delete(userId)
  }

  /**
   * Start tournament: assign tables and deal first hands.
   */
  startTournament(): void {
    if (this.status !== 'REGISTERING') {
      throw new Error('Tournament must be in REGISTERING status')
    }
    const count = this.players.size
    if (count < 2) {
      throw new Error('Need at least 2 players')
    }

    this.status = 'RUNNING'
    this.startedAt = new Date()
    this.assignTables()
    this.syncBlindsToTables()
    for (const table of this.tables.values()) {
      if (this.activePlayersOnTable(table).length >= 2) {
        table.startHand()
      }
    }
  }

  /**
   * Tick: advance blind levels if schedule requires.
   * @param now - Current time
   */
  tick(now: Date = new Date()): boolean {
    if (this.status !== 'RUNNING' || !this.startedAt) return false

    if (
      shouldAdvanceBlindLevel(
        this.startedAt,
        this.config.blindStructure,
        this.currentBlindLevel,
        now,
      )
    ) {
      this.currentBlindLevel += 1
      this.syncBlindsToTables()
      return true
    }
    return false
  }

  /**
   * Record player elimination and rebalance tables if needed.
   * @param userId - Eliminated player
   * @param finishPlace - Final standing
   */
  eliminatePlayer(userId: string, finishPlace: number): void {
    const player = this.players.get(userId)
    if (!player) throw new Error('Player not in tournament')

    player.eliminatedAt = new Date()
    player.finishPlace = finishPlace
    player.stack = 0
    player.tableId = null
    player.seatIndex = null

    const remaining = [...this.players.values()].filter((p) => !p.eliminatedAt)
    if (remaining.length === 1) {
      this.completeTournament(remaining[0].userId)
    } else {
      this.rebalanceTables()
    }
  }

  /**
   * Update player stack after a hand (tournament chips).
   * @param userId - Player id
   * @param newStack - Updated stack
   */
  updatePlayerStack(userId: string, newStack: number): void {
    const player = this.players.get(userId)
    if (!player) return
    player.stack = newStack
    if (newStack <= 0) {
      const place =
        [...this.players.values()].filter((p) => p.eliminatedAt).length + 1
      this.eliminatePlayer(userId, place)
    }
  }

  /**
   * Get table manager by id.
   * @param tableId - Table id
   */
  getTable(tableId: string): TableManager | undefined {
    return this.tables.get(tableId)
  }

  /**
   * Compute final payouts when tournament completes.
   */
  getPayouts(): Payout[] {
    const count = this.players.size
    return distributePrizes(
      calculatePrizePool(this.config.buyIn, this.config.fee, count),
      this.config.prizeStructure,
      count,
    )
  }

  private completeTournament(winnerUserId: string): void {
    const winner = this.players.get(winnerUserId)
    if (winner) {
      winner.finishPlace = 1
    }
    this.status = 'COMPLETED'
    this.completedAt = new Date()
  }

  private assignTables(): void {
    const playerIds = [...this.players.keys()]
    const perTable = this.config.playersPerTable
    let tableIndex = 0

    for (let i = 0; i < playerIds.length; i += perTable) {
      const chunk = playerIds.slice(i, i + perTable)
      const tableId = `${this.config.id}-table-${tableIndex}`
      tableIndex++

      const tableConfig = this.buildTableConfig(tableId)
      const table = new TableManager(tableConfig)
      this.tables.set(tableId, table)

      chunk.forEach((userId, seatIdx) => {
        const player = this.players.get(userId)!
        table.joinSeat(userId, player.stack, seatIdx)
        player.tableId = tableId
        player.seatIndex = seatIdx
      })
    }
  }

  private buildTableConfig(tableId: string): TableConfig {
    const blinds = getBlindLevel(
      this.config.blindStructure,
      this.currentBlindLevel,
    )
    return {
      id: tableId,
      variant: this.config.variant,
      visibility: this.config.visibility,
      hostUserId: this.config.hostUserId,
      inviteCode: null,
      maxSeats: this.config.playersPerTable,
      smallBlind: blinds.smallBlind,
      bigBlind: blinds.bigBlind,
      minBuyIn: this.config.startingStack,
      maxBuyIn: this.config.startingStack,
      tournamentId: this.config.id,
    }
  }

  private syncBlindsToTables(): void {
    const blinds = getBlindLevel(
      this.config.blindStructure,
      this.currentBlindLevel,
    )
    for (const [tableId, table] of this.tables) {
      const state = table.getState()
      state.config.smallBlind = blinds.smallBlind
      state.config.bigBlind = blinds.bigBlind
      this.tables.set(tableId, table)
    }
  }

  private activePlayersOnTable(table: TableManager): TournamentPlayer[] {
    const state = table.getState()
    return [...this.players.values()].filter(
      (p) =>
        p.tableId &&
        !p.eliminatedAt &&
        state.seats.some((s) => s.userId === p.userId && s.stack > 0),
    )
  }

  private rebalanceTables(): void {
    const active = [...this.players.values()].filter((p) => !p.eliminatedAt)
    if (active.length <= this.config.playersPerTable) {
      return
    }
    // Full table-balancing algorithm deferred; placeholder for MTT merge/split
  }
}
