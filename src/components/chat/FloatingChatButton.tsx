import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useChatPanel } from "@/hooks/useChatPanel";
import { useUnreadCounts } from "@/hooks/useUnreadCounts";

export function FloatingChatButton() {
  const { togglePanel } = useChatPanel();
  const { data: counts = {} } = useUnreadCounts();
  
  const totalUnread = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const hasUnread = totalUnread > 0;

  return (
    <Button
      onClick={togglePanel}
      size="lg"
      className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg md:bottom-8 md:right-8"
      aria-label="Open chat"
    >
      <MessageSquare className="h-6 w-6" />
      {hasUnread && (
        <Badge 
          variant="destructive" 
          className="absolute -top-1 -right-1 h-5 min-w-5 px-1 animate-pulse"
        >
          {totalUnread > 99 ? '99+' : totalUnread}
        </Badge>
      )}
    </Button>
  );
}
