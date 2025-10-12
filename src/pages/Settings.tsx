import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings as SettingsIcon, Users } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Upload, X } from "lucide-react";
import { useState } from "react";

const settingsSchema = z.object({
  company_name: z.string().min(1, "Company name is required"),
  company_email: z.string().email("Invalid email").optional().or(z.literal("")),
  company_phone: z.string().optional(),
  company_address: z.string().optional(),
  default_currency: z.string(),
  default_vat_rate: z.string(),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

export default function Settings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isMainAdmin = user?.email === "admin@kingrent.com";
  const [uploading, setUploading] = useState(false);

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

  const { data: appSettings, isLoading: settingsLoading } = useQuery({
    queryKey: ["app_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("*")
        .limit(1)
        .single();
      
      if (error) {
        console.error("Error fetching app settings:", error);
        throw error;
      }
      return data;
    },
  });

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    values: appSettings ? {
      company_name: appSettings.company_name,
      company_email: appSettings.company_email || "",
      company_phone: appSettings.company_phone || "",
      company_address: appSettings.company_address || "",
      default_currency: appSettings.default_currency,
      default_vat_rate: appSettings.default_vat_rate.toString(),
    } : undefined,
  });

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('company-logos')
        .getPublicUrl(filePath);

      // Update app_settings with logo URL
      const { error: updateError } = await supabase
        .from('app_settings')
        .update({ logo_url: publicUrl })
        .eq('id', appSettings?.id);

      if (updateError) throw updateError;

      queryClient.invalidateQueries({ queryKey: ['app_settings'] });
      toast.success('Logo uploaded successfully');
    } catch (error) {
      console.error('Logo upload error:', error);
      toast.error('Failed to upload logo');
    } finally {
      setUploading(false);
    }
  };

  const handleLogoRemove = async () => {
    try {
      const { error } = await supabase
        .from('app_settings')
        .update({ logo_url: null })
        .eq('id', appSettings?.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['app_settings'] });
      toast.success('Logo removed successfully');
    } catch (error) {
      console.error('Logo remove error:', error);
      toast.error('Failed to remove logo');
    }
  };

  const updateSettings = useMutation({
    mutationFn: async (values: SettingsFormValues) => {
      const { error } = await supabase
        .from("app_settings")
        .update({
          company_name: values.company_name,
          company_email: values.company_email || null,
          company_phone: values.company_phone || null,
          company_address: values.company_address || null,
          default_currency: values.default_currency,
          default_vat_rate: parseFloat(values.default_vat_rate),
        })
        .eq("id", appSettings?.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app_settings"] });
      toast.success("Settings updated successfully");
    },
    onError: (error) => {
      console.error("Failed to update settings:", error);
      toast.error("Failed to update settings");
    },
  });

  const updateViewScope = useMutation({
    mutationFn: async ({ userId, viewScope }: { userId: string; viewScope: string }) => {
      // Update view_scope in profiles
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ view_scope: viewScope })
        .eq("id", userId);
      
      if (profileError) throw profileError;

      // Manage roles based on view_scope
      if (viewScope === "all") {
        // Remove staff role first
        await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", "staff");
        
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
        // Remove admin role first
        await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", "admin");
        
        // Add staff role
        const { error: roleError } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, role: "staff" })
          .select();
        
        // Ignore conflict errors (role already exists)
        if (roleError && !roleError.message.includes("duplicate")) {
          throw roleError;
        }
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

      {isMainAdmin && (
        <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Business Configuration</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {settingsLoading ? (
            <p className="text-sm text-muted-foreground">Loading settings...</p>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit((values) => updateSettings.mutate(values))} className="space-y-4">
                <div className="space-y-2">
                  <Label>Company Logo</Label>
                  <div className="flex items-center gap-4">
                    {appSettings?.logo_url ? (
                      <div className="relative">
                        <div className="bg-muted p-2 rounded-lg inline-block">
                          <img 
                            src={appSettings.logo_url} 
                            alt="Company logo" 
                            className="h-16 w-auto object-contain"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute -top-2 -right-2 h-6 w-6"
                          onClick={handleLogoRemove}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="h-16 w-32 border-2 border-dashed rounded-lg flex items-center justify-center text-muted-foreground">
                        No logo
                      </div>
                    )}
                    <div>
                      <Input
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        onChange={handleLogoUpload}
                        disabled={uploading}
                        className="hidden"
                        id="logo-upload"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById('logo-upload')?.click()}
                        disabled={uploading}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {uploading ? 'Uploading...' : 'Upload Logo'}
                      </Button>
                      <p className="text-xs text-muted-foreground mt-1">
                        PNG (with transparency), JPG, WEBP up to 2MB
                      </p>
                    </div>
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="company_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Name</FormLabel>
                      <FormControl>
                        <Input placeholder="KingRent" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="company_email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="info@kingrent.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="company_phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Phone</FormLabel>
                        <FormControl>
                          <Input placeholder="+41 79 123 45 67" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="company_address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Address</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Street, City, Postal Code, Country" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="default_currency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Default Currency</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="EUR">EUR (€)</SelectItem>
                            <SelectItem value="USD">USD ($)</SelectItem>
                            <SelectItem value="GBP">GBP (£)</SelectItem>
                            <SelectItem value="CHF">CHF (CHF)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>Default currency for new bookings</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="default_vat_rate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Default VAT Rate (%)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="0" {...field} />
                        </FormControl>
                        <FormDescription>Default VAT/tax rate percentage</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Button type="submit" disabled={updateSettings.isPending}>
                  {updateSettings.isPending ? "Saving..." : "Save Settings"}
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
      )}
    </div>
  );
}
