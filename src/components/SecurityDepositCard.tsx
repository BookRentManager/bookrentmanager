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
import { Shield, CheckCircle, XCircle, AlertCircle, Loader2, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useState } from "react";

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

  const { data: authorization, isLoading } = useQuery({
    queryKey: ["security_deposit_authorization", bookingId],
    queryFn: async () => {
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
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Security Deposit
        </CardTitle>
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

        {authorization?.status === "authorized" && (
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