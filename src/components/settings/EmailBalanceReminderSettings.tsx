import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";
import { Loader2, Info } from "lucide-react";

export function EmailBalanceReminderSettings() {
  const queryClient = useQueryClient();
  const [subjectLine, setSubjectLine] = useState("");
  const [htmlContent, setHtmlContent] = useState("");

  const { data: template, isLoading } = useQuery({
    queryKey: ["email_template_balance_reminder"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .eq("template_type", "balance_reminder")
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
            template_type: "balance_reminder",
            subject_line: subjectLine,
            html_content: htmlContent,
            is_active: true,
          });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email_template_balance_reminder"] });
      toast.success("Balance reminder template saved successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to save template");
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
        <CardTitle>Balance Payment Reminder Email</CardTitle>
        <CardDescription>
          Customize the email sent to clients reminding them to complete their balance payment
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
                <li><code className="bg-background px-1 py-0.5 rounded">{"{{balance_amount}}"}</code> - Remaining balance</li>
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
            placeholder="Balance Payment Reminder - {{reference_code}}"
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
      </CardContent>
    </Card>
  );
}
