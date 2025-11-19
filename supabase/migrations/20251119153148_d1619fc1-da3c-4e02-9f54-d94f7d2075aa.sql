-- Create webhook_logs table to track all incoming PostFinance webhooks
CREATE TABLE public.webhook_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id TEXT,
  entity_id TEXT NOT NULL,
  event_type TEXT,
  state TEXT,
  space_id TEXT,
  payment_id UUID,
  booking_id UUID,
  status TEXT NOT NULL, -- 'success', 'error', 'ignored'
  processing_duration_ms INTEGER,
  error_message TEXT,
  request_payload JSONB,
  response_data JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for performance
CREATE INDEX idx_webhook_logs_created_at ON public.webhook_logs(created_at DESC);
CREATE INDEX idx_webhook_logs_entity_id ON public.webhook_logs(entity_id);
CREATE INDEX idx_webhook_logs_payment_id ON public.webhook_logs(payment_id);
CREATE INDEX idx_webhook_logs_status ON public.webhook_logs(status);

-- Enable RLS
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- Allow staff to view webhook logs
CREATE POLICY "Staff can view webhook logs"
  ON public.webhook_logs
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'staff'::app_role)
  );

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.webhook_logs;