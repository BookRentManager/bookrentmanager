import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const templateTypes = [
  { value: 'booking_confirmation', label: 'Booking Confirmation' },
  { value: 'payment_confirmation', label: 'Payment Confirmation' },
  { value: 'balance_reminder', label: 'Balance Reminder' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
];

const placeholders = [
  '{{reference_code}}', '{{client_name}}', '{{car_model}}',
  '{{pickup_date}}', '{{return_date}}', '{{pickup_location}}', '{{return_location}}',
  '{{amount_total}}', '{{amount_paid}}', '{{remaining_amount}}', '{{currency}}',
  '{{company_name}}', '{{company_email}}', '{{company_phone}}',
  '{{form_url}}', '{{payment_url}}', '{{payment_method}}', '{{payment_date}}',
  '{{account_name}}', '{{iban}}', '{{bic}}', '{{bank_name}}', '{{reference}}'
];

export function EmailTemplateSettings() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('booking_confirmation');
  const [editedSubject, setEditedSubject] = useState('');
  const [editedContent, setEditedContent] = useState('');

  const { data: templates, isLoading } = useQuery({
    queryKey: ['email-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .order('template_type');
      
      if (error) throw error;
      return data;
    },
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ type, subject, content }: { type: string; subject: string; content: string }) => {
      const { error } = await supabase
        .from('email_templates')
        .update({ 
          subject_line: subject,
          html_content: content,
          updated_at: new Date().toISOString()
        })
        .eq('template_type', type);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      toast.success('Email template updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update template: ' + error.message);
    },
  });

  const activeTemplate = templates?.find(t => t.template_type === activeTab);

  const handleSave = () => {
    if (!activeTemplate) return;
    
    updateTemplate.mutate({
      type: activeTab,
      subject: editedSubject || activeTemplate.subject_line,
      content: editedContent || activeTemplate.html_content,
    });
  };

  const handleReset = () => {
    if (!activeTemplate) return;
    setEditedSubject(activeTemplate.subject_line);
    setEditedContent(activeTemplate.html_content);
    toast.info('Reset to current saved version');
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email Templates</CardTitle>
        <CardDescription>
          Customize the HTML content for automated emails sent via Zapier
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(value) => {
          setActiveTab(value);
          const template = templates?.find(t => t.template_type === value);
          if (template) {
            setEditedSubject(template.subject_line);
            setEditedContent(template.html_content);
          }
        }}>
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4">
            {templateTypes.map((type) => (
              <TabsTrigger key={type.value} value={type.value}>
                {type.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {templateTypes.map((type) => (
            <TabsContent key={type.value} value={type.value} className="space-y-4">
              {activeTemplate && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject Line</Label>
                    <Input
                      id="subject"
                      value={editedSubject || activeTemplate.subject_line}
                      onChange={(e) => setEditedSubject(e.target.value)}
                      placeholder="Email subject line"
                    />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="content">HTML Content</Label>
                      <Textarea
                        id="content"
                        value={editedContent || activeTemplate.html_content}
                        onChange={(e) => setEditedContent(e.target.value)}
                        className="min-h-[400px] font-mono text-sm"
                        placeholder="HTML content"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Live Preview</Label>
                      <div 
                        className="border rounded-md p-4 min-h-[400px] overflow-auto bg-white"
                        dangerouslySetInnerHTML={{ 
                          __html: editedContent || activeTemplate.html_content 
                        }}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Available Placeholders</Label>
                    <div className="flex flex-wrap gap-2">
                      {placeholders.map((placeholder) => (
                        <code
                          key={placeholder}
                          className="px-2 py-1 bg-muted rounded text-xs cursor-pointer hover:bg-muted/80"
                          onClick={() => {
                            navigator.clipboard.writeText(placeholder);
                            toast.success(`Copied ${placeholder}`);
                          }}
                        >
                          {placeholder}
                        </code>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Click any placeholder to copy it to clipboard
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      onClick={handleSave}
                      disabled={updateTemplate.isPending}
                    >
                      {updateTemplate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Save Changes
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={handleReset}
                      disabled={updateTemplate.isPending}
                    >
                      Reset
                    </Button>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    Last updated: {new Date(activeTemplate.updated_at).toLocaleString()}
                  </div>
                </>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
