import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

interface SignatureViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: any;
}

export const SignatureViewerDialog = ({ open, onOpenChange, booking }: SignatureViewerDialogProps) => {
  if (!booking?.tc_signature_data) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Digital Signature & T&C Acceptance</DialogTitle>
          <DialogDescription>
            Booking Reference: {booking.reference_code}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Signature */}
          <div className="space-y-2">
            <h3 className="font-semibold">Digital Signature</h3>
            <div className="border rounded-lg p-4 bg-white">
              <img 
                src={booking.tc_signature_data} 
                alt="Digital Signature" 
                className="max-w-full h-auto"
              />
            </div>
          </div>

          {/* T&C Acceptance Details */}
          <div className="space-y-3">
            <h3 className="font-semibold">Terms & Conditions Acceptance</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Client Name:</span>
                <p className="font-medium">{booking.client_name}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Client Email:</span>
                <p className="font-medium">{booking.client_email}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Accepted At:</span>
                <p className="font-medium font-mono">
                  {booking.tc_accepted_at && format(new Date(booking.tc_accepted_at), "PPpp")}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">IP Address:</span>
                <p className="font-medium font-mono">{booking.tc_accepted_ip || 'N/A'}</p>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">T&C Version:</span>
                <p className="font-medium">
                  {booking.tc_version_id ? (
                    <Badge variant="outline">Version ID: {booking.tc_version_id.slice(0, 8)}</Badge>
                  ) : (
                    'N/A'
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Payment Methods */}
          {booking.available_payment_methods && booking.available_payment_methods.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold">Selected Payment Methods</h3>
              <div className="flex flex-wrap gap-2">
                {booking.available_payment_methods.map((method: string) => (
                  <Badge key={method} variant="secondary">
                    {method.replace(/_/g, ' ').toUpperCase()}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};