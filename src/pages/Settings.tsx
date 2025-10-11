import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings as SettingsIcon, Users } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function Settings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isMainAdmin = user?.email === "admin@kingrent.com";

  const { data: profiles, isLoading: profilesLoading } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) {
        console.error("Error fetching profiles:", error);
        throw error;
      }
      return data;
    },
    enabled: isMainAdmin,
  });

  const updateViewScope = useMutation({
    mutationFn: async ({ userId, viewScope }: { userId: string; viewScope: string }) => {
      // Update view_scope in profiles
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ view_scope: viewScope })
        .eq("id", userId);
      
      if (profileError) throw profileError;

      // Manage admin role based on view_scope
      if (viewScope === "all") {
        // Add admin role
        const { error: roleError } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, role: "admin" })
          .select();
        
        // Ignore conflict errors (role already exists)
        if (roleError && !roleError.message.includes("duplicate")) {
          throw roleError;
        }
      } else {
        // Remove admin role
        const { error: roleError } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", "admin");
        
        if (roleError) throw roleError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("User permissions updated");
    },
    onError: (error) => {
      console.error("Failed to update user permissions:", error);
      toast.error("Failed to update user permissions");
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">Application configuration and preferences</p>
      </div>

      {isMainAdmin && (
        <Card className="shadow-card">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <CardTitle>User Management</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {profilesLoading ? (
              <p className="text-sm text-muted-foreground">Loading users...</p>
            ) : !profiles || profiles.length === 0 ? (
              <p className="text-sm text-muted-foreground">No users found.</p>
            ) : (
              <div className="space-y-4">
                {profiles.map((profile) => (
                  <div
                    key={profile.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="space-y-1">
                      <p className="font-medium">{profile.email}</p>
                      <p className="text-sm text-muted-foreground">
                        {profile.view_scope === "all" ? "Can view all bookings" : "Can only view own bookings"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`scope-${profile.id}`} className="text-sm cursor-pointer">
                        View All
                      </Label>
                      <Switch
                        id={`scope-${profile.id}`}
                        checked={profile.view_scope === "all"}
                        onCheckedChange={(checked) =>
                          updateViewScope.mutate({
                            userId: profile.id,
                            viewScope: checked ? "all" : "own",
                          })
                        }
                        disabled={profile.email === "admin@kingrent.com"}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Configuration</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            General settings and configuration options.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
