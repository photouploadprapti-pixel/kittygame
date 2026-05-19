import { createApi } from './api.js'
import { renderBoard, renderSeats, displayName } from './table-ui.js'

let VIEWER_ID = null
let api = null

let state = null
let pollTimer = null
let legal = { legal: [], toCall: 0, minRaiseTotal: 0 }

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
  const lobbySeated = $('lobby-seated')
  if (lobbySeated) lobbySeated.textContent = `${seated}/${state.config.maxSeats} seated`

  $('table-blinds').textContent =
    `${state.config.smallBlind} / ${state.config.bigBlind}`

  const hero = state.seats.find((s) => s.userId === VIEWER_ID)
  if (hero) $('lobby-balance').textContent = hero.stack.toLocaleString()

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

const setupHomeMenuGlow = () => {
  document.querySelectorAll('.home-menu-btn').forEach((btn) => {
    const on = () => btn.classList.add('is-glow')
    const off = () => btn.classList.remove('is-glow')
    btn.addEventListener('pointerdown', on)
    btn.addEventListener('pointerup', off)
    btn.addEventListener('pointerleave', off)
    btn.addEventListener('pointercancel', off)
  })
}

const bindGameUi = () => {
  setupHomeMenuGlow()

  const goToTable = async () => {
    try {
      await api.setupDemo()
      showScreen('table')
      await refresh()
      toast('Welcome! You are seated at the bottom.')
    } catch (e) {
      toast(e.message)
    }
  }

  $('btn-home-play')?.addEventListener('click', goToTable)

  $('btn-home-settings')?.addEventListener('click', () => {
    toast('Settings coming soon')
  })

  $('btn-back')?.addEventListener('click', () => {
    clearInterval(pollTimer)
    showScreen('lobby')
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
