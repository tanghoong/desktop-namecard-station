import fs   from 'fs/promises'
import path  from 'path'
import { customAlphabet } from 'nanoid'
import type { CardMetadata, CardStatus, CardSummary } from '../types.js'

const hex4 = customAlphabet('0123456789abcdef', 4)

const DATA_DIR  = process.env.DATA_DIR ?? path.join(process.cwd(), 'data')
const CARDS_DIR = path.join(DATA_DIR, 'cards')

export const APP_VERSION = '0.1.0'

const CARD_ID_RE = /^\d{4}-\d{2}-\d{2}_\d{6}_[0-9a-f]{4}$/

// ── Paths ────────────────────────────────────────────────────────────────────

export function cardsDir(): string { return CARDS_DIR }

function cardDir(cardId: string): string {
  return path.join(CARDS_DIR, cardId)
}

export function isValidCardId(id: string): boolean {
  return CARD_ID_RE.test(id)
}

// ── Bootstrap ────────────────────────────────────────────────────────────────

export async function ensureDataDirs(): Promise<void> {
  await fs.mkdir(CARDS_DIR, { recursive: true })
}

// ── ID generation ────────────────────────────────────────────────────────────

function generateCardId(): string {
  const now   = new Date()
  const date  = now.toLocaleDateString('en-CA')             // YYYY-MM-DD
  const time  = now.toTimeString().slice(0, 8).replace(/:/g, '') // HHmmss
  return `${date}_${time}_${hex4()}`
}

function now(): string {
  return new Date().toISOString()
}

// ── Create card ──────────────────────────────────────────────────────────────

export async function createCard(userAgent = '', screenWidth = 0, screenHeight = 0): Promise<{ cardId: string }> {
  const cardId    = generateCardId()
  const dir       = cardDir(cardId)
  const createdAt = now()

  await fs.mkdir(dir, { recursive: true })

  const metadata: CardMetadata = {
    id:           cardId,
    created_at:   createdAt,
    updated_at:   createdAt,
    source:       'mobile-web-camera',
    capture_mode: 'auto-front-back',
    app_version:  APP_VERSION,
    device:       { user_agent: userAgent, screen_width: screenWidth, screen_height: screenHeight },
    files:        {},
    tags:         [],
    notes:        '',
  }

  const status: CardStatus = {
    capture:  'pending',
    front:    'pending',
    back:     'pending',
    ocr:      'pending',
    ai_parse: 'pending',
    review:   'pending',
    export:   'pending',
    errors:   [],
  }

  await Promise.all([
    fs.writeFile(path.join(dir, 'metadata.json'), JSON.stringify(metadata, null, 2)),
    fs.writeFile(path.join(dir, 'status.json'),   JSON.stringify(status, null, 2)),
    fs.writeFile(path.join(dir, 'contact.md'),    buildContactMd(status)),
  ])

  return { cardId }
}

// ── Existence check ──────────────────────────────────────────────────────────

export async function cardExists(cardId: string): Promise<boolean> {
  try {
    await fs.access(path.join(cardDir(cardId), 'metadata.json'))
    return true
  } catch {
    return false
  }
}

// ── Save image ───────────────────────────────────────────────────────────────

export async function saveImage(
  cardId: string,
  side:   'front' | 'back',
  buffer: Buffer,
  originalBuffer?: Buffer,
): Promise<void> {
  const dir       = cardDir(cardId)
  const filename  = `${side}.jpg`
  const origName  = `${side}.original.jpg`

  await fs.writeFile(path.join(dir, filename), buffer)
  if (originalBuffer) {
    await fs.writeFile(path.join(dir, origName), originalBuffer)
  }

  const [metadata, status] = await readCard(cardId)
  metadata.updated_at       = now()
  metadata.files[side]      = filename
  if (originalBuffer) metadata.files[`${side}_original` as 'front_original' | 'back_original'] = origName

  if (side === 'front') {
    status.front   = 'done'
    status.capture = 'partial'
  } else {
    status.back = 'done'
  }

  await writeCard(cardId, metadata, status)
}

// ── Complete card ────────────────────────────────────────────────────────────

export async function completeCard(cardId: string): Promise<CardStatus> {
  const [metadata, status] = await readCard(cardId)

  status.capture  = status.front === 'done' && status.back === 'done' ? 'done' : 'partial'
  metadata.updated_at = now()

  await writeCard(cardId, metadata, status)
  await fs.writeFile(path.join(cardDir(cardId), 'contact.md'), buildContactMd(status))

  return status
}

// ── List cards ───────────────────────────────────────────────────────────────

export async function listCards(opts: {
  captureStatus?: string
  sort?:          string
  limit?:         number
  offset?:        number
} = {}): Promise<{ cards: CardSummary[]; total: number }> {
  const { captureStatus, sort = 'created_desc', limit = 50, offset = 0 } = opts

  let entries: string[]
  try {
    entries = await fs.readdir(CARDS_DIR)
  } catch {
    return { cards: [], total: 0 }
  }

  const ids = entries.filter(e => CARD_ID_RE.test(e))

  const summaries = (
    await Promise.all(ids.map(id => readSummary(id).catch(() => null)))
  ).filter(Boolean) as CardSummary[]

  const filtered = captureStatus
    ? summaries.filter(c => c.status.capture === captureStatus)
    : summaries

  filtered.sort((a, b) => {
    const ta = a.created_at, tb = b.created_at
    return sort === 'created_asc' ? ta.localeCompare(tb) : tb.localeCompare(ta)
  })

  const total = filtered.length
  const cards = filtered.slice(offset, offset + limit)
  return { cards, total }
}

// ── Get single card ──────────────────────────────────────────────────────────

export async function getCard(cardId: string): Promise<{
  metadata: CardMetadata
  status:   CardStatus
  files:    Record<string, string>
  contact_md: string
}> {
  const [metadata, status] = await readCard(cardId)
  const dir = cardDir(cardId)

  const fileMap: Record<string, string> = {}
  const candidates = ['front.jpg', 'front.original.jpg', 'back.jpg', 'back.original.jpg', 'contact.md']
  for (const f of candidates) {
    try {
      await fs.access(path.join(dir, f))
      fileMap[f.replace('.', '_').replace('-', '_')] = `/cards/${cardId}/${f}`
    } catch { /* file absent */ }
  }

  let contact_md = ''
  try { contact_md = await fs.readFile(path.join(dir, 'contact.md'), 'utf8') } catch { /* ok */ }

  return { metadata, status, files: fileMap, contact_md }
}

// ── Delete card ──────────────────────────────────────────────────────────────

export async function deleteCard(cardId: string): Promise<void> {
  await fs.rm(cardDir(cardId), { recursive: true, force: true })
}

// ── Update card tags/notes ───────────────────────────────────────────────────

export async function updateCard(cardId: string, patch: { tags?: string[]; notes?: string }): Promise<CardMetadata> {
  const [metadata, status] = await readCard(cardId)
  if (patch.tags  !== undefined) metadata.tags  = patch.tags
  if (patch.notes !== undefined) metadata.notes = patch.notes
  metadata.updated_at = now()
  await writeCard(cardId, metadata, status)
  return metadata
}

// ── Internal helpers ─────────────────────────────────────────────────────────

async function readCard(cardId: string): Promise<[CardMetadata, CardStatus]> {
  const dir = cardDir(cardId)
  const [m, s] = await Promise.all([
    fs.readFile(path.join(dir, 'metadata.json'), 'utf8'),
    fs.readFile(path.join(dir, 'status.json'),   'utf8'),
  ])
  return [JSON.parse(m) as CardMetadata, JSON.parse(s) as CardStatus]
}

async function writeCard(cardId: string, metadata: CardMetadata, status: CardStatus): Promise<void> {
  const dir = cardDir(cardId)
  await Promise.all([
    fs.writeFile(path.join(dir, 'metadata.json'), JSON.stringify(metadata, null, 2)),
    fs.writeFile(path.join(dir, 'status.json'),   JSON.stringify(status,   null, 2)),
  ])
}

async function readSummary(cardId: string): Promise<CardSummary> {
  const [metadata, status] = await readCard(cardId)
  return {
    id:         metadata.id,
    created_at: metadata.created_at,
    updated_at: metadata.updated_at,
    status,
    has_front:  status.front === 'done',
    has_back:   status.back  === 'done',
  }
}

function buildContactMd(status: CardStatus): string {
  return `# Business Card Draft

## Status
- Capture:  ${status.capture}
- OCR:      ${status.ocr}
- AI Parse: ${status.ai_parse}
- Review:   ${status.review}

## Images
- Front: \`front.jpg\`
- Back:  \`back.jpg\`

## Extracted Contact
Name:
Company:
Job Title:
Phone:
Email:
Website:
Address:

## OCR Raw Text
Pending.

## Notes

`
}
