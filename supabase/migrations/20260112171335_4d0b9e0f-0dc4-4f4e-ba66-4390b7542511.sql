-- =============================================
-- READ-ONLY ROLE ENHANCEMENT: Full Viewing Access
-- =============================================
-- This migration adds SELECT policies for the read_only role
-- across all tables they currently cannot access, plus INSERT
-- for chat messages (the only write action allowed).

-- 1. AGENCIES - Allow read_only to view
CREATE POLICY "Read-only can view agencies"
ON public.agencies FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'read_only'));

-- 2. AGENCY_INVOICES - Allow read_only to view
CREATE POLICY "Read-only can view agency invoices"
ON public.agency_invoices FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'read_only') AND deleted_at IS NULL);

-- 3. BOOKING_DOCUMENTS - Allow read_only to view
CREATE POLICY "Read-only can view booking documents"
ON public.booking_documents FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'read_only') AND deleted_at IS NULL);

-- 4. BOOKING_ACCESS_TOKENS - Allow read_only to view
CREATE POLICY "Read-only can view booking access tokens"
ON public.booking_access_tokens FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'read_only'));

-- 5. PROFILES - Allow read_only to view all profiles
CREATE POLICY "Read-only can view profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'read_only'));

-- 6. TAX_INVOICES - Allow read_only to view
CREATE POLICY "Read-only can view tax invoices"
ON public.tax_invoices FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'read_only') AND deleted_at IS NULL);

-- 7. CHAT_MESSAGES - Allow read_only to view AND write (exception)
CREATE POLICY "Read-only can view chat messages"
ON public.chat_messages FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'read_only') AND deleted_at IS NULL);

CREATE POLICY "Read-only can create chat messages"
ON public.chat_messages FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'read_only') AND auth.uid() = user_id);

-- 8. CHAT_NOTIFICATIONS - Allow read_only to view and create (for mentions)
CREATE POLICY "Read-only can view chat notifications"
ON public.chat_notifications FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'read_only'));

CREATE POLICY "Read-only can create chat notifications"
ON public.chat_notifications FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'read_only'));

-- 9. CHAT_UNREAD_MESSAGES - Allow read_only to manage their unread messages
CREATE POLICY "Read-only can view chat unread messages"
ON public.chat_unread_messages FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'read_only') AND auth.uid() = user_id);

CREATE POLICY "Read-only can delete own chat unread messages"
ON public.chat_unread_messages FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'read_only') AND auth.uid() = user_id);

CREATE POLICY "Read-only can insert chat unread messages"
ON public.chat_unread_messages FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'read_only'));