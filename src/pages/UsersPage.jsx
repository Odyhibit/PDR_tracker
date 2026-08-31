import React, { useState } from 'react'
import { v4 as uuid } from 'uuid'
import { useApp } from '../context/AppContext.jsx'
import { Card, Button, Label, Badge, EmptyState, Modal } from '../components/UI.jsx'
import { todayCentralISO, formatCentralDate } from '../utils/dates.js'

const BLANK = {
  first_name: '', last_name: '', phone: '', email: '',
  role: 'technician', start_date: todayCentralISO(), end_date: '',
}

const ROLE_LABEL = { technician: 'Technician', back_office: 'Back Office', admin: 'Admin' }
const ROLE_COLOR = { technician: 'var(--text-3)', back_office: 'var(--accent)', admin: 'var(--danger)' }

export default function UsersPage() {
  const { profiles, saveUserProfile, isAdmin, isStaff } = useApp()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing,   setEditing]   = useState(null)
  const [form,      setForm]      = useState(BLANK)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')

  if (!isStaff) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <p style={{ color: 'var(--text-3)', fontSize: 15 }}>Staff access only.</p>
      </div>
    )
  }

  function openAdd() {
    setEditing(null); setForm(BLANK); setError(''); setModalOpen(true)
  }

  function openEdit(p) {
    setEditing(p)
    setForm({
      first_name: p.first_name || '',
      last_name:  p.last_name  || '',
      phone:      p.phone      || '',
      email:      p.email      || '',
      role:       p.role       || 'technician',
      start_date: p.start_date || '',
      end_date:   p.end_date   || '',
    })
    setError('')
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.first_name.trim()) { setError('First name is required.'); return }
    if (!form.email.trim())      { setError('Email is required.'); return }
    setSaving(true)
    setError('')
    try {
      await saveUserProfile({
        id:         editing?.id || uuid(),
        user_id:    editing?.user_id ?? null,
        email:      form.email.trim(),
        first_name: form.first_name.trim(),
        last_name:  form.last_name.trim() || null,
        phone:      form.phone.trim() || null,
        // Back office can only create/edit technicians — admin only from here on.
        role:       isAdmin ? form.role : 'technician',
        start_date: form.start_date || null,
        end_date:   form.end_date || null,
        created_at: editing?.created_at || new Date().toISOString(),
      })
      setModalOpen(false)
    } catch (e) {
      setError(e.message || 'Failed to save user.')
    } finally {
      setSaving(false)
    }
  }

  async function handleRehire(p) {
    try {
      await saveUserProfile({ ...p, start_date: todayCentralISO(), end_date: null })
    } catch (e) {
      alert(e.message || 'Failed to update.')
    }
  }

  const f = k => ({ value: form[k], onChange: e => setForm({ ...form, [k]: e.target.value }) })
  const isEnded = p => p.end_date && p.end_date <= todayCentralISO()

  return (
    <div style={{ padding: '16px 16px 120px', maxWidth: 520, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <span style={{
          fontFamily: 'var(--font-display)', fontSize: 13, letterSpacing: 1,
          color: 'var(--text-3)', textTransform: 'uppercase',
        }}>
          {profiles.length} user{profiles.length !== 1 ? 's' : ''}
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
          + Add User
        </button>
      </div>

      {profiles.length === 0 ? (
        <EmptyState
          title="No users yet"
          subtitle="Add a technician here with their email — they'll link up automatically when they sign up."
          action={{ label: 'Add First User', onPress: openAdd }}
        />
      ) : profiles.map(p => {
        const ended = isEnded(p)
        return (
          <Card key={p.id} style={{ marginBottom: 10, opacity: ended ? 0.6 : 1 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start' }}>
              <div style={{
                width: 42, height: 42, borderRadius: 21, flexShrink: 0,
                background: 'var(--bg-3)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, marginRight: 14,
              }}>👤</div>

              <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => openEdit(p)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>
                    {p.first_name} {p.last_name}
                  </span>
                  <Badge color={ROLE_COLOR[p.role]}>{ROLE_LABEL[p.role] || p.role}</Badge>
                  {!p.user_id && <Badge color="var(--text-3)">Not signed up yet</Badge>}
                  {ended && <Badge color="var(--danger)">Ended</Badge>}
                </div>
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>✉ {p.email}</span>
                  {p.phone && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>📞 {p.phone}</span>}
                  {p.start_date && (
                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      📅 {formatCentralDate(p.start_date, { month: 'short', day: 'numeric', year: 'numeric' })}
                      {p.end_date ? ` – ${formatCentralDate(p.end_date, { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {ended && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                <button
                  onClick={() => handleRehire(p)}
                  style={{
                    background: 'var(--surface-2)', border: '1px solid var(--border)',
                    color: 'var(--text-2)', borderRadius: 'var(--radius)',
                    padding: '6px 12px', fontSize: 12, fontWeight: 700,
                    fontFamily: 'var(--font-display)', letterSpacing: 0.5, cursor: 'pointer',
                  }}
                >
                  ↺ Re-hire (clears end date, resets start date to today)
                </button>
              </div>
            )}
          </Card>
        )
      })}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit User' : 'New User'}>
        <Label>First Name *</Label>
        <input {...f('first_name')} placeholder="e.g. Mike" autoFocus />

        <Label>Last Name</Label>
        <input {...f('last_name')} placeholder="e.g. Rodriguez" />

        <Label>Email *</Label>
        <input {...f('email')} placeholder="mike@example.com" type="email" />
        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
          They'll sign up with this exact email to activate their account.
        </div>

        <Label>Phone</Label>
        <input {...f('phone')} placeholder="(555) 000-0000" type="tel" />

        <Label>Role</Label>
        {isAdmin ? (
          <select {...f('role')}>
            <option value="technician">Technician</option>
            <option value="back_office">Back Office</option>
            <option value="admin">Admin</option>
          </select>
        ) : (
          <div style={{ fontSize: 14, color: 'var(--text-2)', padding: '10px 0' }}>
            Technician (only an admin can grant Back Office or Admin access)
          </div>
        )}

        <Label>Start Date</Label>
        <input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} style={{ colorScheme: 'dark' }} />

        <Label>End Date (leave blank while active)</Label>
        <input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} style={{ colorScheme: 'dark' }} />

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
            {editing ? 'Save Changes' : 'Add User'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
