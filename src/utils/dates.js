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
