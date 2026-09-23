import { createClient } from '@supabase/supabase-js'

// ========== REPLACE THESE TWO VALUES ==========
const SUPABASE_URL = 'https://ujydhfmnifrtxpuzcfuf.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqeWRoZm1uaWZydHhwdXpjZnVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDA1NjU4NCwiZXhwIjoyMTA1NjMyNTg0fQ.w6F2zzsKZzi3IyMG4MpgZBZT7yciuLeImy5xZo0nN8c'
// ================================================

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
