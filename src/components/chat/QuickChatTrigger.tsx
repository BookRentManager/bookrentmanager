import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useChatPanel, ChatContext } from "@/hooks/useChatPanel";
import { useContextUnreadCount } from "@/hooks/useUnreadCounts";

interface QuickChatTriggerProps {
  context: ChatContext;
  size?: "sm" | "default" | "lg";
}

export function QuickChatTrigger({ context, size = "sm" }: QuickChatTriggerProps) {
  const { setOpen, setContext } = useChatPanel();
  const unreadCount = useContextUnreadCount(context);

  const handleClick = () => {
    setContext(context);
    setOpen(true);
  };

  return (
    <Button
      variant="ghost"
      size={size}
      onClick={handleClick}
      className="relative"
      aria-label="Open chat for this item"
    >
      <MessageSquare className="h-4 w-4" />
      {unreadCount > 0 && (
        <Badge 
          variant="destructive" 
          className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-xs"
        >
          {unreadCount > 9 ? '9+' : unreadCount}
        </Badge>
      )}
    </Button>
  );
}
