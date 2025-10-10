import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { RequireAuth } from "@/lib/auth";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          <AppSidebar />
          <main className="flex-1 overflow-auto">
            <div className="sticky top-0 z-10 flex h-14 items-center border-b bg-card px-4 shadow-sm">
              <SidebarTrigger />
              <h1 className="ml-4 text-lg font-semibold">KingRent Management</h1>
            </div>
            <div className="p-6">{children}</div>
          </main>
        </div>
      </SidebarProvider>
    </RequireAuth>
  );
}
