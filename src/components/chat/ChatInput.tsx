import { useState, useRef, KeyboardEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { UserMentionAutocomplete } from "./UserMentionAutocomplete";

interface ChatInputProps {
  entityType: 'general' | 'booking' | 'fine' | 'supplier_invoice' | 'client_invoice';
  entityId: string;
  onMessageSent?: () => void;
}

export function ChatInput({ entityType, entityId, onMessageSent }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const queryClient = useQueryClient();

  const sendMessageMutation = useMutation({
    mutationFn: async (text: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
      const mentions: string[] = [];
      let match;
      while ((match = mentionRegex.exec(text)) !== null) {
        mentions.push(match[2]);
      }

      const { data, error } = await supabase
        .from('chat_messages')
        .insert([{
          entity_type: entityType,
          entity_id: entityType === 'general' ? null : entityId,
          user_id: user.id,
          message: text,
          mentioned_users: mentions
        }])
        .select('*, profiles(email, display_name, avatar_url)')
        .single();

      if (error) throw error;

      if (mentions.length > 0) {
        await Promise.all(mentions.map(userId => 
          supabase.from('chat_notifications').insert([{
            user_id: userId,
            message_id: data.id,
            notification_type: 'mention',
            entity_type: entityType,
            entity_id: entityType === 'general' ? null : entityId
          }])
        ));
      }

      // Sync to Telegram (fire and forget - don't block on errors)
      supabase.functions
        .invoke('telegram-send', { body: { message_id: data.id } })
        .catch((err) => console.error('Telegram sync error:', err));

      return data;
    },
    onSuccess: (data) => {
      console.log('✉️ Message sent, updating cache');
      setMessage("");
      
      // Optimistically update the cache - create new array reference
      queryClient.setQueryData<any[]>(
        ['chat-messages', entityType, entityId],
        (old) => {
          const updated = [...(old || []), data];
          console.log('Cache updated:', updated.length, 'messages');
          return updated;
        }
      );
      
      // Immediately invalidate to force refetch
      queryClient.invalidateQueries({ 
        queryKey: ['chat-messages', entityType, entityId],
        refetchType: 'active',
        exact: true
      });
      
      onMessageSent?.();
    },
    onError: () => {
      toast.error("Failed to send message");
    }
  });

  const handleSend = () => {
    if (!message.trim()) return;
    sendMessageMutation.mutate(message);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }

    if (e.key === '@') {
      setShowMentions(true);
      setMentionSearch("");
    }
  };

  const handleChange = (value: string) => {
    setMessage(value);
    
    const lastAtIndex = value.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const searchTerm = value.substring(lastAtIndex + 1);
      if (!searchTerm.includes(' ')) {
        setMentionSearch(searchTerm);
        setShowMentions(true);
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }

    if (textareaRef.current) {
      setCursorPosition(textareaRef.current.selectionStart);
    }
  };

  const handleMentionSelect = (user: { id: string; email: string }) => {
    const lastAtIndex = message.lastIndexOf('@');
    const beforeMention = message.substring(0, lastAtIndex);
    const afterMention = message.substring(cursorPosition);
    const newMessage = `${beforeMention}@[${user.email}](${user.id}) ${afterMention}`;
    
    setMessage(newMessage);
    setShowMentions(false);
    textareaRef.current?.focus();
  };

  return (
    <div className="relative">
      {showMentions && (
        <UserMentionAutocomplete
          searchTerm={mentionSearch}
          onSelect={handleMentionSelect}
          onClose={() => setShowMentions(false)}
        />
      )}
      <div className="flex gap-2">
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message... (@ to mention, Cmd/Ctrl+Enter to send)"
          className="min-h-[60px] resize-none"
          disabled={sendMessageMutation.isPending}
          maxLength={2000}
        />
        <Button
          onClick={handleSend}
          disabled={!message.trim() || sendMessageMutation.isPending}
          size="icon"
          className="shrink-0"
        >
          {sendMessageMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
      <div className="text-xs text-muted-foreground mt-1 text-right">
        {message.length}/2000
      </div>
    </div>
  );
}
