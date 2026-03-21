const { createClient } = require('@supabase/supabase-js');
const config = require('./index');

const supabase = createClient(config.supabase.url, config.supabase.serviceKey);

module.exports = supabase;
