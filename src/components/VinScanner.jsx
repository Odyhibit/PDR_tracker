import React, { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat } from '@zxing/library'

const VIN_RE    = /[A-HJ-NPR-Z0-9]{17}/i
const VIN_CHARS = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789' // VIN alphabet — no I, O, or Q

export default function VinScanner({ onScanned, onClose }) {
  const videoRef  = useRef(null)
  const readerRef = useRef(null)
  const guideRef  = useRef(null)
  const modeRef   = useRef('scan')

  const [error,   setError]   = useState(null)
  const [torch,   setTorch]   = useState(false)
  const [zoom,    setZoom]    = useState(null) // { min, max, step, value } once detected, else null
  // 'scan' (barcode) | 'capture' (frame VIN text) | 'processing' (running OCR) | 'review' (confirm OCR result)
  const [mode,    setMode]    = useState('scan')
  const [ocrText, setOcrText] = useState('')
  const [ocrErr,  setOcrErr]  = useState('')
  // Degrees to counter-rotate the whole overlay when the OS auto-rotates to
  // landscape — see the orientation-compensation effect below.
  const [compensateDeg, setCompensateDeg] = useState(0)

  const wentFullscreenRef = useRef(false)

  useEffect(() => { modeRef.current = mode }, [mode])

  useEffect(() => {
    // True orientation lock only works in Chromium browsers, and (per spec)
    // generally requires a fullscreen context to take effect at all — so ask
    // for fullscreen first. Both are best-effort: Safari/iOS supports neither,
    // which is what the compensation effect below is for.
    async function lockPortrait() {
      const root = document.documentElement
      try {
        if (root.requestFullscreen) {
          await root.requestFullscreen({ navigationUI: 'hide' })
          wentFullscreenRef.current = true
        }
      } catch {}
      try {
        await screen.orientation?.lock?.('portrait')
      } catch {}
    }
    lockPortrait()

    // Doorjamb VIN stickers use Code 39 (a few use Code 128) — restricting the
    // formats and forcing TRY_HARDER makes decoding more tolerant of the blur/
    // skew a slightly concave sticker surface introduces.
    const hints = new Map()
    hints.set(DecodeHintType.TRY_HARDER, true)
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_39, BarcodeFormat.CODE_128])

    const reader = new BrowserMultiFormatReader(hints)
    readerRef.current = reader

    reader.decodeFromConstraints(
      {
        video: {
          facingMode: 'environment',
          width:  { ideal: 1920 },
          height: { ideal: 1080 },
          advanced: [{ focusMode: 'continuous' }],
        }
      },
      videoRef.current,
      (result, err) => {
        if (modeRef.current !== 'scan') return // paused while the OCR flow is active
        if (result) {
          const raw     = result.getText()
          const cleaned = raw.replace(/[^A-HJ-NPR-Z0-9]/gi, '').toUpperCase()
          const match   = cleaned.match(VIN_RE)
          if (match) {
            if (navigator.vibrate) navigator.vibrate(100)
            cleanup()
            onScanned(match[0])
          }
        }
        // NotFoundException fires every frame with no barcode — that's normal, ignore it
      }
    ).catch(err => {
      if (err.name === 'NotAllowedError') {
        setError('Camera permission denied. Please allow camera access in your browser settings, then reload.')
      } else {
        setError(`Camera error: ${err.message}`)
      }
    })

    return () => cleanup()
  }, [])

  // Fallback for when true orientation lock isn't available (iOS Safari
  // supports neither the Fullscreen nor the orientation-lock API, and
  // aiming the camera down at a low door-jamb sticker is a well-known
  // trigger for the accelerometer to misread the tilt as a landscape
  // rotation even though the phone is still held upright). Whenever the OS
  // rotates the viewport, counter-rotate our own overlay back so it keeps
  // reading portrait-up to the user.
  useEffect(() => {
    function updateCompensation() {
      const angle = typeof screen.orientation?.angle === 'number' ? screen.orientation.angle : 0
      const deg = angle === 90 ? -90 : (angle === 270 || angle === -90) ? 90 : angle === 180 ? 180 : 0
      setCompensateDeg(deg)
    }
    updateCompensation()
    screen.orientation?.addEventListener?.('change', updateCompensation)
    window.addEventListener('orientationchange', updateCompensation)
    return () => {
      screen.orientation?.removeEventListener?.('change', updateCompensation)
      window.removeEventListener('orientationchange', updateCompensation)
    }
  }, [])

  // Detect digital zoom support once the stream is live — some concave stickers
  // decode much more reliably once the barcode is framed larger in the shot.
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    function onReady() {
      const track = video.srcObject?.getVideoTracks?.()[0]
      const caps  = track?.getCapabilities?.()
      if (caps?.zoom) {
        const value = track.getSettings?.().zoom ?? caps.zoom.min
        setZoom({ min: caps.zoom.min, max: caps.zoom.max, step: caps.zoom.step || 0.1, value })
      }
    }
    video.addEventListener('loadedmetadata', onReady)
    return () => video.removeEventListener('loadedmetadata', onReady)
  }, [])

  function cleanup() {
    // Unlock orientation when scanner closes
    if (screen.orientation?.unlock) {
      screen.orientation.unlock()
    }
    if (wentFullscreenRef.current && document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {})
      wentFullscreenRef.current = false
    }
    if (readerRef.current) {
      try { readerRef.current.reset() } catch {}
    }
  }

  function handleClose() {
    cleanup()
    onClose()
  }

  async function toggleTorch() {
    try {
      const stream = videoRef.current?.srcObject
      if (!stream) return
      const track        = stream.getVideoTracks()[0]
      const capabilities = track.getCapabilities()
      if (!capabilities.torch) return
      await track.applyConstraints({ advanced: [{ torch: !torch }] })
      setTorch(t => !t)
    } catch { /* torch not supported */ }
  }

  async function applyZoom(value) {
    try {
      const stream = videoRef.current?.srcObject
      const track  = stream?.getVideoTracks()[0]
      if (!track || !zoom) return
      const clamped = Math.min(zoom.max, Math.max(zoom.min, value))
      await track.applyConstraints({ advanced: [{ zoom: clamped }] })
      setZoom(z => z ? { ...z, value: clamped } : z)
    } catch { /* zoom not supported */ }
  }

  function goCapture() {
    setOcrErr('')
    setMode('capture')
  }

  function goBackToBarcode() {
    setOcrErr('')
    setOcrText('')
    setMode('scan')
  }

  // Maps the on-screen guide box back to the underlying video frame's pixel
  // coordinates (accounting for the object-fit: cover crop), crops just that
  // region, and upscales + grayscales it — all of which meaningfully improve
  // OCR accuracy on the small printed VIN text vs. feeding it the full frame.
  function cropGuideToCanvas() {
    const video   = videoRef.current
    const guideEl = guideRef.current
    if (!video || !guideEl || !video.videoWidth) return null

    const videoRect = video.getBoundingClientRect()
    const guideRect = guideEl.getBoundingClientRect()

    const scale    = Math.max(videoRect.width / video.videoWidth, videoRect.height / video.videoHeight)
    const renderedW = video.videoWidth  * scale
    const renderedH = video.videoHeight * scale
    const offsetX   = (renderedW - videoRect.width)  / 2
    const offsetY   = (renderedH - videoRect.height) / 2

    const srcX = (guideRect.left - videoRect.left + offsetX) / scale
    const srcY = (guideRect.top  - videoRect.top  + offsetY) / scale
    const srcW = guideRect.width  / scale
    const srcH = guideRect.height / scale

    const upscale = 2.5
    const canvas  = document.createElement('canvas')
    canvas.width  = Math.round(srcW * upscale)
    canvas.height = Math.round(srcH * upscale)
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, srcX, srcY, srcW, srcH, 0, 0, canvas.width, canvas.height)

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const d = imgData.data
    for (let i = 0; i < d.length; i += 4) {
      const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
      d[i] = d[i + 1] = d[i + 2] = gray
    }
    ctx.putImageData(imgData, 0, 0)

    return canvas
  }

  async function captureAndRecognize() {
    setOcrErr('')
    setMode('processing')
    let worker
    try {
      const canvas = cropGuideToCanvas()
      if (!canvas) throw new Error('Could not capture the frame — try again.')

      const { createWorker, PSM } = await import('tesseract.js')
      worker = await createWorker('eng')
      await worker.setParameters({
        tessedit_pageseg_mode:    PSM.SINGLE_LINE,
        tessedit_char_whitelist:  VIN_CHARS,
      })
      const { data: { text } } = await worker.recognize(canvas)

      const cleaned = text.replace(/[^A-HJ-NPR-Z0-9]/gi, '').toUpperCase()
      const match   = cleaned.match(VIN_RE)
      setOcrText(match ? match[0] : cleaned.slice(0, 17))
      setMode('review')
    } catch (e) {
      setOcrErr(e.message || 'Could not read the text. Try again with more light and less glare.')
      setMode('capture')
    } finally {
      if (worker) { try { await worker.terminate() } catch {} }
    }
  }

  function handleConfirmOcr() {
    const clean = ocrText.trim().toUpperCase()
    if (clean.length !== 17 || !VIN_RE.test(clean)) return
    if (navigator.vibrate) navigator.vibrate(100)
    cleanup()
    onScanned(clean)
  }

  const cameraLive = (mode === 'scan' || mode === 'capture')
  const sideways   = compensateDeg === 90 || compensateDeg === -90

  return (
    <div style={compensateDeg === 0 ? {
      position: 'fixed', inset: 0, zIndex: 1000,
      background: '#000', display: 'flex', flexDirection: 'column',
      // Force portrait layout even if device is rotated
      width: '100dvw', height: '100dvh',
    } : {
      // The OS thinks we're in landscape (usually a false read from tilting
      // the camera down at a low sticker) — rotate the whole overlay back so
      // it still reads portrait-up, sized/centered to fill the actual
      // (rotated) viewport exactly.
      position: 'fixed', top: '50%', left: '50%', zIndex: 1000,
      background: '#000', display: 'flex', flexDirection: 'column',
      width:  sideways ? '100dvh' : '100dvw',
      height: sideways ? '100dvw' : '100dvh',
      transform: `translate(-50%, -50%) rotate(${compensateDeg}deg)`,
      transformOrigin: 'center center',
    }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px', background: 'rgba(0,0,0,0.75)',
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
        paddingTop: 'calc(16px + env(safe-area-inset-top))',
      }}>
        <button onClick={handleClose} style={{
          color: '#fff', fontSize: 28, lineHeight: 1,
          background: 'none', border: 'none', cursor: 'pointer', padding: 4,
        }}>✕</button>
        <span style={{
          color: '#fff', fontFamily: 'var(--font-display)',
          fontSize: 18, fontWeight: 700, letterSpacing: 1,
        }}>
          {mode === 'scan'       && 'SCAN VIN BARCODE'}
          {mode === 'capture'    && 'CAPTURE VIN TEXT'}
          {mode === 'processing' && 'READING TEXT…'}
          {mode === 'review'     && 'CONFIRM VIN'}
        </span>
        {cameraLive ? (
          <button onClick={toggleTorch} style={{
            color: torch ? '#f4a024' : '#fff', fontSize: 22,
            background: 'none', border: 'none', cursor: 'pointer', padding: 4,
          }} title="Toggle flashlight">⚡</button>
        ) : <span style={{ width: 30 }} />}
      </div>

      {/* Video feed */}
      <video
        ref={videoRef}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        muted
        playsInline
      />

      {/* Zoom control — mainly useful when a concave sticker surface makes the
          barcode small/skewed in frame; zooming in flattens that effect. */}
      {cameraLive && zoom && (
        <div style={{
          position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
          zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center',
          background: 'rgba(0,0,0,0.55)', borderRadius: 20, padding: '10px 6px', gap: 10,
        }}>
          <button onClick={() => applyZoom(zoom.value + (zoom.max - zoom.min) / 4)} style={{
            color: '#fff', fontSize: 18, width: 30, height: 30, borderRadius: 15,
            background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer',
          }}>+</button>
          <span style={{ color: '#fff', fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
            {zoom.value.toFixed(1)}×
          </span>
          <button onClick={() => applyZoom(zoom.value - (zoom.max - zoom.min) / 4)} style={{
            color: '#fff', fontSize: 18, width: 30, height: 30, borderRadius: 15,
            background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer',
          }}>−</button>
        </div>
      )}

      {/* Barcode viewfinder */}
      {mode === 'scan' && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} />
          <div style={{
            position: 'relative', width: 300, height: 300, zIndex: 2,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
            borderRadius: 4,
          }}>
            {[
              { top: 0,    left: 0,    borderTop:    '3px solid #f4a024', borderLeft:   '3px solid #f4a024' },
              { top: 0,    right: 0,   borderTop:    '3px solid #f4a024', borderRight:  '3px solid #f4a024' },
              { bottom: 0, left: 0,    borderBottom: '3px solid #f4a024', borderLeft:   '3px solid #f4a024' },
              { bottom: 0, right: 0,   borderBottom: '3px solid #f4a024', borderRight:  '3px solid #f4a024' },
            ].map((s, i) => (
              <div key={i} style={{ position: 'absolute', width: 20, height: 20, ...s }} />
            ))}
            <div style={{
              position: 'absolute', left: 0, right: 0, height: 2,
              background: 'rgba(244,60,36,0.85)',
              animation: 'scanline 2s ease-in-out infinite',
            }} />
          </div>
        </div>
      )}

      {/* OCR text-capture viewfinder */}
      {mode === 'capture' && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} />
          <div ref={guideRef} style={{
            position: 'relative', width: '86%', maxWidth: 420, height: 64, zIndex: 2,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
            borderRadius: 4,
          }}>
            {[
              { top: 0,    left: 0,    borderTop:    '3px solid #f4a024', borderLeft:   '3px solid #f4a024' },
              { top: 0,    right: 0,   borderTop:    '3px solid #f4a024', borderRight:  '3px solid #f4a024' },
              { bottom: 0, left: 0,    borderBottom: '3px solid #f4a024', borderLeft:   '3px solid #f4a024' },
              { bottom: 0, right: 0,   borderBottom: '3px solid #f4a024', borderRight:  '3px solid #f4a024' },
            ].map((s, i) => (
              <div key={i} style={{ position: 'absolute', width: 16, height: 16, ...s }} />
            ))}
          </div>
        </div>
      )}

      {/* Processing spinner */}
      {mode === 'processing' && (
        <div style={{
          position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            border: '3px solid rgba(255,255,255,0.25)', borderTopColor: '#f4a024',
            animation: 'spin 0.8s linear infinite',
          }} />
          <span style={{ color: '#fff', fontSize: 13 }}>Reading VIN text…</span>
        </div>
      )}

      {/* OCR review / confirm */}
      {mode === 'review' && (
        <div style={{
          position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '0 24px', gap: 14,
        }}>
          <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, textAlign: 'center', lineHeight: 1.6 }}>
            Check the characters below against the sticker — OCR can misread similar-looking letters/numbers.
          </p>
          <input
            value={ocrText}
            onChange={e => setOcrText(e.target.value.toUpperCase().slice(0, 17))}
            maxLength={17}
            autoComplete="off" autoCorrect="off" spellCheck={false}
            style={{
              width: '100%', maxWidth: 340, fontFamily: 'monospace', fontSize: 20,
              letterSpacing: 1.5, textAlign: 'center', padding: '12px 10px',
              borderRadius: 'var(--radius)', border: '1.5px solid var(--accent)',
              background: '#111', color: '#fff',
            }}
          />
          <span style={{ color: ocrText.length === 17 ? 'var(--success, #4caf7a)' : 'var(--text-3)', fontSize: 11 }}>
            {ocrText.length}/17
          </span>
          <button
            onClick={handleConfirmOcr}
            disabled={ocrText.length !== 17}
            style={{
              width: '100%', maxWidth: 340, padding: '13px 0', fontSize: 15, fontWeight: 700,
              borderRadius: 'var(--radius)', border: 'none', cursor: ocrText.length === 17 ? 'pointer' : 'not-allowed',
              background: ocrText.length === 17 ? 'var(--accent)' : 'rgba(255,255,255,0.15)',
              color: ocrText.length === 17 ? '#000' : 'rgba(255,255,255,0.5)',
            }}
          >Use This VIN</button>
          <button onClick={() => setMode('capture')} style={{
            color: 'rgba(255,255,255,0.7)', fontSize: 13, background: 'none',
            border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 6,
          }}>Retry photo</button>
        </div>
      )}

      {/* Bottom bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '20px 24px',
        paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
        background: mode === 'review' ? 'transparent' : 'rgba(0,0,0,0.75)', textAlign: 'center',
      }}>
        {error ? (
          <p style={{ color: '#e05252', fontSize: 14, lineHeight: 1.6 }}>{error}</p>
        ) : mode === 'scan' ? (
          <>
            <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, lineHeight: 1.6 }}>
              Point at the barcode on the driver-side door jamb
            </p>
            <button onClick={goCapture} style={{
              marginTop: 8, color: '#f4a024', fontSize: 13, background: 'none',
              border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 4,
            }}>Barcode won't scan? Capture the printed VIN instead</button>
          </>
        ) : mode === 'capture' ? (
          <>
            {ocrErr && (
              <p style={{ color: '#e05252', fontSize: 13, lineHeight: 1.6, marginBottom: 10 }}>⚠ {ocrErr}</p>
            )}
            <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 1.6, marginBottom: 14 }}>
              Fill the box with the printed 17-character VIN, then tap to capture
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 28 }}>
              <button onClick={goBackToBarcode} style={{
                color: 'rgba(255,255,255,0.7)', fontSize: 13, background: 'none',
                border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 4,
              }}>← Back to barcode</button>
              <button onClick={captureAndRecognize} aria-label="Capture" style={{
                width: 64, height: 64, borderRadius: '50%',
                background: '#fff', border: '4px solid rgba(255,255,255,0.4)', cursor: 'pointer',
              }} />
              <span style={{ width: 90 }} />
            </div>
          </>
        ) : null}
      </div>

      <style>{`
        @keyframes scanline {
          0%   { top: 10%; }
          50%  { top: 80%; }
          100% { top: 10%; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
