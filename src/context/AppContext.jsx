import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../utils/supabase.js'
import * as storage from '../utils/storage.js'

const Ctx = createContext(null)

export function AppProvider({ children }) {
  const [session,        setSession]      = useState(null)
  const [authLoading,    setAuthLoading]  = useState(true)
  const [customers,      setCustomers]    = useState([])
  const [vehicles,       setVehicles]     = useState([])
  const [lastCustomerId, setLastCidState] = useState(null)
  const [profile,        setProfile]      = useState(null)
  const [dataLoading,    setDataLoading]  = useState(false)

  // ── Auth ─────────────────────────────────────────────────

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setAuthLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session) loadAll()
    else {
      setCustomers([]); setVehicles([])
      setLastCidState(null); setProfile(null)
    }
  }, [session])

  async function loadAll() {
    setDataLoading(true)
    try {
      const [c, v, lastCid, prof] = await Promise.all([
        storage.getCustomers(),
        storage.getVehicles(),
        storage.getLastCustomerId(),
        storage.getProfile(),
      ])
      setCustomers(c)
      setVehicles(v)
      setLastCidState(lastCid)
      setProfile(prof)
    } catch (e) {
      console.error('Failed to load data:', e)
    } finally {
      setDataLoading(false)
    }
  }

  // ── Auth actions ──────────────────────────────────────────

  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  const signUp = useCallback(async (email, password, firstName) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { first_name: firstName } }
    })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  // ── Customer actions ──────────────────────────────────────

  const addOrUpdateCustomer = useCallback(async (c) => {
    await storage.saveCustomer(c)
    setCustomers(await storage.getCustomers())
  }, [])

  const removeCustomer = useCallback(async (id) => {
    await storage.deleteCustomer(id)
    setCustomers(await storage.getCustomers())
  }, [])

  const setLastCustomer = useCallback(async (id) => {
    await storage.setLastCustomerId(id)
    setLastCidState(id)
  }, [])

  // ── Vehicle actions ───────────────────────────────────────

  const addVehicle = useCallback(async (v) => {
    await storage.saveVehicle(v)
    setVehicles(await storage.getVehicles())
  }, [])

  const removeVehicle = useCallback(async (id) => {
    await storage.deleteVehicle(id)
    setVehicles(await storage.getVehicles())
  }, [])

  const vehiclesForCustomer = useCallback((cid) =>
    vehicles.filter(v => v.customer_id === cid), [vehicles])

  const isAdmin = session?.user?.email === import.meta.env.VITE_ADMIN_EMAIL

  return (
    <Ctx.Provider value={{
      session, authLoading, dataLoading, isAdmin,
      profile, signIn, signUp, signOut,
      customers, lastCustomerId,
      addOrUpdateCustomer, removeCustomer, setLastCustomer,
      vehicles, addVehicle, removeVehicle, vehiclesForCustomer,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export const useApp = () => useContext(Ctx)
