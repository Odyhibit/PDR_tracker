import { supabase } from './supabase.js'
import { formatCentralDate, todayCentralISO } from './dates.js'

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

// Archiving (not deleting) is the normal way to retire a short-term lot —
// it drops out of the Log page's picker but past vehicles/reports keep working.
export async function setCustomerActive(id, active) {
  const { error } = await supabase
    .from('customers')
    .update({ active })
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

// Loads the signed-in user's own roster row, linking it up on first
// login: claims a pre-created row matching their email (added ahead of
// time by admin/back office), or — if no such row exists — creates a
// fresh technician row for them (plain self-serve signup).
export async function getProfile() {
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  if (!user) return null

  const fallback = user?.user_metadata?.first_name
    ? { first_name: user.user_metadata.first_name }
    : null

  const { data: own, error: ownError } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()
  if (ownError && (ownError.code === '42P01' || ownError.code === 'PGRST205')) return fallback
  if (ownError) throw ownError
  if (own) return own

  // No row linked to this login yet — try to claim one pre-created by email
  // (case-insensitive match, since roster entries are typed by hand).
  const email = (user.email || '').toLowerCase()
  const { data: claimed, error: claimError } = await supabase
    .from('profiles')
    .update({ user_id: user.id })
    .is('user_id', null)
    .eq('email', email)
    .select('*')
    .maybeSingle()
  if (!claimError && claimed) return claimed

  // Nothing to claim — create a plain technician row for this signup.
  const { data: created, error: createError } = await supabase
    .from('profiles')
    .insert({
      user_id: user.id,
      email,
      first_name: user.user_metadata?.first_name || null,
    })
    .select('*')
    .maybeSingle()
  if (createError) throw createError
  return created || fallback
}

// Upserts a full roster row (admin/back office adding or editing a user).
// Pass `id` when editing an existing row; omit it to pre-create a new one.
export async function saveProfile(profile) {
  const { error } = await supabase
    .from('profiles')
    .upsert(
      { ...profile, email: profile.email?.trim().toLowerCase() },
      { onConflict: 'id' }
    )
  if (error) throw error
}

export async function getProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('first_name')
  if (error) throw error
  return data || []
}

// ── Payroll ───────────────────────────────────────────────

export async function payVehicle(vehicleId, paidDate) {
  const { error } = await supabase.rpc('mark_vehicle_paid', {
    p_vehicle_id: vehicleId,
    p_paid_date: paidDate,
  })
  if (error) throw error
}

export async function unpayVehicle(vehicleId) {
  const { error } = await supabase.rpc('mark_vehicle_paid', {
    p_vehicle_id: vehicleId,
    p_paid_date: null,
  })
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
    const date = formatCentralDate(v.date, {
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
  a.download = `PDR_${safe}_${todayCentralISO()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
