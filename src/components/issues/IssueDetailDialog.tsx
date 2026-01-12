import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { Loader2, ExternalLink } from "lucide-react";
import { useUserViewScope } from "@/hooks/useUserViewScope";

interface IssueDetailDialogProps {
  issueId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

type IssueStatus = "new" | "under_review" | "in_progress" | "resolved" | "wont_fix" | "need_more_info";
type IssuePriority = "low" | "medium" | "high" | "critical";

export function IssueDetailDialog({
  issueId,
  open,
  onOpenChange,
  onUpdate,
}: IssueDetailDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { isReadOnly } = useUserViewScope();
  const [newNote, setNewNote] = useState("");
  const [isAddingNote, setIsAddingNote] = useState(false);

  const { data: issue, isLoading } = useQuery({
    queryKey: ["issue-detail", issueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("issue_reports")
        .select("*")
        .eq("id", issueId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!issueId,
  });

  const { data: notes } = useQuery({
    queryKey: ["issue-notes", issueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("issue_notes")
        .select("*")
        .eq("issue_id", issueId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!issueId,
  });

  const { data: statusHistory } = useQuery({
    queryKey: ["issue-status-history", issueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("issue_status_history")
        .select("*")
        .eq("issue_id", issueId)
        .order("changed_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!issueId,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({
      status,
      priority,
    }: {
      status?: IssueStatus;
      priority?: IssuePriority;
    }) => {
      const updates: any = { updated_at: new Date().toISOString() };
      
      if (status) {
        updates.status = status;
        if (status === "resolved") {
          updates.resolved_at = new Date().toISOString();
        }

        // Log status change
        const { error: historyError } = await supabase
          .from("issue_status_history")
          .insert({
            issue_id: issueId,
            old_status: issue?.status,
            new_status: status,
            changed_by: user!.id,
          });

        if (historyError) throw historyError;
      }

      if (priority) {
        updates.priority = priority;
      }

      const { error } = await supabase
        .from("issue_reports")
        .update(updates)
        .eq("id", issueId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issue-detail", issueId] });
      queryClient.invalidateQueries({ queryKey: ["issue-status-history", issueId] });
      onUpdate();
      toast.success("Issue updated successfully");
    },
    onError: (error) => {
      console.error("Error updating issue:", error);
      toast.error("Failed to update issue");
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: async (note: string) => {
      const { error } = await supabase.from("issue_notes").insert({
        issue_id: issueId,
        note,
        created_by: user!.id,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issue-notes", issueId] });
      setNewNote("");
      toast.success("Note added successfully");
    },
    onError: (error) => {
      console.error("Error adding note:", error);
      toast.error("Failed to add note");
    },
  });

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setIsAddingNote(true);
    await addNoteMutation.mutateAsync(newNote);
    setIsAddingNote(false);
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      bug: "Bug",
      feature_request: "Feature Request",
      performance: "Performance",
      ui_ux: "UI/UX",
      data_issue: "Data Issue",
      authentication: "Authentication",
      integration: "Integration",
      other: "Other",
    };
    return labels[category] || category;
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!issue) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{issue.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status and Priority Controls */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select
                value={issue.status}
                onValueChange={(value) =>
                  updateStatusMutation.mutate({ status: value as IssueStatus })
                }
                disabled={isReadOnly}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="under_review">Under Review</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="wont_fix">Won't Fix</SelectItem>
                  <SelectItem value="need_more_info">Need More Info</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Priority</label>
              <Select
                value={issue.priority}
                onValueChange={(value) =>
                  updateStatusMutation.mutate({ priority: value as IssuePriority })
                }
                disabled={isReadOnly}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Issue Details */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold mb-1">Category</h3>
              <Badge variant="secondary">{getCategoryLabel(issue.category)}</Badge>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-1">What the user was trying to do</h3>
              <p className="text-sm text-muted-foreground">{issue.attempted_action}</p>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-1">What actually happened</h3>
              <p className="text-sm text-muted-foreground">{issue.actual_behavior}</p>
            </div>

            {issue.expected_behavior && (
              <div>
                <h3 className="text-sm font-semibold mb-1">Expected behavior</h3>
                <p className="text-sm text-muted-foreground">{issue.expected_behavior}</p>
              </div>
            )}

            {issue.steps_to_reproduce && (
              <div>
                <h3 className="text-sm font-semibold mb-1">Steps to reproduce</h3>
                <pre className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {issue.steps_to_reproduce}
                </pre>
              </div>
            )}

            {issue.additional_notes && (
              <div>
                <h3 className="text-sm font-semibold mb-1">Additional notes</h3>
                <p className="text-sm text-muted-foreground">{issue.additional_notes}</p>
              </div>
            )}
          </div>

          <Separator />

          {/* Context Information */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <h3 className="font-semibold mb-1">Page</h3>
              <p className="text-muted-foreground">{issue.page_route}</p>
            </div>
            <div>
              <h3 className="font-semibold mb-1">Screen Size</h3>
              <p className="text-muted-foreground">{issue.screen_size}</p>
            </div>
            <div>
              <h3 className="font-semibold mb-1">Created</h3>
              <p className="text-muted-foreground">
                {format(new Date(issue.created_at), "PPpp")}
              </p>
            </div>
            {issue.resolved_at && (
              <div>
                <h3 className="font-semibold mb-1">Resolved</h3>
                <p className="text-muted-foreground">
                  {format(new Date(issue.resolved_at), "PPpp")}
                </p>
              </div>
            )}
          </div>

          {issue.screenshot_url && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Screenshot</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const { data } = await supabase.storage
                    .from("issue-screenshots")
                    .createSignedUrl(issue.screenshot_url!, 3600);
                  if (data?.signedUrl) {
                    window.open(data.signedUrl, "_blank");
                  }
                }}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View Screenshot
              </Button>
            </div>
          )}

          <Separator />

          {/* Admin Notes */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Admin Notes</h3>
            <div className="space-y-3 mb-4">
              {notes && notes.length > 0 ? (
                notes.map((note) => (
                  <div key={note.id} className="bg-muted p-3 rounded-lg">
                    <p className="text-sm">{note.note}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {format(new Date(note.created_at), "PPpp")}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No notes yet</p>
              )}
            </div>

            {!isReadOnly && (
              <div className="space-y-2">
                <Textarea
                  placeholder="Add a note..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                />
                <Button
                  onClick={handleAddNote}
                  disabled={!newNote.trim() || isAddingNote}
                  size="sm"
                >
                  {isAddingNote && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add Note
                </Button>
              </div>
            )}
          </div>

          {/* Status History */}
          {statusHistory && statusHistory.length > 0 && (
            <>
              <Separator />
              <div>
                <h3 className="text-lg font-semibold mb-3">Status History</h3>
                <div className="space-y-2">
                  {statusHistory.map((history) => (
                    <div key={history.id} className="text-sm">
                      <span className="font-medium">
                        {history.old_status || "Created"} → {history.new_status}
                      </span>
                      <span className="text-muted-foreground ml-2">
                        {format(new Date(history.changed_at), "PPpp")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
