import type { BettingRound, Card, GameVariant } from '../engine/index.js'
import {
  dealCards,
  evaluateHoldem,
  evaluatePlo4,
  newShuffledDeck,
} from '../engine/index.js'
import { compareHands } from '../engine/hand-rank.js'
import type { EvaluatedHand } from '../engine/types.js'
import { validateAction } from './action-validator.js'
import { calculatePots, totalPotAmount } from './pot-manager.js'
import {
  activeSeats,
  canActCount,
  inHandSeats,
  nextActionSeat,
  nextOccupiedSeat,
} from './seat-utils.js'
import type {
  PlayerAction,
  TableConfig,
  TableSeat,
  TableState,
  TableStatus,
} from './types.js'
import { MAX_SEATS, MIN_PLAYERS_TO_DEAL } from './types.js'

const HOLE_COUNT: Record<GameVariant, number> = {
  TEXAS_HOLDEM: 2,
  PLO4: 4,
}

const STREETS: BettingRound[] = ['PREFLOP', 'FLOP', 'TURN', 'RIVER']

/**
 * In-memory table manager: seats, dealing, betting, showdown.
 * Server-authoritative; all actions validated here.
 */
export class TableManager {
  private config: TableConfig
  private status: TableStatus = 'OPEN'
  private seats: TableSeat[]
  private deck: Card[] = []
  private board: Card[] = []
  private dealerSeatIndex = 0
  private actionSeatIndex: number | null = null
  private bettingRound: BettingRound | null = null
  private currentBet = 0
  private minRaise = 0
  private handNumber = 0
  private handInProgress = false
  private actionsThisStreet: Set<number> = new Set()
  private actionLog: PlayerAction[] = []

  /**
   * @param config - Table configuration
   */
  constructor(config: TableConfig) {
    this.config = { ...config, maxSeats: Math.min(config.maxSeats, MAX_SEATS) }
    this.seats = Array.from({ length: this.config.maxSeats }, (_, i) =>
      createEmptySeat(i),
    )
    this.minRaise = config.bigBlind
  }

  /** Current table snapshot (hole cards hidden for non-owner in production) */
  getState(): TableState {
    const { mainPot, sidePots } = calculatePots(this.seats)
    const sb = nextOccupiedSeat(this.seats, this.dealerSeatIndex) ?? 0
    const bb =
      nextOccupiedSeat(this.seats, sb) ?? (sb + 1) % this.config.maxSeats

    return {
      config: this.config,
      status: this.status,
      seats: this.seats.map((s) => ({ ...s, holeCards: [...s.holeCards] })),
      dealerSeatIndex: this.dealerSeatIndex,
      smallBlindSeatIndex: sb,
      bigBlindSeatIndex: bb,
      board: [...this.board],
      potTotal: totalPotAmount(mainPot, sidePots),
      sidePots,
      currentBet: this.currentBet,
      minRaise: this.minRaise,
      actionSeatIndex: this.actionSeatIndex,
      bettingRound: this.bettingRound,
      handNumber: this.handNumber,
      handInProgress: this.handInProgress,
    }
  }

  /**
   * Seat a player at the table.
   * @param userId - Player id
   * @param buyIn - Chip count
   * @param preferredSeat - Optional seat index
   */
  joinSeat(userId: string, buyIn: number, preferredSeat?: number): number {
    if (this.handInProgress) {
      throw new Error('Cannot join during an active hand')
    }
    if (buyIn < this.config.minBuyIn || buyIn > this.config.maxBuyIn) {
      throw new Error(
        `Buy-in must be between ${this.config.minBuyIn} and ${this.config.maxBuyIn}`,
      )
    }
    if (this.seats.some((s) => s.userId === userId)) {
      throw new Error('Player already seated')
    }

    const seatIndex =
      preferredSeat !== undefined
        ? preferredSeat
        : this.seats.findIndex((s) => !s.userId)

    if (seatIndex < 0 || seatIndex >= this.seats.length) {
      throw new Error('No open seats')
    }
    if (this.seats[seatIndex].userId) {
      throw new Error('Seat occupied')
    }

    this.seats[seatIndex] = {
      ...createEmptySeat(seatIndex),
      userId,
      stack: buyIn,
    }
    return seatIndex
  }

  /**
   * Remove player from table (after hand if in progress).
   * @param userId - Player id
   */
  leaveSeat(userId: string): void {
    const seat = this.seats.find((s) => s.userId === userId)
    if (!seat) throw new Error('Player not seated')
    if (this.handInProgress && !seat.hasFolded) {
      throw new Error('Cannot leave during active hand; fold first')
    }
    this.seats[seat.seatIndex] = createEmptySeat(seat.seatIndex)
  }

  /**
   * Start a new hand when enough players are seated.
   */
  startHand(): void {
    const players = activeSeats(this.seats)
    if (players.length < MIN_PLAYERS_TO_DEAL) {
      throw new Error(`Need at least ${MIN_PLAYERS_TO_DEAL} players`)
    }
    if (this.handInProgress) {
      throw new Error('Hand already in progress')
    }

    this.handNumber += 1
    this.handInProgress = true
    this.status = 'RUNNING'
    this.board = []
    this.deck = newShuffledDeck()
    this.actionsThisStreet = new Set()

    for (const seat of this.seats) {
      seat.holeCards = []
      seat.betThisRound = 0
      seat.totalBetThisHand = 0
      seat.hasFolded = false
      seat.isAllIn = false
      seat.lastAction = null
    }

    this.dealerSeatIndex =
      nextOccupiedSeat(this.seats, this.dealerSeatIndex) ??
      this.dealerSeatIndex

    this.postBlinds()
    this.dealHoleCards()
    this.bettingRound = 'PREFLOP'
    this.currentBet = this.config.bigBlind
    this.minRaise = this.config.bigBlind

    const bbSeat = this.getBigBlindSeatIndex()
    this.actionSeatIndex = nextActionSeat(this.seats, bbSeat)
  }

  /**
   * Apply a player action; advances street or ends hand when appropriate.
   * @param seatIndex - Acting seat
   * @param type - Action type
   * @param amount - Optional bet/raise total
   */
  applyAction(
    seatIndex: number,
    type: import('../engine/index.js').PlayerActionType,
    amount?: number,
  ): void {
    if (!this.handInProgress || this.actionSeatIndex !== seatIndex) {
      throw new Error('Not this seat\'s turn')
    }

    const seat = this.seats[seatIndex]
    const validation = validateAction(
      seat,
      type,
      amount,
      this.currentBet,
      this.minRaise,
      this.config.bigBlind,
    )
    if (!validation.valid) {
      throw new Error(validation.error ?? 'Invalid action')
    }

    const chips = validation.resolvedAmount ?? 0
    this.commitChips(seat, chips, type, amount)

    this.actionLog.push({
      seatIndex,
      type,
      amount: chips,
      timestamp: Date.now(),
    })
    this.actionsThisStreet.add(seatIndex)

    if (this.isStreetComplete()) {
      this.advanceStreet()
    } else {
      this.actionSeatIndex = nextActionSeat(this.seats, seatIndex)
    }
  }

  /**
   * Resolve showdown and distribute pots.
   * @returns Winners per pot with amounts
   */
  resolveShowdown(): ShowdownResult[] {
    const remaining = inHandSeats(this.seats)
    if (remaining.length === 1) {
      return this.awardToSingleWinner(remaining[0])
    }

    const { mainPot, sidePots } = calculatePots(this.seats)
    const allPots = [{ amount: mainPot, eligible: remaining.map((s) => s.seatIndex) }, ...sidePots.map((p) => ({
      amount: p.amount,
      eligible: p.eligibleSeatIndexes,
    }))]

    const results: ShowdownResult[] = []
    const evaluate = this.getEvaluator()

    for (const pot of allPots) {
      if (pot.amount <= 0) continue
      const eligible = remaining.filter((s) =>
        pot.eligible.includes(s.seatIndex),
      )
      const ranked = eligible.map((s) => ({
        seatIndex: s.seatIndex,
        hand: evaluate(s.holeCards, this.board),
      }))
      ranked.sort((a, b) => compareHands(b.hand, a.hand))
      const bestScore = ranked[0]?.hand.score
      const winners = ranked.filter((r) => r.hand.score === bestScore)
      const share = Math.floor(pot.amount / winners.length)
      let remainder = pot.amount - share * winners.length

      for (const w of winners) {
        const extra = remainder > 0 ? 1 : 0
        if (remainder > 0) remainder--
        const seat = this.seats[w.seatIndex]
        seat.stack += share + extra
        results.push({
          seatIndex: w.seatIndex,
          amount: share + extra,
          hand: w.hand,
        })
      }
    }

    this.endHand()
    return results
  }

  /** Action history for the current / last hand */
  getActionLog(): PlayerAction[] {
    return [...this.actionLog]
  }

  private getEvaluator(): (hole: Card[], board: Card[]) => EvaluatedHand {
    return this.config.variant === 'PLO4' ? evaluatePlo4 : evaluateHoldem
  }

  private postBlinds(): void {
    const sbIdx = nextOccupiedSeat(this.seats, this.dealerSeatIndex)!
    const bbIdx = nextOccupiedSeat(this.seats, sbIdx)!
    this.postBlind(sbIdx, this.config.smallBlind)
    this.postBlind(bbIdx, this.config.bigBlind)
  }

  private postBlind(seatIndex: number, amount: number): void {
    const seat = this.seats[seatIndex]
    const pay = Math.min(amount, seat.stack)
    this.commitChips(seat, pay, pay < amount ? 'ALL_IN' : 'BET')
  }

  private dealHoleCards(): void {
    const count = HOLE_COUNT[this.config.variant]
    const players = activeSeats(this.seats)
    for (let c = 0; c < count; c++) {
      for (const seat of players) {
        const card = dealCards(this.deck, 1)[0]
        seat.holeCards.push(card)
      }
    }
  }

  private commitChips(
    seat: TableSeat,
    chips: number,
    type: import('../engine/index.js').PlayerActionType,
    raiseTotal?: number,
  ): void {
    seat.stack -= chips
    seat.betThisRound += chips
    seat.totalBetThisHand += chips
    seat.lastAction = type

    if (type === 'FOLD') {
      seat.hasFolded = true
      return
    }

    if (seat.stack === 0) {
      seat.isAllIn = true
    }

    if (type === 'RAISE' || type === 'BET' || type === 'ALL_IN') {
      const newBet =
        type === 'RAISE' && raiseTotal !== undefined
          ? raiseTotal
          : seat.betThisRound
      if (newBet > this.currentBet) {
        const raiseSize = newBet - this.currentBet
        this.minRaise = Math.max(this.minRaise, raiseSize)
        this.currentBet = newBet
        this.actionsThisStreet = new Set([seat.seatIndex])
      }
    }
  }

  private isStreetComplete(): boolean {
    const canAct = canActCount(this.seats)
    if (canAct <= 0) return true

    const inHand = inHandSeats(this.seats)
    if (inHand.length <= 1) return true

    const matched = inHand.every(
      (s) =>
        s.isAllIn ||
        s.betThisRound === this.currentBet ||
        s.stack === 0,
    )
    if (!matched) return false

    return inHand.every(
      (s) =>
        s.isAllIn ||
        this.actionsThisStreet.has(s.seatIndex) ||
        s.betThisRound === 0,
    )
  }

  private advanceStreet(): void {
    const inHand = inHandSeats(this.seats)
    if (inHand.length <= 1) {
      this.resolveShowdown()
      return
    }

    if (canActCount(this.seats) <= 1) {
      this.runOutBoard()
      this.resolveShowdown()
      return
    }

    for (const seat of this.seats) {
      seat.betThisRound = 0
      seat.lastAction = null
    }
    this.currentBet = 0
    this.minRaise = this.config.bigBlind
    this.actionsThisStreet = new Set()

    const streetIdx = STREETS.indexOf(this.bettingRound!)
    if (streetIdx >= STREETS.length - 1) {
      this.bettingRound = 'SHOWDOWN'
      this.resolveShowdown()
      return
    }

    const nextStreet = STREETS[streetIdx + 1]
    this.bettingRound = nextStreet

    if (nextStreet === 'FLOP') {
      dealCards(this.deck, 1)
      this.board.push(...dealCards(this.deck, 3))
    } else if (nextStreet === 'TURN' || nextStreet === 'RIVER') {
      dealCards(this.deck, 1)
      this.board.push(dealCards(this.deck, 1)[0])
    }

    this.actionSeatIndex =
      nextActionSeat(this.seats, this.dealerSeatIndex) ??
      inHand[0].seatIndex
  }

  private runOutBoard(): void {
    while (this.board.length < 5) {
      if (this.board.length === 0) {
        dealCards(this.deck, 1)
        this.board.push(...dealCards(this.deck, 3))
      } else {
        dealCards(this.deck, 1)
        this.board.push(dealCards(this.deck, 1)[0])
      }
    }
    this.bettingRound = 'SHOWDOWN'
  }

  private getBigBlindSeatIndex(): number {
    const sb = nextOccupiedSeat(this.seats, this.dealerSeatIndex)!
    return nextOccupiedSeat(this.seats, sb)!
  }

  private awardToSingleWinner(
    winner: TableSeat,
  ): ShowdownResult[] {
    const { mainPot, sidePots } = calculatePots(this.seats)
    const total = totalPotAmount(mainPot, sidePots)
    winner.stack += total
    this.endHand()
    return [{ seatIndex: winner.seatIndex, amount: total }]
  }

  private endHand(): void {
    this.handInProgress = false
    this.bettingRound = null
    this.actionSeatIndex = null
    this.board = []
    this.deck = []
    this.actionLog = []
    this.status = 'OPEN'
  }
}

/** Showdown payout record */
export interface ShowdownResult {
  seatIndex: number
  amount: number
  hand?: EvaluatedHand
}

const createEmptySeat = (seatIndex: number): TableSeat => ({
  seatIndex,
  userId: null,
  stack: 0,
  betThisRound: 0,
  totalBetThisHand: 0,
  holeCards: [],
  hasFolded: false,
  isAllIn: false,
  isSittingOut: false,
  lastAction: null,
})
