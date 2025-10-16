import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getUserColor, getUserAvatarColor, cn } from "@/lib/utils";
import { Send } from "lucide-react";

interface MessageItemProps {
  message: {
    id: string;
    user_id: string;
    message: string;
    created_at: string;
    source?: string;
    telegram_username?: string;
    profiles?: {
      email: string;
      display_name?: string;
      avatar_url?: string;
    };
  };
  currentUserId: string;
}

export function MessageItem({ message, currentUserId }: MessageItemProps) {
  const isOwnMessage = message.user_id === currentUserId;
  const isTelegram = message.source === 'telegram';
  
  // Display Telegram username if message is from Telegram
  const displayName = isTelegram && message.telegram_username
    ? message.telegram_username
    : message.profiles?.display_name || message.profiles?.email || "Unknown User";
  
  const email = message.profiles?.email || "Unknown User";
  const avatarUrl = message.profiles?.avatar_url;
  const initials = isTelegram && message.telegram_username
    ? message.telegram_username.substring(0, 2).toUpperCase()
    : (message.profiles?.display_name || email).split(/[\s@]/)[0].substring(0, 2).toUpperCase();

  const parsedMessage = message.message.replace(
    /@\[([^\]]+)\]\(([^)]+)\)/g,
    '<span class="text-primary font-medium">@$1</span>'
  );

  // Get unique colors for this user
  const messageColors = isOwnMessage 
    ? 'bg-blue-500 text-white border-blue-600' 
    : `${getUserColor(message.user_id)} text-white`;
  
  const avatarColors = getUserAvatarColor(message.user_id);

  return (
    <div className={cn(
      "flex gap-2 sm:gap-2.5 group animate-fade-in",
      isOwnMessage ? 'flex-row-reverse' : ''
    )}>
      <Avatar className={cn(
        "h-9 w-9 sm:h-8 sm:w-8 shrink-0 ring-2 transition-all",
        isOwnMessage ? 'ring-blue-500/20' : 'ring-transparent',
        !isOwnMessage && avatarColors
      )}>
        {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
        <AvatarFallback className="text-xs font-semibold">
          {initials}
        </AvatarFallback>
      </Avatar>
      
      <div className={cn(
        "flex flex-col max-w-[85%] sm:max-w-[75%]",
        isOwnMessage ? 'items-end' : 'items-start'
      )}>
        <div className={cn(
          "flex items-center gap-1.5 mb-1 px-1",
          isOwnMessage ? 'flex-row-reverse' : ''
        )}>
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-foreground/80">
              {displayName}
            </span>
            {isTelegram && (
              <Send className="h-3 w-3 text-muted-foreground" />
            )}
          </div>
          <span className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
          </span>
        </div>
        
        <div
          className={cn(
            "rounded-2xl px-3 py-2 sm:px-4 sm:py-2.5 shadow-md border transition-all",
            isOwnMessage
              ? 'bg-blue-500 text-white border-blue-600 rounded-tr-sm shadow-blue-500/20'
              : `${messageColors} rounded-tl-sm`
          )}
        >
          <p
            className="text-[13px] sm:text-sm leading-relaxed whitespace-pre-wrap break-words"
            dangerouslySetInnerHTML={{ __html: parsedMessage }}
          />
        </div>
      </div>
    </div>
  );
}
