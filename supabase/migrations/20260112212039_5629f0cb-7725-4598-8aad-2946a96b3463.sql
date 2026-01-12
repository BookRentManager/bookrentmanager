-- Allow public read access for signup whitelist check
-- This enables unauthenticated users to check if their email is whitelisted during signup
CREATE POLICY "Allow public read for signup whitelist check"
ON public.whitelisted_emails
FOR SELECT
TO anon
USING (true);