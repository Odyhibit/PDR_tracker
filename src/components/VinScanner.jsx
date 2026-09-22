import React, { useEffect, useRef, useState } from 'react'
import {
  BrowserMultiFormatReader, DecodeHintType, BarcodeFormat,
  HTMLCanvasElementLuminanceSource, BinaryBitmap, HybridBinarizer,
} from '@zxing/library'

const VIN_RE    = /[A-HJ-NPR-Z0-9]{17}/i
const VIN_CHARS = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789' // VIN alphabet — no I, O, or Q

// Secondary fallback only — testing against real photos showed the dominant
// cause of failed reads is effective resolution on the barcode, not sticker
// curvature (the live scanner's guide-box crop below is what actually fixes
// that). A still capture run through a few assumed horizontal bow corrections
// still costs nothing to try first and occasionally helps a genuinely curved
// sticker, so it stays as a fallback rather than the primary fix.
const CURVATURE_LEVELS = [0, 0.08, -0.08, 0.16, -0.16, 0.24, -0.24, 0.32, -0.32]

// Resamples column-by-column so the center stays put while the edges bow in
// or out by `k` — a cheap stand-in for a true cylindrical un-warp that's
// close enough for the mild curvature a door-jamb sticker actually has.
function dewarpHorizontal(sourceCanvas, k) {
  if (k === 0) return sourceCanvas
  const w = sourceCanvas.width, h = sourceCanvas.height
  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  const ctx = out.getContext('2d')
  for (let x = 0; x < w; x++) {
    const t    = (x / (w - 1)) * 2 - 1
    const srcT = t + k * t * (1 - t * t)
    const srcX = Math.min(w - 1, Math.max(0, ((srcT + 1) / 2) * (w - 1)))
    ctx.drawImage(sourceCanvas, srcX, 0, 1, h, x, 0, 1, h)
  }
  return out
}

// Fixed, predictable zoom stops instead of dividing the device's raw
// [min,max] range into equal fractional steps (which produced odd values
// like 1.6/2.2/2.8 and didn't round-trip cleanly). Whole numbers from 1x up
// to the device's max, plus a single 0.5x stop below 1x if the device
// actually supports zooming out that far (e.g. has an ultra-wide lens).
function buildZoomLevels(min, max) {
  const levels = []
  if (min <= 0.5 && max >= 0.5) levels.push(0.5)
  const start = Math.max(1, Math.ceil(min))
  for (let v = start; v <= Math.floor(max) && v <= max; v++) levels.push(v)
  if (levels.length === 0) levels.push(Number(min.toFixed(1)))
  return levels
}

export default function VinScanner({ onScanned, onClose }) {
  const videoRef        = useRef(null)
  const readerRef       = useRef(null)
  const streamRef       = useRef(null)
  const guideRef        = useRef(null)
  const barcodeGuideRef = useRef(null)
  const modeRef         = useRef('scan')

  const [error,   setError]   = useState(null)
  const [torch,   setTorch]   = useState(false)
  const [zoom,    setZoom]    = useState(null) // { levels, index } once detected, else null — see buildZoomLevels
  // 'scan' (barcode) | 'capture' (frame VIN text) | 'processing' (running OCR) | 'review' (confirm OCR result)
  const [mode,    setMode]    = useState('scan')
  const [ocrText, setOcrText] = useState('')
  const [ocrErr,  setOcrErr]  = useState('')
  const [stillBusy, setStillBusy] = useState(false)
  const [stillErr,  setStillErr]  = useState('')
  const [streamRes, setStreamRes] = useState('') // actual negotiated camera resolution, for diagnosing "why is this blurry"
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
    // formats and forcing TRY_HARDER makes decoding more tolerant of blur/skew.
    const hints = new Map()
    hints.set(DecodeHintType.TRY_HARDER, true)
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_39, BarcodeFormat.CODE_128])
    readerRef.current = new BrowserMultiFormatReader(hints)

    let pollId = null
    let cancelled = false

    // Decoding the *whole* video frame continuously (the old approach) gives
    // the barcode only a small slice of the frame's pixels at a normal
    // holding distance — real test photos showed that's the actual thing
    // breaking reads, not curvature. Cropping to just the guide box before
    // each decode attempt effectively gives it much more resolution to work
    // with, for free, without requiring the user to physically zoom in.
    navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'environment',
        // `ideal` is a soft preference, not a requirement — the browser can
        // still negotiate down on a device that can't do 4K, so this never
        // throws, it just asks for as much as the hardware will give us.
        width:  { ideal: 3840 },
        height: { ideal: 2160 },
        advanced: [{ focusMode: 'continuous' }],
      }
    }).then(stream => {
      if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
      streamRef.current = stream
      videoRef.current.srcObject = stream
      videoRef.current.play().catch(() => {})
      const track = stream.getVideoTracks()[0]
      const settings = track?.getSettings?.()
      if (settings?.width) setStreamRes(`${settings.width}×${settings.height}`)
      pollId = setInterval(() => {
        if (modeRef.current !== 'scan') return
        const canvas = cropElementToCanvas(barcodeGuideRef.current, 2)
        if (!canvas) return
        const raw = decodeCanvas(canvas)
        if (raw) {
          const cleaned = raw.replace(/[^A-HJ-NPR-Z0-9]/gi, '').toUpperCase()
          const match   = cleaned.match(VIN_RE)
          if (match) {
            if (navigator.vibrate) navigator.vibrate(100)
            cleanup()
            onScanned(match[0])
          }
        }
      }, 300)
    }).catch(err => {
      if (err.name === 'NotAllowedError') {
        setError('Camera permission denied. Please allow camera access in your browser settings, then reload.')
      } else {
        setError(`Camera error: ${err.message}`)
      }
    })

    return () => {
      cancelled = true
      if (pollId) clearInterval(pollId)
      cleanup()
    }
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
        const levels  = buildZoomLevels(caps.zoom.min, caps.zoom.max)
        const current = track.getSettings?.().zoom ?? levels[0]
        // Start at whichever predefined level is closest to wherever the
        // camera actually opened, so the displayed value matches reality.
        let index = 0, best = Infinity
        levels.forEach((lvl, i) => {
          const diff = Math.abs(lvl - current)
          if (diff < best) { best = diff; index = i }
        })
        setZoom({ levels, index })
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
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
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

  // Steps through the fixed zoom levels by +1/-1 index rather than adding a
  // raw amount to the current value — that's what makes it round-trip
  // cleanly (zooming in N steps then back out N steps always lands on
  // exactly the levels you started from, never drifting to an off-grid value).
  async function stepZoom(direction) {
    if (!zoom) return
    const nextIndex = Math.min(zoom.levels.length - 1, Math.max(0, zoom.index + direction))
    if (nextIndex === zoom.index) return
    try {
      const stream = videoRef.current?.srcObject
      const track  = stream?.getVideoTracks()[0]
      if (!track) return
      await track.applyConstraints({ advanced: [{ zoom: zoom.levels[nextIndex] }] })
      setZoom(z => z ? { ...z, index: nextIndex } : z)
    } catch { /* zoom not supported */ }
  }

  function goCapture() {
    setOcrErr('')
    setMode('capture')
  }

  function decodeCanvas(canvas) {
    try {
      const source = new HTMLCanvasElementLuminanceSource(canvas)
      const bitmap = new BinaryBitmap(new HybridBinarizer(source))
      return readerRef.current.decodeBitmap(bitmap).getText()
    } catch {
      return null // NotFoundException / ChecksumException / FormatException — just means this candidate didn't decode
    }
  }

  // Maps an on-screen guide box back to the underlying video frame's pixel
  // coordinates (accounting for the object-fit: cover crop) and draws just
  // that region, upscaled, onto a fresh canvas. Real test photos showed this
  // matters a lot: decoding a small guide-box crop at some upscale gives the
  // decoder far more effective resolution on the target than decoding the
  // full video frame ever does at a normal holding distance.
  function cropElementToCanvas(guideEl, upscale = 2) {
    const video = videoRef.current
    if (!video || !guideEl || !video.videoWidth) return null

    const videoRect = video.getBoundingClientRect()
    const guideRect = guideEl.getBoundingClientRect()

    const scale     = Math.max(videoRect.width / video.videoWidth, videoRect.height / video.videoHeight)
    const renderedW = video.videoWidth  * scale
    const renderedH = video.videoHeight * scale
    const offsetX   = (renderedW - videoRect.width)  / 2
    const offsetY   = (renderedH - videoRect.height) / 2

    const srcX = (guideRect.left - videoRect.left + offsetX) / scale
    const srcY = (guideRect.top  - videoRect.top  + offsetY) / scale
    const srcW = guideRect.width  / scale
    const srcH = guideRect.height / scale

    const canvas  = document.createElement('canvas')
    canvas.width  = Math.round(srcW * upscale)
    canvas.height = Math.round(srcH * upscale)
    canvas.getContext('2d').drawImage(video, srcX, srcY, srcW, srcH, 0, 0, canvas.width, canvas.height)
    return canvas
  }

  // Freezes one still frame and tries it through several assumed curvature
  // corrections (see CURVATURE_LEVELS) — a still capture is sharper than any
  // single live-video frame and, unlike the continuous decoder, we can afford
  // to spend real time per attempt trying to undo the sticker's warp.
  async function captureStillAndDecode() {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    setStillErr('')
    setStillBusy(true)
    try {
      // Cap the working resolution — 1D barcode decoding doesn't need full
      // sensor res, and this keeps the per-variant column resampling fast.
      const maxW  = 1280
      const scale = Math.min(1, maxW / video.videoWidth)
      const base  = document.createElement('canvas')
      base.width  = Math.round(video.videoWidth  * scale)
      base.height = Math.round(video.videoHeight * scale)
      base.getContext('2d').drawImage(video, 0, 0, base.width, base.height)

      for (const k of CURVATURE_LEVELS) {
        const candidate = dewarpHorizontal(base, k)
        const raw = decodeCanvas(candidate)
        if (raw) {
          const cleaned = raw.replace(/[^A-HJ-NPR-Z0-9]/gi, '').toUpperCase()
          const match   = cleaned.match(VIN_RE)
          if (match) {
            if (navigator.vibrate) navigator.vibrate(100)
            cleanup()
            onScanned(match[0])
            return
          }
        }
        // Yield a tick between variants so the "trying…" state can actually paint.
        await new Promise(r => setTimeout(r, 0))
      }
      setStillErr("Couldn't read it in a still image either — try the text-capture option below.")
    } finally {
      setStillBusy(false)
    }
  }

  function goBackToBarcode() {
    setOcrErr('')
    setOcrText('')
    setMode('scan')
  }

  // OCR-specific: crops the text guide box (via cropElementToCanvas) then
  // grayscales + contrast-stretches it, which meaningfully improves accuracy
  // on the small printed VIN text vs. feeding it the full frame.
  // Note: the guide box lives in the chrome layer, so if the OS is currently
  // misreading landscape (compensateDeg !== 0) while the guide sits rotated
  // over an unrotated video, the cropped text won't be upright — a rare
  // combination (OCR fallback used mid-false-rotation) not worth the extra
  // unverified rotation math to correct for right now.
  function cropGuideToCanvas() {
    const canvas = cropElementToCanvas(guideRef.current, 2.5)
    if (!canvas) return null
    const ctx = canvas.getContext('2d')

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const d = imgData.data
    let min = 255, max = 0
    for (let i = 0; i < d.length; i += 4) {
      const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
      d[i] = d[i + 1] = d[i + 2] = gray
      if (gray < min) min = gray
      if (gray > max) max = gray
    }
    // Stretch contrast so faint gray-on-dark plaque text uses the full 0–255
    // range — low native contrast (and the manufacturer's-name texture some
    // plaques have behind the text) is the main thing holding OCR back here.
    const range = max - min
    if (range > 10) {
      for (let i = 0; i < d.length; i += 4) {
        const v = ((d[i] - min) / range) * 255
        d[i] = d[i + 1] = d[i + 2] = v
      }
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

  // Everything except the raw <video> is UI — buttons, text, the aiming
  // guides, the scanline — and all of it counter-rotates together to stay
  // portrait-up when the OS misreads landscape. The video itself is left
  // alone: the live camera frame isn't affected by that false reading (it's
  // tied to the camera hardware, not page layout), so rotating it too just
  // breaks an otherwise-correct picture and makes it impossible to aim.
  const chromeStyle = compensateDeg === 0 ? {
    position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none',
  } : {
    position: 'absolute', top: '50%', left: '50%', zIndex: 10, pointerEvents: 'none',
    width:  sideways ? '100dvh' : '100dvw',
    height: sideways ? '100dvw' : '100dvh',
    transform: `translate(-50%, -50%) rotate(${compensateDeg}deg)`,
    transformOrigin: 'center center',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: '#000',
      width: '100dvw', height: '100dvh',
    }}>
      {/* Video feed — always natural/unrotated, exactly what the camera sees */}
      <video
        ref={videoRef}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        muted
        playsInline
      />

      {/* Chrome layer — everything except the raw video is UI, and all of it
          (including the aiming guides and scanline) counter-rotates together
          to stay portrait-up when the OS misreads landscape. Only the video
          itself is left alone (see the note above chromeStyle). */}
      <div style={chromeStyle}>

      {/* Barcode viewfinder */}
      {mode === 'scan' && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} />
          {/* Wide rectangle, not a square — matches an actual barcode's
              proportions so the crop fed to the decoder isn't mostly wasted
              on empty space above/below it. */}
          <div ref={barcodeGuideRef} style={{
            position: 'relative', width: '90%', maxWidth: 480, height: 110, zIndex: 2,
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

      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px', background: 'rgba(0,0,0,0.75)',
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
        paddingTop: 'calc(16px + env(safe-area-inset-top))',
        pointerEvents: 'auto',
      }}>
        <button onClick={handleClose} style={{
          color: '#fff', fontSize: 28, lineHeight: 1,
          background: 'none', border: 'none', cursor: 'pointer', padding: 4,
        }}>✕</button>
        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{
            color: '#fff', fontFamily: 'var(--font-display)',
            fontSize: 18, fontWeight: 700, letterSpacing: 1,
          }}>
            {mode === 'scan'       && 'SCAN VIN BARCODE'}
            {mode === 'capture'    && 'CAPTURE VIN TEXT'}
            {mode === 'processing' && 'READING TEXT…'}
            {mode === 'review'     && 'CONFIRM VIN'}
          </span>
          {/* Actual negotiated camera resolution — temporary diagnostic so we
              can see what the hardware actually gave us vs. what we asked for. */}
          {cameraLive && streamRes && (
            <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, marginTop: 2 }}>
              {streamRes}
            </span>
          )}
        </span>
        {cameraLive ? (
          <button onClick={toggleTorch} style={{
            color: torch ? '#f4a024' : '#fff', fontSize: 22,
            background: 'none', border: 'none', cursor: 'pointer', padding: 4,
          }} title="Toggle flashlight">⚡</button>
        ) : <span style={{ width: 30 }} />}
      </div>

      {/* Zoom control — mainly useful when a concave sticker surface makes the
          barcode small/skewed in frame; zooming in flattens that effect. */}
      {cameraLive && zoom && (
        <div style={{
          position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
          zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center',
          background: 'rgba(0,0,0,0.55)', borderRadius: 20, padding: '10px 6px', gap: 10,
          pointerEvents: 'auto',
        }}>
          <button onClick={() => stepZoom(1)} disabled={zoom.index === zoom.levels.length - 1} style={{
            color: zoom.index === zoom.levels.length - 1 ? 'rgba(255,255,255,0.35)' : '#fff', fontSize: 18,
            width: 30, height: 30, borderRadius: 15,
            background: 'rgba(255,255,255,0.15)', border: 'none',
            cursor: zoom.index === zoom.levels.length - 1 ? 'default' : 'pointer',
          }}>+</button>
          <span style={{ color: '#fff', fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
            {zoom.levels[zoom.index] % 1 === 0 ? zoom.levels[zoom.index] : zoom.levels[zoom.index].toFixed(1)}×
          </span>
          <button onClick={() => stepZoom(-1)} disabled={zoom.index === 0} style={{
            color: zoom.index === 0 ? 'rgba(255,255,255,0.35)' : '#fff', fontSize: 18,
            width: 30, height: 30, borderRadius: 15,
            background: 'rgba(255,255,255,0.15)', border: 'none',
            cursor: zoom.index === 0 ? 'default' : 'pointer',
          }}>−</button>
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
          pointerEvents: 'auto',
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
        pointerEvents: 'auto',
      }}>
        {error ? (
          <p style={{ color: '#e05252', fontSize: 14, lineHeight: 1.6 }}>{error}</p>
        ) : mode === 'scan' ? (
          <>
            {stillErr && (
              <p style={{ color: '#e05252', fontSize: 13, lineHeight: 1.6, marginBottom: 8 }}>⚠ {stillErr}</p>
            )}
            <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, lineHeight: 1.6 }}>
              Fill the box with the barcode on the driver-side door jamb
            </p>
            <button onClick={captureStillAndDecode} disabled={stillBusy} style={{
              marginTop: 8, color: stillBusy ? 'rgba(244,160,36,0.5)' : '#f4a024', fontSize: 13, background: 'none',
              border: 'none', cursor: stillBusy ? 'default' : 'pointer', textDecoration: 'underline', padding: 4,
              display: 'block', width: '100%',
            }}>{stillBusy ? 'Trying a few angles…' : "Not lining up? Try a still-image scan"}</button>
            <button onClick={goCapture} style={{
              marginTop: 6, color: '#f4a024', fontSize: 13, background: 'none',
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

      </div>
      {/* end chrome layer */}

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
