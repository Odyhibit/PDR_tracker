import React, { useState } from 'react'
import { AppProvider } from './context/AppContext.jsx'
import LogPage       from './pages/LogPage.jsx'
import VehiclesPage  from './pages/VehiclesPage.jsx'
import CustomersPage from './pages/CustomersPage.jsx'

const TABS = [
  { id: 'log',       label: 'Log',       icon: '＋' },
  { id: 'vehicles',  label: 'Vehicles',  icon: '🚗' },
  { id: 'customers', label: 'Customers', icon: '🏢' },
]

export default function App() {
  const [tab, setTab] = useState('log')

  return (
    <AppProvider>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>

        {/* Header */}
        <header style={{
          background: 'var(--bg-2)', borderBottom: '1px solid var(--border)',
          padding: '14px 20px 12px', flexShrink: 0,
          display: 'flex', alignItems: 'baseline', gap: 10,
        }}>
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
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain' }}>
          {tab === 'log'       && <LogPage />}
          {tab === 'vehicles'  && <VehiclesPage />}
          {tab === 'customers' && <CustomersPage />}
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
                  transition: 'opacity 0.15s',
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

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </AppProvider>
  )
}
