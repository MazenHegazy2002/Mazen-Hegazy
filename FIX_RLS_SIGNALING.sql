
-- Drop existing policies to be safe
DROP POLICY IF EXISTS "Enable insert for all" ON call_signals;
DROP POLICY IF EXISTS "Enable read for recipient" ON call_signals;

-- Method 1: Just disable RLS (Easiest for troubleshooting Custom Auth)
ALTER TABLE call_signals DISABLE ROW LEVEL SECURITY;

-- Method 2: If you prefer keeping RLS enabled but permissive
-- CREATE POLICY "Allow all access" ON call_signals FOR ALL USING (true) WITH CHECK (true);

-- Ensure Realtime is still listening
ALTER PUBLICATION supabase_realtime ADD TABLE call_signals;
