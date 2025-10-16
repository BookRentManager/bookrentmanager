import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageItem } from "./MessageItem";
import { Loader2, ArrowDown } from "lucide-react";
import { formatDistanceToNow, isToday, isYesterday, format } from "date-fns";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Button } from "@/components/ui/button";

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
    display_name?: string;
    avatar_url?: string;
  };
}

export function ChatMessageList({ entityType, entityId }: ChatMessageListProps) {
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const parentRef = useRef<HTMLDivElement>(null);
  const currentUserId = useRef<string>("");
  const [showJumpToUnread, setShowJumpToUnread] = useState(false);
  const [firstUnreadIndex, setFirstUnreadIndex] = useState<number | null>(null);

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
        .select('*, profiles(email, display_name, avatar_url)')
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

  // Fetch unread messages
  const { data: unreadMessages } = useQuery({
    queryKey: ['chat-unread', entityType, entityId],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return [];

      const { data, error } = await supabase
        .from('chat_unread_messages')
        .select('message_id')
        .eq('user_id', user.user.id)
        .eq('entity_type', entityType)
        .eq('entity_id', entityType === 'general' ? null : entityId);

      if (error) throw error;
      return data?.map(u => u.message_id) || [];
    }
  });

  // Calculate first unread index
  useEffect(() => {
    if (!messages || !unreadMessages || unreadMessages.length === 0) {
      setFirstUnreadIndex(null);
      return;
    }

    const firstUnread = messages.findIndex(msg => unreadMessages.includes(msg.id));
    setFirstUnreadIndex(firstUnread >= 0 ? firstUnread : null);
  }, [messages, unreadMessages]);

  // Virtual scrolling setup
  const rowVirtualizer = useVirtualizer({
    count: messages?.length || 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,
    overscan: 5,
  });

  // Auto-scroll to bottom for new messages
  useEffect(() => {
    if (scrollRef.current && messages && messages.length > 0) {
      const isNearBottom = scrollRef.current.scrollHeight - scrollRef.current.scrollTop - scrollRef.current.clientHeight < 100;
      if (isNearBottom) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }
  }, [messages]);

  // Track scroll position for "jump to unread" button
  useEffect(() => {
    const handleScroll = () => {
      if (!scrollRef.current || firstUnreadIndex === null) {
        setShowJumpToUnread(false);
        return;
      }

      const scrollTop = scrollRef.current.scrollTop;
      const firstUnreadOffset = firstUnreadIndex * 100; // Approximate
      setShowJumpToUnread(scrollTop < firstUnreadOffset - 200);
    };

    const scrollElement = scrollRef.current;
    scrollElement?.addEventListener('scroll', handleScroll);
    return () => scrollElement?.removeEventListener('scroll', handleScroll);
  }, [firstUnreadIndex]);

  const jumpToUnread = () => {
    if (firstUnreadIndex !== null && parentRef.current) {
      rowVirtualizer.scrollToIndex(firstUnreadIndex, { align: 'start' });
    }
  };

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
    <div className="flex-1 relative">
      <ScrollArea className="flex-1 px-4" ref={scrollRef}>
        <div ref={parentRef} className="space-y-6 py-4">
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

      {showJumpToUnread && firstUnreadIndex !== null && (
        <Button
          onClick={jumpToUnread}
          size="sm"
          className="absolute bottom-4 right-4 shadow-lg rounded-full"
          variant="default"
        >
          <ArrowDown className="h-4 w-4 mr-1" />
          Jump to unread
        </Button>
      )}
    </div>
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
