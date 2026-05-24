import React, { useState } from 'react'
import { AppProvider, useApp } from './context/AppContext.jsx'
import AuthPage     from './pages/AuthPage.jsx'
import LogPage      from './pages/LogPage.jsx'
import VehiclesPage from './pages/VehiclesPage.jsx'
import AdminPage    from './pages/AdminPage.jsx'
import { Spinner }  from './components/UI.jsx'

function Shell() {
  const { session, authLoading, dataLoading, isAdmin, signOut } = useApp()
  const [tab, setTab] = useState('log')

  if (authLoading) {
    return (
      <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <Spinner size={32} color="var(--accent)" />
      </div>
    )
  }

  if (!session) return <AuthPage />

  const TABS = [
    { id: 'log',      label: 'Log',       icon: '＋' },
    { id: 'vehicles', label: 'Vehicles',  icon: '🚗' },
    ...(isAdmin ? [{ id: 'admin', label: 'Admin', icon: '⚙️' }] : []),
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>

      {/* Header */}
      <header style={{
        background: 'var(--bg-2)', borderBottom: '1px solid var(--border)',
        padding: '14px 20px 12px', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{
            fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800,
            color: 'var(--accent)', letterSpacing: -0.5,
          }}>
            PDR TRACKER
          </span>
          <span style={{
            fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 600,
            color: 'var(--text-3)', letterSpacing: 2, textTransform: 'uppercase',
          }}>
            Hail Repair Log
          </span>
        </div>

        {/* User info + sign out */}
        <button
          onClick={signOut}
          style={{
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: 99, padding: '6px 14px',
            fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700,
            color: 'var(--text-2)', cursor: 'pointer', letterSpacing: 0.5,
          }}
        >
          Sign Out
        </button>
      </header>

      {/* Loading overlay when fetching data */}
      {dataLoading && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 900,
          background: 'rgba(15,25,35,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Spinner size={36} color="var(--accent)" />
        </div>
      )}

      {/* Page content */}
      <main style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain' }}>
        {tab === 'log'      && <LogPage />}
        {tab === 'vehicles' && <VehiclesPage />}
        {tab === 'admin'    && <AdminPage />}
      </main>

      {/* Bottom tab bar */}
      <nav style={{
        display: 'flex',
        background: 'var(--bg-2)', borderTop: '1px solid var(--border)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        flexShrink: 0,
      }}>
        {TABS.map(t => {
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1, padding: '12px 0 10px',
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              }}
            >
              <span style={{ fontSize: 22, lineHeight: 1 }}>{t.icon}</span>
              <span style={{
                fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700,
                letterSpacing: 0.8, textTransform: 'uppercase',
                color: active ? 'var(--accent)' : 'var(--text-3)',
              }}>
                {t.label}
              </span>
              {active && (
                <div style={{
                  width: 24, height: 2, borderRadius: 1,
                  background: 'var(--accent)', marginTop: 2,
                }} />
              )}
            </button>
          )
        })}
      </nav>
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  )
}
