-- Add missing audit action values
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'booking_form_sent';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'soft_delete';