import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface MessageItemProps {
  message: {
    id: string;
    user_id: string;
    message: string;
    created_at: string;
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
  const displayName = message.profiles?.display_name || message.profiles?.email || "Unknown User";
  const email = message.profiles?.email || "Unknown User";
  const avatarUrl = message.profiles?.avatar_url;
  const initials = (message.profiles?.display_name || email).split(/[\s@]/)[0].substring(0, 2).toUpperCase();

  const parsedMessage = message.message.replace(
    /@\[([^\]]+)\]\(([^)]+)\)/g,
    '<span class="text-primary font-medium">@$1</span>'
  );

  return (
    <div className={`flex gap-2.5 group ${isOwnMessage ? 'flex-row-reverse' : ''}`}>
      <Avatar className={`h-8 w-8 shrink-0 ring-2 transition-all ${
        isOwnMessage 
          ? 'ring-blue-500/20' 
          : 'ring-gray-300/20 dark:ring-gray-700/20'
      }`}>
        {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
        <AvatarFallback className="text-xs font-semibold">{initials}</AvatarFallback>
      </Avatar>
      <div className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'} max-w-[75%]`}>
        <div className={`flex items-center gap-2 mb-1 px-1 ${isOwnMessage ? 'flex-row-reverse' : ''}`}>
          <span className="text-xs font-medium text-foreground/80">{displayName}</span>
          <span className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
          </span>
        </div>
        <div
          className={`rounded-2xl px-4 py-2.5 shadow-sm border transition-all ${
            isOwnMessage
              ? 'bg-blue-500 text-white border-blue-600 rounded-tr-sm'
              : 'bg-gray-100 dark:bg-gray-800 text-foreground border-gray-200 dark:border-gray-700 rounded-tl-sm'
          }`}
        >
          <p
            className="text-[13px] leading-relaxed whitespace-pre-wrap break-words"
            dangerouslySetInnerHTML={{ __html: parsedMessage }}
          />
        </div>
      </div>
    </div>
  );
}
