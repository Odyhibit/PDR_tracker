// The shop's own in-house location — the one customer/lot that requires an
// RO (repair order) number on each car. Every other customer is a
// third-party dealer/lot that doesn't use ROs, so this isn't a universal
// requirement and lives in the frontend rather than the database.
const SHOP_NAME    = 'Perfection Hail'
const SHOP_COMPANY = 'Main Shop'

export function isShopLocation(customer) {
  return customer?.name === SHOP_NAME && customer?.company === SHOP_COMPANY
}
