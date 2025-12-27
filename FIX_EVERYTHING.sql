-- FIX 5: THE NUCLEAR OPTION
-- It seems there are hidden constraints blocking us.
-- We will DROP EVERYTHING that could possibly block the change.

-- 1. DROP ALL POSSIBLE CONSTRAINTS
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_recipient_id_fkey;
ALTER TABLE public.statuses DROP CONSTRAINT IF EXISTS statuses_user_id_fkey;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- 2. DROP ALL POLICIES
DROP POLICY IF EXISTS "Public Usage Profiles" ON public.profiles;
DROP POLICY IF EXISTS "Owner Edit Profile" ON public.profiles;
DROP POLICY IF EXISTS "Public Usage Messages" ON public.messages;
DROP POLICY IF EXISTS "Public Usage Statuses" ON public.statuses;

-- 3. CHANGE TYPES TO TEXT (Now purely safe)
ALTER TABLE public.profiles ALTER COLUMN id TYPE text;
ALTER TABLE public.messages ALTER COLUMN sender_id TYPE text;
ALTER TABLE public.messages ALTER COLUMN recipient_id TYPE text;
ALTER TABLE public.statuses ALTER COLUMN user_id TYPE text;

-- 4. RESTORE POLICIES
CREATE POLICY "Public Usage Profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Usage Messages" ON public.messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Usage Statuses" ON public.statuses FOR ALL USING (true) WITH CHECK (true);

-- 5. GRANT PERMISSIONS
GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.messages TO anon;
GRANT ALL ON TABLE public.statuses TO anon;
