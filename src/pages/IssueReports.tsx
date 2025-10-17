import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IssueDetailDialog } from "@/components/issues/IssueDetailDialog";
import { format } from "date-fns";
import { Search, Filter } from "lucide-react";

type IssueStatus = "new" | "under_review" | "in_progress" | "resolved" | "wont_fix" | "need_more_info";
type IssuePriority = "low" | "medium" | "high" | "critical";

export default function IssueReports() {
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<IssueStatus | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<IssuePriority | "all">("all");

  const { data: issues, isLoading, refetch } = useQuery({
    queryKey: ["issue-reports", statusFilter, priorityFilter],
    queryFn: async () => {
      let query = supabase
        .from("issue_reports")
        .select("*")
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      if (priorityFilter !== "all") {
        query = query.eq("priority", priorityFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const filteredIssues = issues?.filter((issue) =>
    issue.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    issue.attempted_action.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: IssueStatus) => {
    const variants: Record<IssueStatus, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      new: { variant: "default", label: "New" },
      under_review: { variant: "secondary", label: "Under Review" },
      in_progress: { variant: "outline", label: "In Progress" },
      resolved: { variant: "secondary", label: "Resolved" },
      wont_fix: { variant: "destructive", label: "Won't Fix" },
      need_more_info: { variant: "outline", label: "Need More Info" },
    };
    const { variant, label } = variants[status];
    return <Badge variant={variant}>{label}</Badge>;
  };

  const getPriorityBadge = (priority: IssuePriority) => {
    const variants: Record<IssuePriority, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      low: { variant: "secondary", label: "Low" },
      medium: { variant: "outline", label: "Medium" },
      high: { variant: "default", label: "High" },
      critical: { variant: "destructive", label: "Critical" },
    };
    const { variant, label } = variants[priority];
    return <Badge variant={variant}>{label}</Badge>;
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Issue Reports</h1>
        <p className="text-muted-foreground">
          Review and manage user-reported issues
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search issues..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as IssueStatus | "all")}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="under_review">Under Review</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="wont_fix">Won't Fix</SelectItem>
              <SelectItem value="need_more_info">Need More Info</SelectItem>
            </SelectContent>
          </Select>

          <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as IssuePriority | "all")}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8">Loading issues...</div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reported By</TableHead>
                <TableHead>Created</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredIssues && filteredIssues.length > 0 ? (
                filteredIssues.map((issue) => (
                  <TableRow key={issue.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell className="font-medium">{issue.title}</TableCell>
                    <TableCell>{getCategoryLabel(issue.category)}</TableCell>
                    <TableCell>{getPriorityBadge(issue.priority as IssuePriority)}</TableCell>
                    <TableCell>{getStatusBadge(issue.status as IssueStatus)}</TableCell>
                    <TableCell>
                      User #{issue.reported_by.substring(0, 8)}
                    </TableCell>
                    <TableCell>{format(new Date(issue.created_at), "MMM d, yyyy")}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedIssueId(issue.id)}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No issues found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {selectedIssueId && (
        <IssueDetailDialog
          issueId={selectedIssueId}
          open={!!selectedIssueId}
          onOpenChange={(open) => {
            if (!open) setSelectedIssueId(null);
          }}
          onUpdate={refetch}
        />
      )}
    </div>
  );
}
