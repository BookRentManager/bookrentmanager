import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageItem } from "./MessageItem";
import { Loader2, ArrowDown } from "lucide-react";
import { isToday, isYesterday, format } from "date-fns";
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
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [messageCount, setMessageCount] = useState(0);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id);
    });
  }, []);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['chat-messages', entityType, entityId],
    staleTime: 0,
    gcTime: 10 * 60 * 1000,
    structuralSharing: false, // Force new reference on updates
    queryFn: async () => {
      console.log('🔄 QueryFn executing for:', entityType, entityId);
      
      let query = supabase
        .from('chat_messages')
        .select('*, profiles(email, display_name, avatar_url)')
        .eq('entity_type', entityType)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

      // For general chat, entity_id is null
      if (entityType === 'general' && entityId === 'general') {
        query = query.is('entity_id', null);
      } else if (entityId && entityId !== 'general') {
        query = query.eq('entity_id', entityId);
      }

      const { data, error } = await query;
      if (error) {
        console.error('❌ QueryFn error:', error);
        throw error;
      }

      console.log('✅ QueryFn returned', data?.length || 0, 'messages');
      setMessageCount(data?.length || 0); // Force state update
      return (data || []) as ChatMessage[];
    }
  });

  useEffect(() => {
    console.log('📨 Messages rendered:', messages.length, 'messages', 'Count:', messageCount);
  }, [messages, messageCount]);

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel(`chat:${entityType}:${entityId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_messages'
        },
        (payload) => {
          console.log('Raw realtime payload:', payload);
          const newMessage = payload.new as any;
          
          // Check if this message belongs to our current context
          const isGeneral = entityType === 'general' && entityId === 'general';
          const matchesContext = isGeneral 
            ? (newMessage.entity_type === 'general' && newMessage.entity_id === null)
            : (newMessage.entity_type === entityType && newMessage.entity_id === entityId);
          
          if (matchesContext) {
            console.log('Message matches context, invalidating cache...');
            queryClient.invalidateQueries({ 
              queryKey: ['chat-messages', entityType, entityId],
              refetchType: 'active'
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [entityType, entityId, queryClient]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollViewportRef.current) {
      const viewport = scrollViewportRef.current;
      const isAtBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 100;
      
      // Always scroll when message count increases (new message added)
      // OR when user is already near the bottom
      if (isAtBottom || shouldAutoScroll) {
        console.log('📜 Auto-scrolling to new message');
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior: 'smooth'
        });
      }
    }
  }, [messageCount, shouldAutoScroll]);

  // Track scroll position to show/hide scroll button
  useEffect(() => {
    const handleScroll = () => {
      if (scrollViewportRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = scrollViewportRef.current;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
        setShouldAutoScroll(isNearBottom);
        setShowScrollButton(!isNearBottom && (messages?.length ?? 0) > 0);
      }
    };

    const scrollElement = scrollViewportRef.current;
    scrollElement?.addEventListener('scroll', handleScroll);
    return () => scrollElement?.removeEventListener('scroll', handleScroll);
  }, [messages]);

  // Get viewport ref from ScrollArea
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const findViewport = () => {
      const viewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        scrollViewportRef.current = viewport as HTMLDivElement;
        console.log('✅ Scroll viewport ref set');
        return true;
      }
      return false;
    };

    // Try immediately
    if (!findViewport()) {
      // Retry after a delay if not found
      const timer = setTimeout(findViewport, 100);
      return () => clearTimeout(timer);
    }
  }, []);

  const scrollToBottom = () => {
    if (scrollViewportRef.current) {
      scrollViewportRef.current.scrollTo({
        top: scrollViewportRef.current.scrollHeight,
        behavior: 'smooth'
      });
      setShouldAutoScroll(true);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading messages...</p>
        </div>
      </div>
    );
  }

  // Group messages by date
  const groupedMessages = groupMessagesByDate(messages);

  return (
    <div className="flex-1 relative overflow-hidden">
      <ScrollArea ref={scrollAreaRef} className="h-full">
        <div className="space-y-1 p-4 pb-6">
          {Object.entries(groupedMessages).map(([date, msgs]) => (
            <div key={date} className="space-y-3">
              <div className="sticky top-0 z-10 flex items-center justify-center py-3">
                <div className="bg-background/80 backdrop-blur-sm border px-4 py-1.5 rounded-full text-xs font-medium shadow-sm">
                  {date}
                </div>
              </div>
              <div className="space-y-2">
                {msgs.map((message) => (
                  <div
                    key={message.id}
                    id={`message-${message.id}`}
                    className="animate-fade-in"
                  >
                    <MessageItem message={message} currentUserId={currentUserId} />
                  </div>
                ))}
              </div>
            </div>
          ))}
          
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-64 text-center px-4">
              <div className="rounded-full bg-muted p-4 mb-4">
                <ArrowDown className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium mb-1">No messages yet</p>
              <p className="text-xs text-muted-foreground">Start the conversation by sending a message below</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {showScrollButton && (
        <Button
          onClick={scrollToBottom}
          size="icon"
          className="absolute bottom-6 right-6 rounded-full shadow-lg h-10 w-10 animate-fade-in"
          variant="secondary"
        >
          <ArrowDown className="h-5 w-5" />
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
