import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function PaymentConfirmation() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'success' | 'failed' | 'processing'>('processing');
  
  const sessionId = searchParams.get('session_id');
  const bookingRef = searchParams.get('booking_ref');

  useEffect(() => {
    // The webhook will handle the actual payment status update
    // This page just shows the user what happened
    const paymentStatus = searchParams.get('status');
    
    if (paymentStatus === 'success') {
      setStatus('success');
    } else if (paymentStatus === 'failed') {
      setStatus('failed');
    } else {
      // Default to processing, webhook will update the payment status
      setTimeout(() => setStatus('success'), 2000);
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="text-center">
            {status === 'processing' && 'Processing Payment...'}
            {status === 'success' && 'Payment Successful!'}
            {status === 'failed' && 'Payment Failed'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-center">
            {status === 'processing' && (
              <Loader2 className="h-16 w-16 animate-spin text-primary" />
            )}
            {status === 'success' && (
              <CheckCircle className="h-16 w-16 text-green-600" />
            )}
            {status === 'failed' && (
              <XCircle className="h-16 w-16 text-destructive" />
            )}
          </div>

          {status === 'success' && (
            <Alert>
              <AlertDescription className="text-center">
                Your payment has been processed successfully. 
                {bookingRef && ` Booking reference: ${bookingRef}`}
                <br />
                You will receive a confirmation email shortly.
              </AlertDescription>
            </Alert>
          )}

          {status === 'failed' && (
            <Alert variant="destructive">
              <AlertDescription className="text-center">
                Your payment could not be processed. Please try again or contact support.
              </AlertDescription>
            </Alert>
          )}

          {status === 'processing' && (
            <Alert>
              <AlertDescription className="text-center">
                Please wait while we confirm your payment...
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2 justify-center">
            {status === 'success' && (
              <Button onClick={() => navigate('/')}>
                Return to Home
              </Button>
            )}
            {status === 'failed' && (
              <>
                <Button variant="outline" onClick={() => navigate(-1)}>
                  Go Back
                </Button>
                <Button onClick={() => window.location.reload()}>
                  Try Again
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
