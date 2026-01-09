import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export function useUserViewScope() {
  const { user } = useAuth();

  // Fetch user role
  const { data: userRole, isLoading: roleLoading } = useQuery({
    queryKey: ["user-role", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();
      return data?.role as string | null;
    },
    enabled: !!user?.id,
  });

  // Fetch user profile for view_scope
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["user-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("view_scope")
        .eq("id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const viewScope = profile?.view_scope || 'own';
  const isLoading = roleLoading || profileLoading;
  
  // Restricted staff: role='staff' AND view_scope='own'
  // These users should only see their own bookings and have limited UI visibility
  const isRestrictedStaff = userRole === 'staff' && viewScope === 'own';
  
  // Admin or accountant - full access to financial data
  const isAdminOrAccountant = userRole === 'admin' || userRole === 'accountant';

  return {
    role: userRole,
    viewScope,
    isLoading,
    isRestrictedStaff,
    isAdminOrAccountant,
    isAdmin: userRole === 'admin',
  };
}
