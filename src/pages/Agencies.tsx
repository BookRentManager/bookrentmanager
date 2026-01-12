import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Plus, Search, Building2, Pencil, Trash2, Phone, Mail, MapPin, User, FileText, DollarSign, Clock, AlertCircle, ChevronRight, Receipt, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useUserViewScope } from "@/hooks/useUserViewScope";
import { useNavigate } from "react-router-dom";
import { AddAgencyInvoiceDialog } from "@/components/AddAgencyInvoiceDialog";
import { AgencyInvoiceTreatment } from "@/components/AgencyInvoiceTreatment";
import { format } from "date-fns";

interface Agency {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  contact_person: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

interface AgencyFormData {
  name: string;
  email: string;
  phone: string;
  address: string;
  contact_person: string;
  notes: string;
  is_active: boolean;
}

interface AgencyStats {
  total_bookings: number;
  active_bookings: number;
  total_revenue: number;
  pending_payments: number;
  total_commission: number;
  paid_commission: number;
}

interface AgencyBooking {
  id: string;
  reference_code: string;
  car_model: string;
  car_plate: string;
  delivery_datetime: string;
  collection_datetime: string;
  amount_total: number;
  status: string;
}

interface AgencyInvoice {
  id: string;
  issue_date: string;
  amount: number;
  amount_paid: number | null;
  payment_status: string;
  invoice_url: string | null;
  payment_proof_url: string | null;
  booking_id: string | null;
  notes: string | null;
  booking?: { reference_code: string } | null;
}

const initialFormData: AgencyFormData = {
  name: "",
  email: "",
  phone: "",
  address: "",
  contact_person: "",
  notes: "",
  is_active: true,
};

export default function Agencies() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { isAdmin } = useAdminRole();
  const { isReadOnly } = useUserViewScope();
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingAgency, setEditingAgency] = useState<Agency | null>(null);
  const [deletingAgency, setDeletingAgency] = useState<Agency | null>(null);
  const [formData, setFormData] = useState<AgencyFormData>(initialFormData);
  const [selectedAgency, setSelectedAgency] = useState<Agency | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  const { data: agencies, isLoading } = useQuery({
    queryKey: ["agencies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agencies")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;
      return data as Agency[];
    },
  });

  // Fetch booking statistics for all agencies
  const { data: agencyStats } = useQuery({
    queryKey: ["agency-stats"],
    queryFn: async () => {
      const [bookingsRes, invoicesRes] = await Promise.all([
        supabase
          .from("bookings")
          .select("id, agency_id, agency_name, status, amount_total, amount_paid")
          .is("deleted_at", null)
          .eq("booking_type", "agency"),
        supabase
          .from("agency_invoices")
          .select("agency_id, amount, amount_paid, payment_status")
          .is("deleted_at", null),
      ]);

      if (bookingsRes.error) throw bookingsRes.error;
      if (invoicesRes.error) throw invoicesRes.error;

      const statsMap: Record<string, AgencyStats> = {};
      
      bookingsRes.data?.forEach(booking => {
        const agencyId = booking.agency_id;
        if (!agencyId) return;
        
        if (!statsMap[agencyId]) {
          statsMap[agencyId] = {
            total_bookings: 0,
            active_bookings: 0,
            total_revenue: 0,
            pending_payments: 0,
            total_commission: 0,
            paid_commission: 0,
          };
        }
        
        statsMap[agencyId].total_bookings += 1;
        
        if (booking.status === 'draft' || booking.status === 'confirmed' || booking.status === 'ongoing') {
          statsMap[agencyId].active_bookings += 1;
        }
        
        if (booking.status === 'confirmed' || booking.status === 'ongoing' || booking.status === 'completed') {
          statsMap[agencyId].total_revenue += Number(booking.amount_total || 0);
          const remaining = Number(booking.amount_total || 0) - Number(booking.amount_paid || 0);
          if (remaining > 0) {
            statsMap[agencyId].pending_payments += remaining;
          }
        }
      });

      // Add commission stats from invoices
      invoicesRes.data?.forEach(invoice => {
        const agencyId = invoice.agency_id;
        if (!agencyId) return;

        if (!statsMap[agencyId]) {
          statsMap[agencyId] = {
            total_bookings: 0,
            active_bookings: 0,
            total_revenue: 0,
            pending_payments: 0,
            total_commission: 0,
            paid_commission: 0,
          };
        }

        statsMap[agencyId].total_commission += Number(invoice.amount || 0);
        statsMap[agencyId].paid_commission += Number(invoice.amount_paid || 0);
      });
      
      return statsMap;
    },
  });

  // Fetch bookings for selected agency
  const { data: agencyBookings, isLoading: bookingsLoading } = useQuery({
    queryKey: ["agency-bookings", selectedAgency?.id],
    queryFn: async () => {
      if (!selectedAgency) return [];
      const { data, error } = await supabase
        .from("bookings")
        .select("id, reference_code, car_model, car_plate, delivery_datetime, collection_datetime, amount_total, status")
        .eq("agency_id", selectedAgency.id)
        .is("deleted_at", null)
        .order("delivery_datetime", { ascending: false });

      if (error) throw error;
      return data as AgencyBooking[];
    },
    enabled: !!selectedAgency,
  });

  // Fetch invoices for selected agency
  const { data: agencyInvoices, isLoading: invoicesLoading } = useQuery({
    queryKey: ["agency-invoices", selectedAgency?.id],
    queryFn: async () => {
      if (!selectedAgency) return [];
      const { data, error } = await supabase
        .from("agency_invoices")
        .select("*, booking:bookings(reference_code)")
        .eq("agency_id", selectedAgency.id)
        .is("deleted_at", null)
        .order("issue_date", { ascending: false });

      if (error) throw error;
      return data as AgencyInvoice[];
    },
    enabled: !!selectedAgency,
  });

  const createAgencyMutation = useMutation({
    mutationFn: async (data: AgencyFormData) => {
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("agencies")
        .insert({
          name: data.name,
          email: data.email || null,
          phone: data.phone || null,
          address: data.address || null,
          contact_person: data.contact_person || null,
          notes: data.notes || null,
          is_active: data.is_active,
          created_by: user.user?.id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agencies"] });
      toast.success("Agency created successfully");
      handleCloseDialog();
    },
    onError: (error) => {
      toast.error("Failed to create agency: " + error.message);
    },
  });

  const updateAgencyMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: AgencyFormData }) => {
      const { error } = await supabase
        .from("agencies")
        .update({
          name: data.name,
          email: data.email || null,
          phone: data.phone || null,
          address: data.address || null,
          contact_person: data.contact_person || null,
          notes: data.notes || null,
          is_active: data.is_active,
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agencies"] });
      toast.success("Agency updated successfully");
      handleCloseDialog();
    },
    onError: (error) => {
      toast.error("Failed to update agency: " + error.message);
    },
  });

  const deleteAgencyMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("agencies")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agencies"] });
      toast.success("Agency deleted successfully");
      setDeleteDialogOpen(false);
      setDeletingAgency(null);
    },
    onError: (error) => {
      toast.error("Failed to delete agency: " + error.message);
    },
  });

  const handleOpenDialog = (agency?: Agency) => {
    if (agency) {
      setEditingAgency(agency);
      setFormData({
        name: agency.name,
        email: agency.email || "",
        phone: agency.phone || "",
        address: agency.address || "",
        contact_person: agency.contact_person || "",
        notes: agency.notes || "",
        is_active: agency.is_active,
      });
    } else {
      setEditingAgency(null);
      setFormData(initialFormData);
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingAgency(null);
    setFormData(initialFormData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Agency name is required");
      return;
    }

    if (editingAgency) {
      updateAgencyMutation.mutate({ id: editingAgency.id, data: formData });
    } else {
      createAgencyMutation.mutate(formData);
    }
  };

  const handleDelete = (agency: Agency) => {
    setDeletingAgency(agency);
    setDeleteDialogOpen(true);
  };

  const handleAgencyClick = (agency: Agency) => {
    setSelectedAgency(agency);
    setDetailDialogOpen(true);
  };

  const filteredAgencies = agencies?.filter((agency) =>
    agency.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agency.contact_person?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agency.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR" }).format(amount);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <Badge variant="success">Confirmed</Badge>;
      case 'completed':
        return <Badge variant="secondary">Completed</Badge>;
      case 'ongoing':
        return <Badge variant="default">Ongoing</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
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
              {[...Array(3)].map((_, i) => (
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
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Agencies</h2>
          <p className="text-sm md:text-base text-muted-foreground">
            Manage partner agencies for bookings
          </p>
        </div>
        {!isReadOnly && (
          <Button onClick={() => handleOpenDialog()} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Agency
          </Button>
        )}
      </div>

      <Card className="shadow-card">
        <CardHeader className="px-4 md:px-6">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search agencies..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent className="px-4 md:px-6">
          <div className="space-y-4">
            {filteredAgencies && filteredAgencies.length > 0 ? (
              filteredAgencies.map((agency) => {
                const stats = agencyStats?.[agency.id];
                
                return (
                  <div
                    key={agency.id}
                    className="flex flex-col gap-4 p-4 border rounded-lg hover:shadow-card hover:border-primary/30 transition-all cursor-pointer"
                    onClick={() => handleAgencyClick(agency)}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Building2 className="h-4 w-4 text-purple-600" />
                          <span className="font-semibold text-base">{agency.name}</span>
                          <Badge variant={agency.is_active ? "success" : "secondary"}>
                            {agency.is_active ? "Active" : "Inactive"}
                          </Badge>
                          <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-sm text-muted-foreground">
                          {agency.contact_person && (
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {agency.contact_person}
                            </div>
                          )}
                          {agency.email && (
                            <div className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {agency.email}
                            </div>
                          )}
                          {agency.phone && (
                            <div className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {agency.phone}
                            </div>
                          )}
                          {agency.address && (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {agency.address}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenDialog(agency)}
                          className="gap-1"
                        >
                          <Pencil className="h-3 w-3" />
                          Edit
                        </Button>
                        {isAdmin && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(agency)}
                            className="gap-1 text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-3 w-3" />
                            Delete
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    {/* Booking Statistics */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 border-t">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{stats?.total_bookings || 0}</p>
                          <p className="text-xs text-muted-foreground">Total Bookings</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-blue-600" />
                        <div>
                          <p className="text-sm font-medium">{stats?.active_bookings || 0}</p>
                          <p className="text-xs text-muted-foreground">Active</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-green-600" />
                        <div>
                          <p className="text-sm font-medium">{formatCurrency(stats?.total_revenue || 0)}</p>
                          <p className="text-xs text-muted-foreground">Revenue</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-orange-600" />
                        <div>
                          <p className="text-sm font-medium">{formatCurrency(stats?.pending_payments || 0)}</p>
                          <p className="text-xs text-muted-foreground">Pending</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Receipt className="h-4 w-4 text-purple-600" />
                        <div>
                          <p className="text-sm font-medium">{formatCurrency(stats?.total_commission || 0)}</p>
                          <p className="text-xs text-muted-foreground">Commission</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                {searchTerm ? "No agencies found matching your search" : "No agencies yet"}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Agency Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-purple-600" />
              {selectedAgency?.name}
            </DialogTitle>
          </DialogHeader>

          {selectedAgency && (
            <Tabs defaultValue="bookings" className="w-full">
              <div className="flex items-center justify-between mb-4">
                <TabsList>
                  <TabsTrigger value="bookings" className="gap-2">
                    <FileText className="h-4 w-4" />
                    Bookings ({agencyBookings?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger value="invoices" className="gap-2">
                    <Receipt className="h-4 w-4" />
                    Invoices ({agencyInvoices?.length || 0})
                  </TabsTrigger>
                </TabsList>
                <AddAgencyInvoiceDialog 
                  agencyId={selectedAgency.id} 
                  agencyName={selectedAgency.name} 
                />
              </div>

              <TabsContent value="bookings" className="space-y-3">
                {bookingsLoading ? (
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : agencyBookings && agencyBookings.length > 0 ? (
                  agencyBookings.map((booking) => (
                    <div
                      key={booking.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                      onClick={() => {
                        setDetailDialogOpen(false);
                        navigate(`/bookings/${booking.id}`);
                      }}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{booking.reference_code}</span>
                          {getStatusBadge(booking.status)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {booking.car_model} ({booking.car_plate})
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(booking.delivery_datetime), "dd MMM yyyy")} - {format(new Date(booking.collection_datetime), "dd MMM yyyy")}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-medium">{formatCurrency(booking.amount_total)}</span>
                        <ExternalLink className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No bookings for this agency yet
                  </div>
                )}
              </TabsContent>

              <TabsContent value="invoices" className="space-y-3">
                {invoicesLoading ? (
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : agencyInvoices && agencyInvoices.length > 0 ? (
                  agencyInvoices.map((invoice) => (
                    <Card key={invoice.id} className="p-4">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{formatCurrency(invoice.amount)}</span>
                            <Badge variant={invoice.payment_status === 'paid' ? 'success' : 'warning'}>
                              {invoice.payment_status === 'paid' ? 'Paid' : 'To Pay'}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Issue Date: {format(new Date(invoice.issue_date), "dd MMM yyyy")}
                          </p>
                          {invoice.booking && (
                            <p className="text-sm text-muted-foreground">
                              Linked to: {invoice.booking.reference_code}
                            </p>
                          )}
                          {invoice.notes && (
                            <p className="text-sm text-muted-foreground italic">{invoice.notes}</p>
                          )}
                        </div>
                        <div className="w-full sm:w-auto">
                          <AgencyInvoiceTreatment 
                            invoice={invoice} 
                            agencyId={selectedAgency.id} 
                          />
                        </div>
                      </div>
                    </Card>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No commission invoices for this agency yet
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingAgency ? "Edit Agency" : "Add New Agency"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Agency Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Agency name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_person">Contact Person</Label>
              <Input
                id="contact_person"
                value={formData.contact_person}
                onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                placeholder="Contact person name"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@agency.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+41 79 123 45 67"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Agency address"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes about this agency..."
                className="min-h-20"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="is_active">Active</Label>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createAgencyMutation.isPending || updateAgencyMutation.isPending}
              >
                {createAgencyMutation.isPending || updateAgencyMutation.isPending
                  ? "Saving..."
                  : editingAgency
                  ? "Update Agency"
                  : "Add Agency"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Agency</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingAgency?.name}"? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingAgency && deleteAgencyMutation.mutate(deletingAgency.id)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
