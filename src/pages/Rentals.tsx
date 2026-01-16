import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertCircle, FileText, Camera, Car, Search, CalendarIcon, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import { format, isToday } from "date-fns";
import { QuickChatTrigger } from "@/components/chat/QuickChatTrigger";
import { Skeleton } from "@/components/ui/skeleton";
import { DateRange } from "react-day-picker";

export default function Rentals() {
  const [filter, setFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  const { data: rentals, isLoading } = useQuery({
    queryKey: ["rentals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(`
          *,
          booking_documents(id, document_type),
          extra_cost_approvals(id, booking_document_id)
        `)
        .in('status', ['confirmed', 'ongoing', 'completed'])
        .is('deleted_at', null)
        .order('delivery_datetime', { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });

  const getRentalIndicators = (rental: any) => {
    const deliveryContract = rental.booking_documents?.filter(
      (d: any) => d.document_type === 'rental_contract_delivery'
    ).length || 0;
    
    const collectionContract = rental.booking_documents?.filter(
      (d: any) => d.document_type === 'rental_contract_collection'
    ).length || 0;
    
    const deliveryPhotos = rental.booking_documents?.filter(
      (d: any) => d.document_type === 'car_condition_delivery_photo'
    ).length || 0;
    
    const collectionPhotos = rental.booking_documents?.filter(
      (d: any) => d.document_type === 'car_condition_collection_photo'
    ).length || 0;
    
    const unapprovedCosts = rental.booking_documents?.filter(
      (d: any) => d.document_type === 'extra_cost_invoice' && 
           !rental.extra_cost_approvals?.some((a: any) => a.booking_document_id === d.id)
    ).length || 0;
    
    return {
      deliveryContract,
      collectionContract,
      deliveryPhotos,
      collectionPhotos,
      unapprovedCosts,
      needsAttention: !deliveryContract || !collectionContract || unapprovedCosts > 0
    };
  };

  const getRentalStatus = (rental: any) => {
    const now = new Date();
    const deliveryDate = new Date(rental.delivery_datetime);
    
    // Check if delivery contract is signed
    const hasDeliveryContract = rental.booking_documents?.some(
      (d: any) => d.document_type === 'rental_contract_delivery'
    );
    
    // Check if collection contract is signed
    const hasCollectionContract = rental.booking_documents?.some(
      (d: any) => d.document_type === 'rental_contract_collection'
    );
    
    // Completed: collection contract signed
    if (hasCollectionContract) {
      return 'Completed';
    }
    
    // Pending Collection: delivery done, collection approaching or overdue
    if (hasDeliveryContract || now >= deliveryDate) {
      return 'Pending Collection';
    }
    
    // Pending Delivery: confirmed, delivery not yet happened
    if (now < deliveryDate) {
      return 'Pending Delivery';
    }
    
    return 'Pending Delivery'; // Default
  };

  const filteredRentals = rentals?.filter((r) => {
    const status = getRentalStatus(r);
    
    // Status filter
    if (filter === "pending_delivery" && status !== 'Pending Delivery') return false;
    if (filter === "active" && status !== 'Pending Collection') return false;
    if (filter === "pending_collection" && status !== 'Pending Collection') return false;
    if (filter === "completed" && status !== 'Completed') return false;
    if (filter === "needs_attention") {
      // Exclude imported bookings from attention filter
      if (r.imported_from_email) return false;
      if (!getRentalIndicators(r).needsAttention) return false;
    }
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        r.reference_code?.toLowerCase().includes(query) ||
        r.client_name?.toLowerCase().includes(query) ||
        r.car_plate?.toLowerCase().includes(query) ||
        r.car_model?.toLowerCase().includes(query) ||
        r.client_email?.toLowerCase().includes(query) ||
        r.client_phone?.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }
    
    // Date range filter (checks if rental period overlaps with filter range)
    if (dateRange?.from || dateRange?.to) {
      const deliveryDate = new Date(r.delivery_datetime);
      const collectionDate = new Date(r.collection_datetime);
      
      if (dateRange.from && collectionDate < dateRange.from) return false;
      if (dateRange.to && deliveryDate > dateRange.to) return false;
    }
    
    return true;
  });

  const activeRentals = rentals?.filter(r => getRentalStatus(r) === 'Pending Collection') || [];
  const deliveriesToday = rentals?.filter(r => {
    const status = getRentalStatus(r);
    return status === 'Pending Delivery' && 
           r.delivery_datetime && 
           isToday(new Date(r.delivery_datetime));
  }) || [];
  const collectionsToday = rentals?.filter(r => {
    const status = getRentalStatus(r);
    return status === 'Pending Collection' && 
           r.collection_datetime && 
           isToday(new Date(r.collection_datetime));
  }) || [];
  // Exclude imported bookings from needs attention count
  const needsAttention = rentals?.filter(r => 
    !r.imported_from_email && getRentalIndicators(r).needsAttention
  ) || [];

  const clearFilters = () => {
    setSearchQuery("");
    setDateRange(undefined);
  };

  const hasActiveFilters = searchQuery || dateRange?.from;

  if (isLoading) {
    return (
      <div className="space-y-4 md:space-y-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Rentals</h2>
          <p className="text-sm md:text-base text-muted-foreground">
            Manage rental operations and documentation
          </p>
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-48" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Rentals</h2>
        <p className="text-sm md:text-base text-muted-foreground">
          Manage rental operations and documentation
        </p>
      </div>

      {/* Subtle inline summary bar */}
      <div className="flex items-center gap-4 px-4 py-2.5 bg-muted/50 rounded-lg text-sm flex-wrap">
        <span className="text-muted-foreground">{activeRentals.length} active</span>
        <span className="text-muted-foreground hidden sm:inline">•</span>
        <span className="text-muted-foreground">{deliveriesToday.length} deliveries today</span>
        <span className="text-muted-foreground hidden sm:inline">•</span>
        <span className="text-muted-foreground">{collectionsToday.length} collections today</span>
        {needsAttention.length > 0 && (
          <>
            <span className="text-muted-foreground hidden sm:inline">•</span>
            <div className="flex items-center gap-1.5 text-amber-600">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium">{needsAttention.length} need attention</span>
            </div>
          </>
        )}
      </div>

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle>All Rentals</CardTitle>
            <Tabs value={filter} onValueChange={setFilter} className="w-full sm:w-auto">
              <TabsList className="w-full sm:w-auto grid grid-cols-3 lg:grid-cols-6">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="pending_delivery">Pending Delivery</TabsTrigger>
                <TabsTrigger value="active">Active</TabsTrigger>
                <TabsTrigger value="pending_collection">Pending Collection</TabsTrigger>
                <TabsTrigger value="completed">Completed</TabsTrigger>
                <TabsTrigger value="needs_attention" className="gap-1">
                  <AlertCircle className="h-3 w-3" />
                  <span className="hidden sm:inline">Attention</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Search and Date Range Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by ref, client, car plate, model..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start min-w-[200px]">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <span className="truncate">
                        {format(dateRange.from, "MMM d")} - {format(dateRange.to, "MMM d, yyyy")}
                      </span>
                    ) : (
                      format(dateRange.from, "PPP")
                    )
                  ) : (
                    "Filter by date range"
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            
            {hasActiveFilters && (
              <Button variant="ghost" size="icon" onClick={clearFilters} className="shrink-0">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {filteredRentals && filteredRentals.length > 0 ? (
            <div className="space-y-4">
              {filteredRentals.map((rental) => {
                const indicators = getRentalIndicators(rental);
                // Only show attention badge for non-imported bookings
                const showAttentionBadge = !rental.imported_from_email && indicators.needsAttention;
                
                return (
                  <div 
                    key={rental.id}
                    className="flex items-center gap-3 p-4 md:p-5 border rounded-lg hover:shadow-md hover:border-primary/20 transition-all"
                  >
                    <Link
                      to={`/bookings/${rental.id}?tab=rental`}
                      className="flex-1 space-y-2"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{rental.reference_code}</span>
                        <Badge 
                          variant={getRentalStatus(rental) === 'Completed' ? 'success' : 'secondary'}
                          className={getRentalStatus(rental) === 'Completed' ? 'bg-success text-success-foreground hover:bg-success/90' : ''}
                        >
                          {getRentalStatus(rental)}
                        </Badge>
                        {rental.imported_from_email && (
                          <Badge variant="outline" className="text-xs">Imported</Badge>
                        )}
                        {showAttentionBadge && (
                          <Badge variant="destructive" className="gap-1">
                            <AlertCircle className="h-3 w-3" />
                            Attention
                          </Badge>
                        )}
                      </div>

                      <div className="text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">{rental.client_name}</span>
                        <span> • {rental.car_model} ({rental.car_plate})</span>
                      </div>

                      <div className="text-sm">
                        <span className="text-muted-foreground">
                          {format(new Date(rental.delivery_datetime), "PP")} → {format(new Date(rental.collection_datetime), "PP")}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-xs flex-wrap">
                        <div className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          <span className={indicators.deliveryContract ? "text-green-600" : "text-muted-foreground"}>
                            Delivery {indicators.deliveryContract ? "✓" : "✗"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          <span className={indicators.collectionContract ? "text-green-600" : "text-muted-foreground"}>
                            Collection {indicators.collectionContract ? "✓" : "✗"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Camera className="h-3 w-3" />
                          <span>{indicators.deliveryPhotos} / {indicators.collectionPhotos} photos</span>
                        </div>
                        {indicators.unapprovedCosts > 0 && (
                          <div className="flex items-center gap-1 text-destructive">
                            <AlertCircle className="h-3 w-3" />
                            <span>{indicators.unapprovedCosts} pending costs</span>
                          </div>
                        )}
                      </div>
                    </Link>

                    <QuickChatTrigger 
                      context={{ 
                        type: 'rental', 
                        id: rental.id,
                        name: `${rental.reference_code} - ${rental.client_name}`
                      }} 
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Car className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No rentals found for this filter</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
