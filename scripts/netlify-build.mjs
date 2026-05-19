import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')

execSync('npm run build', { cwd: root, stdio: 'inherit' })
execSync('node scripts/prepare-deploy.mjs', { cwd: root, stdio: 'inherit' })
