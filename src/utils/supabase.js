import { createClient } from '@supabase/supabase-js'

// These values come from your Supabase project settings.
// Replace them with your actual values — see SETUP.md for instructions.
const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.error('Missing Supabase env vars. Check your .env file — see SETUP.md.')
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)
