import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Copy, Check, Calendar, RefreshCw, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CalendarSubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CalendarSubscriptionDialog({ open, onOpenChange }: CalendarSubscriptionDialogProps) {
  const [calendarUrl, setCalendarUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | false>(false);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    if (open) {
      fetchCalendarToken();
    }
  }, [open]);

  const fetchCalendarToken = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('calendar_token')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      const baseUrl = import.meta.env.VITE_SUPABASE_URL;
      const feedUrl = `${baseUrl}/functions/v1/calendar-feed?token=${profile.calendar_token}`;
      setCalendarUrl(feedUrl);
    } catch (error) {
      console.error('Error fetching calendar token:', error);
      toast.error('Failed to load calendar URL');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (url: string, type: string = 'main') => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(type);
      toast.success('URL copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy URL');
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('profiles')
        .update({ calendar_token: crypto.randomUUID() })
        .eq('id', user.id);

      if (error) throw error;

      await fetchCalendarToken();
      toast.success('Calendar URL regenerated. Update the URL in your calendar apps.');
    } catch (error) {
      console.error('Error regenerating token:', error);
      toast.error('Failed to regenerate URL');
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Subscribe to Calendar
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Subscribe once and all your confirmed bookings will automatically appear in your calendar app. 
            The calendar updates automatically when bookings change.
          </p>

          {/* Main Calendar URL */}
          <div className="space-y-2">
            <label className="text-sm font-medium">All Events (Deliveries + Collections)</label>
            <div className="flex gap-2">
              <Input 
                value={loading ? 'Loading...' : calendarUrl}
                readOnly
                className="font-mono text-xs"
              />
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => handleCopy(calendarUrl)}
                disabled={loading}
              >
                {copied === 'main' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Color-coded feeds */}
          <div className="space-y-3 pt-2 border-t">
            <p className="text-sm font-medium">For Color-Coded Calendars</p>
            <p className="text-xs text-muted-foreground">
              Subscribe to these separately and set different colors in your calendar app:
            </p>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-xs font-medium">Deliveries Only</span>
              </div>
              <div className="flex gap-2">
                <Input 
                  value={loading ? 'Loading...' : `${calendarUrl}&type=delivery`}
                  readOnly
                  className="font-mono text-xs"
                />
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => handleCopy(`${calendarUrl}&type=delivery`, 'delivery')}
                  disabled={loading}
                >
                  {copied === 'delivery' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-xs font-medium">Collections Only</span>
              </div>
              <div className="flex gap-2">
                <Input 
                  value={loading ? 'Loading...' : `${calendarUrl}&type=collection`}
                  readOnly
                  className="font-mono text-xs"
                />
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => handleCopy(`${calendarUrl}&type=collection`, 'collection')}
                  disabled={loading}
                >
                  {copied === 'collection' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="google">
              <AccordionTrigger className="text-sm">
                <span className="flex items-center gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Google Calendar
                </span>
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-2">
                <ol className="list-decimal list-inside space-y-1">
                  <li>Open Google Calendar on your computer</li>
                  <li>Click the + next to "Other calendars"</li>
                  <li>Select "From URL"</li>
                  <li>Paste your calendar URL</li>
                  <li>Click "Add calendar"</li>
                </ol>
                <p className="text-xs italic">Note: Google Calendar updates subscribed calendars every few hours.</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="apple">
              <AccordionTrigger className="text-sm">
                <span className="flex items-center gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Apple Calendar (Mac/iPhone)
                </span>
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-2">
                <p className="font-medium">On Mac:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Open Calendar app</li>
                  <li>File → New Calendar Subscription</li>
                  <li>Paste your calendar URL</li>
                  <li>Click Subscribe</li>
                </ol>
                <p className="font-medium mt-2">On iPhone:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Settings → Calendar → Accounts</li>
                  <li>Add Account → Other</li>
                  <li>Add Subscribed Calendar</li>
                  <li>Paste your calendar URL</li>
                </ol>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="outlook">
              <AccordionTrigger className="text-sm">
                <span className="flex items-center gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Outlook
                </span>
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                <ol className="list-decimal list-inside space-y-1">
                  <li>Open Outlook Calendar</li>
                  <li>Click "Add calendar" → "Subscribe from web"</li>
                  <li>Paste your calendar URL</li>
                  <li>Give it a name and click "Import"</li>
                </ol>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Regenerate Option */}
          <div className="pt-2 border-t">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleRegenerate}
              disabled={regenerating}
              className="text-muted-foreground"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${regenerating ? 'animate-spin' : ''}`} />
              {regenerating ? 'Regenerating...' : 'Regenerate URL (if compromised)'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
