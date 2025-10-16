import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface MessageItemProps {
  message: {
    id: string;
    user_id: string;
    message: string;
    created_at: string;
    profiles?: {
      email: string;
    };
  };
  currentUserId: string;
}

export function MessageItem({ message, currentUserId }: MessageItemProps) {
  const isOwnMessage = message.user_id === currentUserId;
  const email = message.profiles?.email || "Unknown User";
  const initials = email.split('@')[0].substring(0, 2).toUpperCase();

  const parsedMessage = message.message.replace(
    /@\[([^\]]+)\]\(([^)]+)\)/g,
    '<span class="text-primary font-medium">@$1</span>'
  );

  return (
    <div className={`flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : ''}`}>
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
      </Avatar>
      <div className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'} max-w-[70%]`}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium">{email}</span>
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
