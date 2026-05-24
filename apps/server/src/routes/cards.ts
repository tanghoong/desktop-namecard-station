import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import type { MultipartFile } from '@fastify/multipart'
import {
  createCard, cardExists, saveImage, completeCard,
  listCards, getCard, deleteCard, updateCard,
  isValidCardId, cardsDir,
} from '../services/storage.js'
import { ok, err } from '../types.js'

// ── helpers ──────────────────────────────────────────────────────────────────

function badId(reply: FastifyReply) {
  reply.code(400).send(err('INVALID_CARD_ID', 'Invalid card ID format'))
}

async function requireCard(cardId: string, reply: FastifyReply): Promise<boolean> {
  if (!isValidCardId(cardId)) { badId(reply); return false }
  if (!await cardExists(cardId)) {
    reply.code(404).send(err('CARD_NOT_FOUND', 'Card not found'))
    return false
  }
  return true
}

async function readMultipartImage(req: FastifyRequest): Promise<{ buffer: Buffer; mime: string } | null> {
  const data = await req.file()
  if (!data) return null
  const chunks: Buffer[] = []
  for await (const chunk of data.file) chunks.push(chunk)
  return { buffer: Buffer.concat(chunks), mime: data.mimetype }
}

// ── routes ───────────────────────────────────────────────────────────────────

export async function cardRoutes(app: FastifyInstance): Promise<void> {

  // POST /api/cards/start
  app.post('/api/cards/start', async (req, reply) => {
    const ua     = (req.headers['user-agent'] ?? '') as string
    const sw     = Number((req.headers['x-screen-width']  ?? '0')) || 0
    const sh     = Number((req.headers['x-screen-height'] ?? '0')) || 0
    const result = await createCard(ua, sw, sh)
    reply.code(201).send(ok(result))
  })

  // POST /api/cards/:cardId/front
  app.post('/api/cards/:cardId/front', async (req, reply) => {
    const { cardId } = req.params as { cardId: string }
    if (!await requireCard(cardId, reply)) return

    const img = await readMultipartImage(req)
    if (!img) return reply.code(400).send(err('NO_IMAGE', 'No image file in request'))

    await saveImage(cardId, 'front', img.buffer)
    reply.send(ok({ cardId, side: 'front' }))
  })

  // POST /api/cards/:cardId/back
  app.post('/api/cards/:cardId/back', async (req, reply) => {
    const { cardId } = req.params as { cardId: string }
    if (!await requireCard(cardId, reply)) return

    const img = await readMultipartImage(req)
    if (!img) return reply.code(400).send(err('NO_IMAGE', 'No image file in request'))

    await saveImage(cardId, 'back', img.buffer)
    reply.send(ok({ cardId, side: 'back' }))
  })

  // POST /api/cards/:cardId/complete
  app.post('/api/cards/:cardId/complete', async (req, reply) => {
    const { cardId } = req.params as { cardId: string }
    if (!await requireCard(cardId, reply)) return

    const status = await completeCard(cardId)
    reply.send(ok({ cardId, status }))
  })

  // GET /api/cards
  app.get('/api/cards', async (req, reply) => {
    const q = req.query as Record<string, string>
    const result = await listCards({
      captureStatus: q.capture_status,
      sort:          q.sort,
      limit:         q.limit  ? Number(q.limit)  : undefined,
      offset:        q.offset ? Number(q.offset) : undefined,
    })
    reply.send(ok(result))
  })

  // GET /api/cards/:cardId
  app.get('/api/cards/:cardId', async (req, reply) => {
    const { cardId } = req.params as { cardId: string }
    if (!await requireCard(cardId, reply)) return

    const data = await getCard(cardId)
    reply.send(ok(data))
  })

  // DELETE /api/cards/:cardId
  app.delete('/api/cards/:cardId', async (req, reply) => {
    const { cardId } = req.params as { cardId: string }
    if (!isValidCardId(cardId)) return badId(reply)
    if (!await cardExists(cardId)) return reply.code(404).send(err('CARD_NOT_FOUND', 'Card not found'))

    await deleteCard(cardId)
    reply.code(204).send()
  })

  // PATCH /api/cards/:cardId
  app.patch('/api/cards/:cardId', async (req, reply) => {
    const { cardId } = req.params as { cardId: string }
    if (!await requireCard(cardId, reply)) return

    const body = req.body as { tags?: string[]; notes?: string }
    const metadata = await updateCard(cardId, {
      tags:  Array.isArray(body?.tags)              ? body.tags  : undefined,
      notes: typeof body?.notes === 'string'        ? body.notes : undefined,
    })
    reply.send(ok(metadata))
  })
}
