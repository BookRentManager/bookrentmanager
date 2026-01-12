import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Shield, CheckCircle, XCircle, AlertCircle, Loader2, DollarSign, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useUserViewScope } from "@/hooks/useUserViewScope";

interface SecurityDepositCardProps {
  bookingId: string;
  securityDepositAmount: number;
  currency: string;
}

export function SecurityDepositCard({
  bookingId,
  securityDepositAmount,
  currency,
}: SecurityDepositCardProps) {
  const queryClient = useQueryClient();
  const [captureDialogOpen, setCaptureDialogOpen] = useState(false);
  const [captureAmount, setCaptureAmount] = useState<number>(0);
  const [captureReason, setCaptureReason] = useState("");
  const { isReadOnly } = useUserViewScope();

  const { data: authorizationData, isLoading } = useQuery({
    queryKey: ["security_deposit_authorization", bookingId],
    queryFn: async () => {
      // First try to find an authorized deposit (prioritize over pending)
      const { data: authorizedData, error: authorizedError } = await supabase
        .from("security_deposit_authorizations")
        .select("*")
        .eq("booking_id", bookingId)
        .eq("status", "authorized")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (authorizedError) throw authorizedError;
      if (authorizedData) return authorizedData;

      // If no authorized, check for captured or released
      const { data: finalizedData, error: finalizedError } = await supabase
        .from("security_deposit_authorizations")
        .select("*")
        .eq("booking_id", bookingId)
        .in("status", ["captured", "released"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (finalizedError) throw finalizedError;
      if (finalizedData) return finalizedData;

      // Fall back to most recent (could be pending or expired)
      const { data, error } = await supabase
        .from("security_deposit_authorizations")
        .select("*")
        .eq("booking_id", bookingId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  // Fetch the associated payment record to get PostFinance transaction ID
  const { data: securityDepositPayment } = useQuery({
    queryKey: ["security_deposit_payment", bookingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("postfinance_transaction_id")
        .eq("booking_id", bookingId)
        .eq("payment_intent", "security_deposit")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!authorizationData && authorizationData.status !== "pending",
  });

  const authorization = authorizationData;
  const postfinanceTransactionId = securityDepositPayment?.postfinance_transaction_id;

  const releaseDepositMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("release-security-deposit", {
        body: { authorization_id: authorization?.id },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Security deposit released successfully");
      queryClient.invalidateQueries({ queryKey: ["security_deposit_authorization", bookingId] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to release deposit: ${error.message}`);
    },
  });

  const captureDepositMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("capture-security-deposit", {
        body: {
          authorization_id: authorization?.id,
          amount: captureAmount,
          reason: captureReason,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Security deposit captured successfully");
      setCaptureDialogOpen(false);
      setCaptureAmount(0);
      setCaptureReason("");
      queryClient.invalidateQueries({ queryKey: ["security_deposit_authorization", bookingId] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to capture deposit: ${error.message}`);
    },
  });

  // Sync status mutation - checks if payment was successful and updates authorization
  const syncStatusMutation = useMutation({
    mutationFn: async () => {
      // Find the security deposit payment for this booking
      const { data: payment, error: paymentError } = await supabase
        .from("payments")
        .select("*")
        .eq("booking_id", bookingId)
        .eq("payment_intent", "security_deposit")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (paymentError) throw paymentError;
      if (!payment) throw new Error("No security deposit payment found");

      // Check if payment has a transaction ID (indicates PostFinance confirmed it)
      if (payment.postfinance_transaction_id || payment.payment_link_status === 'paid') {
        // Update the authorization record
        if (authorization) {
          const { error: authError } = await supabase
            .from("security_deposit_authorizations")
            .update({
              status: 'authorized',
              authorized_at: new Date().toISOString(),
            })
            .eq("id", authorization.id);

          if (authError) throw authError;

          // Update booking record
          await supabase
            .from("bookings")
            .update({
              security_deposit_authorized_at: new Date().toISOString(),
              security_deposit_authorization_id: payment.id,
            })
            .eq("id", bookingId);

          return { synced: true, transactionId: payment.postfinance_transaction_id };
        }
      }

      return { synced: false, message: "No confirmed transaction found" };
    },
    onSuccess: (data) => {
      if (data.synced) {
        toast.success("Security deposit status synced successfully");
        queryClient.invalidateQueries({ queryKey: ["security_deposit_authorization", bookingId] });
        queryClient.invalidateQueries({ queryKey: ["security_deposit_payment", bookingId] });
      } else {
        toast.info("No confirmed transaction to sync");
      }
    },
    onError: (error: Error) => {
      toast.error(`Sync failed: ${error.message}`);
    },
  });

  const getStatusBadge = (status: string | undefined) => {
    if (!status) {
      return (
        <Badge variant="outline" className="bg-muted">
          <AlertCircle className="h-3 w-3 mr-1" />
          Not Requested
        </Badge>
      );
    }

    switch (status) {
      case "pending":
        return (
          <Badge variant="secondary">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Pending
          </Badge>
        );
      case "authorized":
        return (
          <Badge variant="default" className="bg-green-600">
            <CheckCircle className="h-3 w-3 mr-1" />
            Authorized
          </Badge>
        );
      case "released":
        return (
          <Badge variant="outline" className="bg-blue-50">
            <CheckCircle className="h-3 w-3 mr-1" />
            Released
          </Badge>
        );
      case "captured":
        return (
          <Badge variant="destructive">
            <DollarSign className="h-3 w-3 mr-1" />
            Captured
          </Badge>
        );
      case "expired":
        return (
          <Badge variant="outline" className="bg-red-50">
            <XCircle className="h-3 w-3 mr-1" />
            Expired
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (securityDepositAmount === 0) {
    return null;
  }

  if (isLoading) {
    return (
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Deposit
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Security Deposit
        </CardTitle>
        {authorization?.status === "pending" && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => syncStatusMutation.mutate()}
                  disabled={syncStatusMutation.isPending}
                >
                  {syncStatusMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Sync status from payment gateway</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
          <div className="space-y-1">
            <p className="text-sm font-medium">Deposit Amount</p>
            <p className="text-2xl font-bold">
              {currency} {securityDepositAmount.toFixed(2)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground mb-1">Status</p>
            {getStatusBadge(authorization?.status)}
          </div>
        </div>

        {authorization && authorization.status !== "pending" && (
          <div className="space-y-2 text-sm">
            {postfinanceTransactionId && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Transaction ID:</span>
                <span className="font-medium font-mono text-xs">
                  {postfinanceTransactionId}
                </span>
              </div>
            )}

            {authorization.authorized_at && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Authorized:</span>
                <span className="font-medium">
                  {format(new Date(authorization.authorized_at), "PPP")}
                </span>
              </div>
            )}

            {authorization.expires_at && authorization.status === "authorized" && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Expires:</span>
                <span className="font-medium">
                  {format(new Date(authorization.expires_at), "PPP")}
                </span>
              </div>
            )}

            {authorization.released_at && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Released:</span>
                <span className="font-medium">
                  {format(new Date(authorization.released_at), "PPP")}
                </span>
              </div>
            )}

            {authorization.captured_at && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Captured:</span>
                  <span className="font-medium">
                    {format(new Date(authorization.captured_at), "PPP")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Captured Amount:</span>
                  <span className="font-medium font-mono">
                    {currency} {authorization.captured_amount.toFixed(2)}
                  </span>
                </div>
                {authorization.capture_reason && (
                  <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded">
                    <p className="text-xs font-medium text-yellow-900">Capture Reason:</p>
                    <p className="text-sm text-yellow-800 mt-1">{authorization.capture_reason}</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {authorization?.status === "authorized" && !isReadOnly && (
          <div className="flex gap-2 pt-2">
            <Button
              variant="default"
              className="flex-1"
              onClick={() => releaseDepositMutation.mutate()}
              disabled={releaseDepositMutation.isPending}
            >
              {releaseDepositMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Release Deposit
            </Button>

            <Dialog open={captureDialogOpen} onOpenChange={setCaptureDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive" className="flex-1">
                  <DollarSign className="h-4 w-4 mr-2" />
                  Capture for Damages
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Capture Security Deposit</DialogTitle>
                  <DialogDescription>
                    Capture part or all of the security deposit for damages or additional charges.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="capture-amount">Amount to Capture</Label>
                    <Input
                      id="capture-amount"
                      type="number"
                      step="0.01"
                      max={authorization.amount}
                      value={captureAmount}
                      onChange={(e) => setCaptureAmount(parseFloat(e.target.value) || 0)}
                      placeholder={`Max: ${currency} ${authorization.amount.toFixed(2)}`}
                    />
                    <p className="text-xs text-muted-foreground">
                      Maximum: {currency} {authorization.amount.toFixed(2)}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="capture-reason">Reason for Capture</Label>
                    <Textarea
                      id="capture-reason"
                      value={captureReason}
                      onChange={(e) => setCaptureReason(e.target.value)}
                      placeholder="Describe the damages or charges..."
                      rows={4}
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setCaptureDialogOpen(false)}
                    disabled={captureDepositMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => captureDepositMutation.mutate()}
                    disabled={
                      captureDepositMutation.isPending ||
                      captureAmount <= 0 ||
                      captureAmount > authorization.amount ||
                      !captureReason.trim()
                    }
                  >
                    {captureDepositMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <DollarSign className="h-4 w-4 mr-2" />
                    )}
                    Capture {currency} {captureAmount.toFixed(2)}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}

        {!authorization && (
          <p className="text-center text-sm text-muted-foreground py-4">
            Security deposit authorization will be requested 48 hours before rental start.
          </p>
        )}

        {authorization?.status === "expired" && (
          <div className="p-3 bg-red-50 border border-red-200 rounded">
            <p className="text-sm text-red-800">
              Authorization expired. Please request a new authorization from the client.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}