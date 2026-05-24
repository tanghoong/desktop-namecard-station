import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import type { CardSummary } from '../types'

function statusBadge(s: CardSummary) {
  const c = s.status.capture
  const color = c === 'done' ? 'var(--green)' : c === 'partial' ? 'var(--blue)' : 'var(--muted)'
  return <span style={{ color, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>{c}</span>
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString()
}

export default function CardsPage() {
  const navigate = useNavigate()
  const [cards,   setCards]   = useState<CardSummary[]>([])
  const [total,   setTotal]   = useState(0)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  async function load() {
    setLoading(true)
    const res = await api.list({ sort: 'created_desc', limit: 100 })
    if (res.ok) { setCards(res.data.cards); setTotal(res.data.total) }
    else setError(res.error.message)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('Delete this card?')) return
    await api.delete(id)
    setCards(c => c.filter(x => x.id !== id))
    setTotal(t => t - 1)
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <button className="btn-secondary" style={{ padding: '8px 14px' }} onClick={() => navigate('/')}>← Home</button>
        <h2 style={{ flex: 1, textAlign: 'center' }}>Cards ({total})</h2>
        <button className="btn-primary" style={{ padding: '8px 14px' }} onClick={() => navigate('/capture')}>+ Scan</button>
      </div>

      {loading && <p style={{ color: 'var(--muted)', textAlign: 'center', padding: 32 }}>Loading…</p>}
      {error   && <p style={{ color: 'var(--red)',   textAlign: 'center', padding: 32 }}>{error}</p>}

      {!loading && cards.length === 0 && (
        <div style={styles.empty}>
          <p style={{ color: 'var(--muted)' }}>No cards yet.</p>
          <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => navigate('/capture')}>
            Scan your first card
          </button>
        </div>
      )}

      <ul style={styles.list}>
        {cards.map(card => (
          <li key={card.id} style={styles.item} onClick={() => navigate(`/cards/${card.id}`)}>
            <div style={styles.itemLeft}>
              <div style={styles.thumbRow}>
                <div style={{ ...styles.thumbPlaceholder, background: card.has_front ? 'var(--border)' : 'transparent' }}>
                  {card.has_front ? <span style={{ fontSize: 10, color: 'var(--muted)' }}>F</span> : null}
                </div>
                <div style={{ ...styles.thumbPlaceholder, background: card.has_back ? 'var(--border)' : 'transparent' }}>
                  {card.has_back ? <span style={{ fontSize: 10, color: 'var(--muted)' }}>B</span> : null}
                </div>
              </div>
            </div>
            <div style={styles.itemMid}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{card.id}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{fmtDate(card.created_at)}</div>
              <div style={{ marginTop: 4 }}>{statusBadge(card)}</div>
            </div>
            <button
              className="btn-danger"
              style={{ padding: '6px 12px', fontSize: 12 }}
              onClick={e => handleDelete(card.id, e)}
            >
              Del
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', flexDirection: 'column', height: '100dvh' },
  header: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '12px 16px', borderBottom: '1px solid var(--border)',
    background: 'var(--surface)',
  },
  list: { listStyle: 'none', overflowY: 'auto', flex: 1, padding: '8px 0' },
  item: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '12px 16px', cursor: 'pointer',
    borderBottom: '1px solid var(--border)',
  },
  itemLeft:  {},
  itemMid:   { flex: 1, minWidth: 0 },
  thumbRow:  { display: 'flex', gap: 4 },
  thumbPlaceholder: {
    width: 36, height: 23, borderRadius: 3,
    border: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  empty: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', flex: 1,
  },
}
