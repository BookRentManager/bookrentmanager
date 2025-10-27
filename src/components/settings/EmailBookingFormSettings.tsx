import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Info } from "lucide-react";

interface EmailTemplate {
  id: string;
  template_type: string;
  subject_line: string;
  html_content: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export function EmailBookingFormSettings() {
  const queryClient = useQueryClient();
  const [htmlContent, setHtmlContent] = useState('');
  const [subjectLine, setSubjectLine] = useState('');

  const { data: template, isLoading } = useQuery<EmailTemplate | null>({
    queryKey: ['email_template_booking_form'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_templates' as any)
        .select('*')
        .eq('template_type', 'booking_form')
        .eq('is_active', true)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data as unknown as EmailTemplate | null;
    },
  });

  useEffect(() => {
    if (template) {
      setHtmlContent(template.html_content || '');
      setSubjectLine(template.subject_line || '');
    }
  }, [template]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (template?.id) {
        const { error } = await supabase
          .from('email_templates' as any)
          .update({
            html_content: htmlContent,
            subject_line: subjectLine,
          })
          .eq('id', template.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('email_templates' as any)
          .insert({
            template_type: 'booking_form',
            subject_line: subjectLine,
            html_content: htmlContent,
            is_active: true,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email_template_booking_form'] });
      toast.success('Template saved successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to save template');
    },
  });

  const handleReset = () => {
    if (template) {
      setHtmlContent(template.html_content || '');
      setSubjectLine(template.subject_line || '');
    }
  };

  const placeholders = [
    { key: '{{reference_code}}', desc: 'Booking reference number' },
    { key: '{{client_name}}', desc: 'Client full name' },
    { key: '{{client_email}}', desc: 'Client email address' },
    { key: '{{car_model}}', desc: 'Vehicle model name' },
    { key: '{{car_plate}}', desc: 'Vehicle license plate' },
    { key: '{{pickup_date}}', desc: 'Pickup date and time' },
    { key: '{{return_date}}', desc: 'Return date and time' },
    { key: '{{pickup_location}}', desc: 'Pickup location' },
    { key: '{{return_location}}', desc: 'Return location' },
    { key: '{{amount_total}}', desc: 'Total booking amount' },
    { key: '{{currency}}', desc: 'Currency code' },
    { key: '{{security_deposit_amount}}', desc: 'Security deposit amount' },
    { key: '{{payment_amount_percent}}', desc: 'Down payment percentage' },
    { key: '{{down_payment}}', desc: 'Calculated down payment amount' },
    { key: '{{balance_payment}}', desc: 'Remaining balance amount' },
    { key: '{{formUrl}}', desc: 'Link to booking form' },
    { key: '{{company_name}}', desc: 'Company name' },
    { key: '{{company_email}}', desc: 'Company email' },
    { key: '{{company_phone}}', desc: 'Company phone' },
    { key: '{{logoUrl}}', desc: 'Company logo URL' },
  ];

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Booking Form Email Template</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-md flex gap-2">
          <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900 dark:text-blue-100">
            <p className="font-semibold mb-1">Booking Form Email</p>
            <p>Sent when you click "Send Booking Form" on a booking. This email invites the client to complete their booking details and make payment.</p>
            <p className="mt-2 text-xs italic">Database identifier: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">booking_form</code></p>
          </div>
        </div>

        <div>
          <Label htmlFor="subject">Email Subject</Label>
          <Textarea
            id="subject"
            value={subjectLine}
            onChange={(e) => setSubjectLine(e.target.value)}
            placeholder="Complete Your Booking - {{reference_code}}"
            className="mt-2 h-20"
          />
        </div>

        <div>
          <Label htmlFor="html">HTML Content</Label>
          <Textarea
            id="html"
            value={htmlContent}
            onChange={(e) => setHtmlContent(e.target.value)}
            placeholder="Enter your HTML email template here..."
            className="mt-2 font-mono text-sm"
            rows={15}
          />
        </div>

        <div className="border rounded-lg p-4 bg-muted/50">
          <h4 className="font-semibold mb-3">Available Placeholders</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            {placeholders.map((p) => (
              <div key={p.key} className="flex gap-2">
                <code className="text-xs bg-background px-1.5 py-0.5 rounded">{p.key}</code>
                <span className="text-muted-foreground text-xs">{p.desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <Button 
            onClick={() => saveMutation.mutate()} 
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Template
          </Button>
          <Button variant="outline" onClick={handleReset}>
            Reset
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
