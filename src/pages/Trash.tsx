import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2, RotateCcw, Search, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";

export default function Trash() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: cancelledBookings, isLoading } = useQuery({
    queryKey: ["cancelled-bookings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("status", "cancelled")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await supabase
        .from("bookings")
        .update({ status: "draft" })
        .eq("id", bookingId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cancelled-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success("Booking restored successfully");
      setRestoreDialogOpen(false);
      setSelectedBooking(null);
    },
    onError: (error) => {
      toast.error("Failed to restore booking: " + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await supabase
        .from("bookings")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", bookingId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cancelled-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success("Booking permanently deleted");
      setDeleteDialogOpen(false);
      setSelectedBooking(null);
      setConfirmDelete(false);
    },
    onError: (error) => {
      toast.error("Failed to delete booking: " + error.message);
    },
  });

  const filteredBookings = cancelledBookings?.filter((booking) =>
    booking.reference_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    booking.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    booking.car_model.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalCancelledValue = cancelledBookings?.reduce(
    (sum, b) => sum + Number(b.amount_total || 0),
    0
  ) || 0;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  const handleRestore = (booking: any) => {
    setSelectedBooking(booking);
    setRestoreDialogOpen(true);
  };

  const handleDelete = (booking: any) => {
    setSelectedBooking(booking);
    setDeleteDialogOpen(true);
    setConfirmDelete(false);
  };

  const confirmRestore = () => {
    if (selectedBooking) {
      restoreMutation.mutate(selectedBooking.id);
    }
  };

  const confirmPermanentDelete = () => {
    if (selectedBooking && confirmDelete) {
      deleteMutation.mutate(selectedBooking.id);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Trash</h2>
        <p className="text-muted-foreground">
          Manage cancelled bookings - restore or permanently delete
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Cancelled Bookings</CardTitle>
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cancelledBookings?.length || 0}</div>
            <p className="text-xs text-muted-foreground">In trash</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Cancelled Value</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalCancelledValue)}</div>
            <p className="text-xs text-muted-foreground">Revenue lost</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Table */}
      <Card>
        <CardHeader>
          <CardTitle>Cancelled Bookings</CardTitle>
          <CardDescription>
            Restore bookings to draft status or permanently delete them
          </CardDescription>
          <div className="flex items-center gap-2 pt-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by reference, client, or car..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          {!filteredBookings || filteredBookings.length === 0 ? (
            <div className="text-center py-12">
              <Trash2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Trash is empty</h3>
              <p className="text-muted-foreground">
                No cancelled bookings found
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Car Model</TableHead>
                  <TableHead>Cancelled Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBookings.map((booking) => (
                  <TableRow key={booking.id}>
                    <TableCell className="font-medium">
                      {booking.reference_code}
                    </TableCell>
                    <TableCell>{booking.client_name}</TableCell>
                    <TableCell>{booking.car_model}</TableCell>
                    <TableCell>
                      {format(new Date(booking.updated_at), "MMM dd, yyyy")}
                    </TableCell>
                    <TableCell>{formatCurrency(booking.amount_total || 0)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRestore(booking)}
                          className="gap-2"
                        >
                          <RotateCcw className="h-4 w-4" />
                          Restore
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(booking)}
                          className="gap-2"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Restore Dialog */}
      <AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Booking</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to restore this booking? It will be changed to "Draft" status
              and will appear in your active bookings list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRestore}>
              Restore Booking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Permanently Delete Booking
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>
                This will permanently remove this booking from your system. This action cannot be undone.
              </p>
              <p className="font-semibold">
                Booking: {selectedBooking?.reference_code} - {selectedBooking?.client_name}
              </p>
              <div className="flex items-center space-x-2 pt-4">
                <Checkbox
                  id="confirm"
                  checked={confirmDelete}
                  onCheckedChange={(checked) => setConfirmDelete(checked as boolean)}
                />
                <label
                  htmlFor="confirm"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  I understand this cannot be undone
                </label>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={confirmPermanentDelete}
              disabled={!confirmDelete}
            >
              Permanently Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
