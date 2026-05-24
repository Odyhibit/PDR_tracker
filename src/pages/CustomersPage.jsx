import React, { useState } from 'react'
import { v4 as uuid } from 'uuid'
import { useApp } from '../context/AppContext.jsx'
import { Card, Button, Label, Badge, EmptyState, Modal } from '../components/UI.jsx'

const BLANK = { name: '', company: '', phone: '', email: '' }

export default function CustomersPage() {
  const { customers, lastCustomerId, addOrUpdateCustomer, removeCustomer, vehiclesForCustomer } = useApp()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing,   setEditing]   = useState(null)
  const [form,      setForm]      = useState(BLANK)
  const [saving,    setSaving]    = useState(false)

  function openAdd() {
    setEditing(null); setForm(BLANK); setModalOpen(true)
  }

  function openEdit(c) {
    setEditing(c)
    setForm({ name: c.name, company: c.company || '', phone: c.phone || '', email: c.email || '' })
    setModalOpen(true)
  }

  function handleSave() {
    if (!form.name.trim()) return alert('Customer name is required.')
    setSaving(true)
    addOrUpdateCustomer({
      id:        editing?.id || uuid(),
      name:      form.name.trim(),
      company:   form.company.trim() || undefined,
      phone:     form.phone.trim()   || undefined,
      email:     form.email.trim()   || undefined,
      createdAt: editing?.createdAt  || new Date().toISOString(),
    })
    setSaving(false)
    setModalOpen(false)
  }

  function handleDelete(c) {
    const count = vehiclesForCustomer(c.id).length
    const warn  = count > 0 ? `\n\n${count} vehicle record(s) will remain but won't be linked.` : ''
    if (confirm(`Delete "${c.name}"?${warn}`)) removeCustomer(c.id)
  }

  const f = (k) => ({ value: form[k], onChange: e => setForm({ ...form, [k]: e.target.value }) })

  return (
    <div style={{ padding: '16px 16px 120px', maxWidth: 520, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, letterSpacing: 1, color: 'var(--text-3)', textTransform: 'uppercase' }}>
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
          + Add
        </button>
      </div>

      {customers.length === 0 ? (
        <EmptyState
          title="No customers yet"
          subtitle="Add car lots or clients here. The last one used will auto-select when logging vehicles."
          action={{ label: 'Add First Customer', onPress: openAdd }}
        />
      ) : customers.map(c => {
        const count  = vehiclesForCustomer(c.id).length
        const isLast = c.id === lastCustomerId
        return (
          <Card key={c.id} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start' }}>
              {/* Icon */}
              <div style={{
                width: 42, height: 42, borderRadius: 21, flexShrink: 0,
                background: 'var(--bg-3)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, marginRight: 14,
              }}>🏢</div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }} onClick={() => openEdit(c)} style={{ cursor: 'pointer', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>
                    {c.name}
                  </span>
                  {isLast && <Badge color="var(--success)">Last used</Badge>}
                </div>
                {c.company && <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>{c.company}</div>}
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 6 }}>
                  {c.phone && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>📞 {c.phone}</span>}
                  {c.email && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>✉ {c.email}</span>}
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>🚗 {count} vehicle{count !== 1 ? 's' : ''}</span>
                </div>
              </div>

              {/* Delete */}
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

      {/* Add / Edit modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Customer' : 'New Customer'}>
        <Label>Name *</Label>
        <input {...f('name')} placeholder="e.g. John Smith or ABC Motors" autoFocus />

        <Label>Company / Lot Name</Label>
        <input {...f('company')} placeholder="e.g. Northside Auto Group" />

        <Label>Phone</Label>
        <input {...f('phone')} placeholder="(555) 000-0000" type="tel" />

        <Label>Email</Label>
        <input {...f('email')} placeholder="contact@example.com" type="email" />

        <div style={{ marginTop: 20 }}>
          <Button onClick={handleSave} loading={saving}>
            {editing ? 'Save Changes' : 'Add Customer'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
