import React, { useState, useEffect, useRef } from 'react'
import { v4 as uuid } from 'uuid'
import { useApp } from '../context/AppContext.jsx'
import { decodeVin, isValidVin } from '../utils/nhtsa.js'
import { Button, Card, Label, Spinner, ColorDot, Modal } from '../components/UI.jsx'
import VinScanner from '../components/VinScanner.jsx'

const COLORS = [
  'Black','White','Silver','Gray','Red','Blue',
  'Brown / Beige','Green','Orange','Gold / Yellow','Purple','Other',
]

const todayISO = () => new Date().toISOString().slice(0, 10)

export default function LogPage() {
  const { customers, lastCustomerId, addVehicle, setLastCustomer } = useApp()

  const [vin,      setVin]      = useState('')
  const [make,     setMake]     = useState('')
  const [model,    setModel]    = useState('')
  const [year,     setYear]     = useState('')
  const [color,    setColor]    = useState('')
  const [notes,    setNotes]    = useState('')
  const [custId,   setCustId]   = useState('')
  const [date,     setDate]     = useState(todayISO())

  const [scanning,  setScanning]  = useState(false)
  const [decoding,  setDecoding]  = useState(false)
  const [decodeErr, setDecodeErr] = useState('')
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)
  const [colorOpen, setColorOpen] = useState(false)
  const [custOpen,  setCustOpen]  = useState(false)

  // Apply last customer default on mount and when it changes
  useEffect(() => {
    if (lastCustomerId && !custId) setCustId(lastCustomerId)
  }, [lastCustomerId])

  const selectedCustomer = customers.find(c => c.id === custId)

  async function handleVinScanned(scannedVin) {
    setScanning(false)
    setVin(scannedVin)
    await lookupVin(scannedVin)
  }

  async function lookupVin(v) {
    const clean = v.trim().toUpperCase()
    if (!isValidVin(clean)) {
      setDecodeErr('Not a valid 17-character VIN.')
      return
    }
    setDecoding(true)
    setDecodeErr('')
    try {
      const r = await decodeVin(clean)
      setMake(r.make)
      setModel(r.model)
      setYear(r.year)
    } catch (e) {
      setDecodeErr(e.message)
    } finally {
      setDecoding(false)
    }
  }

  function resetForm(keepCustomer = true) {
    setVin(''); setMake(''); setModel(''); setYear('')
    setColor(''); setNotes(''); setDate(todayISO())
    setDecodeErr('')
    if (!keepCustomer) setCustId('')
  }

  async function handleSave() {
    if (!vin || vin.trim().length !== 17) return alert('Please scan or enter a valid VIN.')
    if (!make || !model || !year)         return alert('Please decode the VIN first.')
    if (!color)                           return alert('Please select a color.')
    if (!custId)                          return alert('Please select a customer.')

    setSaving(true)
    try {
      addVehicle({
        id: uuid(),
        vin: vin.trim().toUpperCase(),
        make, model, year, color, notes,
        customerId: custId,
        customerName: selectedCustomer?.name || '',
        date,
        createdAt: new Date().toISOString(),
      })
      await setLastCustomer(custId)
      resetForm(true)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setSaving(false)
    }
  }

  const vinFilled = vin.trim().length === 17
  const decoded   = make && model && year

  return (
    <div style={{ padding: '16px 16px 120px', maxWidth: 520, margin: '0 auto' }}>

      {/* Customer */}
      <Label>Customer / Lot</Label>
      <div
        onClick={() => setCustOpen(true)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--surface)', border: '1.5px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '13px 14px', cursor: 'pointer',
        }}
      >
        <span style={{ color: selectedCustomer ? 'var(--text)' : 'var(--text-3)', fontSize: 15 }}>
          {selectedCustomer
            ? selectedCustomer.name + (selectedCustomer.company ? ` · ${selectedCustomer.company}` : '')
            : 'Select customer…'}
        </span>
        <span style={{ color: 'var(--text-3)' }}>▾</span>
      </div>
      {custId && lastCustomerId === custId && (
        <div style={{ fontSize: 11, color: 'var(--success)', marginTop: 4, marginLeft: 2 }}>
          ✓ Last used
        </div>
      )}

      {/* Date */}
      <Label>Date</Label>
      <input
        type="date"
        value={date}
        onChange={e => setDate(e.target.value)}
        style={{ colorScheme: 'dark' }}
      />

      {/* VIN */}
      <Label>VIN</Label>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={vin}
          onChange={e => { setVin(e.target.value.toUpperCase()); setDecodeErr('') }}
          onBlur={() => vinFilled && !decoded && lookupVin(vin)}
          placeholder="Scan or type 17-char VIN"
          maxLength={17}
          style={{ fontFamily: 'monospace', letterSpacing: 1 }}
        />
        <button
          onClick={() => setScanning(true)}
          style={{
            flexShrink: 0, width: 52, height: 48,
            background: 'var(--accent)', borderRadius: 'var(--radius)',
            border: 'none', cursor: 'pointer', fontSize: 22,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          title="Scan barcode"
        >
          📷
        </button>
      </div>

      {vin.length > 0 && vin.length < 17 && (
        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>{vin.length}/17</div>
      )}

      {vinFilled && !decoded && !decoding && (
        <div style={{ marginTop: 8 }}>
          <Button variant="ghost" onClick={() => lookupVin(vin)}>Look Up VIN</Button>
        </div>
      )}

      {decoding && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, color: 'var(--text-2)' }}>
          <Spinner size={16} color="var(--accent)" /> Decoding VIN…
        </div>
      )}

      {decodeErr && (
        <div style={{ marginTop: 8, fontSize: 13, color: 'var(--danger)' }}>{decodeErr}</div>
      )}

      {/* Decoded vehicle display */}
      {decoded && (
        <Card style={{ marginTop: 10, borderColor: 'var(--accent)', borderWidth: 1.5 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, color: 'var(--accent)' }}>
            {year} {make} {model}
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-3)', marginTop: 4, letterSpacing: 0.5 }}>
            {vin}
          </div>
        </Card>
      )}

      {/* Color */}
      <Label>Color</Label>
      <div
        onClick={() => setColorOpen(true)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--surface)', border: '1.5px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '13px 14px', cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {color && <ColorDot color={color} />}
          <span style={{ color: color ? 'var(--text)' : 'var(--text-3)', fontSize: 15 }}>
            {color || 'Select color…'}
          </span>
        </div>
        <span style={{ color: 'var(--text-3)' }}>▾</span>
      </div>

      {/* Notes */}
      <Label>Notes (optional)</Label>
      <textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Panel count, damage description, special notes…"
        rows={3}
      />

      {/* Save */}
      <div style={{ marginTop: 24 }}>
        <Button onClick={handleSave} loading={saving}>
          {saved ? '✓ Saved!' : 'Save Vehicle'}
        </Button>
      </div>

      {/* Scanner */}
      {scanning && (
        <VinScanner
          onScanned={handleVinScanned}
          onClose={() => setScanning(false)}
        />
      )}

      {/* Color picker modal */}
      <Modal open={colorOpen} onClose={() => setColorOpen(false)} title="Select Color">
        {COLORS.map(c => (
          <div
            key={c}
            onClick={() => { setColor(c); setColorOpen(false) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 4px', borderBottom: '1px solid var(--border)',
              cursor: 'pointer',
              background: color === c ? 'var(--accent-bg)' : 'transparent',
            }}
          >
            <ColorDot color={c} />
            <span style={{ fontSize: 16, color: color === c ? 'var(--accent)' : 'var(--text)', fontWeight: color === c ? 700 : 400 }}>{c}</span>
            {color === c && <span style={{ marginLeft: 'auto', color: 'var(--accent)' }}>✓</span>}
          </div>
        ))}
      </Modal>

      {/* Customer picker modal */}
      <Modal open={custOpen} onClose={() => setCustOpen(false)} title="Select Customer">
        {customers.length === 0 ? (
          <p style={{ color: 'var(--text-3)', padding: '20px 0', textAlign: 'center' }}>
            No customers yet — add one in the Customers tab.
          </p>
        ) : customers.map(c => (
          <div
            key={c.id}
            onClick={() => { setCustId(c.id); setCustOpen(false) }}
            style={{
              padding: '14px 4px', borderBottom: '1px solid var(--border)',
              cursor: 'pointer',
              background: custId === c.id ? 'var(--accent-bg)' : 'transparent',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: custId === c.id ? 'var(--accent)' : 'var(--text)' }}>
                {c.name}
              </span>
              {lastCustomerId === c.id && (
                <span style={{ fontSize: 10, color: 'var(--success)', fontWeight: 700 }}>LAST USED</span>
              )}
              {custId === c.id && <span style={{ marginLeft: 'auto', color: 'var(--accent)' }}>✓</span>}
            </div>
            {c.company && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{c.company}</div>}
          </div>
        ))}
      </Modal>
    </div>
  )
}
