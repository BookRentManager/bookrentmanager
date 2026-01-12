import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUserViewScope } from "@/hooks/useUserViewScope";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, Mail, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface SendBookingFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: any;
}

export const SendBookingFormDialog = ({ open, onOpenChange, booking }: SendBookingFormDialogProps) => {
  const { isReadOnly } = useUserViewScope();
  const queryClient = useQueryClient();

  // Block read-only users from sending booking forms
  if (isReadOnly) return null;

  const sendFormMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const { data, error } = await supabase.functions.invoke('trigger-send-booking-form', {
        body: { booking_id: bookingId },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking', booking.id] });
      toast.success('Booking form will be sent via Zapier');
      onOpenChange(false);
    },
    onError: (error: any) => {
      console.error('Send booking form error:', error);
      toast.error(error.message || 'Failed to trigger booking form email');
    },
  });

  const handleSend = () => {
    sendFormMutation.mutate(booking.id);
  };

  if (!booking) return null;

  const isResend = !!booking.booking_form_sent_at;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            {isResend ? 'Resend' : 'Send'} Booking Form
          </DialogTitle>
          <DialogDescription>
            {isResend 
              ? 'This will send a new booking form link to the client\'s email address.'
              : 'Send the booking form to the client to complete their reservation.'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Booking Details */}
          <div className="bg-muted/30 rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Reference:</span>
              <span className="font-semibold">{booking.reference_code}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Client:</span>
              <span className="font-medium">{booking.client_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email:</span>
              <span className="font-medium">{booking.client_email}</span>
            </div>
          </div>

          {!booking.client_email && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No email address found for this booking. Please add an email address first.
              </AlertDescription>
            </Alert>
          )}

          {isResend && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                A previous form was sent on{' '}
                {new Date(booking.booking_form_sent_at).toLocaleString('en-GB')}
              </AlertDescription>
            </Alert>
          )}

          {/* Email Preview */}
          <div className="border rounded-lg p-4 space-y-2">
            <h4 className="font-semibold text-sm">Email will include:</h4>
            <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
              <li>Booking summary with dates and vehicle</li>
              <li>Total amount: €{Number(booking.amount_total).toLocaleString()}</li>
              <li>Security deposit: €{Number(booking.security_deposit_amount || 0).toLocaleString()}</li>
              <li>Link to complete form (valid for 30 days)</li>
              <li>Payment timeline and next steps</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSend} 
            disabled={sendFormMutation.isPending || !booking.client_email}
          >
            {sendFormMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                {isResend ? 'Resend Form' : 'Send Form'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};