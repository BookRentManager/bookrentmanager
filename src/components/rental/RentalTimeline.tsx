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
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-6">Rental Status</h3>
        
        {/* Mobile: Vertical Timeline */}
        <div className="md:hidden space-y-4">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={step.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      step.completed
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`w-0.5 h-8 mt-2 ${
                        step.completed ? 'bg-primary' : 'bg-border'
                      }`}
                    />
                  )}
                </div>
                <div className="flex-1 pt-2">
                  <p
                    className={`font-medium ${
                      step.completed ? 'text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    {step.label}
                  </p>
                  {step.date && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDate(step.date)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop: Horizontal Timeline */}
        <div className="hidden md:block">
          <div className="flex justify-between items-start">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={step.id} className="flex flex-col items-center flex-1">
                  <div className="flex items-center w-full">
                    {index > 0 && (
                      <div
                        className={`h-0.5 flex-1 ${
                          steps[index - 1].completed ? 'bg-primary' : 'bg-border'
                        }`}
                      />
                    )}
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center mx-2 ${
                        step.completed
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    {index < steps.length - 1 && (
                      <div
                        className={`h-0.5 flex-1 ${
                          step.completed ? 'bg-primary' : 'bg-border'
                        }`}
                      />
                    )}
                  </div>
                  <div className="mt-3 text-center max-w-[120px]">
                    <p
                      className={`text-sm font-medium ${
                        step.completed ? 'text-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      {step.label}
                    </p>
                    {step.date && (
                      <p className="text-xs text-muted-foreground mt-1">
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