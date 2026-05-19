/**
 * Builds a Netlify-ready folder: deploy/
 * Upload the *contents* of deploy/ to Netlify (drag-and-drop or CLI).
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const publicDir = join(root, 'public')
const deployDir = join(root, 'deploy')

const loadEnv = () => {
  const envPath = join(root, '.env')
  if (!existsSync(envPath)) return
  const raw = readFileSync(envPath, 'utf8')
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = val
  }
}

loadEnv()

rmSync(deployDir, { recursive: true, force: true })
mkdirSync(deployDir, { recursive: true })

cpSync(publicDir, deployDir, { recursive: true })

const supabaseUrl = process.env.SUPABASE_URL ?? ''
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? ''

writeFileSync(
  join(deployDir, 'config.json'),
  `${JSON.stringify({ supabaseUrl, supabaseAnonKey }, null, 2)}\n`,
  'utf8',
)

writeFileSync(
  join(deployDir, '_headers'),
  `/*
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
`,
  'utf8',
)

console.log('')
console.log('Netlify deploy folder ready: deploy/')
console.log('')
console.log('Next steps:')
console.log('  1. Zip the CONTENTS inside deploy/ (index.html must be at zip root)')
console.log('  2. Netlify → Deploys → Drag and drop that zip')
console.log('  OR: npx netlify deploy --prod --dir=deploy')
console.log('')
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Warning: SUPABASE_URL / SUPABASE_ANON_KEY not set — auth will fail until config.json is filled.')
}
