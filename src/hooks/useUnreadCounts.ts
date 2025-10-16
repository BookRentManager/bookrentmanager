import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChatContext } from "./useChatPanel";

export function useUnreadCounts() {
  return useQuery({
    queryKey: ['unread-counts'],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return {};

      const { data: unread, error } = await supabase
        .from('chat_notifications')
        .select('entity_type, entity_id')
        .eq('user_id', user.user.id)
        .eq('read', false);

      if (error) throw error;

      // Aggregate counts by context
      const counts: Record<string, number> = {};
      
      unread?.forEach((notification) => {
        const key = notification.entity_id 
          ? `${notification.entity_type}:${notification.entity_id}`
          : notification.entity_type;
        counts[key] = (counts[key] || 0) + 1;
      });

      return counts;
    },
    refetchInterval: 5000, // Poll every 5 seconds
  });
}

export function useContextUnreadCount(context: ChatContext) {
  const { data: counts = {} } = useUnreadCounts();
  
  const key = context.id 
    ? `${context.type}:${context.id}`
    : context.type;
  
  return counts[key] || 0;
}
