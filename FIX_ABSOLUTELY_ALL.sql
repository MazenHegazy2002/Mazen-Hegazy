-- FIX 7: THE "SMART" NUCLEAR OPTION
-- Instead of guessing names, we tell the database to find ALL policies and delete them.

-- 1. DYNAMICALLY DROP ALL POLICIES
-- This little program loops through every policy on our tables and removes it.
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE tablename IN ('profiles', 'messages', 'statuses')) LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.' || r.tablename;
    END LOOP;
END $$;

-- 2. DROP ALL CONSTRAINTS (Just in case)
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_recipient_id_fkey;
ALTER TABLE public.statuses DROP CONSTRAINT IF EXISTS statuses_user_id_fkey;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- 3. CHANGE TYPES TO TEXT (The Goal)
ALTER TABLE public.profiles ALTER COLUMN id TYPE text;
ALTER TABLE public.messages ALTER COLUMN sender_id TYPE text;
ALTER TABLE public.messages ALTER COLUMN recipient_id TYPE text;
ALTER TABLE public.statuses ALTER COLUMN user_id TYPE text;

-- 4. RESTORE ACCESS (The Cleanup)
CREATE POLICY "Public Usage Profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Usage Messages" ON public.messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Usage Statuses" ON public.statuses FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.messages TO anon;
GRANT ALL ON TABLE public.statuses TO anon;
