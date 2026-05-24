import { useNavigate } from 'react-router-dom'

export default function HomePage() {
  const navigate = useNavigate()
  return (
    <div style={styles.wrap}>
      <h1 style={styles.title}>Namecard Station</h1>
      <p style={styles.sub}>Scan business cards with your phone camera</p>
      <button className="btn-primary" style={styles.btn} onClick={() => navigate('/capture')}>
        Scan a card
      </button>
      <button className="btn-secondary" style={styles.btn} onClick={() => navigate('/cards')}>
        View saved cards
      </button>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', height: '100dvh', gap: 16, padding: 32,
  },
  title: { fontSize: 28, fontWeight: 700, textAlign: 'center' },
  sub:   { color: 'var(--muted)', textAlign: 'center', marginBottom: 8 },
  btn:   { width: '100%', maxWidth: 320 },
}
