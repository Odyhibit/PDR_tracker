export const CENTRAL_TIME_ZONE = 'America/Chicago'

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/

function dateForDisplay(value) {
  const text = String(value ?? '')
  const match = text.match(DATE_ONLY_RE)
  if (match) {
    const [, year, month, day] = match
    return new Date(`${year}-${month}-${day}T12:00:00Z`)
  }
  return new Date(value)
}

export function formatCentralDate(value, options) {
  return dateForDisplay(value).toLocaleDateString('en-US', {
    timeZone: CENTRAL_TIME_ZONE,
    ...options,
  })
}

export function todayCentralISO() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CENTRAL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())

  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

// Next Friday (Central time), or today if today is already Friday.
// Used to default the payroll date — payroll may be processed the
// Wed/Thu before, but the date stamped on each car should be the Friday.
export function upcomingFridayCentralISO() {
  const todayIso = todayCentralISO()
  const [y, m, d] = todayIso.split('-').map(Number)
  const noon = new Date(Date.UTC(y, m - 1, d, 12))
  const dow = noon.getUTCDay() // 0 = Sun ... 5 = Fri ... 6 = Sat
  const daysUntilFriday = (5 - dow + 7) % 7
  noon.setUTCDate(noon.getUTCDate() + daysUntilFriday)
  return noon.toISOString().slice(0, 10)
}
