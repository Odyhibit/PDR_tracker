import React, { useState } from 'react'
import { v4 as uuid } from 'uuid'
import { useApp } from '../context/AppContext.jsx'
import { Card, Button, Label, Badge, EmptyState, Modal } from '../components/UI.jsx'

const BLANK = { name: '', company: '', phone: '', email: '' }

export default function AdminPage() {
  const { customers, addOrUpdateCustomer, removeCustomer, vehiclesForCustomer, isAdmin } = useApp()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing,   setEditing]   = useState(null)
  const [form,      setForm]      = useState(BLANK)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')

  if (!isAdmin) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <p style={{ color: 'var(--text-3)', fontSize: 15 }}>
          Admin access only.
        </p>
      </div>
    )
  }

  function openAdd() {
    setEditing(null); setForm(BLANK); setError(''); setModalOpen(true)
  }

  function openEdit(c) {
    setEditing(c)
    setForm({ name: c.name, company: c.company || '', phone: c.phone || '', email: c.email || '' })
    setError('')
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Customer name is required.'); return }
    setSaving(true)
    setError('')
    try {
      await addOrUpdateCustomer({
        id:        editing?.id || uuid(),
        name:      form.name.trim(),
        company:   form.company.trim() || null,
        phone:     form.phone.trim()   || null,
        email:     form.email.trim()   || null,
        created_at: editing?.created_at || new Date().toISOString(),
      })
      setModalOpen(false)
    } catch (e) {
      setError(e.message || 'Failed to save customer.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(c) {
    const count = vehiclesForCustomer(c.id).length
    const warn  = count > 0 ? `\n\n${count} vehicle record(s) are linked to this customer.` : ''
    if (!confirm(`Delete "${c.name}"?${warn}`)) return
    try {
      await removeCustomer(c.id)
    } catch (e) {
      alert(e.message || 'Failed to delete.')
    }
  }

  const f = k => ({ value: form[k], onChange: e => setForm({ ...form, [k]: e.target.value }) })

  return (
    <div style={{ padding: '16px 16px 120px', maxWidth: 520, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <span style={{
          fontFamily: 'var(--font-display)', fontSize: 13, letterSpacing: 1,
          color: 'var(--text-3)', textTransform: 'uppercase',
        }}>
          {customers.length} customer{customers.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={openAdd}
          style={{
            background: 'var(--accent)', color: '#0f1923', border: 'none',
            borderRadius: 99, padding: '8px 18px',
            fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700,
            letterSpacing: 0.5, cursor: 'pointer',
          }}
        >
          + Add Customer
        </button>
      </div>

      {customers.length === 0 ? (
        <EmptyState
          title="No customers yet"
          subtitle="Add car lots or clients here. All users will be able to select them."
          action={{ label: 'Add First Customer', onPress: openAdd }}
        />
      ) : customers.map(c => {
        const count = vehiclesForCustomer(c.id).length
        return (
          <Card key={c.id} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start' }}>
              <div style={{
                width: 42, height: 42, borderRadius: 21, flexShrink: 0,
                background: 'var(--bg-3)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, marginRight: 14,
              }}>🏢</div>

              <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => openEdit(c)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>
                    {c.name}
                  </span>
                </div>
                {c.company && <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>{c.company}</div>}
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 6 }}>
                  {c.phone && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>📞 {c.phone}</span>}
                  {c.email && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>✉ {c.email}</span>}
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>🚗 {count} vehicle{count !== 1 ? 's' : ''} (all users)</span>
                </div>
              </div>

              <button
                onClick={() => handleDelete(c)}
                style={{ color: 'var(--danger)', fontSize: 18, background: 'none', border: 'none', cursor: 'pointer', paddingLeft: 8 }}
              >
                🗑
              </button>
            </div>
          </Card>
        )
      })}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Customer' : 'New Customer'}>
        <Label>Name *</Label>
        <input {...f('name')} placeholder="e.g. ABC Motors" autoFocus />

        <Label>Company / Lot Name</Label>
        <input {...f('company')} placeholder="e.g. Northside Auto Group" />

        <Label>Phone</Label>
        <input {...f('phone')} placeholder="(555) 000-0000" type="tel" />

        <Label>Email</Label>
        <input {...f('email')} placeholder="contact@example.com" type="email" />

        {error && (
          <div style={{
            marginTop: 12, padding: '10px 12px',
            background: 'rgba(224,82,82,0.12)', borderRadius: 'var(--radius)',
            fontSize: 13, color: 'var(--danger)',
          }}>
            ⚠ {error}
          </div>
        )}

        <div style={{ marginTop: 20 }}>
          <Button onClick={handleSave} loading={saving}>
            {editing ? 'Save Changes' : 'Add Customer'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
