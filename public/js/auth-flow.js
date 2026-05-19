import {
  getSession,
  getSupabase,
  resendSignupOtp,
  resetPassword,
  signIn,
  signOut,
  signUp,
  verifyEmailOtp,
} from './auth.js'

const SPLASH_MS = 2200
const LOADING_MS = 2400
const RESEND_SECONDS = 45
/** Match UI boxes; set Supabase Auth email OTP length to 4 in project settings */
const OTP_DIGITS = 4

let pendingVerifyEmail = ''
let resendInterval = null

const $ = (id) => document.getElementById(id)

const showAuthScreen = (name) => {
  document.querySelectorAll('.auth-screen, .screen').forEach((el) => {
    el.classList.remove('active')
  })
  const el = $(`screen-${name}`)
  el?.classList.add('active')
}

const showError = (id, message) => {
  const el = $(id)
  if (!el) return
  if (message) {
    el.textContent = message
    el.classList.add('visible')
  } else {
    el.textContent = ''
    el.classList.remove('visible')
  }
}

const formatTimer = (seconds) => {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

const startResendTimer = () => {
  const btn = $('btn-resend-code')
  const label = $('resend-timer')
  if (!btn || !label) return

  clearInterval(resendInterval)
  let left = RESEND_SECONDS
  btn.disabled = true
  label.textContent = formatTimer(left)

  resendInterval = setInterval(() => {
    left -= 1
    label.textContent = formatTimer(left)
    if (left <= 0) {
      clearInterval(resendInterval)
      btn.disabled = false
      label.textContent = '0:00'
    }
  }, 1000)
}

const runLoadingBar = () =>
  new Promise((resolve) => {
    const bar = $('loading-progress')
    const track = bar?.closest('[role="progressbar"]')
    if (!bar) {
      resolve()
      return
    }
    bar.style.width = '0%'
    const start = performance.now()
    const tick = (now) => {
      const t = Math.min(1, (now - start) / LOADING_MS)
      const pct = Math.round(t * 100)
      bar.style.width = `${pct}%`
      if (track) track.setAttribute('aria-valuenow', String(pct))
      if (t < 1) {
        requestAnimationFrame(tick)
      } else {
        resolve()
      }
    }
    requestAnimationFrame(tick)
  })

const emitAuthReady = (session) => {
  const userId = session?.user?.id ?? null
  const displayName =
    session?.user?.user_metadata?.display_name ??
    session?.user?.user_metadata?.username ??
    session?.user?.email?.split('@')[0] ??
    'Player'

  window.dispatchEvent(
    new CustomEvent('auth:ready', {
      detail: { userId, session, displayName },
    }),
  )
}

const enterLobby = async (session) => {
  emitAuthReady(session)
  showAuthScreen('lobby')
}

const setupOtpInputs = () => {
  const inputs = [...document.querySelectorAll('.auth-otp-digit')]
  inputs.forEach((input, idx) => {
    input.addEventListener('input', () => {
      input.value = input.value.replace(/\D/g, '').slice(-1)
      if (input.value && inputs[idx + 1]) inputs[idx + 1].focus()
    })
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !input.value && inputs[idx - 1]) {
        inputs[idx - 1].focus()
      }
    })
    input.addEventListener('paste', (e) => {
      e.preventDefault()
      const digits = (e.clipboardData?.getData('text') ?? '')
        .replace(/\D/g, '')
        .slice(0, OTP_DIGITS)
      digits.split('').forEach((d, i) => {
        if (inputs[i]) inputs[i].value = d
      })
      if (digits.length === OTP_DIGITS) inputs[OTP_DIGITS - 1]?.focus()
    })
  })
}

const getOtpCode = () =>
  [...document.querySelectorAll('.auth-otp-digit')]
    .map((el) => el.value)
    .join('')

const clearOtp = () => {
  document.querySelectorAll('.auth-otp-digit').forEach((el) => {
    el.value = ''
  })
}

const openVerifyScreen = (email) => {
  pendingVerifyEmail = email
  const display = $('verify-email-display')
  if (display) display.textContent = email
  clearOtp()
  showError('verify-error', '')
  showAuthScreen('verify')
  startResendTimer()
  document.querySelector('.auth-otp-digit')?.focus()
}

const isEmailNotConfirmedError = (err) => {
  const msg = (err?.message ?? '').toLowerCase()
  return msg.includes('email not confirmed') || msg.includes('not confirmed')
}

const boot = async () => {
  setupOtpInputs()

  await new Promise((r) => setTimeout(r, SPLASH_MS))
  showAuthScreen('loading')
  await runLoadingBar()

  try {
    await getSupabase()
    const session = await getSession()
    if (session?.user) {
      await enterLobby(session)
      return
    }
    showAuthScreen('login')
  } catch (err) {
    showAuthScreen('login')
    showError(
      'login-error',
      err instanceof Error ? err.message : 'Could not connect to authentication',
    )
  }
}

$('btn-go-signup')?.addEventListener('click', () => {
  showError('signup-error', '')
  showAuthScreen('signup')
})

$('btn-go-login')?.addEventListener('click', () => {
  showError('login-error', '')
  showAuthScreen('login')
})

$('btn-forgot-password')?.addEventListener('click', () => {
  showError('reset-error', '')
  const email = $('login-email')?.value?.trim()
  if (email) $('reset-email').value = email
  showAuthScreen('reset')
})

$('btn-reset-back-login')?.addEventListener('click', () => showAuthScreen('login'))
$('btn-verify-back-login')?.addEventListener('click', () => showAuthScreen('login'))

$('form-login')?.addEventListener('submit', async (e) => {
  e.preventDefault()
  showError('login-error', '')
  const email = $('login-email')?.value?.trim()
  const password = $('login-password')?.value ?? ''
  const btn = $('btn-login')
  if (btn) btn.disabled = true

  try {
    const { data, error } = await signIn({ email, password })
    if (error) throw error
    if (!data.session) {
      if (email) openVerifyScreen(email)
      else showError('login-error', 'Verify your email before logging in.')
      return
    }
    await enterLobby(data.session)
  } catch (err) {
    if (email && isEmailNotConfirmedError(err)) {
      openVerifyScreen(email)
      return
    }
    showError('login-error', err?.message ?? 'Login failed')
  } finally {
    if (btn) btn.disabled = false
  }
})

$('form-signup')?.addEventListener('submit', async (e) => {
  e.preventDefault()
  showError('signup-error', '')

  const username = $('signup-username')?.value?.trim()
  const email = $('signup-email')?.value?.trim()
  const password = $('signup-password')?.value ?? ''
  const confirm = $('signup-password-confirm')?.value ?? ''

  if (password !== confirm) {
    showError('signup-error', 'Passwords do not match')
    return
  }
  if (!$('signup-terms')?.checked) {
    showError('signup-error', 'Please accept the terms of service')
    return
  }

  const btn = $('btn-signup')
  if (btn) btn.disabled = true

  try {
    const { data, error } = await signUp({ email, password, username })
    if (error) throw error

    if (data.session) {
      await enterLobby(data.session)
      return
    }

    openVerifyScreen(email)
  } catch (err) {
    showError('signup-error', err?.message ?? 'Sign up failed')
  } finally {
    if (btn) btn.disabled = false
  }
})

$('form-verify')?.addEventListener('submit', async (e) => {
  e.preventDefault()
  showError('verify-error', '')
  const token = getOtpCode()
  if (token.length < OTP_DIGITS) {
    showError('verify-error', `Enter the full ${OTP_DIGITS}-digit verification code`)
    return
  }

  const btn = $('btn-verify')
  if (btn) btn.disabled = true

  try {
    const { data, error } = await verifyEmailOtp({
      email: pendingVerifyEmail,
      token,
    })
    if (error) throw error
    await enterLobby(data.session)
  } catch (err) {
    showError('verify-error', err?.message ?? 'Invalid or expired code')
  } finally {
    if (btn) btn.disabled = false
  }
})

$('btn-resend-code')?.addEventListener('click', async () => {
  if (!pendingVerifyEmail) return
  showError('verify-error', '')
  try {
    const { error } = await resendSignupOtp(pendingVerifyEmail)
    if (error) throw error
    clearOtp()
    startResendTimer()
  } catch (err) {
    showError('verify-error', err?.message ?? 'Could not resend code')
  }
})

$('form-reset')?.addEventListener('submit', async (e) => {
  e.preventDefault()
  showError('reset-error', '')
  const email = $('reset-email')?.value?.trim()
  const btn = $('btn-reset')
  if (btn) btn.disabled = true

  try {
    const { error } = await resetPassword(email)
    if (error) throw error
    const el = $('reset-error')
    if (el) {
      el.style.color = '#7dffb2'
      el.textContent = 'Check your inbox for a password reset link.'
      el.classList.add('visible')
    }
  } catch (err) {
    showError('reset-error', err?.message ?? 'Could not send reset email')
  } finally {
    if (btn) btn.disabled = false
  }
})

const logout = async () => {
  await signOut()
  pendingVerifyEmail = ''
  showAuthScreen('login')
  window.dispatchEvent(new CustomEvent('auth:logout'))
}

$('btn-logout')?.addEventListener('click', logout)
$('btn-home-exit')?.addEventListener('click', logout)

boot()
