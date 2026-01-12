import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Shield, Eye, Info, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useUserViewScope } from "@/hooks/useUserViewScope";

type Profile = {
  id: string;
  email: string;
  display_name: string | null;
  view_scope: string;
};

type UserRole = {
  user_id: string;
  role: 'admin' | 'staff' | 'read_only';
};

export default function UserManagement() {
  const queryClient = useQueryClient();
  const { isReadOnly } = useUserViewScope();
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<{ id: string; email: string } | null>(null);

  // Fetch profiles
  const { data: profiles, isLoading: profilesLoading } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('email');
      
      if (error) throw error;
      return data as Profile[];
    },
  });

  // Fetch user roles
  const { data: userRoles } = useQuery({
    queryKey: ['user-roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('*');
      
      if (error) throw error;
      return data as UserRole[];
    },
  });

  // Update view scope mutation
  const updateViewScopeMutation = useMutation({
    mutationFn: async ({ userId, viewScope }: { userId: string; viewScope: string }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ view_scope: viewScope })
        .eq('id', userId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      toast.success('View scope updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update view scope: ' + error.message);
    },
  });

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: 'admin' | 'staff' | 'read_only' }) => {
      // Delete existing role
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);
      
      // Insert new role
      const { error } = await supabase
        .from('user_roles')
        .insert([{ user_id: userId, role: newRole }]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-roles'] });
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      toast.success('Role updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update role: ' + error.message);
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Not authenticated');
      }

      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userId },
      });

      if (error) {
        throw new Error(error.message || 'Failed to delete user');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['user-roles'] });
      toast.success('User deleted successfully');
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    },
    onError: (error: Error) => {
      toast.error('Failed to delete user: ' + error.message);
    },
  });

  const getUserRole = (userId: string): string => {
    const role = userRoles?.find(r => r.user_id === userId);
    return role?.role || 'staff';
  };

  if (profilesLoading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground">Manage user roles and permissions</p>
        </div>
        
        <Dialog open={permissionsDialogOpen} onOpenChange={setPermissionsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Info className="h-4 w-4 mr-2" />
              Permission Guide
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Permission System Overview</DialogTitle>
              <DialogDescription>Understanding roles and access levels in the system</DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg mb-2">Logged-In Users (Authenticated)</h3>
                
                <div className="space-y-3">
                  <div className="border rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="destructive">Admin</Badge>
                      <Badge>View Scope: All</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Full access to all bookings, invoices, fines, and settings. Can manage users and system configuration.
                    </p>
                  </div>
                  
                  <div className="border rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="secondary">Staff</Badge>
                      <Badge>View Scope: All</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Can see all bookings and perform operations, but limited access to system settings.
                    </p>
                  </div>
                  
                  <div className="border rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="secondary">Staff</Badge>
                      <Badge variant="outline">View Scope: Own</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Can only see bookings they explicitly created. <strong>Imported bookings are NOT visible.</strong>
                    </p>
                  </div>
                  
                  <div className="border rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">Read Only</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      View-only access to data based on their view scope. Cannot create or modify records.
                    </p>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="font-semibold text-lg mb-2">Token-Based Access (No Login Required)</h3>
                
                <div className="space-y-3">
                  <div className="border rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-blue-500">Client Portal</Badge>
                      <Badge variant="outline">No Expiry</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Accessed via unique link sent to clients. Can view own booking details, upload documents, make payments.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <strong>Can see:</strong> Own booking info, payment details, documents, rental policies<br />
                      <strong>Cannot see:</strong> Other bookings, backend data, admin functions
                    </p>
                  </div>
                  
                  <div className="border rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-green-500">Delivery Driver</Badge>
                      <Badge variant="outline">30 Days Expiry</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Temporary access for car delivery/collection. Can upload contracts and condition photos.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <strong>Can see:</strong> Car model, plate, location, datetime<br />
                      <strong>Cannot see:</strong> Client personal info, payment amounts, financial data
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Alert>
        <Shield className="h-4 w-4" />
        <AlertTitle>Security Information</AlertTitle>
        <AlertDescription>
          Roles control what actions users can perform. View scope determines what data they can access.
          Changes take effect immediately.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>User Permissions</CardTitle>
          <CardDescription>
            Manage roles and data access for each user
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>View Scope</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles?.map((profile) => {
                const currentRole = getUserRole(profile.id);
                const isMainAdmin = profile.email === "admin@kingrent.com";
                
                return (
                  <TableRow key={profile.id}>
                    <TableCell className="font-medium">{profile.email}</TableCell>
                    <TableCell>
                      <Select
                        value={currentRole}
                        onValueChange={(value: 'admin' | 'staff' | 'read_only') =>
                          updateRoleMutation.mutate({
                            userId: profile.id,
                            newRole: value,
                          })
                        }
                        disabled={isMainAdmin || isReadOnly}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="staff">Staff</SelectItem>
                          <SelectItem value="read_only">Read Only</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={profile.view_scope}
                        onValueChange={(value) =>
                          updateViewScopeMutation.mutate({
                            userId: profile.id,
                            viewScope: value,
                          })
                        }
                        disabled={isMainAdmin || isReadOnly}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Bookings</SelectItem>
                          <SelectItem value="own">Own Only</SelectItem>
                        </SelectContent>
                      </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        {!isReadOnly && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isMainAdmin}
                            onClick={() => {
                              setUserToDelete({ id: profile.id, email: profile.email });
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{userToDelete?.email}</strong>? 
              This action cannot be undone. The user's account and all associated data will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setUserToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => userToDelete && deleteUserMutation.mutate(userToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
