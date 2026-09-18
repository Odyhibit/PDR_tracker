import React, { useState, useEffect, useCallback } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { Card, Badge, EmptyState, ColorDot, Label } from '../components/UI.jsx'
import { formatCentralDate, upcomingFridayCentralISO, todayCentralISO } from '../utils/dates.js'
import { isShopLocation } from '../utils/locations.js'
import { getPaidVehiclesPage } from '../utils/storage.js'

const PAGE_SIZE = 25

function fmtDate(iso) {
  return formatCentralDate(iso, { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function PayrollPage() {
  const { vehicles, profiles, customers, payVehicle, unpayVehicle, isStaff } = useApp()
  const [tab,     setTab]     = useState('unpaid') // 'unpaid' | 'paid'
  const [payDate, setPayDate] = useState(upcomingFridayCentralISO())
  const [busy,    setBusy]    = useState({}) // vehicleId -> bool, disables the button mid-request
  const [roSearch, setRoSearch] = useState('')

  // Only the shop's own cars go through this weekly payout — cars logged at
  // other lots/dealers get paid through a separate (slower) process, so they
  // never belong on this page at all.
  const shopCustomer = customers.find(isShopLocation)

  // "Paid" tab — a settled payout history, paginated separately from the
  // vehicles the rest of the app keeps fully loaded, since this list only
  // grows over time.
  const [paidRows,    setPaidRows]    = useState([])
  const [paidCount,   setPaidCount]   = useState(0)
  const [paidPage,    setPaidPage]    = useState(0)
  const [paidLoading, setPaidLoading] = useState(false)

  const loadPaidPage = useCallback(async (page, customerId) => {
    setPaidLoading(true)
    try {
      const { rows, count } = await getPaidVehiclesPage({ page, pageSize: PAGE_SIZE, customerId })
      setPaidRows(rows)
      setPaidCount(count)
    } catch (e) {
      alert(e.message || 'Failed to load paid cars.')
    } finally {
      setPaidLoading(false)
    }
  }, [])

  useEffect(() => {
    if (tab === 'paid' && shopCustomer) loadPaidPage(paidPage, shopCustomer.id)
  }, [tab, paidPage, shopCustomer, loadPaidPage])

  if (!isStaff) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <p style={{ color: 'var(--text-3)', fontSize: 15 }}>Staff access only.</p>
      </div>
    )
  }

  if (!shopCustomer) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <p style={{ color: 'var(--text-3)', fontSize: 15 }}>
          No "Perfection Hail" / "Main Shop" customer found — add it on the Customers tab to enable payroll.
        </p>
      </div>
    )
  }

  const today = todayCentralISO()
  // "Unpaid" tab = not yet paid out, or paid but the payout date hasn't
  // happened yet — those still show a "Delay" button, so a mis-click can be
  // walked back any time before the check actually goes out.
  const inWork = vehicles.filter(v =>
    v.customer_id === shopCustomer.id && (!v.paid_date || v.paid_date >= today)
  )

  const profileByUserId = Object.fromEntries(profiles.map(p => [p.user_id, p]))

  const nameFor = (v) => {
    const p = profileByUserId[v.user_id]
    return p ? [p.first_name, p.last_name].filter(Boolean).join(' ') : (v.logged_by || 'Unknown')
  }

  // Lets the payroll lady look a car up by RO instead of hunting through the
  // Unpaid/Paid tabs — searches everything already loaded for the shop,
  // paid or not, regardless of how far back the payout date was.
  const roQuery = roSearch.trim()
  const searchResults = roQuery
    ? vehicles.filter(v => v.customer_id === shopCustomer.id && v.ro_number?.includes(roQuery))
    : null

  const groups = {}
  for (const v of inWork) {
    const key = v.user_id || 'unknown'
    if (!groups[key]) groups[key] = []
    groups[key].push(v)
  }

  const sections = Object.entries(groups)
    .map(([userId, list]) => ({
      userId,
      name: nameFor(list[0]),
      vehicles: list.sort((a, b) => new Date(a.date) - new Date(b.date)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  async function handlePay(vehicleId) {
    setBusy(s => ({ ...s, [vehicleId]: true }))
    try {
      await payVehicle(vehicleId, payDate)
    } catch (e) {
      alert(e.message || 'Failed to mark paid.')
    } finally {
      setBusy(s => ({ ...s, [vehicleId]: false }))
    }
  }

  async function handleDelay(vehicleId) {
    setBusy(s => ({ ...s, [vehicleId]: true }))
    try {
      await unpayVehicle(vehicleId)
    } catch (e) {
      alert(e.message || 'Failed to undo payout.')
    } finally {
      setBusy(s => ({ ...s, [vehicleId]: false }))
    }
  }

  const unpaidCount  = inWork.filter(v => !v.paid_date).length
  const pendingCount = inWork.length - unpaidCount
  const totalPaidPages = Math.max(1, Math.ceil(paidCount / PAGE_SIZE))

  return (
    <div style={{ padding: '16px 16px 120px', maxWidth: 520, margin: '0 auto' }}>
      <Label>Search by RO Number</Label>
      <div style={{ position: 'relative' }}>
        <input
          value={roSearch}
          onChange={e => setRoSearch(e.target.value.replace(/\D/g, '').slice(0, 5))}
          placeholder="e.g. 4521"
          inputMode="numeric"
          pattern="[0-9]*"
          style={{ paddingRight: roSearch ? 36 : undefined }}
        />
        {roSearch && (
          <button onClick={() => setRoSearch('')} style={{
            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', color: 'var(--text-3)',
            fontSize: 16, cursor: 'pointer', lineHeight: 1,
          }}>✕</button>
        )}
      </div>

      {searchResults ? (
        <div style={{ marginTop: 20 }}>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 13, letterSpacing: 1,
            color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 16,
          }}>
            {searchResults.length === 0 ? 'No match' : `${searchResults.length} match${searchResults.length !== 1 ? 'es' : ''}`}
          </div>

          {searchResults.length === 0 ? (
            <EmptyState title="Not found" subtitle={`No shop car with RO ${roQuery}.`} />
          ) : searchResults.map(v => {
            const status = !v.paid_date
              ? { label: 'Unpaid', color: 'var(--text-3)' }
              : v.paid_date >= today
                ? { label: `Payout ${fmtDate(v.paid_date)}`, color: 'var(--accent)' }
                : { label: `Paid ${fmtDate(v.paid_date)}`, color: 'var(--success)' }
            return (
              <Card key={v.id} style={{ marginBottom: 8 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>
                  {v.year} {v.make} {v.model}
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-3)', marginTop: 3, letterSpacing: 0.5 }}>
                  {v.vin}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                  <Chip>RO {v.ro_number}</Chip>
                  <Chip>👤 {nameFor(v)}</Chip>
                  <Chip><ColorDot color={v.color} /> {v.color}</Chip>
                  <Chip>📅 {fmtDate(v.date)}</Chip>
                  <Badge color={status.color}>{status.label}</Badge>
                </div>
              </Card>
            )
          })}
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', background: 'var(--bg-3)', borderRadius: 'var(--radius)', padding: 3, marginTop: 20, marginBottom: 20 }}>
            {[['unpaid', 'Unpaid'], ['paid', 'Paid']].map(([key, label]) => (
              <button key={key} onClick={() => setTab(key)} style={{
                flex: 1, padding: '8px 14px',
                borderRadius: 'calc(var(--radius) - 2px)',
                fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700,
                letterSpacing: 0.5, textTransform: 'uppercase',
                border: 'none', cursor: 'pointer',
                background: tab === key ? 'var(--accent)' : 'transparent',
                color:      tab === key ? '#0f1923'       : 'var(--text-3)',
              }}>
                {label}
              </button>
            ))}
          </div>

          {tab === 'unpaid' && (
        <>
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
            {unpaidCount} unpaid car{unpaidCount !== 1 ? 's' : ''}
            {pendingCount > 0 && ` · ${pendingCount} pending payout`}
          </div>

          {sections.length === 0 ? (
            <EmptyState title="All caught up" subtitle="No unpaid cars right now." />
          ) : sections.map(({ userId, name, vehicles: list }) => (
            <div key={userId} style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>
                  {name}
                </span>
                <Badge>{list.length}</Badge>
              </div>

              {list.map(v => {
                const isPending = !!v.paid_date
                return (
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
                          {v.ro_number && <Chip>RO {v.ro_number}</Chip>}
                          {isPending && <Chip>💵 Payout {fmtDate(v.paid_date)}</Chip>}
                        </div>
                      </div>
                      <button
                        onClick={() => (isPending ? handleDelay(v.id) : handlePay(v.id))}
                        disabled={!!busy[v.id]}
                        style={{
                          flexShrink: 0, borderRadius: 'var(--radius)',
                          padding: '10px 16px', fontSize: 13, fontWeight: 700,
                          fontFamily: 'var(--font-display)', letterSpacing: 0.5,
                          cursor: 'pointer', opacity: busy[v.id] ? 0.5 : 1,
                          background: isPending ? 'var(--surface-2)' : 'var(--accent)',
                          color: isPending ? 'var(--text)' : '#0f1923',
                          border: isPending ? '1.5px solid var(--border)' : 'none',
                        }}
                      >
                        {busy[v.id] ? '…' : (isPending ? 'Delay' : 'Pay')}
                      </button>
                    </div>
                  </Card>
                )
              })}
            </div>
          ))}
        </>
      )}

      {tab === 'paid' && (
        <>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 13, letterSpacing: 1,
            color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 16,
          }}>
            {paidCount} paid car{paidCount !== 1 ? 's' : ''}
          </div>

          {paidLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>Loading…</div>
          ) : paidRows.length === 0 ? (
            <EmptyState title="No paid cars yet" subtitle="Cars show up here once their payout date has passed." />
          ) : paidRows.map(v => {
            return (
              <Card key={v.id} style={{ marginBottom: 8 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>
                  {v.year} {v.make} {v.model}
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-3)', marginTop: 3, letterSpacing: 0.5 }}>
                  {v.vin}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                  <Chip>👤 {nameFor(v)}</Chip>
                  <Chip><ColorDot color={v.color} /> {v.color}</Chip>
                  {v.ro_number && <Chip>RO {v.ro_number}</Chip>}
                  <Chip>💵 Paid {fmtDate(v.paid_date)}</Chip>
                </div>
              </Card>
            )
          })}

          {paidCount > PAGE_SIZE && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
              <PageButton disabled={paidPage === 0} onClick={() => setPaidPage(p => p - 1)}>← Prev</PageButton>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Page {paidPage + 1} of {totalPaidPages}</span>
              <PageButton disabled={paidPage >= totalPaidPages - 1} onClick={() => setPaidPage(p => p + 1)}>Next →</PageButton>
            </div>
          )}
        </>
      )}
        </>
      )}
    </div>
  )
}

function PageButton({ children, disabled, onClick }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: 'var(--surface-2)', border: '1px solid var(--border)',
      color: 'var(--text-2)', borderRadius: 'var(--radius)',
      padding: '8px 14px', fontSize: 12, fontWeight: 700,
      fontFamily: 'var(--font-display)', letterSpacing: 0.5,
      cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1,
    }}>
      {children}
    </button>
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
