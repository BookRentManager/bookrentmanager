import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, Mail, AlertCircle, CheckCircle2, Clock, PlayCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface ImportLog {
  id: string;
  email_id: string;
  email_subject: string | null;
  booking_reference: string | null;
  action: string;
  changes_detected: string[] | null;
  error_message: string | null;
  raw_email_snippet: string | null;
  processed_at: string;
}

export default function EmailImports() {
  const queryClient = useQueryClient();
  const [isManualTriggerLoading, setIsManualTriggerLoading] = useState(false);

  // Fetch import logs
  const { data: importLogs, isLoading } = useQuery({
    queryKey: ['email-import-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_import_logs')
        .select('*')
        .order('processed_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data as ImportLog[];
    },
  });

  // Calculate statistics
  const stats = {
    total: importLogs?.length || 0,
    created: importLogs?.filter(log => log.action === 'created').length || 0,
    updated: importLogs?.filter(log => log.action === 'updated').length || 0,
    skipped: importLogs?.filter(log => log.action === 'skipped').length || 0,
    failed: importLogs?.filter(log => log.action === 'failed').length || 0,
    lastRun: importLogs?.[0]?.processed_at,
  };

  // Manual trigger mutation
  const handleManualTrigger = async () => {
    setIsManualTriggerLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('gmail-booking-import');
      
      if (error) throw error;
      
      toast({
        title: "Import triggered successfully",
        description: `Processed: ${data.processed || 0}, Created: ${data.created || 0}, Updated: ${data.updated || 0}, Failed: ${data.failed || 0}`,
      });
      
      // Refresh logs
      queryClient.invalidateQueries({ queryKey: ['email-import-logs'] });
    } catch (error: any) {
      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsManualTriggerLoading(false);
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'created':
        return <Badge className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" />Created</Badge>;
      case 'updated':
        return <Badge className="bg-blue-500"><RefreshCw className="w-3 h-3 mr-1" />Updated</Badge>;
      case 'skipped':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Skipped</Badge>;
      case 'failed':
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline">{action}</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Email Imports</h1>
          <p className="text-muted-foreground">Monitor automatic booking imports from Gmail</p>
        </div>
        <Button 
          onClick={handleManualTrigger} 
          disabled={isManualTriggerLoading}
          size="lg"
        >
          {isManualTriggerLoading ? (
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <PlayCircle className="w-4 h-4 mr-2" />
          )}
          Trigger Import Now
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Processed</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Created</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.created}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Updated</CardTitle>
            <RefreshCw className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.updated}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Skipped</CardTitle>
            <Clock className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{stats.skipped}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
          </CardContent>
        </Card>
      </div>

      {/* Last Run Info */}
      {stats.lastRun && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              Last import: {format(new Date(stats.lastRun), 'PPpp')}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Import Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Import History</CardTitle>
          <CardDescription>Recent email import activity (last 50 records)</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : importLogs && importLogs.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Booking Ref</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Changes</TableHead>
                  <TableHead>Email Subject</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(log.processed_at), 'PPp')}
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {log.booking_reference || 'N/A'}
                      </code>
                    </TableCell>
                    <TableCell>{getActionBadge(log.action)}</TableCell>
                    <TableCell>
                      {log.changes_detected && log.changes_detected.length > 0 ? (
                        <div className="text-xs text-muted-foreground">
                          {log.changes_detected.join(', ')}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-xs">
                      {log.email_subject || 'N/A'}
                    </TableCell>
                    <TableCell>
                      {log.error_message ? (
                        <span className="text-xs text-red-600">{log.error_message}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No import logs yet. Click "Trigger Import Now" to process emails.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Failed Imports Section */}
      {stats.failed > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-800 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Failed Imports ({stats.failed})
            </CardTitle>
            <CardDescription className="text-red-700">
              These emails failed to process and require attention
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Email ID</TableHead>
                  <TableHead>Error Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importLogs?.filter(log => log.action === 'failed').map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(log.processed_at), 'PPp')}
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-white px-2 py-1 rounded">
                        {log.email_id}
                      </code>
                    </TableCell>
                    <TableCell className="text-red-600">
                      {log.error_message}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-blue-800 flex items-center gap-2">
            <Mail className="w-5 h-5" />
            How Email Import Works
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-900 space-y-2">
          <p>✓ Automatically checks Gmail every 5 minutes for emails with "DEAL!!! BOOKING FORM" in subject</p>
          <p>✓ Creates new bookings or updates existing ones based on booking reference</p>
          <p>✓ Detects changes and logs all activity</p>
          <p>✓ Marks processed emails as "read" in Gmail</p>
          <p>✓ You can manually trigger import anytime using the button above</p>
        </CardContent>
      </Card>
    </div>
  );
}
