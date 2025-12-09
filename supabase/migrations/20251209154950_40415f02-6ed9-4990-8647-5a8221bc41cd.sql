-- Allow public read access to app_settings for payment confirmation pages, PDFs, etc.
CREATE POLICY "Public can view app settings" 
ON public.app_settings 
FOR SELECT 
USING (true);