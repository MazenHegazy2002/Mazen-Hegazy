
-- Create signaling table
CREATE TABLE IF NOT EXISTS call_signals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sender_id TEXT NOT NULL,
    recipient_id TEXT NOT NULL,
    type TEXT NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE call_signals;

-- RLS
ALTER TABLE call_signals ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (since we have custom IDs and auth might be weird for now)
-- Ideally: sender_id matches auth.uid()
CREATE POLICY "Enable insert for all" ON call_signals FOR INSERT WITH CHECK (true);

-- Allow recipients to read their signals
CREATE POLICY "Enable read for recipient" ON call_signals FOR SELECT USING (recipient_id = auth.uid()::text OR recipient_id = 'public');

-- Cleanup function to auto-delete old signals (optional, but good)
-- For now we will rely on manual cleanup or small volume
