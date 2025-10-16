import { useState } from "react";
import { Check, ChevronsUpDown, Globe, MessageSquare } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useChatPanel, ChatContext } from "@/hooks/useChatPanel";
import { useContextUnreadCount } from "@/hooks/useUnreadCounts";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function ChatContextSwitcher() {
  const [open, setOpen] = useState(false);
  const { currentContext, setContext, recentContexts } = useChatPanel();

  const displayName = currentContext.type === 'general' 
    ? 'General Chat'
    : currentContext.name || `${currentContext.type} ${currentContext.id?.slice(0, 8)}`;

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
        <Command>
          <CommandInput placeholder="Search conversations..." />
          <CommandList>
            <CommandEmpty>No conversations found.</CommandEmpty>
            
            <CommandGroup heading="Quick Access">
              <ContextItem
                context={{ type: 'general' }}
                isSelected={currentContext.type === 'general'}
                onSelect={() => {
                  setContext({ type: 'general' });
                  setOpen(false);
                }}
              />
            </CommandGroup>

            {recentContexts.length > 0 && (
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

  const Icon = context.type === 'general' ? Globe : MessageSquare;

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
