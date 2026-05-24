import React, { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { Card, Badge, EmptyState, ColorDot, Button } from '../components/UI.jsx'
import { generateAndPrintReport } from '../utils/report.js'
import { exportCustomerCSV } from '../utils/storage.js'

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function VehiclesPage() {
  const { customers, vehicles, removeVehicle, vehiclesForCustomer } = useApp()
  const [expanded, setExpanded] = useState({})

  const sections = customers
    .map(c => ({ customer: c, vehicles: vehiclesForCustomer(c.id) }))
    .filter(s => s.vehicles.length > 0)
    .sort((a, b) => {
      const la = a.vehicles.map(v => v.date).sort().reverse()[0] || ''
      const lb = b.vehicles.map(v => v.date).sort().reverse()[0] || ''
      return lb.localeCompare(la)
    })

  const totalVehicles = vehicles.length

  if (totalVehicles === 0) {
    return (
      <EmptyState
        title="No vehicles logged yet"
        subtitle="Use the Log tab to scan a VIN and record your first car."
      />
    )
  }

  return (
    <div style={{ padding: '16px 16px 120px', maxWidth: 520, margin: '0 auto' }}>
      <div style={{
        fontFamily: 'var(--font-display)', fontSize: 13, letterSpacing: 1,
        color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 16,
      }}>
        {totalVehicles} vehicle{totalVehicles !== 1 ? 's' : ''} total
      </div>

      {sections.map(({ customer, vehicles: cvs }) => {
        const isOpen = expanded[customer.id] !== false // default open
        const sorted = [...cvs].sort((a, b) => new Date(b.date) - new Date(a.date))

        return (
          <div key={customer.id} style={{ marginBottom: 24 }}>
            {/* Section header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 8,
            }}>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flex: 1 }}
                onClick={() => setExpanded(e => ({ ...e, [customer.id]: !isOpen }))}
              >
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>
                  {customer.name}
                </span>
                <Badge>{cvs.length}</Badge>
                <span style={{ color: 'var(--text-3)', fontSize: 14 }}>{isOpen ? '▾' : '▸'}</span>
              </div>

              {/* Export buttons */}
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => exportCustomerCSV(customer, cvs)}
                  style={{
                    background: 'var(--surface-2)', border: '1px solid var(--border)',
                    color: 'var(--text-2)', borderRadius: 'var(--radius)',
                    padding: '6px 12px', fontSize: 12, fontWeight: 700,
                    fontFamily: 'var(--font-display)', letterSpacing: 0.5, cursor: 'pointer',
                  }}
                  title="Export CSV"
                >
                  CSV
                </button>
                <button
                  onClick={() => generateAndPrintReport(customer, cvs)}
                  style={{
                    background: 'var(--accent)', border: 'none',
                    color: '#0f1923', borderRadius: 'var(--radius)',
                    padding: '6px 12px', fontSize: 12, fontWeight: 700,
                    fontFamily: 'var(--font-display)', letterSpacing: 0.5, cursor: 'pointer',
                  }}
                  title="Print PDF"
                >
                  PDF
                </button>
              </div>
            </div>

            {/* Vehicle cards */}
            {isOpen && sorted.map(v => (
              <VehicleCard key={v.id} vehicle={v} onDelete={() => {
                if (confirm(`Delete ${v.year} ${v.make} ${v.model}?`)) removeVehicle(v.id)
              }} />
            ))}
          </div>
        )
      })}
    </div>
  )
}

function VehicleCard({ vehicle: v, onDelete }) {
  return (
    <Card style={{ marginBottom: 8, position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>
            {v.year} {v.make} {v.model}
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-3)', marginTop: 3, letterSpacing: 0.5 }}>
            {v.vin}
          </div>
        </div>
        <button
          onClick={onDelete}
          style={{ color: 'var(--danger)', fontSize: 18, background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 0 12px' }}
        >
          🗑
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
        <Chip><ColorDot color={v.color} /> {v.color}</Chip>
        <Chip>📅 {fmtDate(v.date)}</Chip>
      </div>

      {v.notes && (
        <div style={{
          marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)',
          fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5,
        }}>
          {v.notes}
        </div>
      )}
    </Card>
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
