import React, { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { Button, Label } from '../components/UI.jsx'

export default function AuthPage() {
  const {
    signIn, signUp, passwordRecovery, requestPasswordReset, updatePassword,
    authMessage, clearAuthMessage,
  } = useApp()
  const [mode,      setMode]      = useState(passwordRecovery ? 'recovery' : 'login')
  const [firstName, setFirstName] = useState('')
  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [message,   setMessage]   = useState('')

  useEffect(() => {
    if (passwordRecovery) setMode('recovery')
  }, [passwordRecovery])

  async function handleSubmit() {
    setError(''); setMessage('')
    if (mode === 'forgot') {
      if (!email) { setError('Email is required.'); return }
    } else {
      if (mode !== 'recovery' && !email) { setError('Email is required.'); return }
      if (!password) { setError('Password is required.'); return }
      if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
      if (mode === 'recovery' && password !== passwordConfirmation) { setError('Passwords do not match.'); return }
    }
    if (mode === 'signup' && !firstName.trim()) { setError('First name is required.'); return }

    setLoading(true)
    try {
      if (mode === 'login') {
        await signIn(email, password)
      } else if (mode === 'signup') {
        await signUp(email, password, firstName.trim())
        setMessage('Account created! Check your email to confirm, then log in.')
        setMode('login')
        setFirstName('')
      } else if (mode === 'forgot') {
        await requestPasswordReset(email)
        setMessage('If an account exists for that email, a password reset link is on its way.')
      } else {
        await updatePassword(password)
      }
    } catch (e) {
      setError(e.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  function switchMode(m) {
    setMode(m); setError(''); setMessage(''); setFirstName(''); setPassword(''); setPasswordConfirmation('')
    clearAuthMessage()
  }

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: '24px',
    }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 800, color: 'var(--accent)', letterSpacing: -0.5 }}>
          PERFECTION HAIL
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 600, color: 'var(--text-3)', letterSpacing: 2, textTransform: 'uppercase', marginTop: 4 }}>
          Hail Repair Log
        </div>
      </div>

      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: 24,
        width: '100%', maxWidth: 380,
      }}>
        {/* Tab toggle */}
        {mode !== 'forgot' && mode !== 'recovery' && <div style={{ display: 'flex', background: 'var(--bg-3)', borderRadius: 'var(--radius)', padding: 3, marginBottom: 24 }}>
          {['login', 'signup'].map(m => (
            <button key={m} onClick={() => switchMode(m)} style={{
              flex: 1, padding: '9px 0',
              borderRadius: 'calc(var(--radius) - 2px)',
              fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700,
              letterSpacing: 0.5, textTransform: 'uppercase',
              border: 'none', cursor: 'pointer', transition: 'all 0.15s',
              background: mode === m ? 'var(--accent)' : 'transparent',
              color:      mode === m ? '#0f1923'       : 'var(--text-3)',
            }}>
              {m === 'login' ? 'Log In' : 'Sign Up'}
            </button>
          ))}
        </div>}

        {(mode === 'forgot' || mode === 'recovery') && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>
              {mode === 'forgot' ? 'Reset Password' : 'Choose a New Password'}
            </div>
            <p style={{ marginTop: 6, fontSize: 13, color: 'var(--text-3)', lineHeight: 1.5 }}>
              {mode === 'forgot'
                ? 'Enter your email and we’ll send you a secure reset link.'
                : 'Enter the new password you want to use for your account.'}
            </p>
          </div>
        )}

        {/* First name — signup only */}
        {mode === 'signup' && (
          <>
            <Label>First Name</Label>
            <input
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              placeholder="e.g. Mike"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </>
        )}

        {mode !== 'recovery' && <>
          <Label>Email</Label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoCapitalize="none"
            autoCorrect="off"
            autoFocus={mode === 'login' || mode === 'forgot'}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          />
        </>}

        {mode !== 'forgot' && <>
          <Label>{mode === 'recovery' ? 'New Password' : 'Password'}</Label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            autoFocus={mode === 'recovery'}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          />
        </>}

        {mode === 'recovery' && <>
          <Label>Confirm New Password</Label>
          <input
            type="password"
            value={passwordConfirmation}
            onChange={e => setPasswordConfirmation(e.target.value)}
            placeholder="••••••••"
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          />
        </>}

        {mode === 'login' && (
          <button onClick={() => switchMode('forgot')} style={{ display: 'block', margin: '12px 0 0 auto', padding: 0, background: 'none', border: 'none', color: 'var(--accent)', fontSize: 13, cursor: 'pointer' }}>
            Forgot password?
          </button>
        )}

        {error && (
          <div style={{ marginTop: 12, padding: '10px 12px', background: 'rgba(224,82,82,0.12)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--danger)', lineHeight: 1.5 }}>
            ⚠ {error}
          </div>
        )}
        {(message || authMessage) && (
          <div style={{ marginTop: 12, padding: '10px 12px', background: 'rgba(61,186,122,0.12)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--success)', lineHeight: 1.5 }}>
            ✓ {message || authMessage}
          </div>
        )}

        <div style={{ marginTop: 20 }}>
          <Button onClick={handleSubmit} loading={loading}>
            {mode === 'login' ? 'Log In' : mode === 'signup' ? 'Create Account' : mode === 'forgot' ? 'Send Reset Link' : 'Update Password'}
          </Button>
        </div>

        {mode === 'forgot' && (
          <button onClick={() => switchMode('login')} style={{ display: 'block', margin: '16px auto 0', padding: 0, background: 'none', border: 'none', color: 'var(--text-2)', fontSize: 13, cursor: 'pointer' }}>
            Back to Log In
          </button>
        )}
      </div>

      <p style={{ marginTop: 20, fontSize: 12, color: 'var(--text-3)', textAlign: 'center' }}>
        {mode === 'login'
          ? 'Need access? Ask your administrator to add your email first.'
          : mode === 'signup'
            ? 'Use the exact email your administrator added. Already registered? Switch to Log In.'
            : ''}
      </p>
    </div>
  )
}
