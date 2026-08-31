import React, { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { Card, Badge, EmptyState, ColorDot, Button, Label, Modal } from '../components/UI.jsx'
import { generateAndPrintReport } from '../utils/report.js'
import { exportCustomerCSV } from '../utils/storage.js'
import { formatCentralDate } from '../utils/dates.js'
import { COLORS } from './LogPage.jsx'

function fmtDate(iso) {
  return formatCentralDate(iso, { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function VehiclesPage() {
  const { session, customers, vehicles, addVehicle, removeVehicle } = useApp()
  const [expanded, setExpanded] = useState({})
  const [editing,  setEditing]  = useState(null) // vehicle being edited, or null
  const [form,     setForm]     = useState(null)
  const [saving,   setSaving]   = useState(false)
  const [showAll,  setShowAll]  = useState(false) // default: unpaid only

  // Editable customer list: active ones, plus whatever this vehicle is
  // currently assigned to even if that lot has since been archived —
  // otherwise editing any other field would silently unassign it.
  const editableCustomers = editing
    ? customers.filter(c => c.active || c.id === editing.customer_id)
    : []

  function openEdit(v) {
    setEditing(v)
    setForm({ customer_id: v.customer_id || '', date: v.date, color: v.color || '', notes: v.notes || '' })
  }

  async function handleSaveEdit() {
    setSaving(true)
    try {
      // Built explicitly (not spread from `editing`) — that object carries a
      // joined `customers: {...}` field from getVehicles() that isn't a real
      // column and would break the upsert.
      await addVehicle({
        id:          editing.id,
        vin:         editing.vin,
        make:        editing.make,
        model:       editing.model,
        year:        editing.year,
        logged_by:   editing.logged_by,
        paid_date:   editing.paid_date,
        created_at:  editing.created_at,
        customer_id: form.customer_id,
        date:        form.date,
        color:       form.color,
        notes:       form.notes,
      })
      setEditing(null)
    } catch (e) {
      alert(e.message || 'Failed to save changes.')
    } finally {
      setSaving(false)
    }
  }

  // Admin/back office can see everyone's cars (RLS allows it, for the
  // payroll report) — this page stays "my logged cars" for every role.
  const myVehicles  = vehicles.filter(v => v.user_id === session?.user?.id)
  const unpaidCount = myVehicles.filter(v => !v.paid_date).length
  const totalVehicles = myVehicles.length

  // Sections are built from the currently displayed set (unpaid-only by
  // default), so a customer with nothing unpaid just drops out of the list —
  // but CSV/PDF export always covers that customer's full history, not just
  // what's on screen, so switching the toggle isn't required to run a report.
  const sections = customers
    .map(c => {
      const allForCustomer = myVehicles.filter(v => v.customer_id === c.id)
      const shown = showAll ? allForCustomer : allForCustomer.filter(v => !v.paid_date)
      return { customer: c, vehicles: shown, allVehicles: allForCustomer }
    })
    .filter(s => s.vehicles.length > 0)
    .sort((a, b) => {
      const la = a.vehicles.map(v => v.date).sort().reverse()[0] || ''
      const lb = b.vehicles.map(v => v.date).sort().reverse()[0] || ''
      return lb.localeCompare(la)
    })

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 10 }}>
        <span style={{
          fontFamily: 'var(--font-display)', fontSize: 13, letterSpacing: 1,
          color: 'var(--text-3)', textTransform: 'uppercase',
        }}>
          {showAll
            ? `${totalVehicles} vehicle${totalVehicles !== 1 ? 's' : ''} total`
            : `${unpaidCount} unpaid`}
        </span>

        <div style={{ display: 'flex', background: 'var(--bg-3)', borderRadius: 'var(--radius)', padding: 3 }}>
          {[['unpaid', 'Unpaid'], ['all', 'All']].map(([key, label]) => (
            <button key={key} onClick={() => setShowAll(key === 'all')} style={{
              padding: '6px 14px',
              borderRadius: 'calc(var(--radius) - 2px)',
              fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700,
              letterSpacing: 0.5, textTransform: 'uppercase',
              border: 'none', cursor: 'pointer',
              background: (key === 'all') === showAll ? 'var(--accent)' : 'transparent',
              color:      (key === 'all') === showAll ? '#0f1923'       : 'var(--text-3)',
            }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {sections.length === 0 && (
        <EmptyState
          title="All caught up"
          subtitle="No unpaid vehicles right now."
          action={{ label: 'Show All Vehicles', onPress: () => setShowAll(true) }}
        />
      )}

      {sections.map(({ customer, vehicles: cvs, allVehicles }) => {
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
                <Badge>{cvs.length}{!showAll && allVehicles.length !== cvs.length ? ` / ${allVehicles.length}` : ''}</Badge>
                <span style={{ color: 'var(--text-3)', fontSize: 14 }}>{isOpen ? '▾' : '▸'}</span>
              </div>

              {/* Export buttons — always cover this customer's full history, not just what's shown */}
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => exportCustomerCSV(customer, allVehicles)}
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
                  onClick={() => generateAndPrintReport(customer, allVehicles)}
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
              <VehicleCard key={v.id} vehicle={v} onEdit={() => openEdit(v)} onDelete={() => {
                if (confirm(`Delete ${v.year} ${v.make} ${v.model}?`)) removeVehicle(v.id)
              }} />
            ))}
          </div>
        )
      })}

      {/* Edit modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Vehicle">
        {editing && form && (
          <>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, color: 'var(--accent)' }}>
              {editing.year} {editing.make} {editing.model}
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-3)', marginTop: 4, letterSpacing: 0.5 }}>
              {editing.vin}
            </div>

            <Label>Customer / Lot</Label>
            <select value={form.customer_id} onChange={e => setForm({ ...form, customer_id: e.target.value })}>
              <option value="" disabled>Select customer…</option>
              {editableCustomers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.company ? ` · ${c.company}` : ''}{!c.active ? ' (archived)' : ''}
                </option>
              ))}
            </select>

            <Label>Date</Label>
            <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} style={{ colorScheme: 'dark' }} />

            <Label>Color</Label>
            <select value={form.color} onChange={e => setForm({ ...form, color: e.target.value })}>
              <option value="" disabled>Select color…</option>
              {COLORS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            <Label>Notes</Label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} />

            <div style={{ marginTop: 20 }}>
              <Button onClick={handleSaveEdit} loading={saving} disabled={!form.customer_id || !form.color}>
                Save Changes
              </Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}

function VehicleCard({ vehicle: v, onEdit, onDelete }) {
  return (
    <Card style={{ marginBottom: 8, position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ flex: 1, cursor: 'pointer' }} onClick={onEdit}>
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

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }} onClick={onEdit}>
        <Chip><ColorDot color={v.color} /> {v.color}</Chip>
        <Chip>📅 {fmtDate(v.date)}</Chip>
        {v.paid_date && <Chip>💵 Paid {fmtDate(v.paid_date)}</Chip>}
      </div>

      {v.notes && (
        <div style={{
          marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)',
          fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5,
        }} onClick={onEdit}>
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
