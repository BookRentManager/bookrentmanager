-- Soft delete all orphaned fines (fines with no booking_id)
UPDATE public.fines
SET deleted_at = now()
WHERE booking_id IS NULL AND deleted_at IS NULL;