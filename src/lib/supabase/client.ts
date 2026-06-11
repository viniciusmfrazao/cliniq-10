import { createBrowserClient } from '@supabase/ssr'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yqrjbyaucimvmzpfipgs.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxcmpieWF1Y2ltdm16cGZpcGdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NzE0ODcsImV4cCI6MjA5MTM0NzQ4N30.T8kjp-2Nl0HGe9_UIvQNZXPT6DNJgaqK3awUKU0HeYA'

export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
}
