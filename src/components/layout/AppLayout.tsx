import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { RequireAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { data: appSettings } = useQuery({
    queryKey: ["app_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
  });

  return (
    <RequireAuth>
      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          <AppSidebar />
          <main className="flex-1 overflow-auto">
            <div className="sticky top-0 z-10 flex h-14 items-center border-b bg-card px-3 md:px-4 shadow-sm">
              <SidebarTrigger />
              <h1 className="ml-3 md:ml-4 text-base md:text-lg font-semibold truncate">
                {appSettings?.company_name || 'KingRent'} Management
              </h1>
            </div>
            <div className="p-4 md:p-6">{children}</div>
          </main>
        </div>
      </SidebarProvider>
    </RequireAuth>
  );
}
