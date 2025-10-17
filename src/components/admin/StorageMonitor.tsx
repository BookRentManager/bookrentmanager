import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, HardDrive } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface StorageUsage {
  bucket_name: string;
  file_count: number;
  total_size_mb: number;
}

export function StorageMonitor() {
  const { data: storageUsage, isLoading } = useQuery({
    queryKey: ["storage-usage"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_storage_usage" as any);
      if (error) throw error;
      return (data || []) as StorageUsage[];
    },
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  const totalSize = storageUsage?.reduce((sum, bucket) => sum + Number(bucket.total_size_mb), 0) || 0;
  const totalFiles = storageUsage?.reduce((sum, bucket) => sum + Number(bucket.file_count), 0) || 0;

  // Warning at 80% of 1GB (typical free tier limit)
  const warningThreshold = 800; // MB
  const showWarning = totalSize > warningThreshold;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Storage Usage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="h-5 w-5" />
          Storage Usage
        </CardTitle>
        <CardDescription>
          Monitor your file storage across all buckets
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {showWarning && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Storage usage is high ({totalSize.toFixed(2)} MB). Consider archiving old files.
            </AlertDescription>
          </Alert>
        )}
        
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total Files</span>
            <span className="font-medium">{totalFiles.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total Size</span>
            <span className="font-medium">{totalSize.toFixed(2)} MB</span>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-medium">By Bucket</h4>
          {storageUsage?.map((bucket) => (
            <div key={bucket.bucket_name} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{bucket.bucket_name}</span>
              <span>{Number(bucket.total_size_mb).toFixed(2)} MB ({bucket.file_count} files)</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
