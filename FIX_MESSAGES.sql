-- FIX 2: Drop the constraint on messages table too
-- This ensures messages can be sent even if the recipient ID is "virtual" (not yet synced)

ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_recipient_id_fkey;

-- Ensure RLS allows insert for everyone
DROP POLICY IF EXISTS "Public Usage Messages" ON public.messages;
CREATE POLICY "Public Usage Messages" ON public.messages FOR ALL USING (true) WITH CHECK (true);
