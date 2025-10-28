import { CheckCircle, CheckCircle2, Camera, Car, FileSignature } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface TimelineStep {
  id: string;
  label: string;
  completed: boolean;
  icon: React.ComponentType<{ className?: string }>;
  date?: string;
}

interface RentalTimelineProps {
  booking: {
    status: string;
    delivery_contract_signed_at?: string | null;
    delivery_inspection_completed_at?: string | null;
    rental_started_at?: string | null;
    collection_contract_signed_at?: string | null;
    collection_inspection_completed_at?: string | null;
    rental_completed_at?: string | null;
  };
}

export function RentalTimeline({ booking }: RentalTimelineProps) {
  const steps: TimelineStep[] = [
    {
      id: 'confirmed',
      label: 'Booking Confirmed',
      completed: booking.status === 'confirmed' || booking.status === 'completed',
      icon: CheckCircle,
    },
    {
      id: 'delivery_contract',
      label: 'Contract Signed (Delivery)',
      completed: !!booking.delivery_contract_signed_at,
      icon: FileSignature,
      date: booking.delivery_contract_signed_at || undefined,
    },
    {
      id: 'delivery_inspection',
      label: 'Pre-Rental Inspection',
      completed: !!booking.delivery_inspection_completed_at,
      icon: Camera,
      date: booking.delivery_inspection_completed_at || undefined,
    },
    {
      id: 'rental_active',
      label: 'Rental in Progress',
      completed: !!booking.rental_started_at && !booking.collection_contract_signed_at,
      icon: Car,
      date: booking.rental_started_at || undefined,
    },
    {
      id: 'collection_contract',
      label: 'Contract Signed (Collection)',
      completed: !!booking.collection_contract_signed_at,
      icon: FileSignature,
      date: booking.collection_contract_signed_at || undefined,
    },
    {
      id: 'collection_inspection',
      label: 'Post-Rental Inspection',
      completed: !!booking.collection_inspection_completed_at,
      icon: Camera,
      date: booking.collection_inspection_completed_at || undefined,
    },
    {
      id: 'completed',
      label: 'Rental Completed',
      completed: !!booking.rental_completed_at,
      icon: CheckCircle2,
      date: booking.rental_completed_at || undefined,
    },
  ];

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Card className="overflow-hidden border-2 border-king-gold/20">
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-6">Rental Status</h3>
        
        {/* Mobile: Horizontal Scrollable Compact Timeline */}
        <div className="md:hidden overflow-x-auto pb-4 scrollbar-hide">
          <div className="flex gap-1 min-w-max px-2">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isCompleted = step.completed;
              return (
                <div key={step.id} className="flex items-center">
                  <div className="flex flex-col items-center min-w-[70px]">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                        isCompleted
                          ? 'bg-king-gold text-white shadow-lg shadow-king-gold/30'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <p className={`text-[10px] font-medium text-center mt-2 leading-tight px-1 ${
                      isCompleted ? 'text-king-gold' : 'text-muted-foreground'
                    }`}>
                      {step.label.split(' ').slice(0, 2).join(' ')}
                    </p>
                    {step.date && (
                      <p className="text-[8px] text-muted-foreground mt-0.5">
                        {formatDate(step.date).split(',')[0]}
                      </p>
                    )}
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`h-px w-8 mx-1 ${
                        isCompleted ? 'bg-king-gold' : 'bg-border'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Desktop: Horizontal Timeline */}
        <div className="hidden md:block">
          <div className="relative flex justify-between items-start">
            {/* Background connecting line */}
            <div className="absolute top-6 left-0 right-0 h-0.5 bg-border -z-10" />
            
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.id} className="flex flex-col items-center flex-1 relative">
                  {/* Icon */}
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center z-10 transition-all ${
                      step.completed
                        ? 'bg-gradient-king text-king-gold shadow-lg shadow-king-gold/30'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  
                  {/* Label */}
                  <div className="mt-3 text-center px-2">
                    <p className={`text-xs font-semibold leading-tight ${
                      step.completed ? 'text-king-gold' : 'text-muted-foreground'
                    }`}>
                      {step.label}
                    </p>
                    {step.date && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {formatDate(step.date)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}