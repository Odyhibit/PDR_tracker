import React, { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library'

const OVERLAY_STYLE = {
  position: 'fixed', inset: 0, zIndex: 1000,
  background: '#000', display: 'flex', flexDirection: 'column',
}

const VIN_RE = /[A-HJ-NPR-Z0-9]{17}/i

export default function VinScanner({ onScanned, onClose }) {
  const videoRef  = useRef(null)
  const readerRef = useRef(null)
  const [error, setError]     = useState(null)
  const [torch, setTorch]     = useState(false)
  const streamRef = useRef(null)

  useEffect(() => {
    const reader = new BrowserMultiFormatReader()
    readerRef.current = reader

    reader.decodeFromConstraints(
      {
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        }
      },
      videoRef.current,
      (result, err) => {
        if (result) {
          const raw     = result.getText()
          const cleaned = raw.replace(/[^A-HJ-NPR-Z0-9]/gi, '').toUpperCase()
          const match   = cleaned.match(VIN_RE)
          if (match) {
            // Vibrate if supported
            if (navigator.vibrate) navigator.vibrate(100)
            cleanup()
            onScanned(match[0])
          }
        }
        // NotFoundException is normal — just means no barcode in frame yet
      }
    ).then(controls => {
      streamRef.current = controls
    }).catch(err => {
      if (err.name === 'NotAllowedError') {
        setError('Camera permission denied. Please allow camera access in your browser settings.')
      } else {
        setError(`Camera error: ${err.message}`)
      }
    })

    return () => cleanup()
  }, [])

  function cleanup() {
    if (readerRef.current) {
      readerRef.current.reset()
    }
  }

  async function toggleTorch() {
    try {
      const stream = videoRef.current?.srcObject
      if (!stream) return
      const track = stream.getVideoTracks()[0]
      const capabilities = track.getCapabilities()
      if (!capabilities.torch) return
      await track.applyConstraints({ advanced: [{ torch: !torch }] })
      setTorch(t => !t)
    } catch { /* torch not supported on this device */ }
  }

  return (
    <div style={OVERLAY_STYLE}>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px', background: 'rgba(0,0,0,0.7)',
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
      }}>
        <button onClick={() => { cleanup(); onClose() }} style={{
          color: '#fff', fontSize: 28, lineHeight: 1, background: 'none',
          border: 'none', cursor: 'pointer', padding: 4,
        }}>✕</button>
        <span style={{ color: '#fff', fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, letterSpacing: 1 }}>
          SCAN VIN BARCODE
        </span>
        <button onClick={toggleTorch} style={{
          color: torch ? '#f4a024' : '#fff', fontSize: 22, background: 'none',
          border: 'none', cursor: 'pointer', padding: 4,
        }}>⚡</button>
      </div>

      {/* Video */}
      <video
        ref={videoRef}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        muted
        playsInline
      />

      {/* Viewfinder overlay */}
      <div style={{
        position: 'absolute', inset: 0, display: 'flex',
        alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
      }}>
        {/* Dark mask */}
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} />

        {/* Cutout */}
        <div style={{
          position: 'relative', width: 300, height: 90, zIndex: 2,
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
          borderRadius: 4,
        }}>
          {/* Corner marks */}
          {[
            { top: 0, left: 0,  borderTop: '3px solid #f4a024', borderLeft:  '3px solid #f4a024' },
            { top: 0, right: 0, borderTop: '3px solid #f4a024', borderRight: '3px solid #f4a024' },
            { bottom: 0, left: 0,  borderBottom: '3px solid #f4a024', borderLeft:  '3px solid #f4a024' },
            { bottom: 0, right: 0, borderBottom: '3px solid #f4a024', borderRight: '3px solid #f4a024' },
          ].map((s, i) => (
            <div key={i} style={{ position: 'absolute', width: 20, height: 20, ...s }} />
          ))}

          {/* Animated scan line */}
          <div style={{
            position: 'absolute', left: 0, right: 0, height: 2,
            background: 'rgba(244,160,36,0.8)',
            animation: 'scanline 2s ease-in-out infinite',
          }} />
        </div>
      </div>

      {/* Bottom hint */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '20px 24px 40px', background: 'rgba(0,0,0,0.7)',
        textAlign: 'center',
      }}>
        {error ? (
          <p style={{ color: '#e05252', fontSize: 14, lineHeight: 1.5 }}>{error}</p>
        ) : (
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, lineHeight: 1.5 }}>
            Aim at the barcode on the driver-side door jamb
          </p>
        )}
      </div>

      <style>{`
        @keyframes scanline {
          0%   { top: 10%; }
          50%  { top: 80%; }
          100% { top: 10%; }
        }
      `}</style>
    </div>
  )
}
