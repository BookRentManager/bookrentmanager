import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get storage usage
    const { data: storageUsage, error: storageError } = await supabaseClient
      .rpc('get_storage_usage');

    if (storageError) {
      throw storageError;
    }

    const totalSize = storageUsage.reduce((sum: number, bucket: any) => 
      sum + Number(bucket.total_size_mb), 0
    );

    // Warning thresholds (in MB)
    const WARNING_THRESHOLD = 800;  // 80% of 1GB
    const CRITICAL_THRESHOLD = 950; // 95% of 1GB

    let alertLevel = 'normal';
    let message = 'Storage usage is within normal limits';

    if (totalSize > CRITICAL_THRESHOLD) {
      alertLevel = 'critical';
      message = `CRITICAL: Storage usage is at ${totalSize.toFixed(2)} MB. Immediate action required.`;
      
      // Log critical alert
      await supabaseClient.from('audit_logs').insert({
        entity: 'system',
        action: 'storage_critical',
        payload_snapshot: {
          total_size_mb: totalSize,
          threshold: CRITICAL_THRESHOLD,
          buckets: storageUsage
        }
      });
    } else if (totalSize > WARNING_THRESHOLD) {
      alertLevel = 'warning';
      message = `WARNING: Storage usage is at ${totalSize.toFixed(2)} MB. Consider cleanup.`;
      
      // Log warning
      await supabaseClient.from('audit_logs').insert({
        entity: 'system',
        action: 'storage_warning',
        payload_snapshot: {
          total_size_mb: totalSize,
          threshold: WARNING_THRESHOLD,
          buckets: storageUsage
        }
      });
    }

    console.log('Storage monitoring check completed:', { alertLevel, totalSize, message });

    return new Response(
      JSON.stringify({
        success: true,
        alertLevel,
        message,
        totalSize,
        usage: storageUsage
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error in storage-monitor:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
