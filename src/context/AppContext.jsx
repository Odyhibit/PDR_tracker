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
  const [profileError,   setProfileError] = useState(null)
  const [profiles,       setProfiles]     = useState([])
  const [dataLoading,    setDataLoading]  = useState(false)
  const [passwordRecovery, setPasswordRecovery] = useState(() =>
    window.location.hash.includes('type=recovery')
  )
  const [authMessage, setAuthMessage] = useState('')

  // ── Auth ─────────────────────────────────────────────────

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setAuthLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session) loadAll()
    else {
      setCustomers([]); setVehicles([])
      setLastCidState(null); setProfile(null); setProfileError(null); setProfiles([])
    }
  }, [session])

  async function loadAll() {
    setDataLoading(true)
    setProfileError(null)
    try {
      // Profile loads first — it claims the invited roster row on first
      // login, and vehicles' RLS visibility depends on the resulting role.
      setProfile(await storage.getProfile())

      const [customerResult, vehicleResult, lastCustomerResult, profilesResult] = await Promise.allSettled([
        storage.getCustomers(),
        storage.getVehicles(),
        storage.getLastCustomerId(),
        storage.getProfiles(),
      ])

      if (customerResult.status === 'fulfilled') setCustomers(customerResult.value)
      else {
        console.error('Failed to load customers:', customerResult.reason)
        setCustomers([])
      }

      if (vehicleResult.status === 'fulfilled') setVehicles(vehicleResult.value)
      else {
        console.error('Failed to load vehicles:', vehicleResult.reason)
        setVehicles([])
      }

      if (lastCustomerResult.status === 'fulfilled') setLastCidState(lastCustomerResult.value)
      else {
        console.error('Failed to load last customer:', lastCustomerResult.reason)
        setLastCidState(null)
      }

      // A technician's RLS only returns their own row here — harmless no-op.
      if (profilesResult.status === 'fulfilled') setProfiles(profilesResult.value)
      else {
        console.error('Failed to load roster:', profilesResult.reason)
        setProfiles([])
      }
    } catch (e) {
      console.error('Failed to load profile:', e)
      setProfile(null)
      setProfileError(e)
    } finally {
      setDataLoading(false)
    }
  }

  // ── Auth actions ──────────────────────────────────────────
  // Emails are always trimmed + lowercased before hitting Supabase Auth —
  // a stray leading/trailing space (easy to pick up from a mobile keyboard
  // or autofill) would otherwise get baked into auth.users.email and the
  // JWT's email claim permanently, silently breaking the invited-profile
  // claim match in the DB (which is case-insensitive but not whitespace-
  // insensitive) even though the invited row's email looks identical.

  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
    if (error) throw error
  }, [])

  const signUp = useCallback(async (email, password, firstName) => {
    const { error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: { first_name: firstName } }
    })
    if (error) throw error
  }, [])

  const requestPasswordReset = useCallback(async (email) => {
    const redirectTo = `${window.location.origin}${window.location.pathname}`
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo })
    if (error) throw error
  }, [])

  const updatePassword = useCallback(async (password) => {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw error

    setPasswordRecovery(false)
    setAuthMessage('Password updated. You can now log in with your new password.')
    await supabase.auth.signOut()
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  // ── Customer actions ──────────────────────────────────────

  const addOrUpdateCustomer = useCallback(async (c) => {
    await storage.saveCustomer(c)
    setCustomers(await storage.getCustomers())
  }, [])

  const setCustomerActive = useCallback(async (id, active) => {
    await storage.setCustomerActive(id, active)
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

  // ── Roster (roles, users) ─────────────────────────────────

  const saveUserProfile = useCallback(async (p) => {
    await storage.saveProfile(p)
    setProfiles(await storage.getProfiles())
  }, [])

  // ── Payroll ────────────────────────────────────────────────

  const payVehicle = useCallback(async (vehicleId, paidDate) => {
    await storage.payVehicle(vehicleId, paidDate)
    setVehicles(await storage.getVehicles())
  }, [])

  const unpayVehicle = useCallback(async (vehicleId) => {
    await storage.unpayVehicle(vehicleId)
    setVehicles(await storage.getVehicles())
  }, [])

  const role         = profile?.role || 'technician'
  const isAdmin       = role === 'admin'
  const isBackOffice  = role === 'back_office'
  const isStaff       = isAdmin || isBackOffice // can run payroll + manage users

  return (
    <Ctx.Provider value={{
      session, authLoading, dataLoading,
      role, isAdmin, isBackOffice, isStaff,
      profile, profileError, profiles, signIn, signUp, signOut,
      passwordRecovery, requestPasswordReset, updatePassword,
      authMessage, clearAuthMessage: () => setAuthMessage(''),
      customers, lastCustomerId,
      addOrUpdateCustomer, setCustomerActive, setLastCustomer,
      vehicles, addVehicle, removeVehicle, vehiclesForCustomer,
      saveUserProfile, payVehicle, unpayVehicle,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export const useApp = () => useContext(Ctx)
