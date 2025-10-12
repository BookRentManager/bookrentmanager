import { format, startOfWeek, addDays, isSameDay, differenceInHours } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Booking {
  id: string;
  reference_code: string;
  client_name: string;
  car_model: string;
  car_plate: string;
  delivery_datetime: string;
  collection_datetime: string;
  status: string;
  amount_total: number;
}

interface BookingCalendarProps {
  bookings: Booking[];
}

interface CalendarEvent {
  id: string;
  bookingId: string;
  type: 'delivery' | 'collection';
  datetime: Date;
  carModel: string;
  time: string;
  duration: string;
}

export function BookingCalendar({ bookings }: BookingCalendarProps) {
  const navigate = useNavigate();
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));

  // Create delivery and collection events
  const events: CalendarEvent[] = bookings.flatMap(booking => {
    const deliveryDate = new Date(booking.delivery_datetime);
    const collectionDate = new Date(booking.collection_datetime);
    const durationHours = Math.round(differenceInHours(collectionDate, deliveryDate));
    
    return [
      {
        id: `${booking.id}-delivery`,
        bookingId: booking.id,
        type: 'delivery' as const,
        datetime: deliveryDate,
        carModel: booking.car_model,
        time: format(deliveryDate, 'HH:mm'),
        duration: `${durationHours} ore`,
      },
      {
        id: `${booking.id}-collection`,
        bookingId: booking.id,
        type: 'collection' as const,
        datetime: collectionDate,
        carModel: booking.car_model,
        time: format(collectionDate, 'HH:mm'),
        duration: `${durationHours} ore`,
      },
    ];
  });

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));

  const getEventsForDay = (day: Date) => {
    return events.filter(event => isSameDay(event.datetime, day));
  };

  const handlePrevWeek = () => {
    setCurrentWeekStart(addDays(currentWeekStart, -7));
  };

  const handleNextWeek = () => {
    setCurrentWeekStart(addDays(currentWeekStart, 7));
  };

  const handleToday = () => {
    setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
  };

  return (
    <div className="bg-card rounded-lg p-3 md:p-4 shadow-card">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrevWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleToday}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={handleNextWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="text-sm font-semibold">
          {format(currentWeekStart, 'd MMM')} - {format(addDays(currentWeekStart, 6), 'd MMM yyyy')}
        </div>
      </div>

      {/* Legend */}
      <div className="mb-3 flex items-center gap-3 text-xs px-2">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-success/30" />
          <span>Delivery</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-destructive/30" />
          <span>Collection</span>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[700px]">
          <div className="grid grid-cols-7 gap-px bg-border">
            {weekDays.map((day, index) => {
              const dayEvents = getEventsForDay(day);
              const isToday = isSameDay(day, new Date());
              
              return (
                <div key={index} className="bg-card min-h-[120px]">
                  {/* Day Header */}
                  <div className={`p-2 text-center border-b border-border ${isToday ? 'bg-accent/10' : ''}`}>
                    <div className="text-xs text-muted-foreground uppercase">
                      {format(day, 'EEE')}
                    </div>
                    <div className={`text-lg font-semibold ${isToday ? 'text-accent' : ''}`}>
                      {format(day, 'd')}
                    </div>
                  </div>
                  
                  {/* Events */}
                  <div className="p-1 space-y-1">
                    {dayEvents.map((event) => (
                      <div
                        key={event.id}
                        onClick={() => navigate(`/bookings/${event.bookingId}`)}
                        className={`p-2 rounded cursor-pointer transition-opacity hover:opacity-80 ${
                          event.type === 'delivery'
                            ? 'bg-success/30 text-success-foreground'
                            : 'bg-destructive/30 text-destructive-foreground'
                        }`}
                      >
                        <div className="text-xs font-semibold line-clamp-2 mb-1">
                          {event.carModel}
                        </div>
                        <div className="text-[10px] opacity-90">
                          {event.time}
                        </div>
                        <div className="text-[10px] opacity-90">
                          {event.duration}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}