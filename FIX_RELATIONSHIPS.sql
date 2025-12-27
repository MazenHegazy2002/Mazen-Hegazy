-- FIX: Drop the constraint that forces users to be in auth.users
-- This allows us to create users directly from the App (client-side ID generation)

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;

-- Also verify standard permissions are still correct
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Ensure public access is still allowed (re-apply just in case)
DROP POLICY IF EXISTS "Public Usage Profiles" ON public.profiles;
CREATE POLICY "Public Usage Profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);
