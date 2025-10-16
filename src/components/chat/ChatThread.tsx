import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MessageItem } from "./MessageItem";
import { ChatInput } from "./ChatInput";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";

interface ChatThreadProps {
  entityType: 'booking' | 'fine' | 'supplier_invoice' | 'client_invoice';
  entityId: string;
  entityName?: string;
  compact?: boolean;
}

interface ChatMessage {
  id: string;
  entity_type: string;
  entity_id: string;
  user_id: string;
  message: string;
  mentioned_users: string[];
  created_at: string;
  updated_at: string;
  profiles?: {
    email: string;
  };
}

export function ChatThread({ entityType, entityId, entityName, compact = false }: ChatThreadProps) {
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentUserId, setCurrentUserId] = useState<string>("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id);
    });
  }, []);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['chat-messages', entityType, entityId],
    queryFn: async () => {
      const { data: messages, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', messages?.map(m => m.user_id) || []);

      return messages?.map(msg => ({
        ...msg,
        profiles: profiles?.find(p => p.id === msg.user_id)
      })) as ChatMessage[];
    }
  });

  useEffect(() => {
    const channel = supabase
      .channel(`chat:${entityType}:${entityId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `entity_type=eq.${entityType},entity_id=eq.${entityId}`
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

  const content = (
    <div className="flex flex-col h-full">
      <ScrollArea className={compact ? "h-80" : "h-[500px]"} ref={scrollRef}>
        <div className="space-y-4 p-4">
          {messages.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No messages yet. Start the conversation!
            </p>
          ) : (
            messages.map((message) => (
              <MessageItem
                key={message.id}
                message={message}
                currentUserId={currentUserId}
              />
            ))
          )}
        </div>
      </ScrollArea>
      <div className="border-t p-4">
        <ChatInput entityType={entityType} entityId={entityId} />
      </div>
    </div>
  );

  if (compact) {
    return content;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{entityName ? `Chat - ${entityName}` : 'Chat'}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {content}
      </CardContent>
    </Card>
  );
}
