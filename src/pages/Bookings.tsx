import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, List, Calendar as CalendarIcon, Filter, Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { AddBookingDialog } from "@/components/AddBookingDialog";
import { BookingCalendar } from "@/components/BookingCalendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { QuickChatTrigger } from "@/components/chat/QuickChatTrigger";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type StatusFilter = 'active' | 'confirmed' | 'draft' | 'cancelled' | 'all';

export default function Bookings() {
  const queryClient = useQueryClient();
  const { isAdmin } = useAdminRole();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [selectedBookings, setSelectedBookings] = useState<Set<string>>(new Set());
  const [bulkCancelDialogOpen, setBulkCancelDialogOpen] = useState(false);
  const navigate = useNavigate();

  const { data: bookings, isLoading } = useQuery({
    queryKey: ["bookings"],
    queryFn: async () => {
      const { data: bookingsData, error } = await supabase
        .from("bookings")
        .select(`
          *,
          payments (
            id,
            amount,
            payment_link_status,
            paid_at,
            payment_intent
          ),
          client_invoices!inner (
            id,
            total_amount
          )
        `)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Fetch creator profiles for bookings that have created_by
      const creatorIds = [...new Set(bookingsData?.filter(b => b.created_by).map(b => b.created_by))];
      if (creatorIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, email, display_name")
          .in("id", creatorIds);
        
        // Map profiles to bookings
        const profilesMap = new Map(profilesData?.map(p => [p.id, p]));
        return bookingsData?.map(booking => ({
          ...booking,
          creator: booking.created_by ? profilesMap.get(booking.created_by) : null
        }));
      }
      
      return bookingsData;
    },
  });

  // Calculate actual amount paid excluding security deposits
  const calculateActualAmountPaid = (booking: any) => {
    // For imported bookings, use booking.amount_paid from the database
    if (booking.imported_from_email) {
      return Number(booking.amount_paid || 0);
    }
    
    // For normal bookings, calculate from payments table
    if (!booking.payments || booking.payments.length === 0) {
      return 0;
    }
    
    return booking.payments
      .filter((payment: any) => 
        payment.payment_link_status === 'paid' && 
        payment.paid_at !== null &&
        payment.payment_intent !== 'security_deposit'
      )
      .reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0);
  };

  const filteredBookings = bookings?.filter((booking) => {
    // Apply search filter
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = (
      booking.client_name.toLowerCase().includes(searchLower) ||
      booking.car_plate.toLowerCase().includes(searchLower) ||
      booking.reference_code.toLowerCase().includes(searchLower)
    );

    if (!matchesSearch) return false;

    // Apply status filter
    switch (statusFilter) {
      case 'active':
        return booking.status === 'confirmed' || booking.status === 'draft';
      case 'confirmed':
        return booking.status === 'confirmed';
      case 'draft':
        return booking.status === 'draft';
      case 'cancelled':
        return booking.status === 'cancelled';
      case 'all':
        return true;
      default:
        return true;
    }
  });

  const bulkCancelMutation = useMutation({
    mutationFn: async (bookingIds: string[]) => {
      const { error } = await supabase
        .from('bookings')
        .update({ 
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .in('id', bookingIds);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success(`Successfully moved ${selectedBookings.size} booking(s) to trash`);
      setBulkCancelDialogOpen(false);
      setSelectedBookings(new Set());
    },
    onError: (error) => {
      toast.error("Failed to move bookings to trash: " + error.message);
    },
  });

  const handleSelectAll = () => {
    if (selectedBookings.size === filteredBookings?.length) {
      setSelectedBookings(new Set());
    } else {
      setSelectedBookings(new Set(filteredBookings?.map(b => b.id) || []));
    }
  };

  const handleToggleSelect = (bookingId: string) => {
    const newSelected = new Set(selectedBookings);
    if (newSelected.has(bookingId)) {
      newSelected.delete(bookingId);
    } else {
      newSelected.add(bookingId);
    }
    setSelectedBookings(newSelected);
  };

  const handleBulkCancel = () => {
    if (selectedBookings.size > 0) {
      setBulkCancelDialogOpen(true);
    }
  };

  const confirmBulkCancel = () => {
    if (selectedBookings.size > 0) {
      bulkCancelMutation.mutate(Array.from(selectedBookings));
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline" | "warning" | "success"; className?: string }> = {
      draft: { variant: "warning" },
      confirmed: { variant: "success" },
      ongoing: { variant: "default" },
      completed: { variant: "success" },
      cancelled: { variant: "destructive" },
    };
    return variants[status] || { variant: "outline" };
  };

  if (isLoading) {
    return (
      <div className="space-y-4 md:space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Card className="shadow-card">
          <CardContent className="p-6">
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Bookings</h2>
          <p className="text-sm md:text-base text-muted-foreground">Manage your rental reservations</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && selectedBookings.size > 0 && (
            <Button
              variant="destructive"
              onClick={handleBulkCancel}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Move to Trash ({selectedBookings.size})
            </Button>
          )}
          <AddBookingDialog />
        </div>
      </div>

      {isAdmin && selectedBookings.size > 0 && (
        <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
          <Checkbox
            checked={selectedBookings.size === filteredBookings?.length}
            onCheckedChange={handleSelectAll}
          />
          <span className="text-sm font-medium">
            {selectedBookings.size} of {filteredBookings?.length} selected
          </span>
        </div>
      )}

      <Tabs defaultValue="list" className="space-y-4">
        <TabsList>
          <TabsTrigger value="list" className="gap-2">
            <List className="h-4 w-4" />
            List View
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-2">
            <CalendarIcon className="h-4 w-4" />
            Calendar View
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <Card className="shadow-card">
            <CardHeader className="px-4 md:px-6">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex items-center gap-2 flex-1">
                  <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <Input
                    placeholder="Search by client, plate, or reference..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <Select value={statusFilter} onValueChange={(value: StatusFilter) => setStatusFilter(value)}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Confirmed + Draft</SelectItem>
                      <SelectItem value="confirmed">Confirmed Only</SelectItem>
                      <SelectItem value="draft">Draft Only</SelectItem>
                      <SelectItem value="cancelled">Cancelled Only</SelectItem>
                      <SelectItem value="all">All Bookings</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-4 md:px-6">
              <div className="space-y-4">
                {filteredBookings && filteredBookings.length > 0 ? (
                  filteredBookings.map((booking) => (
                    <div
                      key={booking.id}
                      className={`flex items-center gap-3 p-4 md:p-5 border rounded-lg hover:shadow-card hover:border-accent transition-all group ${
                        selectedBookings.has(booking.id) ? 'ring-2 ring-primary' : ''
                      }`}
                    >
                      {isAdmin && (
                        <Checkbox
                          checked={selectedBookings.has(booking.id)}
                          onCheckedChange={() => handleToggleSelect(booking.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}
                      <div 
                        className="flex-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 cursor-pointer"
                        onClick={() => navigate(`/bookings/${booking.id}`)}
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm md:text-base break-words">{booking.reference_code}</span>
                            <Badge {...getStatusBadge(booking.status)}>
                              {booking.status.replace('_', ' ')}
                            </Badge>
                            {booking.status === 'confirmed' && booking.payments?.some((p: any) => 
                              p.payment_link_status === 'pending' && p.payment_intent !== 'security_deposit'
                            ) && (
                              <Badge variant="secondary" className="bg-orange-50 text-orange-700 border-orange-200">
                                Pending Payment
                              </Badge>
                            )}
                            {booking.imported_from_email && (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                <Mail className="w-3 h-3 mr-1" />
                                Imported
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs md:text-sm text-muted-foreground break-words">
                            {booking.client_name}
                            {booking.original_client_name && booking.client_name !== booking.original_client_name && (
                              <span className="text-xs text-muted-foreground/70 ml-1">
                                (Original: {booking.original_client_name})
                              </span>
                            )}
                            {' • '}
                            {booking.car_model} ({booking.car_plate})
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(booking.delivery_datetime), "PP")} - {format(new Date(booking.collection_datetime), "PP")}
                          </div>
                          {(booking as any).creator && (
                            <div className="text-[10px] text-muted-foreground/60 mt-1">
                              Created by: {(booking as any).creator.display_name || (booking as any).creator.email}
                            </div>
                          )}
                        </div>
                        <div className="text-left sm:text-right flex-shrink-0">
                          <div className="font-semibold text-sm md:text-base">
                            €{(booking.imported_from_email
                              ? (booking.client_invoices?.reduce((sum: number, inv: any) => sum + Number(inv.total_amount), 0) || 0)
                              : Number(booking.rental_price_gross)
                            ).toLocaleString()}
                          </div>
                          <div className="text-xs md:text-sm text-muted-foreground">
                            Paid: €{Number(calculateActualAmountPaid(booking)).toLocaleString()}
                            <span className="block text-[10px] italic mt-0.5">
                              (excl. security deposit)
                            </span>
                          </div>
                        </div>
                      </div>
                      <QuickChatTrigger 
                        context={{ 
                          type: 'booking', 
                          id: booking.id,
                          name: `${booking.reference_code} - ${booking.client_name}`
                        }} 
                      />
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    {searchTerm ? "No bookings found matching your search" : "No bookings yet"}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calendar">
          {bookings && <BookingCalendar bookings={bookings} />}
        </TabsContent>
      </Tabs>

      {/* Bulk Cancel Dialog */}
      <AlertDialog open={bulkCancelDialogOpen} onOpenChange={setBulkCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Move Bookings to Trash
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>
                You are about to move {selectedBookings.size} booking(s) to trash. This will change their status to "Cancelled".
              </p>
              <p className="text-sm text-muted-foreground">
                You can restore them later from the Trash page.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBulkCancel} className="bg-destructive hover:bg-destructive/90">
              Move to Trash
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
