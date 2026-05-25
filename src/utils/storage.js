import { supabase } from './supabase.js'

// ── Customers (shared, read by all) ───────────────────────

export async function getCustomers() {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .order('name')
  if (error) throw error
  return data || []
}

export async function saveCustomer(customer) {
  const { error } = await supabase
    .from('customers')
    .upsert(customer, { onConflict: 'id' })
  if (error) throw error
}

export async function deleteCustomer(id) {
  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ── Vehicles (private per user, user_id set by RLS) ───────

export async function getVehicles() {
  const { data, error } = await supabase
    .from('vehicles')
    .select('*, customers(name, company)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function saveVehicle(vehicle) {
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase
    .from('vehicles')
    .upsert({ ...vehicle, user_id: user.id }, { onConflict: 'id' })
  if (error) throw error
}

export async function deleteVehicle(id) {
  const { error } = await supabase
    .from('vehicles')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ── User Preferences (last customer) ──────────────────────

export async function getLastCustomerId() {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('last_customer_id')
    .maybeSingle()
  if (error && error.code !== 'PGRST116') throw error // PGRST116 = no rows, that's fine
  return data?.last_customer_id || null
}

export async function setLastCustomerId(customerId) {
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase
    .from('user_preferences')
    .upsert({ user_id: user.id, last_customer_id: customerId }, { onConflict: 'user_id' })
  if (error) throw error
}

// ── CSV Export (unchanged, runs client-side) ──────────────

export function exportCustomerCSV(customer, vehicles) {
  const rows = []
  rows.push(['Customer', customer.name])
  if (customer.company) rows.push(['Company', customer.company])
  if (customer.phone)   rows.push(['Phone',   customer.phone])
  if (customer.email)   rows.push(['Email',   customer.email])
  rows.push([])
  rows.push(['Date', 'VIN', 'Year', 'Make', 'Model', 'Color', 'Notes'])

  const sorted = [...vehicles].sort((a, b) => new Date(a.date) - new Date(b.date))
  for (const v of sorted) {
    const date = new Date(v.date).toLocaleDateString('en-US', {
      month: '2-digit', day: '2-digit', year: 'numeric'
    })
    rows.push([date, v.vin, v.year, v.make, v.model, v.color, v.notes || ''])
  }

  const csv = rows.map(row =>
    row.map(cell => {
      const s = String(cell ?? '')
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"` : s
    }).join(',')
  ).join('\r\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  const safe = customer.name.replace(/[^a-z0-9]/gi, '_')
  a.href     = url
  a.download = `PDR_${safe}_${new Date().toISOString().slice(0,10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
