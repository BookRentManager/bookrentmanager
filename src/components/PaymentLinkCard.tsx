import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Mail, X, ExternalLink, Eye } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface PaymentLinkCardProps {
  payment: {
    id: string;
    amount: number;
    payment_intent: string;
    payment_link_url: string | null;
    payment_link_status: string | null;
    payment_link_expires_at: string | null;
    currency: string;
    payment_method_type?: string | null;
    proof_url?: string | null;
  };
  onCancel: () => void;
}

export function PaymentLinkCard({ payment, onCancel }: PaymentLinkCardProps) {
  const handleCopyLink = async () => {
    if (payment.payment_link_url) {
      await navigator.clipboard.writeText(payment.payment_link_url);
      toast.success("Payment link copied to clipboard");
    }
  };

  const handleResendEmail = async () => {
    // TODO: Implement email resend
    toast.info("Email resend functionality coming soon");
  };

  const handleCancelLink = async () => {
    try {
      const { error } = await supabase
        .from('payments')
        .update({ payment_link_status: 'cancelled' })
        .eq('id', payment.id);

      if (error) throw error;

      toast.success("Payment link cancelled");
      onCancel();
    } catch (error: any) {
      console.error('Error cancelling payment link:', error);
      toast.error("Failed to cancel payment link");
    }
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'active':
        return 'bg-green-500';
      case 'pending':
        return 'bg-yellow-500';
      case 'expired':
        return 'bg-red-500';
      case 'cancelled':
        return 'bg-gray-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-medium capitalize">
                {payment.payment_intent.replace('_', ' ')}
                {payment.payment_method_type && (
                  <span className="ml-2 text-muted-foreground">
                    ({payment.payment_method_type === 'visa_mastercard' ? 'Visa/Mastercard' :
                      payment.payment_method_type === 'amex' ? 'American Express' :
                      payment.payment_method_type === 'bank_transfer' ? 'Bank Transfer' :
                      payment.payment_method_type})
                  </span>
                )}
                {' - €'}{payment.amount.toFixed(2)}
              </div>
              <Badge className={getStatusColor(payment.payment_link_status)}>
                {payment.payment_link_status}
              </Badge>
            </div>
          </div>

          {payment.payment_link_expires_at && (
            <div className="text-sm text-muted-foreground">
              Expires: {format(new Date(payment.payment_link_expires_at), 'PPp')}
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            {payment.payment_method_type === 'bank_transfer' && payment.proof_url && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.open(payment.proof_url!, '_blank')}
              >
                <Eye className="h-4 w-4 mr-1" />
                View Proof
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopyLink}
              disabled={!payment.payment_link_url}
            >
              <Copy className="h-4 w-4 mr-1" />
              Copy Link
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleResendEmail}
            >
              <Mail className="h-4 w-4 mr-1" />
              Resend Email
            </Button>
            {payment.payment_link_url && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.open(payment.payment_link_url!, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Open
              </Button>
            )}
            {payment.payment_link_status === 'active' && (
              <Button
                size="sm"
                variant="destructive"
                onClick={handleCancelLink}
              >
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
