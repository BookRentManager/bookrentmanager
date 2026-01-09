import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Loader2, Settings as SettingsIcon, Lock, Upload, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { StorageMonitor } from "@/components/admin/StorageMonitor";
import { PaymentMethodsSettings } from "@/components/settings/PaymentMethodsSettings";
import { CurrencyConversionSettings } from "@/components/settings/CurrencyConversionSettings";
import { EmailBookingFormSettings } from "@/components/settings/EmailBookingFormSettings";
import { EmailPaymentConfirmationSettings } from "@/components/settings/EmailPaymentConfirmationSettings";
import { EmailBankTransferSettings } from "@/components/settings/EmailBankTransferSettings";
import { EmailBalanceReminderSettings } from "@/components/settings/EmailBalanceReminderSettings";
import { EmailSecurityDepositReminderSettings } from "@/components/settings/EmailSecurityDepositReminderSettings";
import { BankAccountSettings } from "@/components/settings/BankAccountSettings";
import { TermsAndConditionsSettings } from "@/components/settings/TermsAndConditionsSettings";
import { RentalPoliciesSettings } from "@/components/settings/RentalPoliciesSettings";
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
import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";
import { useUserViewScope } from "@/hooks/useUserViewScope";

const settingsSchema = z.object({
  company_name: z.string().min(1, "Company name is required"),
  company_email: z.string().email("Invalid email").optional().or(z.literal("")),
  company_phone: z.string().optional(),
  company_address: z.string().optional(),
  default_currency: z.string(),
  default_vat_rate: z.string(),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type PasswordFormValues = z.infer<typeof passwordSchema>;

export default function Settings() {
  const { user, session } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { isRestrictedStaff } = useUserViewScope();
  const isMainAdmin = user?.email === "admin@kingrent.com";
  const [uploading, setUploading] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [authDebugInfo, setAuthDebugInfo] = useState<any>(null);
  const [sessionRefreshing, setSessionRefreshing] = useState(false);

  // Force session refresh on mount to ensure valid auth state
  useEffect(() => {
    const refreshSession = async () => {
      try {
        setSessionRefreshing(true);
        const { data, error } = await supabase.auth.getSession();
        
        setAuthDebugInfo({
          hasSession: !!data.session,
          userId: data.session?.user?.id,
          userEmail: data.session?.user?.email,
          expiresAt: data.session?.expires_at,
          error: error?.message,
          timestamp: new Date().toISOString()
        });

        if (error) {
          console.error("Session refresh error:", error);
          toast.error("Session validation failed. Please log out and log in again.");
        }
      } catch (error) {
        console.error("Session refresh exception:", error);
      } finally {
        setSessionRefreshing(false);
      }
    };

    refreshSession();
  }, []);


  const { data: appSettings, isLoading: settingsLoading, error: settingsError } = useQuery({
    queryKey: ["app_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("*")
        .limit(1)
        .single();
      
      if (error) {
        console.error("Settings query error:", error);
        console.error("Auth state:", { userId: user?.id, hasSession: !!session });
        console.error("RLS may have blocked this request. User needs to be authenticated.");
        throw error;
      }
      return data;
    },
    enabled: !!user && !sessionRefreshing,
    retry: (failureCount, error: any) => {
      // Don't retry on auth errors
      if (error?.message?.includes('JWT') || error?.message?.includes('auth')) {
        return false;
      }
      return failureCount < 2;
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

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const handlePasswordChange = async (values: PasswordFormValues) => {
    setChangingPassword(true);
    try {
      // First verify current password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || "",
        password: values.currentPassword,
      });

      if (signInError) {
        toast.error("Current password is incorrect");
        setChangingPassword(false);
        return;
      }

      // Update password
      const { error } = await supabase.auth.updateUser({
        password: values.newPassword,
      });

      if (error) {
        toast.error(error.message || "Failed to change password");
      } else {
        toast.success("Password changed successfully");
        passwordForm.reset();
      }
    } catch (error) {
      console.error("Password change error:", error);
      toast.error("Failed to change password");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check auth state before attempting upload
    if (!user || !session) {
      toast.error("You must be logged in to upload a logo. Please refresh and log in again.");
      return;
    }

    setUploading(true);
    try {
      console.log("Starting logo upload, user:", user.email);
      const fileExt = file.name.split('.').pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        console.error("Storage upload error:", uploadError);
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('company-logos')
        .getPublicUrl(filePath);

      // Update app_settings with logo URL
      const { error: updateError } = await supabase
        .from('app_settings')
        .update({ logo_url: publicUrl })
        .eq('id', appSettings?.id);

      if (updateError) {
        console.error("Settings update error:", updateError);
        console.error("This may be an RLS policy issue. User must have admin role.");
        
        // Check if it's an RLS error
        if (updateError.message?.includes('policy') || updateError.code === 'PGRST301') {
          toast.error("Permission denied. You must be an admin to update the logo.");
        } else {
          throw updateError;
        }
        return;
      }

      queryClient.invalidateQueries({ queryKey: ['app_settings'] });
      toast.success('Logo uploaded successfully');
    } catch (error: any) {
      console.error('Logo upload error:', error);
      toast.error(error.message || 'Failed to upload logo. Please check your permissions.');
    } finally {
      setUploading(false);
    }
  };

  const handleLogoRemove = async () => {
    // Check auth state before attempting removal
    if (!user || !session) {
      toast.error("You must be logged in to remove the logo. Please refresh and log in again.");
      return;
    }

    try {
      const { error } = await supabase
        .from('app_settings')
        .update({ logo_url: null })
        .eq('id', appSettings?.id);

      if (error) {
        console.error("Settings update error:", error);
        if (error.message?.includes('policy') || error.code === 'PGRST301') {
          toast.error("Permission denied. You must be an admin to remove the logo.");
        } else {
          throw error;
        }
        return;
      }

      queryClient.invalidateQueries({ queryKey: ['app_settings'] });
      toast.success('Logo removed successfully');
    } catch (error: any) {
      console.error('Logo remove error:', error);
      toast.error(error.message || 'Failed to remove logo. Please check your permissions.');
    }
  };

  const updateSettings = useMutation({
    mutationFn: async (values: SettingsFormValues) => {
      console.log("Updating settings with values:", values);
      console.log("Current user:", user?.email);
      
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
      
      if (error) {
        console.error("Settings update error:", error);
        console.error("This may be an RLS policy issue. User must have admin role.");
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app_settings"] });
      toast.success("Settings updated successfully");
    },
    onError: (error: any) => {
      console.error("Update settings mutation error:", error);
      if (error.message?.includes('policy') || error.code === 'PGRST301') {
        toast.error("Permission denied. You must be an admin to update settings.");
      } else {
        toast.error(error.message || "Failed to update settings. Please check your session and try again.");
      }
    },
  });


  // Show auth error if session refresh failed
  if (settingsError) {
    const errorMessage = settingsError?.message;
    const isAuthError = errorMessage?.includes('JWT') || errorMessage?.includes('auth') || errorMessage?.includes('policy');
    
    if (isAuthError) {
      return (
        <div className="space-y-6">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
            <p className="text-muted-foreground">Application configuration and preferences</p>
          </div>
          <Card className="shadow-card">
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  <h3 className="text-xl font-semibold">Authentication Error</h3>
                </div>
                <p className="text-muted-foreground">
                  Your session may have expired or you don't have permission to view this page.
                </p>
                <div className="bg-muted p-4 rounded-md">
                  <p className="text-sm font-mono">{errorMessage}</p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => {
                    supabase.auth.signOut();
                    navigate('/auth');
                  }}>
                    Log Out and Sign In Again
                  </Button>
                  <Button variant="outline" onClick={() => window.location.reload()}>
                    Refresh Page
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
          <p className="text-muted-foreground">Application configuration and preferences</p>
        </div>
        {sessionRefreshing && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Validating session...</span>
          </div>
        )}
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className={`grid w-full gap-1 h-auto ${isRestrictedStaff ? 'grid-cols-1 max-w-[200px]' : 'grid-cols-3 md:grid-cols-7'}`}>
          <TabsTrigger value="general">General</TabsTrigger>
          {!isRestrictedStaff && (
            <>
              <TabsTrigger value="payments">Payments</TabsTrigger>
              <TabsTrigger value="currency">Currency</TabsTrigger>
              <TabsTrigger value="emails">Emails</TabsTrigger>
              <TabsTrigger value="terms" className="text-xs md:text-sm">
                {isMobile ? "T&C" : "Terms & Conditions"}
              </TabsTrigger>
              <TabsTrigger value="policies">Policies</TabsTrigger>
              <TabsTrigger value="storage">Storage</TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="general" className="space-y-6 mt-6">

      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Change Password</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Form {...passwordForm}>
            <form onSubmit={passwordForm.handleSubmit(handlePasswordChange)} className="space-y-4">
              <FormField
                control={passwordForm.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Password</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={passwordForm.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Minimum 6 characters" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={passwordForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm New Password</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={changingPassword}>
                {changingPassword ? "Changing..." : "Change Password"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>


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
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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


      {/* Debug Panel for Admins */}
      {isMainAdmin && authDebugInfo && (
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-sm font-mono">Debug Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-xs font-mono">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="text-muted-foreground">Session Active:</div>
                <div className={authDebugInfo.hasSession ? "text-green-600" : "text-red-600"}>
                  {authDebugInfo.hasSession ? "✓ Yes" : "✗ No"}
                </div>
                
                <div className="text-muted-foreground">User ID:</div>
                <div className="truncate">{authDebugInfo.userId || "None"}</div>
                
                <div className="text-muted-foreground">Email:</div>
                <div className="truncate">{authDebugInfo.userEmail || "None"}</div>
                
                <div className="text-muted-foreground">Session Expires:</div>
                <div>{authDebugInfo.expiresAt ? new Date(authDebugInfo.expiresAt * 1000).toLocaleString() : "N/A"}</div>
                
                <div className="text-muted-foreground">Last Check:</div>
                <div>{new Date(authDebugInfo.timestamp).toLocaleTimeString()}</div>
              </div>
              {authDebugInfo.error && (
                <div className="mt-2 p-2 bg-destructive/10 rounded">
                  <div className="text-destructive">Error: {authDebugInfo.error}</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
        </TabsContent>

        <TabsContent value="payments" className="space-y-6 mt-6">
          {isMainAdmin && (
            <>
              <PaymentMethodsSettings />
              <BankAccountSettings />
            </>
          )}
        </TabsContent>

        <TabsContent value="currency" className="space-y-6 mt-6">
          {isMainAdmin && <CurrencyConversionSettings />}
        </TabsContent>

        <TabsContent value="emails" className="space-y-6 mt-6">
          {isMainAdmin && (
            <>
              <EmailBookingFormSettings />
              <EmailBankTransferSettings />
              <EmailPaymentConfirmationSettings />
              <EmailBalanceReminderSettings />
              <EmailSecurityDepositReminderSettings />
            </>
          )}
        </TabsContent>

        <TabsContent value="terms" className="space-y-6 mt-6">
          {isMainAdmin && <TermsAndConditionsSettings />}
        </TabsContent>

        <TabsContent value="policies" className="space-y-6 mt-6">
          {isMainAdmin && <RentalPoliciesSettings />}
        </TabsContent>

        <TabsContent value="storage" className="space-y-6 mt-6">
          {isMainAdmin && <StorageMonitor />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
