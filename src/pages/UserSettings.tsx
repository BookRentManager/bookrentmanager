import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Upload, Loader2, TrendingUp, Calendar, DollarSign, BarChart3 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserViewScope } from "@/hooks/useUserViewScope";

export default function UserSettings() {
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState("");
  const [uploading, setUploading] = useState(false);
  const { isReadOnly } = useUserViewScope();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      setDisplayName(data.display_name || "");
      return data;
    },
  });

  // Fetch user's personal statistics
  const { data: myStats, isLoading: statsLoading } = useQuery({
    queryKey: ["my-statistics", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;
      
      // Fetch bookings created by this user
      const { data: myBookings, error: bookingsError } = await supabase
        .from("bookings")
        .select("*")
        .eq("created_by", profile.id)
        .is("deleted_at", null);
      
      if (bookingsError) throw bookingsError;
      
      // Fetch financials for these bookings
      const bookingIds = myBookings?.map(b => b.id) || [];
      
      let myFinancials: any[] = [];
      if (bookingIds.length > 0) {
        const { data } = await supabase
          .from("booking_financials")
          .select("*")
          .in("id", bookingIds);
        myFinancials = data || [];
      }
      
      // Calculate statistics
      const confirmedCount = myBookings?.filter(b => b.status === 'confirmed').length || 0;
      const draftCount = myBookings?.filter(b => b.status === 'draft').length || 0;
      const cancelledCount = myBookings?.filter(b => b.status === 'cancelled').length || 0;
      
      const activeBookings = myBookings?.filter(b => 
        b.status === 'confirmed' || b.status === 'ongoing' || b.status === 'completed'
      ) || [];
      
      const activeFinancials = myFinancials?.filter(f => 
        activeBookings.some(b => b.id === f.id)
      ) || [];
      
      const revenueExpected = activeFinancials.reduce((sum, f) => 
        sum + Number(f.amount_total || 0), 0);
      
      const revenueReceived = activeBookings.reduce((sum, b) => 
        sum + Number(b.amount_paid || 0), 0);
      
      const commissionGross = activeFinancials.reduce((sum, f) => 
        sum + Number(f.commission_net || 0), 0);
      
      const commissionNet = activeBookings.reduce((sum, b) => {
        const financial = activeFinancials.find(f => f.id === b.id);
        const extraDeduction = Number(b.extra_deduction || 0);
        return sum + Number(financial?.commission_net || 0) - extraDeduction;
      }, 0);
      
      return {
        totalBookings: myBookings?.length || 0,
        confirmedCount,
        draftCount,
        cancelledCount,
        revenueExpected,
        revenueReceived,
        commissionGross,
        commissionNet,
      };
    },
    enabled: !!profile?.id,
  });

  const updateProfile = useMutation({
    mutationFn: async (updates: { display_name?: string; avatar_url?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Profile updated successfully");
    },
    onError: (error) => {
      toast.error("Failed to update profile: " + error.message);
    },
  });

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("File size must be less than 2MB");
      return;
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const fileExt = file.name.split(".").pop();
      const filePath = `${user.id}/avatar.${fileExt}`;

      // Delete old avatar if exists
      if (profile?.avatar_url) {
        const oldPath = profile.avatar_url.split("/").slice(-2).join("/");
        await supabase.storage.from("avatars").remove([oldPath]);
      }

      // Upload new avatar
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      // Update profile with new avatar URL
      await updateProfile.mutateAsync({ avatar_url: publicUrl });
    } catch (error: any) {
      toast.error("Failed to upload avatar: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSaveDisplayName = () => {
    updateProfile.mutate({ display_name: displayName.trim() || null });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const initials = (displayName || profile?.email || "U")
    .split(/[\s@]/)[0]
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">User Settings</h1>
        <p className="text-sm md:text-base text-muted-foreground">Manage your profile and preferences</p>
      </div>

      {/* My Statistics Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            My Statistics
          </CardTitle>
          <CardDescription>
            Performance overview for bookings you created
          </CardDescription>
        </CardHeader>
        <CardContent>
          {statsLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
              {/* Confirmed Bookings */}
              <div className="p-3 md:p-4 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="text-xl md:text-2xl font-bold">{myStats?.confirmedCount || 0}</div>
                <div className="text-xs md:text-sm text-muted-foreground">Confirmed</div>
                <div className="text-[10px] md:text-xs text-muted-foreground mt-1">
                  Draft: {myStats?.draftCount || 0} | Cancelled: {myStats?.cancelledCount || 0}
                </div>
              </div>
              
              {/* Total Bookings */}
              <div className="p-3 md:p-4 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="text-xl md:text-2xl font-bold">{myStats?.totalBookings || 0}</div>
                <div className="text-xs md:text-sm text-muted-foreground">Total Bookings</div>
              </div>
              
              {/* Revenue Expected */}
              <div className="p-3 md:p-4 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="text-xl md:text-2xl font-bold">
                  €{(myStats?.revenueExpected || 0).toLocaleString()}
                </div>
                <div className="text-xs md:text-sm text-muted-foreground">Revenue Expected</div>
              </div>
              
              {/* Revenue Received */}
              <div className="p-3 md:p-4 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-primary" />
                </div>
                <div className="text-xl md:text-2xl font-bold text-primary">
                  €{(myStats?.revenueReceived || 0).toLocaleString()}
                </div>
                <div className="text-xs md:text-sm text-muted-foreground">Revenue Received</div>
              </div>
              
              {/* Commission Gross */}
              <div className="p-3 md:p-4 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="text-xl md:text-2xl font-bold">
                  €{(myStats?.commissionGross || 0).toLocaleString()}
                </div>
                <div className="text-xs md:text-sm text-muted-foreground">Commission (Gross)</div>
              </div>
              
              {/* Commission Net */}
              <div className="p-3 md:p-4 rounded-lg border bg-green-50 dark:bg-green-950/30">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                </div>
                <div className="text-xl md:text-2xl font-bold text-green-600">
                  €{(myStats?.commissionNet || 0).toLocaleString()}
                </div>
                <div className="text-xs md:text-sm text-muted-foreground">Commission (Net)</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>
            Update your display name and avatar. This is how you'll appear in chat messages.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar Section */}
          <div className="flex items-center gap-4 md:gap-6">
            <Avatar className="h-16 w-16 md:h-20 md:w-20">
              {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={displayName} />}
              <AvatarFallback className="text-xl md:text-2xl">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              {!isReadOnly && (
                <>
                  <Label htmlFor="avatar-upload" className="cursor-pointer">
                    <Button variant="outline" disabled={uploading} asChild>
                      <span>
                        {uploading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="mr-2 h-4 w-4" />
                            Upload Avatar
                          </>
                        )}
                      </span>
                    </Button>
                  </Label>
                  <input
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                    disabled={uploading}
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    JPG, PNG or WEBP. Max 2MB.
                  </p>
                </>
              )}
              {isReadOnly && (
                <p className="text-xs text-muted-foreground">
                  Avatar changes disabled for read-only users
                </p>
              )}
            </div>
          </div>

          {/* Display Name Section */}
          <div className="space-y-2">
            <Label htmlFor="display-name">Display Name</Label>
            <div className="flex gap-2">
              <Input
                id="display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter your display name"
                maxLength={50}
                disabled={isReadOnly}
              />
              {!isReadOnly && (
                <Button 
                  onClick={handleSaveDisplayName}
                  disabled={updateProfile.isPending || displayName === (profile?.display_name || "")}
                >
                  {updateProfile.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save"
                  )}
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Leave empty to use your email address
            </p>
          </div>

          {/* Email (Read-only) */}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={profile?.email || ""} disabled />
          </div>

          {/* Chat Preview */}
          <div className="space-y-2">
            <Label>Chat Preview</Label>
            <Card className="p-4">
              <div className="flex gap-3">
                <Avatar className="h-8 w-8 shrink-0">
                  {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={displayName} />}
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start max-w-[70%]">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">
                      {displayName || profile?.email || "Unknown User"}
                    </span>
                    <span className="text-xs text-muted-foreground">just now</span>
                  </div>
                  <div className="rounded-lg px-4 py-2 bg-primary text-primary-foreground">
                    <p className="text-sm">This is how you appear in chat</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
