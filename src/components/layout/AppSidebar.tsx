import { Car, Key, LayoutDashboard, Receipt, FileText, AlertCircle, Settings, LogOut, Webhook, ChevronDown, Mail, MailCheck, Trash2, User, Bug, Users, Calculator, Building2, UserSquare2, Handshake } from "lucide-react";
import { NavLink } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState } from "react";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserViewScope } from "@/hooks/useUserViewScope";

export function AppSidebar() {
  const { signOut, user } = useAuth();
  const { setOpenMobile } = useSidebar();
  const isMobile = useIsMobile();
  const location = useLocation();
  const { isRestrictedStaff, isAdminOrAccountant, isAdmin, role: userRole } = useUserViewScope();
  const [settingsOpen, setSettingsOpen] = useState(
    location.pathname === "/settings" || 
    location.pathname === "/integrations" || 
    location.pathname === "/settings/profile" ||
    location.pathname === "/email-imports"
  );

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

  // Menu items - filtered based on user scope
  const menuItems = [
    { title: "Dashboard", url: "/", icon: LayoutDashboard },
    { title: "Bookings", url: "/bookings", icon: Car },
    { title: "Rentals", url: "/rentals", icon: Key },
    { title: "Fines", url: "/fines", icon: AlertCircle },
    // Hide Invoices and Reports from restricted staff
    ...(!isRestrictedStaff ? [
      { title: "Invoices", url: "/invoices", icon: FileText },
      { title: "Reports", url: "/reports", icon: Receipt },
    ] : []),
  ];

  const getNavClassName = ({ isActive }: { isActive: boolean }) =>
    isActive
      ? "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground"
      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground";

  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarContent>
        <div className="flex h-14 items-center border-b border-sidebar-border px-4">
          <div className="flex items-center gap-2">
            {appSettings?.logo_url ? (
              <div className="p-1.5">
                <img 
                  src={appSettings.logo_url} 
                  alt="Company logo" 
                  className="h-8 md:h-10 w-auto object-contain max-w-[120px] md:max-w-[150px]"
                />
              </div>
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-sidebar-primary">
                <Car className="h-4 w-4 text-sidebar-primary-foreground" />
              </div>
            )}
            {!appSettings?.logo_url && (
              <span className="text-lg font-bold text-sidebar-foreground">
                {appSettings?.company_name || 'BookRentManager'}
              </span>
            )}
          </div>
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/60">Main Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className={getNavClassName} onClick={handleNavClick}>
                      <item.icon className="h-4 w-4 text-sidebar-foreground" />
                      <span className="text-sidebar-foreground">{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Management section - hidden for restricted staff */}
        {!isRestrictedStaff && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/60">Management</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink to="/agencies" className={getNavClassName} onClick={handleNavClick}>
                      <Building2 className="h-4 w-4 text-sidebar-foreground" />
                      <span className="text-sidebar-foreground">Agencies</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {isAdminOrAccountant && (
                  <>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild>
                        <NavLink to="/customers" className={getNavClassName} onClick={handleNavClick}>
                          <UserSquare2 className="h-4 w-4 text-sidebar-foreground" />
                          <span className="text-sidebar-foreground">Customers</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild>
                        <NavLink to="/suppliers" className={getNavClassName} onClick={handleNavClick}>
                          <Handshake className="h-4 w-4 text-sidebar-foreground" />
                          <span className="text-sidebar-foreground">Suppliers</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild>
                        <NavLink to="/accounting" className={getNavClassName} onClick={handleNavClick}>
                          <Calculator className="h-4 w-4 text-sidebar-foreground" />
                          <span className="text-sidebar-foreground">Accounting</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/60">Settings</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton>
                      <Settings className="h-4 w-4 text-sidebar-foreground" />
                      <span className="text-sidebar-foreground">Settings</span>
                      <ChevronDown className="ml-auto h-4 w-4 text-sidebar-foreground transition-transform" 
                        style={{ transform: settingsOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} 
                      />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {!isRestrictedStaff && (
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild>
                            <NavLink to="/settings/profile" className={getNavClassName} onClick={handleNavClick}>
                              <User className="h-4 w-4 text-sidebar-foreground" />
                              <span className="text-sidebar-foreground">My Profile</span>
                            </NavLink>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      )}
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild>
                          <NavLink to="/settings" className={getNavClassName} onClick={handleNavClick}>
                            <Settings className="h-4 w-4 text-sidebar-foreground" />
                            <span className="text-sidebar-foreground">General</span>
                          </NavLink>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      {!isRestrictedStaff && (
                        <>
                          <SidebarMenuSubItem>
                            <SidebarMenuSubButton asChild>
                              <NavLink to="/integrations" className={getNavClassName} onClick={handleNavClick}>
                                <Webhook className="h-4 w-4 text-sidebar-foreground" />
                                <span className="text-sidebar-foreground">Integrations</span>
                              </NavLink>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                          <SidebarMenuSubItem>
                            <SidebarMenuSubButton asChild>
                              <NavLink to="/email-imports" className={getNavClassName} onClick={handleNavClick}>
                                <Mail className="h-4 w-4 text-sidebar-foreground" />
                                <span className="text-sidebar-foreground">Email Imports</span>
                              </NavLink>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        </>
                      )}
                      {isAdmin && (
                        <>
                          <SidebarMenuSubItem>
                            <SidebarMenuSubButton asChild>
                              <NavLink to="/user-management" className={getNavClassName} onClick={handleNavClick}>
                                <Users className="h-4 w-4 text-sidebar-foreground" />
                                <span className="text-sidebar-foreground">User Management</span>
                              </NavLink>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                          <SidebarMenuSubItem>
                            <SidebarMenuSubButton asChild>
                              <NavLink to="/email-whitelist" className={getNavClassName} onClick={handleNavClick}>
                                <MailCheck className="h-4 w-4 text-sidebar-foreground" />
                                <span className="text-sidebar-foreground">Email Whitelist</span>
                              </NavLink>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        </>
                      )}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Trash and Issue Reports - hidden for restricted staff */}
        {!isRestrictedStaff && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink to="/trash" className={getNavClassName} onClick={handleNavClick}>
                      <Trash2 className="h-4 w-4 text-sidebar-foreground" />
                      <span className="text-sidebar-foreground">Trash</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {isAdmin && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink to="/issues" className={getNavClassName} onClick={handleNavClick}>
                        <Bug className="h-4 w-4 text-sidebar-foreground" />
                        <span className="text-sidebar-foreground">Issue Reports</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-sidebar-foreground truncate max-w-[150px]">
              {user?.email}
            </span>
            <span className="text-xs text-sidebar-foreground/60">v1.0</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => signOut()}
            className="text-sidebar-foreground hover:bg-sidebar-accent"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
