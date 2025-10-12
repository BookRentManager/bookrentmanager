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
  const [view, setView] = useState<View>('month');

  const events = bookings.map(booking => ({
    id: booking.id,
    title: `${booking.reference_code} - ${booking.client_name}`,
    start: new Date(booking.delivery_datetime),
    end: new Date(booking.collection_datetime),
    resource: booking,
  }));

  const handleSelectEvent = (event: any) => {
    navigate(`/bookings/${event.id}`);
  };

  const eventStyleGetter = (event: any) => {
    const booking = event.resource as Booking;
    let backgroundColor = '#3b82f6';
    
    switch (booking.status) {
      case 'confirmed':
        backgroundColor = '#22c55e';
        break;
      case 'cancelled':
        backgroundColor = '#ef4444';
        break;
      case 'draft':
        backgroundColor = '#6b7280';
        break;
    }

    return {
      style: {
        backgroundColor,
        borderRadius: '4px',
        opacity: 0.8,
        color: 'white',
        border: '0px',
        display: 'block',
        fontSize: '12px',
        padding: '2px 4px',
      }
    };
  };

  const CustomEvent = ({ event }: any) => {
    const booking = event.resource as Booking;
    return (
      <div className="text-xs">
        <div className="font-semibold truncate">{event.title}</div>
        <div className="truncate">{booking.car_model}</div>
      </div>
    );
  };

  return (
    <div className="bg-card rounded-lg p-4 shadow-card">
      <div className="mb-4 flex items-center gap-2">
        <Badge variant="default" className="bg-green-500">Confirmed</Badge>
        <Badge variant="default" className="bg-gray-500">Draft</Badge>
        <Badge variant="default" className="bg-red-500">Cancelled</Badge>
      </div>
      <div className="h-[700px]">
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
          views={['month', 'week', 'day', 'agenda']}
          popup
          style={{ height: '100%' }}
        />
      </div>
    </div>
  );
}