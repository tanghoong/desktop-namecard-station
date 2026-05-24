import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import type { CardDetail } from '../api'

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.row}>
      <span style={styles.rowLabel}>{label}</span>
      <span style={styles.rowValue}>{value || '—'}</span>
    </div>
  )
}

function StatusPill({ value }: { value: string }) {
  const ok = value === 'done'
  const warn = value === 'partial' || value === 'in_progress'
  const color = ok ? 'var(--green)' : warn ? 'var(--blue)' : 'var(--muted)'
  return (
    <span style={{ color, fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>{value}</span>
  )
}

export default function CardDetailPage() {
  const { cardId }  = useParams<{ cardId: string }>()
  const navigate    = useNavigate()
  const [data,    setData]    = useState<CardDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [notes,   setNotes]   = useState('')
  const [saving,  setSaving]  = useState(false)
  const [lightbox, setLightbox] = useState('')

  useEffect(() => {
    if (!cardId) return
    api.get(cardId).then(res => {
      if (res.ok) { setData(res.data); setNotes(res.data.metadata.notes) }
      else setError(res.error.message)
      setLoading(false)
    })
  }, [cardId])

  async function handleSaveNotes() {
    if (!cardId || !data) return
    setSaving(true)
    const res = await api.patch(cardId, { notes })
    if (res.ok) setData(d => d ? { ...d, metadata: res.data } : d)
    setSaving(false)
  }

  async function handleDelete() {
    if (!cardId || !confirm('Delete this card permanently?')) return
    await api.delete(cardId)
    navigate('/cards')
  }

  if (loading) return <div style={styles.center}>Loading…</div>
  if (error || !data) return (
    <div style={styles.center}>
      <p style={{ color: 'var(--red)' }}>{error || 'Not found'}</p>
      <button className="btn-secondary" style={{ marginTop: 16 }} onClick={() => navigate('/cards')}>
        Back
      </button>
    </div>
  )

  const { metadata, status, files } = data
  const frontUrl = files['front_jpg'] ? files['front_jpg'] : ''
  const backUrl  = files['back_jpg']  ? files['back_jpg']  : ''

  return (
    <div style={styles.wrap}>
      {/* Lightbox */}
      {lightbox && (
        <div style={styles.lightboxOverlay} onClick={() => setLightbox('')}>
          <img src={lightbox} alt="full" style={styles.lightboxImg} />
        </div>
      )}

      {/* Header */}
      <div style={styles.header}>
        <button className="btn-secondary" style={{ padding: '8px 14px' }} onClick={() => navigate('/cards')}>
          ← Back
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {metadata.id}
          </div>
        </div>
        <button className="btn-danger" style={{ padding: '8px 14px' }} onClick={handleDelete}>
          Delete
        </button>
      </div>

      <div style={styles.body}>

        {/* Images */}
        <div style={styles.imageRow}>
          {frontUrl
            ? <img src={frontUrl} alt="front" style={styles.cardImg} onClick={() => setLightbox(frontUrl)} />
            : <div style={styles.imgPlaceholder}>No front</div>
          }
          {backUrl
            ? <img src={backUrl}  alt="back"  style={styles.cardImg} onClick={() => setLightbox(backUrl)} />
            : <div style={styles.imgPlaceholder}>No back</div>
          }
        </div>

        {/* Status */}
        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>Status</h3>
          <div style={styles.statusGrid}>
            {(['capture', 'front', 'back', 'ocr', 'ai_parse', 'review', 'export'] as const).map(k => (
              <div key={k} style={styles.statusItem}>
                <span style={{ color: 'var(--muted)', fontSize: 11 }}>{k.replace('_', ' ')}</span>
                <StatusPill value={status[k] as string} />
              </div>
            ))}
          </div>
        </section>

        {/* Contact extracted (contact.md preview) */}
        {data.contact_md && (
          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>Contact MD</h3>
            <pre style={styles.pre}>{data.contact_md}</pre>
          </section>
        )}

        {/* Metadata */}
        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>Info</h3>
          <Row label="Created"     value={new Date(metadata.created_at).toLocaleString()} />
          <Row label="Updated"     value={new Date(metadata.updated_at).toLocaleString()} />
          <Row label="App version" value={metadata.app_version} />
          <Row label="Source"      value={metadata.source} />
        </section>

        {/* Notes */}
        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>Notes</h3>
          <textarea
            style={styles.textarea}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={4}
            placeholder="Add notes…"
          />
          <button
            className="btn-secondary"
            style={{ marginTop: 8, width: '100%' }}
            onClick={handleSaveNotes}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save notes'}
          </button>
        </section>

      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap:   { display: 'flex', flexDirection: 'column', height: '100dvh' },
  center: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100dvh', padding: 32 },
  header: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '12px 16px', borderBottom: '1px solid var(--border)',
    background: 'var(--surface)', flexShrink: 0,
  },
  body:   { overflowY: 'auto', flex: 1, padding: 16 },
  imageRow: { display: 'flex', gap: 12, marginBottom: 16 },
  cardImg: {
    flex: 1, maxWidth: '50%', borderRadius: 8,
    border: '1px solid var(--border)', cursor: 'zoom-in',
    objectFit: 'contain', background: '#000',
  },
  imgPlaceholder: {
    flex: 1, height: 100, borderRadius: 8,
    border: '1px dashed var(--border)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--muted)', fontSize: 13,
  },
  section:      { marginBottom: 24 },
  sectionTitle: { fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  statusGrid:   { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px' },
  statusItem:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid var(--border)' },
  row:          { display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border)' },
  rowLabel:     { color: 'var(--muted)', fontSize: 13 },
  rowValue:     { fontSize: 13 },
  pre: {
    fontFamily: 'monospace', fontSize: 12,
    background: 'var(--surface)', borderRadius: 6,
    padding: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
    border: '1px solid var(--border)', maxHeight: 300, overflowY: 'auto',
  },
  textarea: {
    width: '100%', background: 'var(--surface)',
    border: '1px solid var(--border)', borderRadius: 8,
    color: 'var(--text)', padding: 10, fontSize: 14,
    resize: 'vertical', fontFamily: 'inherit',
  },
  lightboxOverlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,.9)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 100, cursor: 'zoom-out',
  },
  lightboxImg: { maxWidth: '95vw', maxHeight: '95dvh', borderRadius: 4 },
}
