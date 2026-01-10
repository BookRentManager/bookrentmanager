import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";
import { Loader2, Info, Eye, RefreshCw, Trash2 } from "lucide-react";
import DOMPurify from "dompurify";

export function EmailSecurityDepositReminderSettings() {
  const queryClient = useQueryClient();
  const [subjectLine, setSubjectLine] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

  // Sample data for preview
  const sampleData = {
    client_name: "Jane Smith",
    reference_code: "KR009999",
    deposit_amount: "1500.00",
    currency: "EUR",
    portalUrl: "https://example.com/booking-form/sample-token",
    company_name: "KingRent",
    logoUrl: "/king-rent-logo.png",
    days_until_delivery: "2",
  };

  const getPreviewHtml = () => {
    let preview = htmlContent;
    Object.entries(sampleData).forEach(([key, value]) => {
      preview = preview.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    });
    return DOMPurify.sanitize(preview);
  };

  const { data: template, isLoading } = useQuery({
    queryKey: ["email_template_security_deposit_reminder"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .eq("template_type", "security_deposit_reminder")
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setSubjectLine(data.subject_line);
        setHtmlContent(data.html_content);
      }
      
      return data;
    },
  });

  const loadDefaultMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-default-email-template', {
        body: { template_type: 'security_deposit_reminder' }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setSubjectLine(data.subject_line);
      setHtmlContent(data.html_content);
      toast.success("Default template loaded successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to load default template");
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (template) {
        const { error } = await supabase
          .from("email_templates")
          .update({
            subject_line: subjectLine,
            html_content: htmlContent,
          })
          .eq("id", template.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("email_templates")
          .insert({
            template_type: "security_deposit_reminder",
            subject_line: subjectLine,
            html_content: htmlContent,
            is_active: true,
          });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email_template_security_deposit_reminder"] });
      toast.success("Security deposit reminder template saved successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to save template");
    },
  });

  const restoreDefaultMutation = useMutation({
    mutationFn: async () => {
      if (!template?.id) throw new Error("No template to delete");
      
      const { error } = await supabase
        .from("email_templates")
        .delete()
        .eq("id", template.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      setSubjectLine("");
      setHtmlContent("");
      queryClient.invalidateQueries({ queryKey: ["email_template_security_deposit_reminder"] });
      toast.success("Template removed - system will now use the built-in default");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to restore default");
    },
  });

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
        <CardTitle>Security Deposit Reminder Email</CardTitle>
        <CardDescription>
          Customize the email sent to clients reminding them to authorize their security deposit
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-muted p-4 rounded-lg">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-2">Available placeholders:</p>
              <ul className="space-y-1 text-xs">
                <li><code className="bg-background px-1 py-0.5 rounded">{"{{client_name}}"}</code> - Client's name</li>
                <li><code className="bg-background px-1 py-0.5 rounded">{"{{reference_code}}"}</code> - Booking reference</li>
                <li><code className="bg-background px-1 py-0.5 rounded">{"{{deposit_amount}}"}</code> - Security deposit amount</li>
                <li><code className="bg-background px-1 py-0.5 rounded">{"{{currency}}"}</code> - Currency code</li>
                <li><code className="bg-background px-1 py-0.5 rounded">{"{{portalUrl}}"}</code> - Client portal link</li>
                <li><code className="bg-background px-1 py-0.5 rounded">{"{{company_name}}"}</code> - Your company name</li>
                <li><code className="bg-background px-1 py-0.5 rounded">{"{{logoUrl}}"}</code> - Company logo URL</li>
                <li><code className="bg-background px-1 py-0.5 rounded">{"{{days_until_delivery}}"}</code> - Days until pickup</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="subject">Subject Line</Label>
          <Input
            id="subject"
            value={subjectLine}
            onChange={(e) => setSubjectLine(e.target.value)}
            placeholder="Security Deposit Authorization Required - {{reference_code}}"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="html">Email HTML Content</Label>
          <Textarea
            id="html"
            value={htmlContent}
            onChange={(e) => setHtmlContent(e.target.value)}
            placeholder="Enter your HTML email template here..."
            rows={20}
            className="font-mono text-xs"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !subjectLine || !htmlContent}
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Template"
            )}
          </Button>

          <Button
            variant="outline"
            onClick={() => loadDefaultMutation.mutate()}
            disabled={loadDefaultMutation.isPending}
          >
            {loadDefaultMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Load Default Template
              </>
            )}
          </Button>

          <Button
            variant="outline"
            onClick={() => restoreDefaultMutation.mutate()}
            disabled={restoreDefaultMutation.isPending || !template}
          >
            {restoreDefaultMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Restoring...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Restore to Default
              </>
            )}
          </Button>

          <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" disabled={!htmlContent}>
                <Eye className="mr-2 h-4 w-4" />
                Preview Email
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Email Preview</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Subject:</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {subjectLine.replace(/\{\{reference_code\}\}/g, sampleData.reference_code)}
                  </p>
                </div>
                <div className="border rounded-lg p-4 bg-muted/30">
                  <div 
                    dangerouslySetInnerHTML={{ __html: getPreviewHtml() }}
                    className="bg-white"
                  />
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <p className="text-xs text-muted-foreground mt-2">
          <strong>Note:</strong> "Restore to Default" will delete your custom template from the database, causing the system to use the built-in default template.
        </p>
      </CardContent>
    </Card>
  );
}
