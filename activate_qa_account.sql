-- Script to activate the QA test account for testing
-- This should be run against the Supabase database before testing

-- First, find the user ID for the QA account
-- UPDATE public.profiles 
-- SET is_active = true
-- WHERE email = 'qa.cursor.seq@sophia-os.test';

-- Grant admin role to the QA account
-- INSERT INTO public.user_roles (user_id, role)
-- SELECT id, 'admin'::public.app_role
-- FROM auth.users
-- WHERE email = 'qa.cursor.seq@sophia-os.test'
-- ON CONFLICT (user_id, role) DO NOTHING;

-- Check if account exists and is activated
SELECT 
  u.id,
  u.email,
  p.is_active,
  p.prenom,
  p.nom,
  array_agg(ur.role) as roles
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
WHERE u.email = 'qa.cursor.seq@sophia-os.test'
GROUP BY u.id, u.email, p.is_active, p.prenom, p.nom;
