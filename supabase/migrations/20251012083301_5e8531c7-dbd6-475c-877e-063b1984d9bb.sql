-- Allow unauthenticated users to view app settings (needed for login page branding)
CREATE POLICY "Anyone can view app settings"
ON public.app_settings
FOR SELECT
TO public
USING (true);