import { Calendar, dateFnsLocalizer, View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';

const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

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

export function BookingCalendar({ bookings }: BookingCalendarProps) {
  const navigate = useNavigate();
  const [view, setView] = useState<View>('week');

  // Create two events per booking: delivery (green) and collection (red)
  const events = bookings.flatMap(booking => {
    const deliveryDate = new Date(booking.delivery_datetime);
    const collectionDate = new Date(booking.collection_datetime);
    
    // Create delivery event (1 hour duration)
    const deliveryEnd = new Date(deliveryDate.getTime() + 60 * 60 * 1000);
    
    // Create collection event (1 hour duration)
    const collectionEnd = new Date(collectionDate.getTime() + 60 * 60 * 1000);
    
    return [
      {
        id: `${booking.id}-delivery`,
        title: booking.car_model,
        start: deliveryDate,
        end: deliveryEnd,
        resource: { ...booking, type: 'delivery' },
      },
      {
        id: `${booking.id}-collection`,
        title: booking.car_model,
        start: collectionDate,
        end: collectionEnd,
        resource: { ...booking, type: 'collection' },
      },
    ];
  });

  const handleSelectEvent = (event: any) => {
    const bookingId = event.resource.id;
    navigate(`/bookings/${bookingId}`);
  };

  const eventStyleGetter = (event: any) => {
    const { type } = event.resource;
    
    // Green for delivery, red for collection
    const backgroundColor = type === 'delivery' 
      ? 'hsl(142, 71%, 85%)' // Light green
      : 'hsl(0, 70%, 85%)'; // Light red/pink
    
    const textColor = type === 'delivery'
      ? 'hsl(142, 71%, 25%)' // Dark green text
      : 'hsl(0, 70%, 35%)'; // Dark red text

    return {
      style: {
        backgroundColor,
        color: textColor,
        borderRadius: '4px',
        border: 'none',
        fontSize: '11px',
        padding: '4px',
        fontWeight: '500',
      }
    };
  };

  const CustomEvent = ({ event }: any) => {
    return (
      <div className="text-[10px] leading-tight">
        <div className="font-semibold truncate">{event.title}</div>
        <div className="truncate opacity-80">
          {format(event.start, 'HH:mm')}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-card rounded-lg p-2 md:p-4 shadow-card">
      <div className="mb-3 flex items-center gap-2 text-xs flex-wrap px-2">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: 'hsl(142, 71%, 85%)' }} />
          <span>Delivery</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: 'hsl(0, 70%, 85%)' }} />
          <span>Collection</span>
        </div>
      </div>
      <div className="h-[600px] md:h-[700px] calendar-container">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          onSelectEvent={handleSelectEvent}
          eventPropGetter={eventStyleGetter}
          components={{
            event: CustomEvent,
          }}
          view={view}
          onView={setView}
          views={['week', 'day']}
          defaultView="week"
          step={60}
          timeslots={1}
          style={{ height: '100%' }}
        />
      </div>
    </div>
  );
}