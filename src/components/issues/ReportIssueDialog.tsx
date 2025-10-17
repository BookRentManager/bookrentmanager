import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

const issueSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters").max(100),
  category: z.enum([
    "bug",
    "feature_request",
    "performance",
    "ui_ux",
    "data_issue",
    "authentication",
    "integration",
    "other",
  ]),
  priority: z.enum(["low", "medium", "high", "critical"]),
  attempted_action: z.string().min(10, "Please describe what you were trying to do"),
  actual_behavior: z.string().min(10, "Please describe what actually happened"),
  steps_to_reproduce: z.string().optional(),
  expected_behavior: z.string().optional(),
  additional_notes: z.string().optional(),
  screenshot: z.any().optional(),
});

type IssueFormData = z.infer<typeof issueSchema>;

interface ReportIssueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReportIssueDialog({ open, onOpenChange }: ReportIssueDialogProps) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<IssueFormData>({
    resolver: zodResolver(issueSchema),
    defaultValues: {
      priority: "medium",
      category: "bug",
    },
  });

  const captureContext = () => ({
    route: window.location.pathname,
    userAgent: navigator.userAgent,
    screenSize: `${window.innerWidth}x${window.innerHeight}`,
    browserInfo: {
      language: navigator.language,
      platform: navigator.platform,
      cookiesEnabled: navigator.cookieEnabled,
    },
  });

  const onSubmit = async (data: IssueFormData) => {
    if (!user) {
      toast.error("You must be logged in to report an issue");
      return;
    }

    setIsSubmitting(true);

    try {
      const context = captureContext();
      let screenshotUrl = null;

      // Upload screenshot if provided
      if (data.screenshot && data.screenshot[0]) {
        const file = data.screenshot[0];
        const fileExt = file.name.split(".").pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("issue-screenshots")
          .upload(fileName, file);

        if (uploadError) {
          console.error("Screenshot upload error:", uploadError);
        } else {
          screenshotUrl = fileName;
        }
      }

      // Insert issue report
      const { error: insertError } = await supabase.from("issue_reports").insert({
        title: data.title,
        category: data.category,
        priority: data.priority,
        attempted_action: data.attempted_action,
        actual_behavior: data.actual_behavior,
        steps_to_reproduce: data.steps_to_reproduce,
        expected_behavior: data.expected_behavior,
        additional_notes: data.additional_notes,
        page_route: context.route,
        user_agent: context.userAgent,
        screen_size: context.screenSize,
        browser_info: context.browserInfo,
        screenshot_url: screenshotUrl,
        reported_by: user.id,
      });

      if (insertError) throw insertError;

      toast.success("Issue reported successfully! Our team will review it soon.");
      form.reset();
      onOpenChange(false);
    } catch (error) {
      console.error("Error reporting issue:", error);
      toast.error("Failed to report issue. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Report an Issue</DialogTitle>
          <DialogDescription>
            Help us improve by reporting bugs, requesting features, or sharing feedback.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Issue Title *</FormLabel>
                  <FormControl>
                    <Input placeholder="Brief summary of the issue" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="bug">Bug</SelectItem>
                        <SelectItem value="feature_request">Feature Request</SelectItem>
                        <SelectItem value="performance">Performance</SelectItem>
                        <SelectItem value="ui_ux">UI/UX</SelectItem>
                        <SelectItem value="data_issue">Data Issue</SelectItem>
                        <SelectItem value="authentication">Authentication</SelectItem>
                        <SelectItem value="integration">Integration</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="attempted_action"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>What were you trying to do? *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="E.g., I was trying to add a new booking..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="actual_behavior"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>What actually happened? *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="E.g., The page crashed with an error message..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="expected_behavior"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>What did you expect to happen?</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="E.g., The booking should have been saved..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="steps_to_reproduce"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Steps to Reproduce (if applicable)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="1. Go to Bookings page&#10;2. Click Add Booking&#10;3. Fill in the form&#10;4. Click Save"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="additional_notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Additional Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Any other information that might be helpful..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="screenshot"
              render={({ field: { onChange, value, ...field } }) => (
                <FormItem>
                  <FormLabel>Screenshot (optional)</FormLabel>
                  <FormControl>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => onChange(e.target.files)}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit Issue
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
