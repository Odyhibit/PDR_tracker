import React from 'react'

export function Button({ children, onClick, variant = 'primary', loading, disabled, style }) {
  const base = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: '13px 20px', borderRadius: 'var(--radius)', fontFamily: 'var(--font-display)',
    fontSize: 17, fontWeight: 700, letterSpacing: 0.5, cursor: 'pointer',
    border: 'none', width: '100%', transition: 'opacity 0.15s, transform 0.1s',
    opacity: (disabled || loading) ? 0.5 : 1,
    ...style,
  }

  const variants = {
    primary:   { background: 'var(--accent)',   color: '#0f1923' },
    secondary: { background: 'var(--surface-2)', color: 'var(--text)', border: '1.5px solid var(--border)' },
    danger:    { background: 'var(--danger)',    color: '#fff' },
    ghost:     { background: 'transparent',      color: 'var(--accent)', border: '1.5px solid var(--accent)' },
  }

  return (
    <button
      style={{ ...base, ...variants[variant] }}
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading ? <Spinner /> : children}
    </button>
  )
}

export function Card({ children, style, onClick }) {
  const base = {
    background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border)', padding: 16,
    cursor: onClick ? 'pointer' : 'default',
    ...style,
  }
  return onClick
    ? <div style={base} onClick={onClick}>{children}</div>
    : <div style={base}>{children}</div>
}

export function Label({ children }) {
  return (
    <div style={{
      fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700,
      letterSpacing: 1.5, color: 'var(--text-3)', textTransform: 'uppercase',
      marginBottom: 6, marginTop: 16,
    }}>
      {children}
    </div>
  )
}

export function Spinner({ size = 18, color = 'currentColor' }) {
  return (
    <div style={{
      width: size, height: size,
      border: `2px solid transparent`,
      borderTopColor: color,
      borderRadius: '50%',
      animation: 'spin 0.7s linear infinite',
      display: 'inline-block',
    }} />
  )
}

export function Badge({ children, color = 'var(--accent)' }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      background: color + '22', color,
      borderRadius: 99, padding: '2px 10px',
      fontSize: 11, fontWeight: 700,
      fontFamily: 'var(--font-display)', letterSpacing: 0.5,
    }}>
      {children}
    </span>
  )
}

export function EmptyState({ title, subtitle, action }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '48px 24px', textAlign: 'center', gap: 12,
    }}>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--text-3)' }}>
        {title}
      </p>
      {subtitle && <p style={{ fontSize: 14, color: 'var(--text-3)', lineHeight: 1.6, maxWidth: 280 }}>{subtitle}</p>}
      {action && (
        <div style={{ marginTop: 8, width: 200 }}>
          <Button onClick={action.onPress}>{action.label}</Button>
        </div>
      )}
    </div>
  )
}

export function Modal({ open, onClose, title, children }) {
  if (!open) return null
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'rgba(0,0,0,0.7)', display: 'flex',
      alignItems: 'flex-end',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'var(--bg-2)', width: '100%', borderRadius: '16px 16px 0 0',
        maxHeight: '90vh', overflow: 'auto', padding: 20,
        animation: 'fadeUp 0.2s ease',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>
            {title}
          </span>
          <button onClick={onClose} style={{ fontSize: 24, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function ColorDot({ color }) {
  const map = {
    'Black': '#1a1a1a', 'White': '#e0e0e0', 'Silver': '#c0c0c0',
    'Gray': '#808080', 'Red': '#e63946', 'Blue': '#2563eb',
    'Brown / Beige': '#a0785a', 'Green': '#16a34a', 'Orange': '#ea580c',
    'Gold / Yellow': '#ca8a04', 'Purple': '#7c3aed', 'Other': '#64748b',
  }
  return (
    <div style={{
      width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
      background: map[color] || '#64748b',
      border: '1px solid rgba(255,255,255,0.2)',
    }} />
  )
}
