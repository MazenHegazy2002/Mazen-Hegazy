-- FIX 4: FINAL TYPE CONVERSION
-- We must drop policies first because they "lock" the column type.

-- 1. DROP ALL POLICIES (Cleaning the slate)
DROP POLICY IF EXISTS "Public Usage Profiles" ON public.profiles;
DROP POLICY IF EXISTS "Owner Edit Profile" ON public.profiles;
DROP POLICY IF EXISTS "Public Usage Messages" ON public.messages;
DROP POLICY IF EXISTS "Public Usage Statuses" ON public.statuses;

-- 2. ALTER COLUMNS to TEXT
-- This allows "u-1234..." IDs to be stored
ALTER TABLE public.profiles ALTER COLUMN id TYPE text;
ALTER TABLE public.messages ALTER COLUMN sender_id TYPE text;
ALTER TABLE public.messages ALTER COLUMN recipient_id TYPE text;
ALTER TABLE public.statuses ALTER COLUMN user_id TYPE text;

-- 3. RE-CREATE POLICIES
-- Now we put the permission rules back
CREATE POLICY "Public Usage Profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Usage Messages" ON public.messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Usage Statuses" ON public.statuses FOR ALL USING (true) WITH CHECK (true);

-- 4. GRANT PERMISSIONS TO ANON
GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.messages TO anon;
GRANT ALL ON TABLE public.statuses TO anon;
