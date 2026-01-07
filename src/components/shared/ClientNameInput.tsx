import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ClientNameInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function ClientNameInput({ 
  value, 
  onChange, 
  placeholder = "Select or enter client name", 
  disabled = false 
}: ClientNameInputProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const isMobile = useIsMobile();

  // Sync inputValue with external value changes
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Fetch distinct client names from bookings and tax_invoices
  const { data: clientNames, isLoading } = useQuery({
    queryKey: ['distinct-client-names'],
    queryFn: async () => {
      // Fetch from bookings
      const { data: bookingClients } = await supabase
        .from('bookings')
        .select('client_name')
        .not('client_name', 'is', null)
        .is('deleted_at', null);

      // Fetch from tax_invoices
      const { data: invoiceClients } = await supabase
        .from('tax_invoices')
        .select('client_name')
        .not('client_name', 'is', null)
        .is('deleted_at', null);

      // Combine and deduplicate
      const allNames = new Set<string>();
      bookingClients?.forEach(b => b.client_name && allNames.add(b.client_name));
      invoiceClients?.forEach(i => i.client_name && allNames.add(i.client_name));

      return Array.from(allNames).sort((a, b) => a.localeCompare(b));
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Filter suggestions based on input
  const filteredNames = clientNames?.filter(name => 
    name.toLowerCase().includes(inputValue.toLowerCase())
  ) || [];

  const handleSelect = (selectedValue: string) => {
    onChange(selectedValue);
    setInputValue(selectedValue);
    setOpen(false);
  };

  const handleInputChange = (newValue: string) => {
    setInputValue(newValue);
    // Also update the actual value for free text entry
    onChange(newValue);
  };

  const triggerButton = (
    <Button
      type="button"
      variant="outline"
      role="combobox"
      aria-expanded={open}
      className="w-full justify-between h-11"
      disabled={disabled}
    >
      <span className={cn(!value && "text-muted-foreground", "truncate")}>
        {value || placeholder}
      </span>
      {isLoading ? (
        <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin" />
      ) : (
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      )}
    </Button>
  );

  const commandContent = (
    <Command shouldFilter={false}>
      <CommandInput 
        placeholder="Search or enter new client..." 
        className={cn(isMobile ? "h-14 text-base" : "h-11")} 
        value={inputValue}
        onValueChange={handleInputChange}
        autoFocus={isMobile}
      />
      <CommandList 
        className={cn(isMobile && "max-h-[60vh]")}
        style={isMobile ? { touchAction: 'manipulation' } : undefined}
      >
        {inputValue && !filteredNames.includes(inputValue) && (
          <CommandGroup heading="New Entry">
            <CommandItem
              value={inputValue}
              onSelect={() => handleSelect(inputValue)}
              onPointerDown={(e) => {
                if (isMobile) {
                  e.preventDefault();
                  handleSelect(inputValue);
                }
              }}
              className={cn(
                "cursor-pointer",
                isMobile && "py-3 min-h-[44px] text-base"
              )}
            >
              <span className="text-muted-foreground mr-2">Add:</span>
              {inputValue}
            </CommandItem>
          </CommandGroup>
        )}
        
        {filteredNames.length === 0 && !inputValue && (
          <CommandEmpty>No clients found. Start typing to add.</CommandEmpty>
        )}
        
        {filteredNames.length > 0 && (
          <CommandGroup heading="Existing Clients">
            {filteredNames.slice(0, 50).map((name) => (
              <CommandItem
                key={name}
                value={name}
                onSelect={() => handleSelect(name)}
                onPointerDown={(e) => {
                  if (isMobile) {
                    e.preventDefault();
                    handleSelect(name);
                  }
                }}
                className={cn(
                  "cursor-pointer",
                  isMobile && "py-3 min-h-[44px] text-base"
                )}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === name ? "opacity-100" : "opacity-0"
                  )}
                />
                {name}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </Command>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>
          {triggerButton}
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader className="text-left">
            <DrawerTitle>Select Client</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6">
            {commandContent}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {triggerButton}
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        {commandContent}
      </PopoverContent>
    </Popover>
  );
}
