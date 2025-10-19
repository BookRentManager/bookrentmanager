import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import kingrentLogo from '@/assets/kingrent-logo.png';

export default function PaymentConfirmation() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'success' | 'failed' | 'processing'>('processing');
  const [booking, setBooking] = useState<any>(null);
  
  const sessionId = searchParams.get('session_id');

  const { data: appSettings } = useQuery({
    queryKey: ['app_settings'],
    queryFn: async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    const fetchBookingData = async () => {
      if (!sessionId) return;
      
      const { data } = await supabase
        .from('payments')
        .select(`
          booking_id,
          bookings (
            reference_code,
            client_name,
            client_email,
            client_phone,
            guest_name,
            guest_phone,
            guest_country,
            guest_billing_address,
            guest_company_name,
            car_model,
            car_plate,
            delivery_datetime,
            collection_datetime,
            delivery_location,
            collection_location,
            amount_total,
            amount_paid,
            currency,
            confirmation_pdf_url
          )
        `)
        .eq('payment_link_id', sessionId)
        .single();
      
      if (data?.bookings) {
        setBooking(data.bookings);
      }
    };
    
    fetchBookingData();
    
    const paymentStatus = searchParams.get('status');
    
    if (paymentStatus === 'success') {
      setStatus('success');
    } else if (paymentStatus === 'failed') {
      setStatus('failed');
    } else {
      setTimeout(() => setStatus('success'), 2000);
    }
  }, [searchParams, sessionId]);

  const handleDownloadPDF = () => {
    if (booking?.confirmation_pdf_url) {
      window.open(booking.confirmation_pdf_url, '_blank');
    }
  };

  const companyName = appSettings?.company_name || 'King Rent';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-[hsl(220,15%,12%)] py-6 md:py-8">
        <div className="container mx-auto px-4 flex justify-center">
          <img 
            src={kingrentLogo} 
            alt={companyName}
            className="h-12 md:h-16 object-contain"
          />
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-12 md:py-16">
        <div className="max-w-2xl mx-auto">
          {status === 'processing' && (
            <div className="text-center space-y-8">
              <div className="flex justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-accent" />
              </div>
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-wider text-muted-foreground">
                  Processing Your Payment
                </p>
                <p className="text-foreground/80">
                  Please wait while we confirm your payment...
                </p>
              </div>
            </div>
          )}

          {status === 'success' && booking && (
            <div className="space-y-8 md:space-y-12">
              {/* Reference */}
              <div className="text-center space-y-2">
                <p className="text-sm uppercase tracking-wider text-muted-foreground">
                  Booking Confirmation – Ref. {booking.reference_code}
                </p>
              </div>

              {/* Headline */}
              <div className="text-center space-y-4">
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-serif text-foreground leading-tight">
                  Your {companyName} Experience<br />Is Confirmed!
                </h1>
              </div>

              {/* Message */}
              <div className="space-y-6 text-foreground/80 leading-relaxed">
                <p>Dear {booking.client_name},</p>
                
                <p>
                  Thank you for choosing {companyName}. We are pleased to confirm your booking — your payment has been successfully received through your selected method.
                </p>
                
                <p>
                  Your vehicle is now being scheduled and prepared for your upcoming rental.
                </p>
              </div>

              {/* CTA Button */}
              {booking.confirmation_pdf_url && (
                <div className="flex justify-center py-4">
                  <Button
                    onClick={handleDownloadPDF}
                    size="lg"
                    className="bg-accent hover:bg-accent/90 text-accent-foreground px-8 py-6 text-base md:text-lg font-medium rounded-md shadow-lg hover:shadow-xl transition-all"
                  >
                    <Download className="h-5 w-5 mr-2" />
                    Download Booking Details (PDF)
                  </Button>
                </div>
              )}

              {/* Support Message */}
              <div className="text-center space-y-2 pt-4">
                <p className="text-foreground/70 leading-relaxed">
                  Should you need any assistance or wish to personalize your booking further, our dedicated team remains at your full disposal at any time.
                </p>
              </div>
            </div>
          )}

          {status === 'failed' && (
            <div className="space-y-8 text-center">
              <div className="space-y-2">
                <h1 className="text-3xl md:text-4xl font-serif text-foreground">
                  Payment Could Not Be Processed
                </h1>
                <p className="text-destructive">
                  We were unable to process your payment at this time.
                </p>
              </div>

              <div className="space-y-2 text-foreground/70">
                <p>
                  Please verify your payment details and try again, or contact our support team for assistance.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => navigate(-1)}
                  size="lg"
                >
                  Go Back
                </Button>
                <Button 
                  onClick={() => window.location.reload()}
                  size="lg"
                  className="bg-accent hover:bg-accent/90 text-accent-foreground"
                >
                  Try Again
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[hsl(220,15%,12%)] text-white/90 py-8 md:py-12 mt-16">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center space-y-6">
            <p className="text-sm md:text-base">
              Warm regards,<br />
              The {companyName} Team
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 text-sm text-white/70">
              {appSettings?.company_email && (
                <a 
                  href={`mailto:${appSettings.company_email}`}
                  className="hover:text-accent transition-colors"
                >
                  {appSettings.company_email}
                </a>
              )}
              {appSettings?.company_phone && (
                <a 
                  href={`tel:${appSettings.company_phone}`}
                  className="hover:text-accent transition-colors"
                >
                  {appSettings.company_phone}
                </a>
              )}
            </div>

            {appSettings?.company_address && (
              <p className="text-sm text-white/60">
                {appSettings.company_address}
              </p>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}