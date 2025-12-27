
-- Create a table to store user Push Subscriptions (VAPID)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    user_id UUID NOT NULL,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY (user_id, endpoint) -- Allow multiple devices per user
);

-- Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Allow users to insert their own subscriptions
CREATE POLICY "Users can insert their own subscriptions" ON public.push_subscriptions
    FOR INSERT WITH CHECK (true); -- Ideally check auth.uid() but we use client-generated IDs for this hybrid app

-- Allow public access for now since auth is custom
DROP POLICY IF EXISTS "Public Usage Subscriptions" ON public.push_subscriptions;
CREATE POLICY "Public Usage Subscriptions" ON public.push_subscriptions FOR ALL USING (true) WITH CHECK (true);
