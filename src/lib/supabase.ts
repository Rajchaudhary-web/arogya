import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('placeholder')) {
  console.warn(
    '[Arogya] Supabase env vars not configured.\n' +
    'Copy .env.example → .env and fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.\n' +
    'Auth features will not work until real values are provided.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
