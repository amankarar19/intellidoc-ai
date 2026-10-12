import { createClient } from '@supabase/supabase-js'

// Vite exposes variables that start with VITE_ through import.meta.env.
const url = (import.meta.env.VITE_SUPABASE_URL ?? '').trim()
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()

// Configuration counts as valid only if both values exist, the URL looks like a
// real https URL and the placeholder text from .env.example has been replaced.
function looksConfigured() {
  if (!url || !key) return false
  if (/your-|<|>|xxxx/i.test(url + key)) return false
  try {
    return new URL(url).protocol === 'https:'
  } catch {
    return false
  }
}

export const isSupabaseConfigured = looksConfigured()

// Project reference shown in the sidebar, e.g. "mfkmhpeapkqglazlmgng".
export const supabaseProjectRef = isSupabaseConfigured ? new URL(url).hostname.split('.')[0] : ''

// One shared client for the whole app. It is null until .env is filled in.
export const supabase = isSupabaseConfigured ? createClient(url, key) : null
