import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tzrxynyyhgmpyrxaucwd.supabase.co';
const supabaseKey = 'sb_publishable_QkGt-SnAXA3dgw6dPW74-A_DlxfehM-';

export const supabase = createClient(supabaseUrl, supabaseKey);