import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface UserMentionAutocompleteProps {
  searchTerm: string;
  onSelect: (user: { id: string; email: string }) => void;
  onClose: () => void;
}

export function UserMentionAutocomplete({ searchTerm, onSelect, onClose }: UserMentionAutocompleteProps) {
  const { data: users = [] } = useQuery({
    queryKey: ['staff-users', searchTerm],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email')
        .ilike('email', `%${searchTerm}%`)
        .limit(5);

      if (error) throw error;
      return data as { id: string; email: string }[];
    }
  });

  if (users.length === 0) return null;

  return (
    <Card className="absolute bottom-full left-0 mb-2 w-64 shadow-lg z-50">
      <ScrollArea className="max-h-48">
        <div className="p-2">
          {users.map((user) => {
            const initials = user.email.split('@')[0].substring(0, 2).toUpperCase();
            return (
              <button
                key={user.id}
                onClick={() => onSelect(user)}
                className="w-full flex items-center gap-2 p-2 rounded hover:bg-muted transition-colors"
              >
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
                <span className="text-sm truncate">{user.email}</span>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </Card>
  );
}
