-- Create enums for issue reporting
CREATE TYPE public.issue_category AS ENUM (
  'bug',
  'feature_request',
  'performance',
  'ui_ux',
  'data_issue',
  'authentication',
  'integration',
  'other'
);

CREATE TYPE public.issue_priority AS ENUM (
  'low',
  'medium',
  'high',
  'critical'
);

CREATE TYPE public.issue_status AS ENUM (
  'new',
  'under_review',
  'in_progress',
  'resolved',
  'wont_fix',
  'need_more_info'
);

-- Create issue_reports table
CREATE TABLE public.issue_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category issue_category NOT NULL,
  priority issue_priority NOT NULL DEFAULT 'medium',
  status issue_status NOT NULL DEFAULT 'new',
  
  -- What the user was trying to do
  attempted_action TEXT NOT NULL,
  
  -- What actually happened
  actual_behavior TEXT NOT NULL,
  
  -- Steps to reproduce
  steps_to_reproduce TEXT,
  
  -- What they expected
  expected_behavior TEXT,
  
  -- Additional notes
  additional_notes TEXT,
  
  -- Auto-captured context
  page_route TEXT NOT NULL,
  user_agent TEXT,
  screen_size TEXT,
  browser_info JSONB,
  console_errors JSONB,
  
  -- Screenshot
  screenshot_url TEXT,
  
  -- Assignment
  assigned_to UUID REFERENCES auth.users(id),
  
  -- User info
  reported_by UUID NOT NULL REFERENCES auth.users(id),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- Create issue_notes table for admin comments
CREATE TABLE public.issue_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES public.issue_reports(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create issue_status_history table for audit trail
CREATE TABLE public.issue_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES public.issue_reports(id) ON DELETE CASCADE,
  old_status issue_status,
  new_status issue_status NOT NULL,
  changed_by UUID NOT NULL REFERENCES auth.users(id),
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.issue_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_status_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for issue_reports
CREATE POLICY "Users can insert their own issues"
  ON public.issue_reports
  FOR INSERT
  WITH CHECK (auth.uid() = reported_by);

CREATE POLICY "Users can view their own issues"
  ON public.issue_reports
  FOR SELECT
  USING (auth.uid() = reported_by OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all issues"
  ON public.issue_reports
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete issues"
  ON public.issue_reports
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for issue_notes
CREATE POLICY "Users can view notes on their own issues"
  ON public.issue_notes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.issue_reports
      WHERE id = issue_notes.issue_id
      AND (reported_by = auth.uid() OR has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "Admins can insert notes"
  ON public.issue_notes
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update notes"
  ON public.issue_notes
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete notes"
  ON public.issue_notes
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for issue_status_history
CREATE POLICY "Users can view history of their own issues"
  ON public.issue_status_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.issue_reports
      WHERE id = issue_status_history.issue_id
      AND (reported_by = auth.uid() OR has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "Admins can insert status history"
  ON public.issue_status_history
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Create storage bucket for issue screenshots
INSERT INTO storage.buckets (id, name, public)
VALUES ('issue-screenshots', 'issue-screenshots', false);

-- Storage RLS policies
CREATE POLICY "Users can upload their own screenshots"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'issue-screenshots' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own screenshots"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'issue-screenshots' 
    AND (auth.uid()::text = (storage.foldername(name))[1] OR has_role(auth.uid(), 'admin'))
  );

CREATE POLICY "Admins can view all screenshots"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'issue-screenshots' AND has_role(auth.uid(), 'admin'));

-- Create trigger for updated_at
CREATE TRIGGER update_issue_reports_updated_at
  BEFORE UPDATE ON public.issue_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_issue_notes_updated_at
  BEFORE UPDATE ON public.issue_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();