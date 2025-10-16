import { X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useChatPanel } from "@/hooks/useChatPanel";
import { ChatContextSwitcher } from "./ChatContextSwitcher";
import { ChatMessageList } from "./ChatMessageList";
import { ChatInput } from "./ChatInput";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSwipeable } from "react-swipeable";

export function ChatPanel() {
  const { isOpen, setOpen, currentContext } = useChatPanel();
  const isMobile = useIsMobile();

  const entityType = currentContext.type === 'general' ? 'general' : currentContext.type;
  const entityId = currentContext.id || '';

  // Swipe down to close on mobile
  const swipeHandlers = useSwipeable({
    onSwipedDown: () => {
      if (isMobile) {
        setOpen(false);
        // Haptic feedback
        if (navigator.vibrate) {
          navigator.vibrate(10);
        }
      }
    },
    trackMouse: false,
    trackTouch: true,
  });

  return (
    <Sheet open={isOpen} onOpenChange={setOpen}>
      <SheetContent 
        side="right" 
        className="w-full p-0 sm:w-[420px] sm:max-w-[420px] flex flex-col safe-area-inset"
        {...swipeHandlers}
      >
        <SheetHeader className="border-b p-4 space-y-3">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg">Chat</SheetTitle>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setOpen(false)}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <ChatContextSwitcher />
        </SheetHeader>

        <div className="flex-1 flex flex-col min-h-0">
          <ChatMessageList 
            entityType={entityType}
            entityId={entityId}
          />
          
          <div className="border-t p-4 pb-safe">
            <ChatInput 
              entityType={entityType}
              entityId={entityId}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
