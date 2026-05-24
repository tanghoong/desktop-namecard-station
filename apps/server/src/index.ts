import Fastify        from 'fastify'
import cors           from '@fastify/cors'
import multipart      from '@fastify/multipart'
import staticFiles    from '@fastify/static'
import path           from 'path'
import { fileURLToPath } from 'url'
import { ensureDataDirs, cardsDir } from './services/storage.js'
import { healthRoutes } from './routes/health.js'
import { cardRoutes }   from './routes/cards.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const PORT = Number(process.env.PORT ?? 3000)
const HOST = process.env.HOST ?? '0.0.0.0'

// Resolve web dist: production layout has it at ../../apps/web/dist relative
// to this compiled file (apps/server/dist/index.js)
const WEB_DIST = process.env.WEB_DIST
  ?? path.resolve(__dirname, '..', '..', '..', 'apps', 'web', 'dist')

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } })

await app.register(cors, { origin: true })
await app.register(multipart, {
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB max per image
})

// Create data dirs before registering static plugin (plugin checks dir exists)
await ensureDataDirs()

// First static registration adds reply.sendFile — must NOT have decorateReply:false
await app.register(staticFiles, {
  root:   cardsDir(),
  prefix: '/cards/',
})

// API routes
await app.register(healthRoutes)
await app.register(cardRoutes)

// Serve web SPA — second registration reuses decoration
try {
  await app.register(staticFiles, {
    root:          WEB_DIST,
    prefix:        '/',
    decorateReply: false,
  })
  app.setNotFoundHandler((_req, reply) => {
    reply.sendFile('index.html', WEB_DIST)
  })
} catch {
  // web dist absent in dev — Vite serves the frontend instead
}

await app.listen({ port: PORT, host: HOST })
console.log(`Namecard Station listening on http://${HOST}:${PORT}`)
