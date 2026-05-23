import { createApi } from './api.js'
import { renderBoard, renderSeats, displayName } from './table-ui.js'

let VIEWER_ID = null
let api = null

let state = null
let pollTimer = null
let legal = { legal: [], toCall: 0, minRaiseTotal: 0 }

/** @type {{ gameType: string, buyInLabel: string, buyIn: number, current: number, max: number } | null} */
let waitingRoomMeta = null

const LEADERBOARD_PLAYERS = [
  { rank: 1, name: 'Player 1', chips: 150000 },
  { rank: 2, name: 'Player 2', chips: 130000 },
  { rank: 3, name: 'Lucky Cat', chips: 120000 },
  { rank: 4, name: 'Player 4', chips: 50000 },
]

const LEADERBOARD_CLUBS = [
  { rank: 1, name: 'Kitty Poker Club', chips: 520000 },
  { rank: 2, name: 'Lucky Paws', chips: 410000 },
  { rank: 3, name: 'Whisker Warriors', chips: 285000 },
  { rank: 4, name: 'Chip Chasers', chips: 190000 },
]

/** @type {'players' | 'clubs'} */
let leaderboardTab = 'players'

const DEFAULT_WAITING_PLAYERS = [
  { label: 'Player 1', username: 'Username', chips: 12000 },
  { label: 'Player 2', username: 'Username', chips: 12000 },
  { label: 'Player 3', username: 'Username', chips: 12000 },
  { label: 'Player 4', username: 'Username', chips: 12000 },
]

const playerAvatarSvg =
  '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>'

const $ = (id) => document.getElementById(id)

const showScreen = (name) => {
  document.querySelectorAll('.auth-screen, .screen').forEach((s) => {
    s.classList.remove('active')
  })
  $(`screen-${name}`)?.classList.add('active')
}

const toast = (msg) => {
  const el = $('toast')
  if (!el) return
  el.textContent = msg
  el.classList.remove('hidden')
  setTimeout(() => el.classList.add('hidden'), 2800)
}

const refresh = async () => {
  if (!api) return
  state = await api.state()
  render()

  if (state.handInProgress) {
    try {
      legal = await api.legalActions()
    } catch {
      legal = { legal: [], toCall: 0, minRaiseTotal: 0 }
    }
  }
  updateActions()
}

const render = () => {
  if (!state) return

  const seated = state.seats.filter((s) => s.userId).length
  const seatedLabel = `${seated}/${state.config.maxSeats} seated`
  const hubSeated = $('hub-seated')
  if (hubSeated) hubSeated.textContent = seatedLabel

  $('table-blinds').textContent =
    `${state.config.smallBlind} / ${state.config.bigBlind}`

  const hero = state.seats.find((s) => s.userId === VIEWER_ID)
  if (hero) {
    const chips = hero.stack.toLocaleString()
    const hubBalance = $('hub-balance')
    if (hubBalance) hubBalance.textContent = chips
    const menuBalance = $('menu-balance')
    if (menuBalance) menuBalance.textContent = chips
  }

  renderBoard(state)
  renderSeats($('seats-ring'), state, VIEWER_ID)

  const dealBtn = $('btn-start-hand')
  if (dealBtn) {
    const canDeal =
      !state.handInProgress &&
      state.seats.filter((s) => s.userId).length >= 2
    dealBtn.disabled = !canDeal
  }
}

const updateActions = () => {
  const hint = $('action-hint')
  const buttons = $('action-buttons')?.querySelectorAll('button') ?? []
  const raisePanel = $('raise-panel')

  if (!state?.handInProgress) {
    hint.textContent = state?.handInProgress
      ? 'Hand in progress'
      : 'Press Deal Hand when ready'
    buttons.forEach((b) => { b.disabled = true })
    raisePanel?.classList.add('hidden')
    return
  }

  const actionSeat = state.actionSeatIndex
  const acting = actionSeat !== null ? state.seats[actionSeat] : null
  const isMyTurn = acting?.userId === VIEWER_ID

  if (!isMyTurn) {
    hint.textContent = acting
      ? `Waiting for ${displayName(acting.userId, VIEWER_ID)}…`
      : 'Waiting…'
    buttons.forEach((b) => { b.disabled = true })
    raisePanel?.classList.add('hidden')
    return
  }

  hint.textContent = `Your turn · ${state.bettingRound ?? ''}`
  const legalSet = new Set(legal.legal ?? [])

  buttons.forEach((btn) => {
    const action = btn.dataset.action
    btn.disabled = !legalSet.has(action)
    if (action === 'CALL' && legal.toCall > 0) {
      btn.textContent = `Call ${legal.toCall}`
    } else if (action === 'CHECK') {
      btn.textContent = 'Check'
    }
  })

  const hero = state.seats.find((s) => s.userId === VIEWER_ID)
  const slider = $('raise-slider')
  if (slider && hero) {
    const min = legal.minRaiseTotal ?? state.config.bigBlind * 2
    const max = hero.stack + hero.betThisRound
    slider.min = String(min)
    slider.max = String(max)
    slider.value = String(min)
    $('raise-value').textContent = min
  }
}

const doAction = async (type, amount) => {
  try {
    state = await api.action(type, amount)
    render()
    if (state.handInProgress) {
      legal = await api.legalActions()
    }
    updateActions()
    schedulePoll()
  } catch (e) {
    toast(e.message)
  }
}

const schedulePoll = () => {
  clearInterval(pollTimer)
  pollTimer = setInterval(async () => {
    if (!state?.handInProgress) {
      clearInterval(pollTimer)
      return
    }
    const prevSeat = state.actionSeatIndex
    await refresh()
    if (state.actionSeatIndex !== prevSeat) return
  }, 800)
}

/**
 * Build title line for waiting room banner.
 * @param {string} gameType
 * @param {string} buyInLabel
 */
const waitingRoomTitle = (gameType, buyInLabel) =>
  `${gameType} -${buyInLabel} Buy-In`

/**
 * Paint waiting room UI from current meta and table state.
 */
const renderWaitingRoom = () => {
  if (!waitingRoomMeta) return

  const titleEl = $('wr-game-title')
  const countEl = $('wr-player-count')
  const listEl = $('wr-player-list')

  if (titleEl) {
    titleEl.textContent = waitingRoomTitle(
      waitingRoomMeta.gameType,
      waitingRoomMeta.buyInLabel,
    )
  }

  const seated =
    state?.seats?.filter((s) => s.userId).length ?? waitingRoomMeta.current
  const max = state?.config?.maxSeats ?? waitingRoomMeta.max
  const current = Math.max(seated, waitingRoomMeta.current)

  if (countEl) countEl.textContent = `${current}/${max} Players`

  if (!listEl) return

  const seatedPlayers = (state?.seats ?? [])
    .map((seat, index) => ({ seat, index }))
    .filter(({ seat }) => seat.userId)
    .map(({ seat, index }) => ({
      label: `Player ${index + 1}`,
      username: displayName(seat.userId, VIEWER_ID),
      chips: seat.stack,
    }))

  const rows =
    seatedPlayers.length >= 2
      ? seatedPlayers
      : DEFAULT_WAITING_PLAYERS.slice(0, current)

  listEl.innerHTML = rows
    .map(
      (p) => `
    <div class="wr-player-row" role="listitem">
      <div class="wr-player-avatar">${playerAvatarSvg}</div>
      <div class="wr-player-info">
        <span class="wr-player-label">${p.label}</span>
        <span class="wr-player-username">${p.username}</span>
      </div>
      <span class="wr-player-chips">Chips ${p.chips.toLocaleString()}</span>
    </div>`,
    )
    .join('')
}

/**
 * Render leaderboard rows for the active tab.
 * @param {'players' | 'clubs'} tab
 */
const renderLeaderboard = (tab) => {
  leaderboardTab = tab
  const listEl = $('lb-list')
  const tabPlayers = $('btn-lb-tab-players')
  const tabClubs = $('btn-lb-tab-clubs')
  if (!listEl) return

  const rows = tab === 'clubs' ? LEADERBOARD_CLUBS : LEADERBOARD_PLAYERS

  listEl.innerHTML = rows
    .map(
      (row) => `
    <li class="lb-row">
      <span class="lb-row-name">${row.rank}. ${row.name}</span>
      <span class="lb-row-chips">${row.chips.toLocaleString()} Chips</span>
    </li>`,
    )
    .join('')

  if (tabPlayers) {
    tabPlayers.classList.toggle('is-active', tab === 'players')
    tabPlayers.setAttribute('aria-selected', tab === 'players' ? 'true' : 'false')
  }
  if (tabClubs) {
    tabClubs.classList.toggle('is-active', tab === 'clubs')
    tabClubs.setAttribute('aria-selected', tab === 'clubs' ? 'true' : 'false')
  }
}

const goToLeaderboard = () => {
  renderLeaderboard('players')
  showScreen('leaderboard')
}

const setupButtonGlow = (selector) => {
  document.querySelectorAll(selector).forEach((btn) => {
    const on = () => btn.classList.add('is-glow')
    const off = () => btn.classList.remove('is-glow')
    btn.addEventListener('pointerdown', on)
    btn.addEventListener('pointerup', off)
    btn.addEventListener('pointerleave', off)
    btn.addEventListener('pointercancel', off)
  })
}

const bindGameUi = () => {
  setupButtonGlow('.home-menu-btn')
  setupButtonGlow('.hub-action-btn')

  const goToTable = async () => {
    try {
      showScreen('table')
      await refresh()
      toast('Welcome! You are seated at the bottom.')
    } catch (e) {
      toast(e.message)
    }
  }

  const leaveWaitingRoom = () => {
    showScreen('hub')
    refresh()
  }

  /**
   * Join table server-side and show pre-game waiting room.
   * @param {{ gameType: string, buyInLabel: string, buyIn: number, current: number, max: number }} meta
   */
  const enterWaitingRoom = async (meta) => {
    waitingRoomMeta = meta
    try {
      await api.setupDemo()
      await refresh()
      renderWaitingRoom()
      showScreen('waiting-room')
    } catch (e) {
      toast(e.message)
    }
  }

  $('btn-home-play')?.addEventListener('click', () => {
    showScreen('hub')
    refresh()
  })

  $('btn-hub-quick-play')?.addEventListener('click', () => {
    enterWaitingRoom({
      gameType: "Texas Hold'em",
      buyInLabel: '10k',
      buyIn: 10000,
      current: 4,
      max: 6,
    })
  })

  document.querySelectorAll('.hub-table-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const el = /** @type {HTMLButtonElement} */ (btn)
      enterWaitingRoom({
        gameType: el.dataset.gameType ?? "Texas Hold'em",
        buyInLabel: el.dataset.buyInLabel ?? '10k',
        buyIn: Number(el.dataset.buyIn ?? 10000),
        current: Number(el.dataset.current ?? 4),
        max: Number(el.dataset.max ?? 6),
      })
    })
  })

  const goToCreateGame = () => showScreen('create-game')

  const leaveCreateGame = () => {
    showScreen('hub')
    refresh()
  }

  $('btn-hub-create-game')?.addEventListener('click', goToCreateGame)

  $('btn-create-back')?.addEventListener('click', leaveCreateGame)
  $('btn-create-close')?.addEventListener('click', leaveCreateGame)
  $('btn-create-cancel')?.addEventListener('click', leaveCreateGame)

  $('btn-create-notify')?.addEventListener('click', () => {
    toast('Notifications coming soon')
  })

  $('btn-create-chat')?.addEventListener('click', () => {
    toast('Chat coming soon')
  })

  $('btn-create-submit')?.addEventListener('click', async () => {
    const privacy =
      document.querySelector('input[name="privacy"]:checked')?.value ?? 'public'
    const buyIn = Number($('create-buy-in')?.value ?? 10000)
    const buyInLabel =
      buyIn >= 1000 ? `${buyIn / 1000}k` : String(buyIn)
    const max = Number($('create-max-players')?.value ?? 6)
    const gameType =
      $('create-game-type')?.value === 'plo'
        ? 'Pot Limit Omaha'
        : "Texas Hold'em"
    try {
      await enterWaitingRoom({
        gameType,
        buyInLabel,
        buyIn,
        current: 4,
        max,
      })
      toast(
        privacy === 'private'
          ? 'Private table created — waiting for players'
          : 'Public table created — waiting for players',
      )
    } catch (e) {
      toast(e.message)
    }
  })

  $('btn-nav-home')?.addEventListener('click', () => showScreen('lobby'))
  $('btn-nav-lobby')?.addEventListener('click', leaveCreateGame)
  $('btn-nav-leaderboard')?.addEventListener('click', goToLeaderboard)

  $('btn-hub-join-game')?.addEventListener('click', () => {
    toast('Join Game coming soon')
  })

  $('btn-home-settings')?.addEventListener('click', () => {
    toast('Settings coming soon')
  })

  $('btn-wr-back')?.addEventListener('click', leaveWaitingRoom)
  $('btn-wr-close')?.addEventListener('click', leaveWaitingRoom)
  $('btn-wr-notify')?.addEventListener('click', () => {
    toast('Notifications coming soon')
  })
  $('btn-wr-header-chat')?.addEventListener('click', () => {
    toast('Chat coming soon')
  })
  $('btn-wr-chat-window')?.addEventListener('click', goToTable)
  $('btn-wr-nav-home')?.addEventListener('click', () => showScreen('lobby'))
  $('btn-wr-nav-lobby')?.addEventListener('click', leaveWaitingRoom)
  $('btn-wr-nav-leaderboard')?.addEventListener('click', goToLeaderboard)

  $('btn-lb-back')?.addEventListener('click', () => showScreen('hub'))
  $('btn-lb-close')?.addEventListener('click', () => showScreen('hub'))
  $('btn-lb-notify')?.addEventListener('click', () => {
    toast('Notifications coming soon')
  })
  $('btn-lb-chat')?.addEventListener('click', () => {
    toast('Chat coming soon')
  })
  $('btn-lb-tab-players')?.addEventListener('click', () => renderLeaderboard('players'))
  $('btn-lb-tab-clubs')?.addEventListener('click', () => renderLeaderboard('clubs'))
  $('btn-lb-nav-home')?.addEventListener('click', () => showScreen('lobby'))
  $('btn-lb-nav-lobby')?.addEventListener('click', () => showScreen('hub'))
  $('btn-lb-nav-leaderboard')?.addEventListener('click', goToLeaderboard)

  $('btn-back')?.addEventListener('click', () => {
    clearInterval(pollTimer)
    if (waitingRoomMeta) {
      renderWaitingRoom()
      showScreen('waiting-room')
    } else {
      showScreen('hub')
    }
    refresh()
  })

  $('btn-start-hand')?.addEventListener('click', async () => {
    try {
      state = await api.startHand()
      render()
      legal = await api.legalActions()
      updateActions()
      schedulePoll()
    } catch (e) {
      toast(e.message)
    }
  })

  $('action-buttons')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('button')
    if (!btn || btn.disabled) return
    const action = btn.dataset.action
    if (action === 'RAISE') {
      $('raise-panel')?.classList.remove('hidden')
      return
    }
    await doAction(action)
  })

  $('btn-confirm-raise')?.addEventListener('click', async () => {
    const total = Number($('raise-slider')?.value ?? 0)
    $('raise-panel')?.classList.add('hidden')
    const useBet = state.currentBet === 0
    await doAction(useBet ? 'BET' : 'RAISE', total)
  })

  $('raise-slider')?.addEventListener('input', (e) => {
    $('raise-value').textContent = e.target.value
  })
}

const startGame = async (userId) => {
  VIEWER_ID = userId
  api = createApi(VIEWER_ID)
  bindGameUi()
  try {
    await api.setupDemo()
    await refresh()
  } catch {
    toast('Table ready — tap Play Now when you are set.')
  }
}

window.addEventListener('auth:ready', (e) => {
  const { userId } = e.detail
  if (userId) startGame(userId)
})

window.addEventListener('auth:logout', () => {
  clearInterval(pollTimer)
  VIEWER_ID = null
  api = null
  state = null
})
