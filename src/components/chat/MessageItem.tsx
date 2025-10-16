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
    <div className={`flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : ''}`}>
      <Avatar className="h-8 w-8 shrink-0">
        {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
      </Avatar>
      <div className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'} max-w-[70%]`}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium">{displayName}</span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
          </span>
        </div>
        <div
          className={`rounded-lg px-4 py-2 ${
            isOwnMessage
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted'
          }`}
        >
          <p
            className="text-sm whitespace-pre-wrap break-words"
            dangerouslySetInnerHTML={{ __html: parsedMessage }}
          />
        </div>
      </div>
    </div>
  );
}
