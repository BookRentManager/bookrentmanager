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

  // Filter to only show confirmed bookings
  const confirmedBookings = bookings.filter(booking => booking.status === 'confirmed');

  // Create delivery and collection events
  const events: CalendarEvent[] = confirmedBookings.flatMap(booking => {
    const deliveryDate = new Date(booking.delivery_datetime);
    const collectionDate = new Date(booking.collection_datetime);
    const durationHours = Math.round(differenceInHours(collectionDate, deliveryDate));
    const durationDays = (durationHours / 24).toFixed(1);
    
    return [
      {
        id: `${booking.id}-delivery`,
        bookingId: booking.id,
        type: 'delivery' as const,
        datetime: deliveryDate,
        carModel: booking.car_model,
        time: format(deliveryDate, 'HH:mm'),
        duration: `${durationHours} hrs | ${durationDays} days`,
      },
      {
        id: `${booking.id}-collection`,
        bookingId: booking.id,
        type: 'collection' as const,
        datetime: collectionDate,
        carModel: booking.car_model,
        time: format(collectionDate, 'HH:mm'),
        duration: `${durationHours} hrs | ${durationDays} days`,
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

  // Generate week navigation options (5 weeks total: 2 before, current, 2 after)
  const weekNavOptions = Array.from({ length: 5 }, (_, i) => {
    const weekStart = addDays(currentWeekStart, (i - 2) * 7);
    const weekEnd = addDays(weekStart, 6);
    return {
      start: weekStart,
      label: `${format(weekStart, 'd')}-${format(weekEnd, 'd')}`,
      month: format(weekStart, 'MMM'),
      isCurrent: i === 2,
    };
  });

  return (
    <div className="bg-card rounded-lg shadow-card">
      {/* Week Title */}
      <div className="p-2 md:p-4 border-b border-border">
        <h3 className="text-sm md:text-lg font-semibold">
          {format(currentWeekStart, 'd')} - {format(addDays(currentWeekStart, 6), 'd MMMM')}
        </h3>
      </div>

      {/* Days as Rows */}
      <div className="divide-y divide-border">
        {weekDays.map((day, index) => {
          const dayEvents = getEventsForDay(day);
          const isToday = isSameDay(day, new Date());
          
          return (
            <div key={index} className="flex min-h-[60px] md:min-h-[80px]">
              {/* Day Label */}
              <div className={`flex-shrink-0 w-12 md:w-20 p-1.5 md:p-4 flex flex-col items-center justify-center border-r border-border ${isToday ? 'bg-accent/10' : ''}`}>
                <div className="text-[9px] md:text-xs text-muted-foreground uppercase mb-0.5 md:mb-1">
                  {format(day, 'EEE')}
                </div>
                <div className={`text-base md:text-2xl font-bold ${isToday ? 'text-accent' : 'text-foreground'}`}>
                  {format(day, 'd')}
                </div>
              </div>
              
              {/* Events flowing horizontally */}
              <div className="flex-1 overflow-x-auto scrollbar-hide">
                <div className="flex gap-1 md:gap-2 p-1 md:p-2 min-h-full items-start">
                  {dayEvents.length === 0 ? (
                    <div className="text-muted-foreground text-sm py-2"></div>
                  ) : (
                    dayEvents.map((event) => (
                      <div
                        key={event.id}
                        onClick={() => navigate(`/bookings/${event.bookingId}`)}
                        className={`flex-shrink-0 w-24 md:w-40 p-1.5 md:p-3 rounded cursor-pointer transition-all hover:opacity-80 ${
                          event.type === 'delivery'
                            ? 'bg-success/20 border border-success/40'
                            : 'bg-destructive/20 border border-destructive/40'
                        }`}
                      >
                        <div className="text-[10px] md:text-sm font-semibold mb-1 md:mb-2 line-clamp-2 text-foreground">
                          {event.carModel}
                        </div>
                        <div className="text-[9px] md:text-xs mb-0.5 md:mb-1 text-foreground/80">
                          {event.time}
                        </div>
                        <div className="text-[9px] md:text-xs text-foreground/80">
                          {event.duration}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Week Navigation */}
      <div className="p-2 md:p-3 border-t border-border flex items-center justify-center gap-1 md:gap-2 overflow-x-auto scrollbar-hide">
        {weekNavOptions.map((week, i) => (
          <button
            key={i}
            onClick={() => setCurrentWeekStart(week.start)}
            className={`flex-shrink-0 px-2 md:px-3 py-1.5 md:py-2 rounded-full text-xs font-medium transition-all ${
              week.isCurrent
                ? 'bg-accent text-accent-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-accent/20'
            }`}
          >
            <div className="uppercase text-[9px] md:text-[10px] opacity-70">{week.month}</div>
            <div className="font-semibold text-[10px] md:text-xs">{week.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}