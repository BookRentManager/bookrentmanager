import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageItem } from "./MessageItem";
import { Loader2 } from "lucide-react";
import { formatDistanceToNow, isToday, isYesterday, format } from "date-fns";

interface ChatMessageListProps {
  entityType: 'general' | 'booking' | 'fine' | 'supplier_invoice' | 'client_invoice';
  entityId: string;
}

interface ChatMessage {
  id: string;
  entity_type: string;
  entity_id: string | null;
  user_id: string;
  message: string;
  mentioned_users: string[];
  created_at: string;
  updated_at: string;
  source: string;
  profiles?: {
    email: string;
  };
}

export function ChatMessageList({ entityType, entityId }: ChatMessageListProps) {
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentUserId = useRef<string>("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) currentUserId.current = data.user.id;
    });
  }, []);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['chat-messages', entityType, entityId],
    queryFn: async () => {
      let query = supabase
        .from('chat_messages')
        .select('*')
        .eq('entity_type', entityType)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

      // For general chat, entity_id is null
      if (entityType === 'general') {
        query = query.is('entity_id', null);
      } else if (entityId) {
        query = query.eq('entity_id', entityId);
      }

      const { data: messages, error } = await query;
      if (error) throw error;

      // Fetch profiles separately
      const userIds = messages?.map(m => m.user_id) || [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', userIds);

      return messages?.map(msg => ({
        ...msg,
        profiles: profiles?.find(p => p.id === msg.user_id)
      })) as ChatMessage[];
    }
  });

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel(`chat:${entityType}:${entityId || 'general'}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: entityType === 'general' 
            ? `entity_type=eq.${entityType},entity_id=is.null`
            : `entity_type=eq.${entityType},entity_id=eq.${entityId}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['chat-messages', entityType, entityId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [entityType, entityId, queryClient]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Group messages by date
  const groupedMessages = groupMessagesByDate(messages);

  return (
    <ScrollArea className="flex-1 px-4" ref={scrollRef}>
      <div className="space-y-6 py-4">
        {Object.entries(groupedMessages).map(([date, msgs]) => (
          <div key={date}>
            <div className="sticky top-0 z-10 flex justify-center mb-4">
              <div className="bg-muted px-3 py-1 rounded-full text-xs text-muted-foreground">
                {date}
              </div>
            </div>
            <div className="space-y-4">
              {msgs.map((message) => (
                <MessageItem
                  key={message.id}
                  message={message}
                  currentUserId={currentUserId.current}
                />
              ))}
            </div>
          </div>
        ))}
        {messages.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            No messages yet. Start the conversation!
          </p>
        )}
      </div>
    </ScrollArea>
  );
}

function groupMessagesByDate(messages: ChatMessage[]): Record<string, ChatMessage[]> {
  const groups: Record<string, ChatMessage[]> = {};

  messages.forEach((message) => {
    const date = new Date(message.created_at);
    let label: string;

    if (isToday(date)) {
      label = 'Today';
    } else if (isYesterday(date)) {
      label = 'Yesterday';
    } else {
      label = format(date, 'MMM d, yyyy');
    }

    if (!groups[label]) {
      groups[label] = [];
    }
    groups[label].push(message);
  });

  return groups;
}
