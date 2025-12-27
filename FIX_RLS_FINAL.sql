
-- 1. Disable RLS (This is the critical part to fix "Success. No rows returned" on inserts)
ALTER TABLE call_signals DISABLE ROW LEVEL SECURITY;

-- 2. Drop policies just to be clean (ignoring errors if they don't exist)
DROP POLICY IF EXISTS "Enable insert for all" ON call_signals;
DROP POLICY IF EXISTS "Enable read for recipient" ON call_signals;

-- 3. We SKIPPED the "ALTER PUBLICATION" command because it is already done.
--    Your previous error confirmed that Realtime is ALREADY enabled for this table.
