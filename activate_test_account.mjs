import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Activate the test account
const email = 'qa.cursor.seq@sophia-os.test';

// First, try to get the user ID from profiles table
const { data: profile, error: profileError } = await supabase
  .from('profiles')
  .select('id, is_active, email')
  .eq('email', email)
  .single();

if (profileError) {
  console.error('Error finding profile:', profileError);
  process.exit(1);
}

console.log('Found profile:', profile);

// Update the profile to be active
const { data: updateData, error: updateError } = await supabase
  .from('profiles')
  .update({ is_active: true })
  .eq('id', profile.id);

if (updateError) {
  console.error('Error updating profile:', updateError);
  console.log('This likely failed due to RLS policies. The account needs to be activated by an admin.');
  process.exit(1);
}

console.log('Successfully activated account!');
