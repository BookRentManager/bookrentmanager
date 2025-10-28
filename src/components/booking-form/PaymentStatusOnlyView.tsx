import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CheckCircle2, Clock } from 'lucide-react';

interface Payment {
  id: string;
  paid_at?: string;
  payment_link_status?: string;
  payment_intent?: string;
}

interface SecurityDeposit {
  id: string;
  status: string;
}

interface PaymentStatusOnlyViewProps {
  payments: Payment[];
  securityDeposits: SecurityDeposit[];
}

export function PaymentStatusOnlyView({ payments, securityDeposits }: PaymentStatusOnlyViewProps) {
  const firstPaymentPaid = payments.some(p => 
    p.paid_at && (p.payment_intent === 'client_payment' || p.payment_intent === 'down_payment')
  );
  
  const balancePaymentPaid = payments.some(p =>
    p.paid_at && (p.payment_intent === 'balance_payment' || p.payment_intent === 'final_payment')
  );
  
  const depositAuthorized = securityDeposits.some(sd => 
    sd.status === 'authorized'
  );
  
  return (
    <div className="space-y-4">
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Payment Status</h3>
        
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">First Payment</span>
            <Badge variant={firstPaymentPaid ? "default" : "secondary"} className={firstPaymentPaid ? "bg-green-600 gap-1" : "gap-1"}>
              {firstPaymentPaid ? (
                <>
                  <CheckCircle2 className="h-3 w-3" />
                  Paid
                </>
              ) : (
                <>
                  <Clock className="h-3 w-3" />
                  Pending
                </>
              )}
            </Badge>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Balance Payment</span>
            <Badge variant={balancePaymentPaid ? "default" : "secondary"} className={balancePaymentPaid ? "bg-green-600 gap-1" : "gap-1"}>
              {balancePaymentPaid ? (
                <>
                  <CheckCircle2 className="h-3 w-3" />
                  Paid
                </>
              ) : (
                <>
                  <Clock className="h-3 w-3" />
                  Pending
                </>
              )}
            </Badge>
          </div>
          
          <Separator />
          
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Security Deposit</span>
            <Badge variant={depositAuthorized ? "warning" : "secondary"} className="gap-1">
              {depositAuthorized ? (
                <>
                  <CheckCircle2 className="h-3 w-3" />
                  Authorized
                </>
              ) : (
                <>
                  <Clock className="h-3 w-3" />
                  Pending
                </>
              )}
            </Badge>
          </div>
        </div>
        
        <p className="text-xs text-muted-foreground mt-4 p-3 bg-muted rounded-md">
          <strong>Note:</strong> Payment amounts are confidential. Contact the office for detailed payment information.
        </p>
      </Card>
    </div>
  );
}
