import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export function useAccountantRole() {
  const { user } = useAuth();
  
  const { data: isAccountant, isLoading } = useQuery({
    queryKey: ["user-role-accountant", user?.id],
    queryFn: async () => {
      if (!user) return false;
      
      const { data, error } = await supabase
        .rpc('has_role', {
          _user_id: user.id,
          _role: 'accountant'
        });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
  
  return { isAccountant: isAccountant ?? false, isLoading };
}
