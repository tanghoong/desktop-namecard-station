import type { CardMetadata, CardStatus, CardSummary, ApiResponse } from './types'

const BASE = ''  // proxied in dev via vite; same origin in prod

async function call<T>(method: string, path: string, body?: unknown): Promise<ApiResponse<T>> {
  const res = await fetch(BASE + path, {
    method,
    headers: body && !(body instanceof FormData)
      ? { 'Content-Type': 'application/json' }
      : undefined,
    body: body instanceof FormData
      ? body
      : body ? JSON.stringify(body) : undefined,
  })
  return res.json() as Promise<ApiResponse<T>>
}

export interface StartResult   { cardId: string }
export interface CompleteResult { cardId: string; status: CardStatus }
export interface CardDetail {
  metadata:   CardMetadata
  status:     CardStatus
  files:      Record<string, string>
  contact_md: string
}
export interface CardList { cards: CardSummary[]; total: number }

export const api = {
  start(): Promise<ApiResponse<StartResult>> {
    return call('POST', '/api/cards/start')
  },

  uploadFront(cardId: string, blob: Blob): Promise<ApiResponse<{ cardId: string; side: string }>> {
    const fd = new FormData()
    fd.append('image', blob, 'front.jpg')
    return call('POST', `/api/cards/${cardId}/front`, fd)
  },

  uploadBack(cardId: string, blob: Blob): Promise<ApiResponse<{ cardId: string; side: string }>> {
    const fd = new FormData()
    fd.append('image', blob, 'back.jpg')
    return call('POST', `/api/cards/${cardId}/back`, fd)
  },

  complete(cardId: string): Promise<ApiResponse<CompleteResult>> {
    return call('POST', `/api/cards/${cardId}/complete`)
  },

  list(params?: { capture_status?: string; sort?: string; limit?: number; offset?: number }): Promise<ApiResponse<CardList>> {
    const qs = params ? '?' + new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    ).toString() : ''
    return call('GET', `/api/cards${qs}`)
  },

  get(cardId: string): Promise<ApiResponse<CardDetail>> {
    return call('GET', `/api/cards/${cardId}`)
  },

  delete(cardId: string): Promise<Response> {
    return fetch(`/api/cards/${cardId}`, { method: 'DELETE' })
  },

  patch(cardId: string, body: { tags?: string[]; notes?: string }): Promise<ApiResponse<CardMetadata>> {
    return call('PATCH', `/api/cards/${cardId}`, body)
  },
}
