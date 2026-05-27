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

// ── Vehicles (private per user) ───────────────────────────

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

// ── VIN duplicate check (cross-user via RPC) ──────────────

export async function checkVinExists(vin) {
  const { data, error } = await supabase
    .rpc('check_vin_exists', { lookup_vin: vin })
  if (error) throw error
  if (!data || data.length === 0) return null
  return data[0] // { found, first_name, log_date, color, user_id }
}

// ── Profile ───────────────────────────────────────────────

export async function getProfile() {
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  if (!user) return null

  const fallback = user?.user_metadata?.first_name
    ? { first_name: user.user_metadata.first_name }
    : null

  const { data, error } = await supabase
    .from('profiles')
    .select('first_name')
    .eq('user_id', user.id)
    .maybeSingle()
  if (error && (error.code === '42P01' || error.code === 'PGRST205')) return fallback
  if (error) throw error
  return data || fallback
}

export async function saveProfile(firstName) {
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase
    .from('profiles')
    .upsert({ user_id: user.id, first_name: firstName }, { onConflict: 'user_id' })
  if (error) throw error
}

// ── User Preferences (last customer) ──────────────────────

export async function getLastCustomerId() {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('last_customer_id')
    .maybeSingle()
  if (error) throw error
  return data?.last_customer_id || null
}

export async function setLastCustomerId(customerId) {
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase
    .from('user_preferences')
    .upsert({ user_id: user.id, last_customer_id: customerId }, { onConflict: 'user_id' })
  if (error) throw error
}

// ── CSV Export ────────────────────────────────────────────

export function exportCustomerCSV(customer, vehicles) {
  const rows = []
  rows.push(['Customer', customer.name])
  if (customer.company) rows.push(['Company', customer.company])
  if (customer.phone)   rows.push(['Phone',   customer.phone])
  if (customer.email)   rows.push(['Email',   customer.email])
  rows.push([])
  rows.push(['Date', 'VIN', 'Year', 'Make', 'Model', 'Color', 'Technician', 'Notes'])

  const sorted = [...vehicles].sort((a, b) => new Date(a.date) - new Date(b.date))
  for (const v of sorted) {
    const date = new Date(v.date).toLocaleDateString('en-US', {
      month: '2-digit', day: '2-digit', year: 'numeric'
    })
    rows.push([date, v.vin, v.year, v.make, v.model, v.color, v.logged_by || '', v.notes || ''])
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
