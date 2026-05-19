import { cardToString } from '../engine/card.js'
import type { Card } from '../engine/index.js'
import type { PlayerActionType } from '../engine/index.js'
import { validateAction } from '../table/action-validator.js'
import { TableManager } from '../table/table-manager.js'
import type { TableConfig, TableState } from '../table/types.js'

const demoConfig: TableConfig = {
  id: 'demo-table',
  variant: 'TEXAS_HOLDEM',
  visibility: 'PUBLIC',
  hostUserId: null,
  inviteCode: null,
  maxSeats: 9,
  smallBlind: 5,
  bigBlind: 10,
  minBuyIn: 100,
  maxBuyIn: 5000,
  tournamentId: null,
}

let table = new TableManager(demoConfig)

const serializeCard = (c: Card): string => cardToString(c)

type ClientTableState = Omit<TableState, 'board' | 'seats'> & {
  viewerId: string | null
  board: string[]
  seats: Array<
    Omit<TableState['seats'][number], 'holeCards'> & {
      holeCards: string[]
      isBot: boolean
    }
  >
}

const clientState = (viewerId: string | null): ClientTableState => {
  const state = table.getState()
  return {
    ...state,
    viewerId,
    board: state.board.map(serializeCard),
    seats: state.seats.map((s) => {
      const hide =
        s.holeCards.length > 0 &&
        s.userId !== viewerId &&
        state.handInProgress
      return {
        ...s,
        holeCards: hide
          ? s.holeCards.map(() => '??')
          : s.holeCards.map(serializeCard),
        isBot: s.userId?.startsWith('bot-') ?? false,
      }
    }),
  }
}

const runBots = (): void => {
  let guard = 0
  while (guard++ < 40) {
    const state = table.getState()
    if (!state.handInProgress || state.actionSeatIndex === null) break
    const seat = state.seats[state.actionSeatIndex]
    if (!seat?.userId?.startsWith('bot-')) break
    const action = pickBotAction(seat.seatIndex, state)
    table.applyAction(seat.seatIndex, action.type, action.amount)
  }
}

const pickBotAction = (
  seatIndex: number,
  state: TableState,
): { type: PlayerActionType; amount?: number } => {
  const seat = state.seats[seatIndex]
  const toCall = state.currentBet - seat.betThisRound
  const roll = Math.random()

  if (toCall === 0) {
    if (roll < 0.15 && seat.stack > state.config.bigBlind * 3) {
      return { type: 'BET', amount: state.config.bigBlind * 2 }
    }
    return { type: 'CHECK' }
  }

  if (toCall >= seat.stack) {
    return roll < 0.55 ? { type: 'CALL' } : { type: 'FOLD' }
  }

  if (toCall <= state.config.bigBlind) {
    return roll < 0.7 ? { type: 'CALL' } : { type: 'FOLD' }
  }

  return roll < 0.35 ? { type: 'CALL' } : { type: 'FOLD' }
}

export type ApiRequest = {
  method: string
  pathname: string
  viewerId: string | null
  body: Record<string, unknown>
}

export type ApiResponse = {
  status: number
  body: unknown
}

/**
 * Handle JSON API routes (shared by Node server and Netlify Functions).
 */
export const handleApiRequest = async (
  req: ApiRequest,
): Promise<ApiResponse | null> => {
  const { method, pathname, viewerId, body } = req

  if (pathname === '/api/health' && method === 'GET') {
    return { status: 200, body: { ok: true, service: 'kittys-poker-club' } }
  }

  if (pathname === '/api/config' && method === 'GET') {
    const supabaseUrl = process.env.SUPABASE_URL ?? ''
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? ''
    if (!supabaseUrl || !supabaseAnonKey) {
      return {
        status: 503,
        body: {
          error:
            'Set SUPABASE_URL and SUPABASE_ANON_KEY in Netlify environment variables',
        },
      }
    }
    return { status: 200, body: { supabaseUrl, supabaseAnonKey } }
  }

  if (pathname === '/api/table/state' && method === 'GET') {
    return { status: 200, body: clientState(viewerId) }
  }

  if (pathname === '/api/table/legal-actions' && method === 'GET') {
    const state = table.getState()
    const seatIdx = state.actionSeatIndex
    if (seatIdx === null) {
      return { status: 200, body: { actions: [] } }
    }
    const seat = state.seats[seatIdx]
    const types: PlayerActionType[] = [
      'FOLD',
      'CHECK',
      'CALL',
      'BET',
      'RAISE',
      'ALL_IN',
    ]
    const legal = types.filter((t) =>
      validateAction(
        seat,
        t,
        t === 'RAISE'
          ? state.currentBet + state.minRaise
          : state.config.bigBlind * 2,
        state.currentBet,
        state.minRaise,
        state.config.bigBlind,
      ).valid,
    )
    const toCall = Math.max(0, state.currentBet - seat.betThisRound)
    return {
      status: 200,
      body: {
        legal,
        toCall,
        minRaiseTotal: state.currentBet + state.minRaise,
        currentBet: state.currentBet,
      },
    }
  }

  if (pathname === '/api/table/reset' && method === 'POST') {
    table = new TableManager(demoConfig)
    return { status: 200, body: { ok: true, state: clientState(viewerId) } }
  }

  if (pathname === '/api/table/setup-demo' && method === 'POST') {
    table = new TableManager(demoConfig)
    const heroId = String(body.viewerId ?? 'player-you')
    const names = ['Luna', 'Mittens', 'Shadow', 'Whiskers', 'Cleo', 'Felix', 'Nala']
    table.joinSeat(heroId, 1000, 0)
    for (let i = 0; i < 5; i++) {
      table.joinSeat(`bot-${names[i]!.toLowerCase()}`, 800 + i * 50, i + 1)
    }
    return { status: 200, body: clientState(heroId) }
  }

  if (pathname === '/api/table/join' && method === 'POST') {
    const seatIndex = table.joinSeat(
      String(body.userId ?? `player-${Date.now()}`),
      Number(body.buyIn ?? 500),
      body.seat !== undefined ? Number(body.seat) : undefined,
    )
    return {
      status: 200,
      body: { seatIndex, state: clientState(String(body.viewerId ?? '')) },
    }
  }

  if (pathname === '/api/table/start' && method === 'POST') {
    table.startHand()
    runBots()
    return { status: 200, body: clientState(viewerId) }
  }

  if (pathname === '/api/table/action' && method === 'POST') {
    const state = table.getState()
    const seat = state.actionSeatIndex
    if (seat === null) {
      return { status: 400, body: { error: 'No action required' } }
    }
    const acting = state.seats[seat]
    const vid = String(body.viewerId ?? '')
    if (acting.userId !== vid && !acting.userId?.startsWith('bot-')) {
      return { status: 403, body: { error: 'Not your turn' } }
    }
    table.applyAction(
      seat,
      (body.type as PlayerActionType) ?? 'CHECK',
      body.amount !== undefined ? Number(body.amount) : undefined,
    )
    runBots()
    return { status: 200, body: clientState(vid || viewerId) }
  }

  return null
}
