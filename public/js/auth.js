import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

let client = null
let configPromise = null

/**
 * Load public Supabase config from the game server.
 * @returns {Promise<{ url: string, anonKey: string }>}
 */
const loadConfig = async () => {
  if (configPromise) return configPromise
  configPromise = (async () => {
    const fromStatic = await fetch('/config.json')
    if (fromStatic.ok) {
      const data = await fromStatic.json()
      if (data.supabaseUrl && data.supabaseAnonKey) {
        return { url: data.supabaseUrl, anonKey: data.supabaseAnonKey }
      }
    }

    const res = await fetch('/api/config')
    const data = await res.json()
    if (!res.ok || !data.supabaseUrl || !data.supabaseAnonKey) {
      throw new Error(data.error ?? 'Supabase is not configured on the server')
    }
    return { url: data.supabaseUrl, anonKey: data.supabaseAnonKey }
  })()
  return configPromise
}

/**
 * Get or create the Supabase browser client.
 * @returns {Promise<import('@supabase/supabase-js').SupabaseClient>}
 */
export const getSupabase = async () => {
  if (client) return client
  const { url, anonKey } = await loadConfig()
  client = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
  return client
}

/**
 * Sign up with email, password, and display name metadata.
 * @param {{ email: string, password: string, username: string }} params
 */
export const signUp = async ({ email, password, username }) => {
  const supabase = await getSupabase()
  return supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: username, username },
      emailRedirectTo: 'https://kittygamepro.netlify.app/',
    },
  })
}

/**
 * Sign in with email and password.
 * @param {{ email: string, password: string }} params
 */
export const signIn = async ({ email, password }) => {
  const supabase = await getSupabase()
  return supabase.auth.signInWithPassword({ email, password })
}

/**
 * Send password reset email.
 * @param {string} email
 */
export const resetPassword = async (email) => {
  const supabase = await getSupabase()
  const redirectTo = `${window.location.origin}${window.location.pathname}`
  return supabase.auth.resetPasswordForEmail(email, { redirectTo })
}

/**
 * Verify email OTP via Supabase (Auth → Providers → Email → enable Email OTP).
 * Set OTP length to 4 in Supabase if using the 4-box verify UI.
 * @param {{ email: string, token: string }} params
 */
export const verifyEmailOtp = async ({ email, token }) => {
  const supabase = await getSupabase()
  return supabase.auth.verifyOtp({
    email,
    token,
    type: 'signup',
  })
}

/**
 * Resend signup / email verification OTP.
 * @param {string} email
 */
export const resendSignupOtp = async (email) => {
  const supabase = await getSupabase()
  return supabase.auth.resend({
    type: 'signup',
    email,
  })
}

/**
 * Sign out the current user.
 */
export const signOut = async () => {
  const supabase = await getSupabase()
  return supabase.auth.signOut()
}

/**
 * Get the active session, if any.
 */
export const getSession = async () => {
  const supabase = await getSupabase()
  const { data } = await supabase.auth.getSession()
  return data.session
}
