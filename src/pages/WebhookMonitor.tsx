import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, XCircle, Clock, RefreshCw, Search, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface WebhookLog {
  id: string;
  event_id: string | null;
  entity_id: string;
  event_type: string | null;
  state: string | null;
  space_id: string | null;
  payment_id: string | null;
  booking_id: string | null;
  status: string;
  processing_duration_ms: number | null;
  error_message: string | null;
  request_payload: any;
  response_data: any;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export default function WebhookMonitor() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedLog, setSelectedLog] = useState<WebhookLog | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch webhook logs
  const { data: logs, refetch } = useQuery({
    queryKey: ["webhook-logs", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("webhook_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as WebhookLog[];
    },
    refetchInterval: autoRefresh ? 5000 : false,
  });

  // Subscribe to real-time updates
  useEffect(() => {
    const channel = supabase
      .channel('webhook-logs-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'webhook_logs'
        },
        (payload) => {
          console.log('New webhook received:', payload);
          toast({
            title: "New webhook received",
            description: `Event: ${payload.new.event_type || 'Unknown'}`,
          });
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch, toast]);

  const filteredLogs = logs?.filter(log =>
    searchTerm === "" ||
    log.entity_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.event_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.event_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <Badge className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />Success</Badge>;
      case "error":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Error</Badge>;
      case "processing":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Processing</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getEventTypeBadge = (eventType: string | null) => {
    if (!eventType) return null;
    
    const colors: Record<string, string> = {
      "payment.succeeded": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      "payment.failed": "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      "authorization.succeeded": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      "session.expired": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    };

    return (
      <Badge variant="outline" className={colors[eventType] || ""}>
        {eventType}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">PostFinance Webhook Monitor</h1>
        <p className="text-muted-foreground">
          Real-time monitoring of all incoming PostFinance webhook deliveries
        </p>
      </div>

      {/* Controls */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters & Controls</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by transaction ID, event ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="success">Success Only</SelectItem>
                <SelectItem value="error">Errors Only</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex gap-2">
              <Button
                variant={autoRefresh ? "default" : "outline"}
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
                className="flex-1"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
                {autoRefresh ? "Auto-Refresh On" : "Auto-Refresh Off"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Webhooks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{logs?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Successful</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {logs?.filter(l => l.status === 'success').length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Failed</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {logs?.filter(l => l.status === 'error').length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg Processing Time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {logs && logs.length > 0
                ? Math.round(
                    logs.reduce((sum, l) => sum + (l.processing_duration_ms || 0), 0) / logs.length
                  )
                : 0}ms
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Webhook Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Webhooks</CardTitle>
          <CardDescription>
            Showing {filteredLogs?.length || 0} of {logs?.length || 0} webhooks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {filteredLogs?.map((log) => (
              <Dialog key={log.id}>
                <DialogTrigger asChild>
                  <div
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                    onClick={() => setSelectedLog(log)}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="min-w-[100px]">
                        {getStatusBadge(log.status)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {getEventTypeBadge(log.event_type)}
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {log.entity_id}
                          </code>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {log.state && <span className="mr-3">State: {log.state}</span>}
                          {log.processing_duration_ms && (
                            <span className="mr-3">{log.processing_duration_ms}ms</span>
                          )}
                          {log.ip_address && (
                            <span className="mr-3">IP: {log.ip_address}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right min-w-[150px]">
                        <div className="text-sm">
                          {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(log.created_at).toLocaleString()}
                        </div>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Webhook Details</DialogTitle>
                    <DialogDescription>
                      Event ID: {log.event_id || 'N/A'}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">Status</label>
                        <div className="mt-1">{getStatusBadge(log.status)}</div>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Event Type</label>
                        <div className="mt-1">{getEventTypeBadge(log.event_type)}</div>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Transaction ID</label>
                        <div className="mt-1 font-mono text-sm">{log.entity_id}</div>
                      </div>
                      <div>
                        <label className="text-sm font-medium">State</label>
                        <div className="mt-1 font-mono text-sm">{log.state || 'N/A'}</div>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Processing Time</label>
                        <div className="mt-1">{log.processing_duration_ms || 0}ms</div>
                      </div>
                      <div>
                        <label className="text-sm font-medium">IP Address</label>
                        <div className="mt-1 font-mono text-sm">{log.ip_address || 'N/A'}</div>
                      </div>
                    </div>

                    {log.error_message && (
                      <div>
                        <label className="text-sm font-medium text-destructive">Error Message</label>
                        <div className="mt-1 p-3 bg-destructive/10 rounded text-sm">
                          {log.error_message}
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="text-sm font-medium">Request Payload</label>
                      <Textarea
                        value={JSON.stringify(log.request_payload, null, 2)}
                        readOnly
                        className="mt-1 font-mono text-xs h-48"
                      />
                    </div>

                    {log.response_data && (
                      <div>
                        <label className="text-sm font-medium">Response Data</label>
                        <Textarea
                          value={JSON.stringify(log.response_data, null, 2)}
                          readOnly
                          className="mt-1 font-mono text-xs h-32"
                        />
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            ))}

            {filteredLogs?.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No webhooks found</p>
                <p className="text-sm">Webhook deliveries will appear here in real-time</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
