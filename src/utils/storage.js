const KEYS = {
  CUSTOMERS: 'pdr_customers',
  VEHICLES:  'pdr_vehicles',
  LAST_CID:  'pdr_last_customer_id',
}

function load(key) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

// ── Customers ─────────────────────────────────────────────

export function getCustomers() {
  return load(KEYS.CUSTOMERS) || []
}

export function saveCustomer(customer) {
  const list = getCustomers()
  const idx = list.findIndex(c => c.id === customer.id)
  if (idx >= 0) list[idx] = customer
  else list.push(customer)
  save(KEYS.CUSTOMERS, list)
}

export function deleteCustomer(id) {
  save(KEYS.CUSTOMERS, getCustomers().filter(c => c.id !== id))
}

// ── Last Customer ─────────────────────────────────────────

export function getLastCustomerId() {
  return localStorage.getItem(KEYS.LAST_CID)
}

export function setLastCustomerId(id) {
  localStorage.setItem(KEYS.LAST_CID, id)
}

// ── Vehicles ──────────────────────────────────────────────

export function getVehicles() {
  return load(KEYS.VEHICLES) || []
}

export function saveVehicle(vehicle) {
  const list = getVehicles()
  const idx = list.findIndex(v => v.id === vehicle.id)
  if (idx >= 0) list[idx] = vehicle
  else list.push(vehicle)
  save(KEYS.VEHICLES, list)
}

export function deleteVehicle(id) {
  save(KEYS.VEHICLES, getVehicles().filter(v => v.id !== id))
}

// ── CSV Export ────────────────────────────────────────────

export function exportCustomerCSV(customer, vehicles) {
  const rows = []

  // Customer header block
  rows.push(['Customer', customer.name])
  if (customer.company) rows.push(['Company', customer.company])
  if (customer.phone)   rows.push(['Phone',   customer.phone])
  if (customer.email)   rows.push(['Email',   customer.email])
  rows.push([]) // blank separator row

  // Vehicle table header
  rows.push(['Date', 'VIN', 'Year', 'Make', 'Model', 'Color', 'Notes'])

  // Vehicle rows sorted by date
  const sorted = [...vehicles].sort((a, b) => new Date(a.date) - new Date(b.date))
  for (const v of sorted) {
    const date = new Date(v.date).toLocaleDateString('en-US', {
      month: '2-digit', day: '2-digit', year: 'numeric'
    })
    rows.push([date, v.vin, v.year, v.make, v.model, v.color, v.notes || ''])
  }

  // Serialize — wrap fields with commas or quotes in double-quotes
  const csv = rows.map(row =>
    row.map(cell => {
      const s = String(cell ?? '')
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s
    }).join(',')
  ).join('\r\n')

  // Trigger download
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  const safeName = customer.name.replace(/[^a-z0-9]/gi, '_')
  a.href     = url
  a.download = `PDR_${safeName}_${new Date().toISOString().slice(0,10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
