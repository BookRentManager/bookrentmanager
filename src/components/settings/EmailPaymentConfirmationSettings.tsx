import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export function EmailPaymentConfirmationSettings() {
  const queryClient = useQueryClient();
  const [htmlContent, setHtmlContent] = useState("");
  const [subjectLine, setSubjectLine] = useState("");

  // Fetch current template
  const { data: template, isLoading } = useQuery({
    queryKey: ['email-template-payment-confirmation'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('email_templates')
        .select('*')
        .eq('template_type', 'payment_confirmation')
        .eq('is_active', true)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      
      if (data) {
        setHtmlContent(data.html_content);
        setSubjectLine(data.subject_line);
      }
      
      return data;
    },
  });

  // Save template mutation
  const saveTemplate = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (template?.id) {
        // Update existing
        const { error } = await (supabase as any)
          .from('email_templates')
          .update({
            html_content: htmlContent,
            subject_line: subjectLine,
            updated_at: new Date().toISOString(),
          })
          .eq('id', template.id);
        
        if (error) throw error;
      } else {
        // Insert new
        const { error } = await (supabase as any)
          .from('email_templates')
          .insert({
            template_type: 'payment_confirmation',
            subject_line: subjectLine,
            html_content: htmlContent,
            is_active: true,
            created_by: user?.id,
          });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-template-payment-confirmation'] });
      toast.success("Payment confirmation email template saved");
    },
    onError: (error) => {
      toast.error("Failed to save template: " + error.message);
    },
  });

  const handleReset = () => {
    if (template) {
      setHtmlContent(template.html_content);
      setSubjectLine(template.subject_line);
      toast.info("Changes reset to last saved version");
    }
  };

  const placeholders = [
    { key: "{{reference_code}}", desc: "Booking reference" },
    { key: "{{client_name}}", desc: "Client's name" },
    { key: "{{client_email}}", desc: "Client's email" },
    { key: "{{car_model}}", desc: "Vehicle name" },
    { key: "{{car_plate}}", desc: "License plate" },
    { key: "{{pickup_date}}", desc: "Formatted pickup date" },
    { key: "{{return_date}}", desc: "Formatted return date" },
    { key: "{{pickup_location}}", desc: "Pickup location" },
    { key: "{{return_location}}", desc: "Return location" },
    { key: "{{amount_paid}}", desc: "Payment amount" },
    { key: "{{total_amount}}", desc: "Booking total" },
    { key: "{{booking_paid}}", desc: "Total paid so far" },
    { key: "{{amount_remaining}}", desc: "Balance remaining" },
    { key: "{{payment_method}}", desc: "Payment method" },
    { key: "{{currency}}", desc: "Currency code" },
    { key: "{{portal_url}}", desc: "Client portal link" },
    { key: "{{receipt_url}}", desc: "Receipt PDF link" },
    { key: "{{confirmation_url}}", desc: "Confirmation PDF link" },
    { key: "{{company_name}}", desc: "Company name" },
    { key: "{{company_email}}", desc: "Company email" },
    { key: "{{company_phone}}", desc: "Company phone" },
  ];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Payment Confirmation Email</CardTitle>
          <CardDescription>Loading template...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Confirmation Email</CardTitle>
        <CardDescription>
          Customize the HTML email sent when payments are received
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-2 block">Subject Line</label>
          <Textarea
            value={subjectLine}
            onChange={(e) => setSubjectLine(e.target.value)}
            className="font-mono text-sm h-20"
            placeholder="Email subject..."
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">HTML Template</label>
          <Textarea
            value={htmlContent}
            onChange={(e) => setHtmlContent(e.target.value)}
            className="font-mono text-sm h-96"
            placeholder="HTML email content..."
          />
        </div>

        <div className="bg-muted p-4 rounded-lg">
          <h4 className="font-semibold text-sm mb-2">Available Placeholders:</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {placeholders.map((p) => (
              <div key={p.key}>
                <code className="bg-background px-1 py-0.5 rounded">{p.key}</code>
                <span className="text-muted-foreground ml-2">- {p.desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={() => saveTemplate.mutate()}
            disabled={saveTemplate.isPending}
          >
            {saveTemplate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
