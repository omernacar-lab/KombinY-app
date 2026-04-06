const { createClient } = require('@supabase/supabase-js');
const config = require('./index');

// Service role client - veri işlemleri için (RLS bypass eder)
const supabase = createClient(config.supabase.url, config.supabase.serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Anon client - auth işlemleri için (signInWithPassword session'ı service client'ı kirletmesin)
const supabaseAuth = createClient(config.supabase.url, config.supabase.anonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

module.exports = { supabase, supabaseAuth };
