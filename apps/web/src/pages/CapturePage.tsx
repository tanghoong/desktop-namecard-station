import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

// ── Detection config (mirrors confirmed test.html values) ────────────────────
const CFG = {
  sampleW:     160,
  sampleH:     120,
  tick:        100,   // ms per analysis frame
  bMin:        40,
  bMax:        230,
  mThresh:     12,
  cThresh:     20,
  eThresh:     0.04,
  stableNeeded: 5,   // ~500 ms
  cdFrom:       1,   // countdown seconds
  flipSpike:   25,
  flipSettle:   4,
}

// Guide frame: 85 vw capped at 360, ratio 1.585:1
const GUIDE_W = () => Math.min(window.innerWidth * 0.85, 360)
const GUIDE_H = () => GUIDE_W() / 1.585

type Phase =
  | 'init'
  | 'detecting_front'
  | 'countdown_front'
  | 'uploading_front'
  | 'flip_wait'
  | 'detecting_back'
  | 'countdown_back'
  | 'uploading_back'
  | 'done'
  | 'error'

interface Metrics { brightness: number; motion: number; contrast: number; edgeDensity: number }

// ── Canvas helpers ────────────────────────────────────────────────────────────

function cropToGuide(src: HTMLVideoElement, out: HTMLCanvasElement): void {
  const vw = src.videoWidth, vh = src.videoHeight
  const dw = src.clientWidth, dh = src.clientHeight

  const scale = Math.max(dw / vw, dh / vh)
  const rendW = vw * scale, rendH = vh * scale
  const offX  = (dw - rendW) / 2, offY = (dh - rendH) / 2

  const gw = GUIDE_W(), gh = GUIDE_H()
  const gx = (dw - gw) / 2,    gy = (dh - gh) / 2

  const srcX = (gx - offX) / scale
  const srcY = (gy - offY) / scale
  const srcW = gw / scale
  const srcH = gh / scale

  out.width  = Math.round(srcW)
  out.height = Math.round(srcH)
  out.getContext('2d')!.drawImage(src, srcX, srcY, srcW, srcH, 0, 0, out.width, out.height)
}

function analyseFrame(
  video: HTMLVideoElement,
  offscreen: HTMLCanvasElement,
  prev: ImageData | null,
): { metrics: Metrics; pixels: ImageData } {
  const ctx = offscreen.getContext('2d')!
  offscreen.width  = CFG.sampleW
  offscreen.height = CFG.sampleH
  ctx.drawImage(video, 0, 0, CFG.sampleW, CFG.sampleH)
  const pixels = ctx.getImageData(0, 0, CFG.sampleW, CFG.sampleH)
  const d = pixels.data, n = CFG.sampleW * CFG.sampleH

  let sumB = 0, sumB2 = 0, motionSum = 0, edgeCount = 0

  for (let i = 0; i < n; i++) {
    const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2]
    const lum = 0.299 * r + 0.587 * g + 0.114 * b
    sumB  += lum
    sumB2 += lum * lum

    if (prev) {
      const diff = Math.abs(lum - (0.299 * prev.data[i*4] + 0.587 * prev.data[i*4+1] + 0.114 * prev.data[i*4+2]))
      motionSum += diff
    }

    // Sobel-lite: compare with right + bottom neighbours
    if (i % CFG.sampleW < CFG.sampleW - 1 && Math.floor(i / CFG.sampleW) < CFG.sampleH - 1) {
      const ri = i + 1, bi = i + CFG.sampleW
      const lumR = 0.299 * d[ri*4] + 0.587 * d[ri*4+1] + 0.114 * d[ri*4+2]
      const lumB2 = 0.299 * d[bi*4] + 0.587 * d[bi*4+1] + 0.114 * d[bi*4+2]
      if (Math.abs(lum - lumR) > 20 || Math.abs(lum - lumB2) > 20) edgeCount++
    }
  }

  const brightness  = sumB / n
  const variance    = sumB2 / n - brightness * brightness
  const contrast    = Math.sqrt(Math.max(0, variance))
  const motion      = prev ? motionSum / n : 0
  const edgeDensity = edgeCount / n

  return { metrics: { brightness, motion, contrast, edgeDensity }, pixels }
}

function blobFromCanvas(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((res, rej) => canvas.toBlob(
    b => b ? res(b) : rej(new Error('canvas toBlob failed')),
    'image/jpeg', 0.88,
  ))
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CapturePage() {
  const navigate = useNavigate()

  const videoRef    = useRef<HTMLVideoElement>(null)
  const offscRef    = useRef<HTMLCanvasElement>(document.createElement('canvas'))
  const captureRef  = useRef<HTMLCanvasElement>(document.createElement('canvas'))
  const prevPixRef  = useRef<ImageData | null>(null)
  const streamRef   = useRef<MediaStream | null>(null)
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null)

  const stableRef   = useRef(0)
  const flipRef     = useRef<'idle' | 'spike' | 'settle'>('idle')
  const flipCntRef  = useRef(0)
  const cdRef       = useRef(CFG.cdFrom)
  const cardIdRef   = useRef<string | null>(null)

  const [phase,    setPhase]    = useState<Phase>('init')
  const [metrics,  setMetrics]  = useState<Metrics>({ brightness: 0, motion: 0, contrast: 0, edgeDensity: 0 })
  const [cdSecs,   setCdSecs]   = useState(CFG.cdFrom)
  const [error,    setError]    = useState('')
  const [frontUrl, setFrontUrl] = useState('')
  const [backUrl,  setBackUrl]  = useState('')

  // ── start camera ──────────────────────────────────────────────────────────

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width:      { ideal: 1920 },
          height:     { ideal: 1080 },
        },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
    } catch (e) {
      setError(`Camera error: ${(e as Error).message}`)
      setPhase('error')
    }
  }, [])

  // ── analysis tick ─────────────────────────────────────────────────────────

  const tick = useCallback(() => {
    const video = videoRef.current
    if (!video || video.readyState < 2) return

    const { metrics: m, pixels } = analyseFrame(video, offscRef.current, prevPixRef.current)
    prevPixRef.current = pixels
    setMetrics(m)

    setPhase(prev => {
      if (prev === 'detecting_front' || prev === 'detecting_back') {
        const ok = m.brightness >= CFG.bMin && m.brightness <= CFG.bMax
                && m.motion      <  CFG.mThresh
                && m.contrast    >= CFG.cThresh
                && m.edgeDensity >= CFG.eThresh

        if (ok) {
          stableRef.current++
          if (stableRef.current >= CFG.stableNeeded) {
            stableRef.current = 0
            cdRef.current = CFG.cdFrom
            setCdSecs(CFG.cdFrom)
            return prev === 'detecting_front' ? 'countdown_front' : 'countdown_back'
          }
        } else {
          stableRef.current = 0
        }
        return prev
      }

      if (prev === 'countdown_front' || prev === 'countdown_back') {
        const ok = m.brightness >= CFG.bMin && m.brightness <= CFG.bMax
                && m.motion      <  CFG.mThresh
                && m.contrast    >= CFG.cThresh
                && m.edgeDensity >= CFG.eThresh

        if (!ok) {
          stableRef.current = 0
          return prev === 'countdown_front' ? 'detecting_front' : 'detecting_back'
        }

        cdRef.current -= CFG.tick / 1000
        const s = Math.ceil(cdRef.current)
        setCdSecs(s)
        if (cdRef.current <= 0) {
          // capture!
          return prev === 'countdown_front' ? 'uploading_front' : 'uploading_back'
        }
        return prev
      }

      if (prev === 'flip_wait') {
        if (flipRef.current === 'idle' && m.motion > CFG.flipSpike) {
          flipRef.current = 'spike'
          flipCntRef.current = 0
        } else if (flipRef.current === 'spike') {
          if (m.motion < CFG.mThresh) {
            flipCntRef.current++
            if (flipCntRef.current >= CFG.flipSettle) {
              flipRef.current = 'idle'
              stableRef.current = 0
              return 'detecting_back'
            }
          } else {
            flipCntRef.current = 0
          }
        }
        return prev
      }

      return prev
    })
  }, [])

  // ── upload front ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== 'uploading_front') return
    ;(async () => {
      try {
        // start card session if not already
        if (!cardIdRef.current) {
          const res = await api.start()
          if (!res.ok) throw new Error(res.error.message)
          cardIdRef.current = res.data.cardId
        }

        cropToGuide(videoRef.current!, captureRef.current)
        const blob = await blobFromCanvas(captureRef.current)
        setFrontUrl(URL.createObjectURL(blob))

        const res = await api.uploadFront(cardIdRef.current!, blob)
        if (!res.ok) throw new Error(res.error.message)

        flipRef.current = 'idle'
        setPhase('flip_wait')
      } catch (e) {
        setError((e as Error).message)
        setPhase('error')
      }
    })()
  }, [phase])

  // ── upload back ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== 'uploading_back') return
    ;(async () => {
      try {
        cropToGuide(videoRef.current!, captureRef.current)
        const blob = await blobFromCanvas(captureRef.current)
        setBackUrl(URL.createObjectURL(blob))

        const res = await api.uploadBack(cardIdRef.current!, blob)
        if (!res.ok) throw new Error(res.error.message)

        await api.complete(cardIdRef.current!)
        setPhase('done')
      } catch (e) {
        setError((e as Error).message)
        setPhase('error')
      }
    })()
  }, [phase])

  // ── tap-to-start handler (must be in direct user gesture) ────────────────

  const handleStart = useCallback(() => {
    setPhase('detecting_front')
    startCamera()
  }, [startCamera])

  // ── cleanup on unmount ────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  useEffect(() => {
    if (phase === 'detecting_front' || phase === 'countdown_front'
     || phase === 'flip_wait'
     || phase === 'detecting_back'  || phase === 'countdown_back') {
      timerRef.current = setInterval(tick, CFG.tick)
    } else {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [phase, tick])

  // ── render helpers ────────────────────────────────────────────────────────

  const isCountdown = phase === 'countdown_front' || phase === 'countdown_back'
  const isUploading = phase === 'uploading_front' || phase === 'uploading_back'
  const isFlipWait  = phase === 'flip_wait'
  const stepLabel   = phase.includes('back') || phase === 'flip_wait' || phase === 'done'
                      ? 'BACK 2/2' : 'FRONT 1/2'
  const guideColor  = isCountdown ? '#60a5fa' : '#ffffff'

  if (phase === 'done') {
    return (
      <div style={styles.done}>
        <h2 style={{ marginBottom: 16 }}>Card saved!</h2>
        <div style={styles.thumbRow}>
          {frontUrl && <img src={frontUrl} alt="front" style={styles.thumb} />}
          {backUrl  && <img src={backUrl}  alt="back"  style={styles.thumb} />}
        </div>
        <button className="btn-primary" style={{ marginTop: 24 }}
          onClick={() => navigate(`/cards/${cardIdRef.current}`)}>
          View card
        </button>
        <button className="btn-secondary" style={{ marginTop: 12 }}
          onClick={() => { cardIdRef.current = null; setFrontUrl(''); setBackUrl(''); setPhase('detecting_front') }}>
          Capture another
        </button>
        <button className="btn-secondary" style={{ marginTop: 12 }}
          onClick={() => navigate('/cards')}>
          All cards
        </button>
      </div>
    )
  }

  if (phase === 'init') {
    return (
      <div style={styles.initScreen}>
        <div style={styles.initBox}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📷</div>
          <h2 style={{ marginBottom: 8 }}>Ready to scan</h2>
          <p style={{ color: 'var(--muted)', marginBottom: 24, fontSize: 14 }}>
            Tap to start camera and scan a business card
          </p>
          <button className="btn-primary" style={{ width: '100%' }} onClick={handleStart}>
            Start Camera
          </button>
          <button className="btn-secondary" style={{ width: '100%', marginTop: 12 }}
            onClick={() => navigate('/')}>
            Back
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div style={styles.initScreen}>
        <div style={styles.initBox}>
          <p style={{ color: 'var(--red)', marginBottom: 16 }}>{error}</p>
          <button className="btn-secondary" style={{ width: '100%' }} onClick={() => navigate('/')}>Home</button>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      {/* Video */}
      <video ref={videoRef} style={styles.video} playsInline muted autoPlay />

      {/* Guide frame */}
      <div style={{
        ...styles.guide,
        width:  GUIDE_W(),
        height: GUIDE_H(),
        borderColor: guideColor,
        boxShadow: isCountdown ? `0 0 0 2px ${guideColor}` : undefined,
      }} />

      {/* Step badge */}
      <div style={styles.badge}>{stepLabel}</div>

      {/* Countdown */}
      {isCountdown && (
        <div style={styles.countdown}>{cdSecs}</div>
      )}

      {/* Flip overlay */}
      {isFlipWait && (
        <div style={styles.flipOverlay}>
          <div style={styles.flipBox}>
            <div style={{ fontSize: 40 }}>↕</div>
            <div style={{ marginTop: 8, fontWeight: 600 }}>Flip card over</div>
            <div style={{ marginTop: 4, fontSize: 13, color: 'var(--muted)' }}>
              Will detect automatically
            </div>
            <button
              className="btn-secondary"
              style={{ marginTop: 20, width: '100%' }}
              onClick={() => { stableRef.current = 0; flipRef.current = 'idle'; setPhase('detecting_back') }}
            >
              Ready — scan back
            </button>
          </div>
        </div>
      )}

      {/* Uploading overlay */}
      {isUploading && (
        <div style={styles.flipOverlay}>
          <div style={styles.flipBox}>Uploading…</div>
        </div>
      )}

      {/* Debug metrics */}
      <div style={styles.debug}>
        {([
          ['Brightness', metrics.brightness, 255],
          ['Motion',     metrics.motion,     60],
          ['Contrast',   metrics.contrast,   80],
          ['Edges',      metrics.edgeDensity * 100, 20],
        ] as [string, number, number][]).map(([label, val, max]) => (
          <div key={label} style={styles.debugRow}>
            <span style={styles.debugLabel}>{label}</span>
            <div style={styles.bar}>
              <div style={{ ...styles.barFill, width: `${Math.min(100, val / max * 100)}%` }} />
            </div>
            <span style={styles.debugVal}>{label === 'Edges' ? val.toFixed(1) + '%' : val.toFixed(0)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  initScreen: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: '100%', height: '100vh', padding: 32,
  },
  initBox: {
    width: '100%', maxWidth: 320, textAlign: 'center',
  },
  container: {
    position: 'relative', width: '100%', height: '100vh',
    overflow: 'hidden', background: '#000',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  video: {
    position: 'absolute', inset: 0,
    width: '100%', height: '100%',
    objectFit: 'cover',
  },
  guide: {
    position: 'absolute',
    border: '2px solid #fff',
    borderRadius: 8,
    pointerEvents: 'none',
    transition: 'border-color .2s, box-shadow .2s',
    zIndex: 2,
  },
  badge: {
    position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
    background: 'rgba(0,0,0,.6)', color: '#fff',
    padding: '4px 14px', borderRadius: 20, fontSize: 13, fontWeight: 700,
    letterSpacing: 1, zIndex: 3,
  },
  countdown: {
    position: 'absolute', top: '50%', left: '50%',
    transform: 'translate(-50%, -50%)',
    fontSize: 80, fontWeight: 700, color: '#60a5fa',
    textShadow: '0 2px 12px rgba(0,0,0,.8)',
    zIndex: 4, pointerEvents: 'none',
  },
  flipOverlay: {
    position: 'absolute', inset: 0,
    background: 'rgba(0,0,0,.7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 5,
  },
  flipBox: {
    textAlign: 'center', color: '#fff',
    background: 'rgba(255,255,255,.1)',
    padding: '32px 40px', borderRadius: 16,
  },
  debug: {
    position: 'absolute', bottom: 16, left: 16, right: 16,
    background: 'rgba(0,0,0,.55)',
    borderRadius: 8, padding: '8px 12px',
    zIndex: 3,
  },
  debugRow: {
    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3,
  },
  debugLabel: { color: '#94a3b8', fontSize: 11, width: 72, flexShrink: 0 },
  bar:      { flex: 1, height: 4, background: 'rgba(255,255,255,.15)', borderRadius: 2, overflow: 'hidden' },
  barFill:  { height: '100%', background: '#4ade80', borderRadius: 2, transition: 'width .1s' },
  debugVal: { color: '#f1f5f9', fontSize: 11, width: 40, textAlign: 'right', flexShrink: 0 },
  done: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', width: '100%', height: '100vh',
    padding: 32, gap: 0,
  },
  thumbRow: {
    display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center',
  },
  thumb: {
    width: 140, height: 88, objectFit: 'cover', borderRadius: 8,
    border: '1px solid var(--border)',
  },
}
