import type { PlayerActionType } from '../engine/index.js'
import type { TableSeat } from './types.js'

/** Result of validating a player action */
export interface ActionValidation {
  valid: boolean
  error?: string
  /** Resolved chip amount for CALL/BET/RAISE/ALL_IN */
  resolvedAmount?: number
}

/**
 * Validate whether a player action is legal on the current street.
 * @param seat - Acting seat
 * @param type - Action type
 * @param amount - Bet/raise amount (if applicable)
 * @param currentBet - Highest bet this street
 * @param minRaise - Minimum raise increment
 * @param bigBlind - Table big blind
 */
export const validateAction = (
  seat: TableSeat,
  type: PlayerActionType,
  amount: number | undefined,
  currentBet: number,
  minRaise: number,
  bigBlind: number,
): ActionValidation => {
  if (!seat.userId || seat.hasFolded || seat.isSittingOut) {
    return { valid: false, error: 'Seat cannot act' }
  }

  const toCall = currentBet - seat.betThisRound
  const stack = seat.stack

  switch (type) {
    case 'FOLD':
      return { valid: true, resolvedAmount: 0 }

    case 'CHECK':
      if (toCall > 0) {
        return { valid: false, error: 'Cannot check facing a bet' }
      }
      return { valid: true, resolvedAmount: 0 }

    case 'CALL': {
      if (toCall <= 0) {
        return { valid: false, error: 'Nothing to call' }
      }
      const callAmount = Math.min(toCall, stack)
      return { valid: true, resolvedAmount: callAmount }
    }

    case 'BET': {
      if (currentBet > 0) {
        return { valid: false, error: 'Cannot bet when there is already a bet' }
      }
      const bet = amount ?? 0
      if (bet < bigBlind) {
        return { valid: false, error: `Minimum bet is ${bigBlind}` }
      }
      if (bet > stack) {
        return { valid: false, error: 'Insufficient stack' }
      }
      return { valid: true, resolvedAmount: bet }
    }

    case 'RAISE': {
      if (currentBet <= 0) {
        return { valid: false, error: 'Cannot raise without a bet to raise' }
      }
      const raiseTotal = amount ?? 0
      const raiseBy = raiseTotal - currentBet
      if (raiseBy < minRaise && raiseTotal < stack + seat.betThisRound) {
        return {
          valid: false,
          error: `Minimum raise is ${minRaise} (total ${currentBet + minRaise})`,
        }
      }
      const chipsNeeded = raiseTotal - seat.betThisRound
      if (chipsNeeded > stack) {
        return { valid: false, error: 'Insufficient stack for raise' }
      }
      return { valid: true, resolvedAmount: chipsNeeded }
    }

    case 'ALL_IN': {
      if (stack <= 0) {
        return { valid: false, error: 'No chips to go all-in' }
      }
      return { valid: true, resolvedAmount: stack }
    }

    default:
      return { valid: false, error: 'Unknown action' }
  }
}
