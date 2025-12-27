-- FIX 3: CHANGE TYPES TO TEXT
-- The app is generating IDs like "u-12345" which are NOT valid UUIDs.
-- We must change the database columns to TEXT to accept them.

-- 1. Change Profiles Table
ALTER TABLE public.profiles ALTER COLUMN id TYPE text;

-- 2. Change Messages Table
-- Note: We act on sender_id and recipient_id. 
-- If they are foreign keys we might need to drop them (we did in previous steps), 
-- but converting type usually handles it if dependencies are clear.
ALTER TABLE public.messages ALTER COLUMN sender_id TYPE text;
ALTER TABLE public.messages ALTER COLUMN recipient_id TYPE text;

-- 3. Change Statuses Table
ALTER TABLE public.statuses ALTER COLUMN user_id TYPE text;

-- 4. Re-ensure everything is open (just to be safe)
GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.messages TO anon;
GRANT ALL ON TABLE public.statuses TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
