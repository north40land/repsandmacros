import { createClient } from '@supabase/supabase-js'

// Without these two values the app runs in "this phone only" mode: no sign-in, no cloud.
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = url && key ? createClient(url, key) : null
