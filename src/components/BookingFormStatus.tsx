import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Clock, Send, FileCheck } from "lucide-react";
import { format } from "date-fns";

interface BookingFormStatusProps {
  booking: any;
}

export const BookingFormStatus = ({ booking }: BookingFormStatusProps) => {
  const getStatus = () => {
    if (booking.tc_accepted_at) {
      return {
        label: "Completed",
        icon: <CheckCircle className="h-4 w-4" />,
        variant: "default" as const,
        bgClass: "bg-success/10 border-success/30",
      };
    }
    if (booking.booking_form_last_accessed_at) {
      return {
        label: "Accessed",
        icon: <FileCheck className="h-4 w-4" />,
        variant: "secondary" as const,
        bgClass: "bg-blue-500/10 border-blue-500/30",
      };
    }
    if (booking.booking_form_sent_at) {
      return {
        label: "Sent",
        icon: <Send className="h-4 w-4" />,
        variant: "secondary" as const,
        bgClass: "bg-amber-500/10 border-amber-500/30",
      };
    }
    return {
      label: "Not Sent",
      icon: <Clock className="h-4 w-4" />,
      variant: "outline" as const,
      bgClass: "bg-muted/30",
    };
  };

  const status = getStatus();

  return (
    <Card className={`${status.bgClass} border`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {status.icon}
            <span className="font-semibold">Booking Form Status:</span>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
        </div>
        
        <div className="mt-3 space-y-1 text-sm text-muted-foreground">
          {booking.booking_form_sent_at && (
            <div className="flex justify-between">
              <span>Sent:</span>
              <span className="font-mono">{format(new Date(booking.booking_form_sent_at), "PPp")}</span>
            </div>
          )}
          {booking.booking_form_last_accessed_at && (
            <div className="flex justify-between">
              <span>Last Accessed:</span>
              <span className="font-mono">{format(new Date(booking.booking_form_last_accessed_at), "PPp")}</span>
            </div>
          )}
          {booking.tc_accepted_at && (
            <div className="flex justify-between">
              <span>Completed:</span>
              <span className="font-mono">{format(new Date(booking.tc_accepted_at), "PPp")}</span>
            </div>
          )}
          {booking.security_deposit_authorized_at && (
            <div className="flex justify-between">
              <span className="text-success">Security Deposit Authorized:</span>
              <span className="font-mono text-success">{format(new Date(booking.security_deposit_authorized_at), "PPp")}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};