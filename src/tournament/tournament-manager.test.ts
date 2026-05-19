import { describe, expect, it } from 'vitest'
import { buildBlindStructure } from './blind-schedule.js'
import { calculatePrizePool, distributePrizes, defaultPrizeStructure } from './prize-pool.js'
import { TournamentManager } from './tournament-manager.js'
import type { TournamentConfig } from './types.js'

const baseTournament = (): TournamentConfig => ({
  id: 'tourney-1',
  name: 'Test SNG',
  variant: 'TEXAS_HOLDEM',
  type: 'SNG',
  visibility: 'PUBLIC',
  hostUserId: null,
  buyIn: 100,
  fee: 10,
  startingStack: 1500,
  maxPlayers: 18,
  playersPerTable: 9,
  blindStructure: buildBlindStructure(10, 8),
  prizeStructure: defaultPrizeStructure(6),
  scheduledStartAt: null,
})

describe('TournamentManager', () => {
  it('registers players and starts', () => {
    const tm = new TournamentManager(baseTournament())
    tm.openRegistration()
    tm.registerPlayer('p1')
    tm.registerPlayer('p2')
    tm.startTournament()

    const state = tm.getState()
    expect(state.status).toBe('RUNNING')
    expect(state.players).toHaveLength(2)
    expect(state.startedAt).not.toBeNull()
  })

  it('eliminates down to one winner', () => {
    const tm = new TournamentManager(baseTournament())
    tm.openRegistration()
    tm.registerPlayer('p1')
    tm.registerPlayer('p2')
    tm.startTournament()
    tm.eliminatePlayer('p2', 2)

    expect(tm.getState().status).toBe('COMPLETED')
    expect(tm.getState().players.find((p) => p.userId === 'p1')?.finishPlace).toBe(1)
  })
})

describe('prize pool', () => {
  it('calculates pool minus fees', () => {
    expect(calculatePrizePool(100, 10, 10)).toBe(900)
  })

  it('distributes by tiers', () => {
    const tiers = defaultPrizeStructure(10)
    const payouts = distributePrizes(1000, tiers, 10)
    const total = payouts.reduce((s, p) => s + p.amount, 0)
    expect(total).toBe(1000)
  })
})

describe('blind schedule', () => {
  it('builds escalating levels', () => {
    const levels = buildBlindStructure(25, 5)
    expect(levels).toHaveLength(5)
    expect(levels[1].smallBlind).toBeGreaterThan(levels[0].smallBlind)
  })
})
