import { useState } from "react";
import { Check, ChevronsUpDown, Globe, MessageSquare, FileText, AlertCircle, Receipt } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useChatPanel, ChatContext } from "@/hooks/useChatPanel";
import { useContextUnreadCount } from "@/hooks/useUnreadCounts";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function ChatContextSwitcher() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { currentContext, setContext, recentContexts } = useChatPanel();

  const displayName = currentContext.type === 'general' 
    ? 'General Chat'
    : currentContext.name || `${currentContext.type} ${currentContext.id?.slice(0, 8)}`;

  // Search across all entities
  const { data: searchResults } = useQuery({
    queryKey: ['chat-entity-search', search],
    queryFn: async () => {
      if (!search || search.length < 2) return { bookings: [], fines: [], supplier_invoices: [], client_invoices: [] };

      const searchLower = search.toLowerCase();

      const [bookings, fines, supplierInvoices, clientInvoices] = await Promise.all([
        supabase
          .from('bookings')
          .select('id, reference_code, client_name, car_model')
          .is('deleted_at', null)
          .or(`reference_code.ilike.%${searchLower}%,client_name.ilike.%${searchLower}%,car_model.ilike.%${searchLower}%`)
          .limit(5),
        supabase
          .from('fines')
          .select('id, fine_number, display_name, car_plate')
          .is('deleted_at', null)
          .or(`fine_number.ilike.%${searchLower}%,display_name.ilike.%${searchLower}%,car_plate.ilike.%${searchLower}%`)
          .limit(5),
        supabase
          .from('supplier_invoices')
          .select('id, supplier_name, car_plate')
          .is('deleted_at', null)
          .or(`supplier_name.ilike.%${searchLower}%,car_plate.ilike.%${searchLower}%`)
          .limit(5),
        supabase
          .from('client_invoices')
          .select('id, invoice_number, client_name')
          .is('deleted_at', null)
          .or(`invoice_number.ilike.%${searchLower}%,client_name.ilike.%${searchLower}%`)
          .limit(5)
      ]);

      return {
        bookings: bookings.data || [],
        fines: fines.data || [],
        supplier_invoices: supplierInvoices.data || [],
        client_invoices: clientInvoices.data || []
      };
    },
    enabled: search.length >= 2
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          <span className="truncate">{displayName}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder="Search conversations..." 
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>No conversations found.</CommandEmpty>
            
            <CommandGroup heading="Quick Access">
              <ContextItem
                context={{ type: 'general' }}
                isSelected={currentContext.type === 'general'}
                onSelect={() => {
                  setContext({ type: 'general' });
                  setOpen(false);
                  setSearch("");
                }}
              />
            </CommandGroup>

            {search.length >= 2 && searchResults && (
              <>
                {searchResults.bookings.length > 0 && (
                  <CommandGroup heading="Bookings">
                    {searchResults.bookings.map((booking) => (
                      <ContextItem
                        key={`booking-${booking.id}`}
                        context={{ 
                          type: 'booking', 
                          id: booking.id,
                          name: `${booking.reference_code} - ${booking.client_name}`
                        }}
                        isSelected={currentContext.type === 'booking' && currentContext.id === booking.id}
                        onSelect={() => {
                          setContext({ 
                            type: 'booking', 
                            id: booking.id,
                            name: `${booking.reference_code} - ${booking.client_name}`
                          });
                          setOpen(false);
                          setSearch("");
                        }}
                      />
                    ))}
                  </CommandGroup>
                )}

                {searchResults.fines.length > 0 && (
                  <CommandGroup heading="Fines">
                    {searchResults.fines.map((fine) => (
                      <ContextItem
                        key={`fine-${fine.id}`}
                        context={{ 
                          type: 'fine', 
                          id: fine.id,
                          name: fine.display_name || fine.fine_number || `Fine ${fine.id.slice(0, 8)}`
                        }}
                        isSelected={currentContext.type === 'fine' && currentContext.id === fine.id}
                        onSelect={() => {
                          setContext({ 
                            type: 'fine', 
                            id: fine.id,
                            name: fine.display_name || fine.fine_number || `Fine ${fine.id.slice(0, 8)}`
                          });
                          setOpen(false);
                          setSearch("");
                        }}
                      />
                    ))}
                  </CommandGroup>
                )}

                {searchResults.supplier_invoices.length > 0 && (
                  <CommandGroup heading="Supplier Invoices">
                    {searchResults.supplier_invoices.map((invoice) => (
                      <ContextItem
                        key={`supplier_invoice-${invoice.id}`}
                        context={{ 
                          type: 'supplier_invoice', 
                          id: invoice.id,
                          name: invoice.supplier_name
                        }}
                        isSelected={currentContext.type === 'supplier_invoice' && currentContext.id === invoice.id}
                        onSelect={() => {
                          setContext({ 
                            type: 'supplier_invoice', 
                            id: invoice.id,
                            name: invoice.supplier_name
                          });
                          setOpen(false);
                          setSearch("");
                        }}
                      />
                    ))}
                  </CommandGroup>
                )}

                {searchResults.client_invoices.length > 0 && (
                  <CommandGroup heading="Client Invoices">
                    {searchResults.client_invoices.map((invoice) => (
                      <ContextItem
                        key={`client_invoice-${invoice.id}`}
                        context={{ 
                          type: 'client_invoice', 
                          id: invoice.id,
                          name: `${invoice.invoice_number} - ${invoice.client_name}`
                        }}
                        isSelected={currentContext.type === 'client_invoice' && currentContext.id === invoice.id}
                        onSelect={() => {
                          setContext({ 
                            type: 'client_invoice', 
                            id: invoice.id,
                            name: `${invoice.invoice_number} - ${invoice.client_name}`
                          });
                          setOpen(false);
                          setSearch("");
                        }}
                      />
                    ))}
                  </CommandGroup>
                )}
              </>
            )}

            {!search && recentContexts.length > 0 && (
              <CommandGroup heading="Recent">
                {recentContexts.map((context, idx) => (
                  <ContextItem
                    key={`${context.type}-${context.id}-${idx}`}
                    context={context}
                    isSelected={
                      currentContext.type === context.type &&
                      currentContext.id === context.id
                    }
                    onSelect={() => {
                      setContext(context);
                      setOpen(false);
                    }}
                  />
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function ContextItem({ 
  context, 
  isSelected, 
  onSelect 
}: { 
  context: ChatContext; 
  isSelected: boolean; 
  onSelect: () => void;
}) {
  const unreadCount = useContextUnreadCount(context);
  const displayName = context.type === 'general'
    ? 'General Chat'
    : context.name || `${context.type} ${context.id?.slice(0, 8)}`;

  const getIcon = () => {
    switch (context.type) {
      case 'general': return Globe;
      case 'booking': return MessageSquare;
      case 'fine': return AlertCircle;
      case 'supplier_invoice': return FileText;
      case 'client_invoice': return Receipt;
      default: return MessageSquare;
    }
  };
  const Icon = getIcon();

  return (
    <CommandItem onSelect={onSelect} className="cursor-pointer">
      <Icon className="mr-2 h-4 w-4" />
      <span className="flex-1 truncate">{displayName}</span>
      {unreadCount > 0 && (
        <Badge variant="secondary" className="ml-2">
          {unreadCount}
        </Badge>
      )}
      <Check
        className={cn(
          "ml-2 h-4 w-4",
          isSelected ? "opacity-100" : "opacity-0"
        )}
      />
    </CommandItem>
  );
}
