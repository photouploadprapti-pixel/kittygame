import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { handleApiRequest } from './api-handler.js'

const PORT = Number(process.env.PORT) || 3001
const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '../../public')

/** Load .env when not started with --env-file (e.g. production start). */
const loadEnvFile = (): void => {
  if (process.env.SUPABASE_URL) return
  try {
    const envPath = join(fileURLToPath(new URL('.', import.meta.url)), '../../.env')
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
  } catch {
    /* .env optional */
  }
}

loadEnvFile()

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
}

const serveStatic = async (
  path: string,
): Promise<{ body: Buffer; type: string } | null> => {
  const safe = path === '/' ? '/index.html' : path
  const filePath = join(ROOT, safe.replace(/^\//, ''))
  if (!filePath.startsWith(ROOT)) return null
  try {
    const body = await readFile(filePath)
    const ext = extname(filePath)
    return { body, type: MIME[ext] ?? 'application/octet-stream' }
  } catch {
    return null
  }
}

const readJson = async (
  req: import('node:http').IncomingMessage,
): Promise<Record<string, unknown>> => {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(chunk as Buffer)
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
}

const json = (
  res: import('node:http').ServerResponse,
  status: number,
  data: unknown,
): void => {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)
  const method = req.method ?? 'GET'
  const viewerId = url.searchParams.get('viewerId')

  try {
    const body =
      method === 'GET' || method === 'HEAD' ? {} : await readJson(req)

    const apiResult = await handleApiRequest({
      method,
      pathname: url.pathname,
      viewerId,
      body,
    })

    if (apiResult) {
      json(res, apiResult.status, apiResult.body)
      return
    }

    const file = await serveStatic(url.pathname)
    if (file) {
      res.writeHead(200, { 'Content-Type': file.type })
      res.end(file.body)
      return
    }

    json(res, 404, { error: 'Not found' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error'
    json(res, 500, { error: message })
  }
})

server.listen(PORT, () => {
  console.log(`Kittys Poker Club → http://localhost:${PORT}`)
})
