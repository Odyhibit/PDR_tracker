import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import * as storage from '../utils/storage.js'

const Ctx = createContext(null)

export function AppProvider({ children }) {
  const [customers, setCustomers]         = useState([])
  const [vehicles,  setVehicles]          = useState([])
  const [lastCustomerId, setLastCidState] = useState(null)

  useEffect(() => {
    setCustomers(storage.getCustomers())
    setVehicles(storage.getVehicles())
    setLastCidState(storage.getLastCustomerId())
  }, [])

  const addOrUpdateCustomer = useCallback((c) => {
    storage.saveCustomer(c)
    setCustomers(storage.getCustomers())
  }, [])

  const removeCustomer = useCallback((id) => {
    storage.deleteCustomer(id)
    setCustomers(storage.getCustomers())
  }, [])

  const setLastCustomer = useCallback((id) => {
    storage.setLastCustomerId(id)
    setLastCidState(id)
  }, [])

  const addVehicle = useCallback((v) => {
    storage.saveVehicle(v)
    setVehicles(storage.getVehicles())
  }, [])

  const removeVehicle = useCallback((id) => {
    storage.deleteVehicle(id)
    setVehicles(storage.getVehicles())
  }, [])

  const vehiclesForCustomer = useCallback((cid) =>
    vehicles.filter(v => v.customerId === cid), [vehicles])

  return (
    <Ctx.Provider value={{
      customers, lastCustomerId,
      addOrUpdateCustomer, removeCustomer, setLastCustomer,
      vehicles, addVehicle, removeVehicle, vehiclesForCustomer,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export const useApp = () => useContext(Ctx)
