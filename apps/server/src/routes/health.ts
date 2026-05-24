import type { FastifyInstance } from 'fastify'
import { APP_VERSION } from '../services/storage.js'
import { ok } from '../types.js'

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () =>
    ok({ status: 'ok', version: APP_VERSION, ts: new Date().toISOString() })
  )
}
