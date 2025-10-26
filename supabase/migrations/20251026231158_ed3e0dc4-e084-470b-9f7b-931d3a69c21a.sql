-- Add rental_day_hour_tolerance column to bookings table
ALTER TABLE bookings 
ADD COLUMN rental_day_hour_tolerance INTEGER DEFAULT 1 
CHECK (rental_day_hour_tolerance >= 1 AND rental_day_hour_tolerance <= 12);

COMMENT ON COLUMN bookings.rental_day_hour_tolerance IS 
'Number of hours tolerance before an extra rental day is counted (1-12 hours)';