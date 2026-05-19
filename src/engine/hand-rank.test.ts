import { describe, expect, it } from 'vitest'
import { parseCard, parseCards } from './card.js'
import { compareHands, evaluateFive } from './hand-rank.js'
import { evaluateHoldem } from './holdem-evaluator.js'
import { evaluatePlo4 } from './plo-evaluator.js'

describe('evaluateFive', () => {
  it('ranks flush above straight', () => {
    const flush = evaluateFive(parseCards('Ah Kh Qh Jh 9h'))
    const straight = evaluateFive(parseCards('9c 8d 7h 6s 5c'))
    expect(compareHands(flush, straight)).toBeGreaterThan(0)
  })

  it('detects full house', () => {
    const hand = evaluateFive(parseCards('Kc Kh Kd 5s 5h'))
    expect(hand.category).toBe(6)
  })

  it('detects wheel straight', () => {
    const hand = evaluateFive(parseCards('5c 4d 3h 2s As'))
    expect(hand.category).toBe(4)
    expect(hand.kickers[0]).toBe(5)
  })
})

describe('evaluateHoldem', () => {
  it('picks best five of seven', () => {
    const hole = parseCards('As Ad')
    const board = parseCards('Kc Kh Kd 2s 3c')
    const hand = evaluateHoldem(hole, board)
    expect(hand.category).toBe(6) // kings full of aces
  })
})

describe('evaluatePlo4', () => {
  it('must use exactly two hole and three board', () => {
    const hole = parseCards('As Ah Kd Kc')
    const board = parseCards('2h 3h 4h 5c 9d')
    const hand = evaluatePlo4(hole, board)
    expect(hand.cards).toHaveLength(5)
    const holeUsed = hand.cards.filter((c) =>
      hole.some((h) => h.rank === c.rank && h.suit === c.suit),
    )
    expect(holeUsed).toHaveLength(2)
  })
})

describe('parseCard', () => {
  it('parses ace of spades', () => {
    const card = parseCard('As')
    expect(card.rank).toBe(14)
    expect(card.suit).toBe('s')
  })
})
