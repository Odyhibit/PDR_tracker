import React, { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { Button, Label } from '../components/UI.jsx'

export default function AuthPage() {
  const { signIn, signUp } = useApp()
  const [mode,     setMode]     = useState('login') // 'login' | 'signup'
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [message,  setMessage]  = useState('')

  async function handleSubmit() {
    setError('')
    setMessage('')
    if (!email || !password) { setError('Email and password are required.'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }

    setLoading(true)
    try {
      if (mode === 'login') {
        await signIn(email, password)
        // AppContext will handle the session change automatically
      } else {
        await signUp(email, password)
        setMessage('Account created! Check your email to confirm, then log in.')
        setMode('login')
      }
    } catch (e) {
      setError(e.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: '24px',
    }}>
      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{
          fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 800,
          color: 'var(--accent)', letterSpacing: -0.5,
        }}>
          PDR TRACKER
        </div>
        <div style={{
          fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 600,
          color: 'var(--text-3)', letterSpacing: 2, textTransform: 'uppercase', marginTop: 4,
        }}>
          Hail Repair Log
        </div>
      </div>

      {/* Card */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: 24,
        width: '100%', maxWidth: 380,
      }}>
        {/* Tab toggle */}
        <div style={{
          display: 'flex', background: 'var(--bg-3)',
          borderRadius: 'var(--radius)', padding: 3, marginBottom: 24,
        }}>
          {['login', 'signup'].map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(''); setMessage('') }}
              style={{
                flex: 1, padding: '9px 0',
                borderRadius: 'calc(var(--radius) - 2px)',
                fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700,
                letterSpacing: 0.5, textTransform: 'uppercase',
                border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                background: mode === m ? 'var(--accent)' : 'transparent',
                color:      mode === m ? '#0f1923'       : 'var(--text-3)',
              }}
            >
              {m === 'login' ? 'Log In' : 'Sign Up'}
            </button>
          ))}
        </div>

        <Label>Email</Label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoCapitalize="none"
          autoCorrect="off"
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        />

        <Label>Password</Label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="••••••••"
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        />

        {error && (
          <div style={{
            marginTop: 12, padding: '10px 12px',
            background: 'rgba(224,82,82,0.12)', borderRadius: 'var(--radius)',
            fontSize: 13, color: 'var(--danger)', lineHeight: 1.5,
          }}>
            ⚠ {error}
          </div>
        )}

        {message && (
          <div style={{
            marginTop: 12, padding: '10px 12px',
            background: 'rgba(61,186,122,0.12)', borderRadius: 'var(--radius)',
            fontSize: 13, color: 'var(--success)', lineHeight: 1.5,
          }}>
            ✓ {message}
          </div>
        )}

        <div style={{ marginTop: 20 }}>
          <Button onClick={handleSubmit} loading={loading}>
            {mode === 'login' ? 'Log In' : 'Create Account'}
          </Button>
        </div>
      </div>

      <p style={{ marginTop: 20, fontSize: 12, color: 'var(--text-3)', textAlign: 'center' }}>
        {mode === 'login'
          ? 'Need access? Ask your administrator to create an account.'
          : 'Already have an account? Switch to Log In above.'}
      </p>
    </div>
  )
}
