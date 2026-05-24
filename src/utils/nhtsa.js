const BASE = 'https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues'

export function isValidVin(vin) {
  return /^[A-HJ-NPR-Z0-9]{17}$/i.test(vin.trim())
}

export async function decodeVin(vin) {
  const clean = vin.trim().toUpperCase()
  if (!isValidVin(clean)) throw new Error('VIN must be 17 valid characters (no I, O, or Q).')

  const res = await fetch(`${BASE}/${clean}?format=json`)
  if (!res.ok) throw new Error(`NHTSA returned ${res.status}. Check your connection.`)

  const data = await res.json()
  const r    = data.Results?.[0]
  if (!r) throw new Error('No data returned from NHTSA.')

  const errorCode = r['ErrorCode']
  if (errorCode && errorCode !== '0') {
    throw new Error(r['ErrorText'] || 'VIN could not be decoded.')
  }

  return {
    make:  r['Make']              || '',
    model: r['Model']             || '',
    year:  r['ModelYear']        || '',
    body:  r['BodyClass']        || '',
    trim:  r['Trim']              || '',
    fuel:  r['FuelTypePrimary'] || '',
  }
}
