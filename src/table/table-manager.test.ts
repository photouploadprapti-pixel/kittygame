import { describe, expect, it } from 'vitest'
import { TableManager } from './table-manager.js'
import type { TableConfig } from './types.js'

const baseConfig = (): TableConfig => ({
  id: 'table-1',
  variant: 'TEXAS_HOLDEM',
  visibility: 'PUBLIC',
  hostUserId: null,
  inviteCode: null,
  maxSeats: 6,
  smallBlind: 5,
  bigBlind: 10,
  minBuyIn: 100,
  maxBuyIn: 1000,
  tournamentId: null,
})

describe('TableManager', () => {
  it('seats players and starts a hand', () => {
    const table = new TableManager(baseConfig())
    table.joinSeat('user-a', 500, 0)
    table.joinSeat('user-b', 500, 1)
    table.startHand()

    const state = table.getState()
    expect(state.handInProgress).toBe(true)
    expect(state.bettingRound).toBe('PREFLOP')
    expect(state.potTotal).toBeGreaterThan(0)
    expect(state.seats[0].holeCards).toHaveLength(2)
  })

  it('allows fold and awards pot to remaining player', () => {
    const table = new TableManager(baseConfig())
    table.joinSeat('user-a', 500, 0)
    table.joinSeat('user-b', 500, 1)
    table.startHand()

    const actionSeat = table.getState().actionSeatIndex!
    table.applyAction(actionSeat, 'FOLD')

    expect(table.getState().handInProgress).toBe(false)
    const winner = table.getState().seats.find((s) => s.stack > 500)
    expect(winner).toBeDefined()
  })

  it('rejects invalid buy-in', () => {
    const table = new TableManager(baseConfig())
    expect(() => table.joinSeat('user-a', 10, 0)).toThrow(/Buy-in/)
  })
})
