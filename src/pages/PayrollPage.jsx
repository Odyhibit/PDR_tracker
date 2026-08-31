import React, { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { Card, Badge, EmptyState, ColorDot, Label } from '../components/UI.jsx'
import { formatCentralDate, upcomingFridayCentralISO } from '../utils/dates.js'

function fmtDate(iso) {
  return formatCentralDate(iso, { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function PayrollPage() {
  const { vehicles, profiles, customers, payVehicle, isStaff } = useApp()
  const [payDate, setPayDate] = useState(upcomingFridayCentralISO())
  const [paying,  setPaying]  = useState({}) // vehicleId -> bool, disables the button mid-request

  if (!isStaff) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <p style={{ color: 'var(--text-3)', fontSize: 15 }}>Staff access only.</p>
      </div>
    )
  }

  const unpaid = vehicles.filter(v => !v.paid_date)

  const profileByUserId = Object.fromEntries(profiles.map(p => [p.user_id, p]))
  const customerById     = Object.fromEntries(customers.map(c => [c.id, c]))

  const groups = {}
  for (const v of unpaid) {
    const key = v.user_id || 'unknown'
    if (!groups[key]) groups[key] = []
    groups[key].push(v)
  }

  const sections = Object.entries(groups)
    .map(([userId, list]) => {
      const p = profileByUserId[userId]
      const name = p ? [p.first_name, p.last_name].filter(Boolean).join(' ') : (list[0]?.logged_by || 'Unknown')
      return { userId, name, vehicles: list.sort((a, b) => new Date(a.date) - new Date(b.date)) }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  async function handlePay(vehicleId) {
    setPaying(s => ({ ...s, [vehicleId]: true }))
    try {
      await payVehicle(vehicleId, payDate)
    } catch (e) {
      alert(e.message || 'Failed to mark paid.')
    } finally {
      setPaying(s => ({ ...s, [vehicleId]: false }))
    }
  }

  async function handlePayAll(list) {
    if (!confirm(`Mark all ${list.length} car(s) paid on ${fmtDate(payDate)}?`)) return
    for (const v of list) await handlePay(v.id)
  }

  return (
    <div style={{ padding: '16px 16px 120px', maxWidth: 520, margin: '0 auto' }}>
      <Label>Pay Date</Label>
      <input
        type="date"
        value={payDate}
        onChange={e => setPayDate(e.target.value)}
        style={{ colorScheme: 'dark', marginBottom: 20 }}
      />
      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: -14, marginBottom: 20 }}>
        Defaults to the upcoming Friday — adjust if processing early.
      </div>

      <div style={{
        fontFamily: 'var(--font-display)', fontSize: 13, letterSpacing: 1,
        color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 16,
      }}>
        {unpaid.length} unpaid car{unpaid.length !== 1 ? 's' : ''}
      </div>

      {sections.length === 0 ? (
        <EmptyState title="All caught up" subtitle="No unpaid cars right now." />
      ) : sections.map(({ userId, name, vehicles: list }) => (
        <div key={userId} style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>
                {name}
              </span>
              <Badge>{list.length}</Badge>
            </div>
            <button
              onClick={() => handlePayAll(list)}
              style={{
                background: 'var(--accent)', border: 'none',
                color: '#0f1923', borderRadius: 'var(--radius)',
                padding: '6px 12px', fontSize: 12, fontWeight: 700,
                fontFamily: 'var(--font-display)', letterSpacing: 0.5, cursor: 'pointer',
              }}
            >
              Pay All
            </button>
          </div>

          {list.map(v => (
            <Card key={v.id} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>
                    {v.year} {v.make} {v.model}
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-3)', marginTop: 3, letterSpacing: 0.5 }}>
                    {v.vin}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                    <Chip><ColorDot color={v.color} /> {v.color}</Chip>
                    <Chip>📅 {fmtDate(v.date)}</Chip>
                    {customerById[v.customer_id] && <Chip>🏢 {customerById[v.customer_id].name}</Chip>}
                  </div>
                </div>
                <button
                  onClick={() => handlePay(v.id)}
                  disabled={!!paying[v.id]}
                  style={{
                    flexShrink: 0, background: 'var(--accent)', border: 'none',
                    color: '#0f1923', borderRadius: 'var(--radius)',
                    padding: '10px 16px', fontSize: 13, fontWeight: 700,
                    fontFamily: 'var(--font-display)', letterSpacing: 0.5,
                    cursor: 'pointer', opacity: paying[v.id] ? 0.5 : 1,
                  }}
                >
                  {paying[v.id] ? '…' : 'Pay'}
                </button>
              </div>
            </Card>
          ))}
        </div>
      ))}
    </div>
  )
}

function Chip({ children }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: 'var(--bg-3)', borderRadius: 99,
      padding: '4px 10px', fontSize: 12, color: 'var(--text-2)',
    }}>
      {children}
    </div>
  )
}
