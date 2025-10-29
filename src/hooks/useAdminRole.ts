import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export function useAdminRole() {
  const { user } = useAuth();
  
  const { data: isAdmin, isLoading } = useQuery({
    queryKey: ["user-role", user?.id],
    queryFn: async () => {
      if (!user) return false;
      
      const { data, error } = await supabase
        .rpc('has_role', {
          _user_id: user.id,
          _role: 'admin'
        });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
  
  return { isAdmin: isAdmin ?? false, isLoading };
}
