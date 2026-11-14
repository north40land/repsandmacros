import { createClient } from '@supabase/supabase-js'

// Without these two values the app runs in "this phone only" mode: no sign-in, no cloud.
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// `npm run dev:local` sets VITE_LOCAL_ONLY so features can be tested without touching real accounts.
const localOnly = import.meta.env.VITE_LOCAL_ONLY === '1'

export const supabase = url && key && !localOnly ? createClient(url, key) : null
