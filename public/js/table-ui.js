import { renderCard, renderCards } from './cards.js'

const BOT_NAMES = {
  'bot-luna': 'Luna',
  'bot-mittens': 'Mittens',
  'bot-shadow': 'Shadow',
  'bot-whiskers': 'Whiskers',
  'bot-cleo': 'Cleo',
  'bot-felix': 'Felix',
  'bot-nala': 'Nala',
}

/**
 * Display name for a seat user id.
 * @param {string | null} userId
 * @param {string} viewerId
 */
export const displayName = (userId, viewerId) => {
  if (!userId) return 'Empty'
  if (userId === viewerId) return 'You'
  if (BOT_NAMES[userId]) return BOT_NAMES[userId]
  if (userId.startsWith('bot-')) return userId.replace('bot-', '').replace(/^\w/, (c) => c.toUpperCase())
  return userId
}

/**
 * Avatar emoji for player.
 * @param {string | null} userId
 */
const avatarEmoji = (userId) => {
  if (!userId) return '+'
  if (userId.startsWith('bot-')) return '🐱'
  return '😺'
}

/**
 * Render all seats around the table.
 * @param {HTMLElement} ring
 * @param {object} state - Table state from API
 * @param {string} viewerId
 */
export const renderSeats = (ring, state, viewerId) => {
  ring.innerHTML = ''
  const max = state.config.maxSeats

  for (let i = 0; i < max; i++) {
    const seat = state.seats[i] ?? { seatIndex: i, userId: null, stack: 0 }
    const el = document.createElement('div')
    el.className = 'seat'
    el.dataset.seat = String(i)

    if (!seat.userId) el.classList.add('empty')
    if (state.actionSeatIndex === i) el.classList.add('acting')
    if (seat.userId === viewerId) el.classList.add('hero-seat')

    const avatar = document.createElement('div')
    avatar.className = 'seat-avatar'
    if (seat.userId === viewerId) avatar.classList.add('hero')
    avatar.textContent = avatarEmoji(seat.userId)

    if (state.dealerSeatIndex === i) {
      const d = document.createElement('span')
      d.className = 'dealer-btn'
      d.textContent = 'D'
      avatar.appendChild(d)
    }

    const name = document.createElement('div')
    name.className = 'seat-name'
    name.textContent = displayName(seat.userId, viewerId)

    const stack = document.createElement('div')
    stack.className = 'seat-stack'
    stack.textContent = seat.userId ? String(seat.stack) : '—'

    const cards = document.createElement('div')
    cards.className = 'seat-cards'
    if (seat.holeCards?.length) {
      seat.holeCards.forEach((c) => cards.appendChild(renderCard(c)))
    }

    if (seat.betThisRound > 0) {
      const bet = document.createElement('div')
      bet.className = 'seat-bet'
      bet.textContent = String(seat.betThisRound)
      bet.style.top = '-8px'
      el.appendChild(bet)
    }

    el.append(avatar, name, stack, cards)
    ring.appendChild(el)
  }
}

/**
 * Update board and pot from state.
 * @param {object} state
 */
export const renderBoard = (state) => {
  const boardEl = document.getElementById('board')
  const potEl = document.getElementById('pot-total')
  if (boardEl) renderCards(boardEl, state.board ?? [])
  if (potEl) potEl.textContent = String(state.potTotal ?? 0)
}
