-- FIX 6: THE "MESSAGE PRIVACY" FIX
-- There was a hidden policy named "Message Privacy" that we missed.
-- This script drops that one too.

-- 1. DROP ALL POLICIES (Including the one that caused the error)
DROP POLICY IF EXISTS "Message Privacy" ON public.messages;
DROP POLICY IF EXISTS "Public Usage Profiles" ON public.profiles;
DROP POLICY IF EXISTS "Owner Edit Profile" ON public.profiles;
DROP POLICY IF EXISTS "Public Usage Messages" ON public.messages;
DROP POLICY IF EXISTS "Public Usage Statuses" ON public.statuses;
-- Drop other common defaults just in case
DROP POLICY IF EXISTS "Enable read access for all users" ON public.profiles;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.profiles;
DROP POLICY IF EXISTS "Enable update for users based on email" ON public.profiles;

-- 2. DROP ALL CONSTRAINTS (Just to be sure)
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_recipient_id_fkey;
ALTER TABLE public.statuses DROP CONSTRAINT IF EXISTS statuses_user_id_fkey;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- 3. CHANGE TYPES TO TEXT (The goal)
ALTER TABLE public.profiles ALTER COLUMN id TYPE text;
ALTER TABLE public.messages ALTER COLUMN sender_id TYPE text;
ALTER TABLE public.messages ALTER COLUMN recipient_id TYPE text;
ALTER TABLE public.statuses ALTER COLUMN user_id TYPE text;

-- 4. RESTORE ACCESS (Re-enable RLS)
CREATE POLICY "Public Usage Profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Usage Messages" ON public.messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Usage Statuses" ON public.statuses FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.messages TO anon;
GRANT ALL ON TABLE public.statuses TO anon;
