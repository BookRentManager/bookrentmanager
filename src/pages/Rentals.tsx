import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, FileText, Camera, Car } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import { format, isToday, addDays } from "date-fns";
import { QuickChatTrigger } from "@/components/chat/QuickChatTrigger";
import { Skeleton } from "@/components/ui/skeleton";

export default function Rentals() {
  const [filter, setFilter] = useState("all");

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

  const filteredRentals = rentals?.filter((r) => {
    if (filter === "all") return true;
    
    if (filter === "pending_delivery") {
      return r.status === 'confirmed' && 
             new Date(r.delivery_datetime) > new Date();
    }
    
    if (filter === "active") {
      return r.status === 'ongoing';
    }
    
    if (filter === "pending_collection") {
      return r.status === 'ongoing' && 
             new Date(r.collection_datetime) <= addDays(new Date(), 7);
    }
    
    if (filter === "completed") {
      return r.status === 'completed';
    }
    
    if (filter === "needs_attention") {
      const indicators = getRentalIndicators(r);
      return indicators.needsAttention;
    }
    
    return true;
  });

  const activeRentals = rentals?.filter(r => r.status === 'ongoing') || [];
  const deliveriesToday = rentals?.filter(r => 
    r.delivery_datetime && isToday(new Date(r.delivery_datetime))
  ) || [];
  const collectionsToday = rentals?.filter(r => 
    r.collection_datetime && isToday(new Date(r.collection_datetime))
  ) || [];
  const needsAttention = rentals?.filter(r => getRentalIndicators(r).needsAttention) || [];

const getStatusVariant = (status: string) => {
  switch (status) {
    case 'confirmed':
      return 'default';
    case 'ongoing':
      return 'secondary';
    case 'completed':
      return 'default';
    default:
      return 'default';
  }
};

const getStatusClassName = (status: string) => {
  switch (status) {
    case 'confirmed':
      return 'bg-success text-white hover:bg-success/90';
    case 'completed':
      return 'bg-success text-white hover:bg-success/90';
    case 'ongoing':
      return '';
    default:
      return '';
  }
};

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

      {needsAttention.length > 0 && (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <CardTitle className="text-destructive">Needs Attention</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Active Rentals</p>
                <p className="text-2xl font-bold">{activeRentals.length}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Deliveries Today</p>
                <p className="text-2xl font-bold">{deliveriesToday.length}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Collections Today</p>
                <p className="text-2xl font-bold">{collectionsToday.length}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Missing Docs</p>
                <p className="text-2xl font-bold text-destructive">{needsAttention.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
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
        </CardHeader>
        <CardContent>
          {filteredRentals && filteredRentals.length > 0 ? (
            <div className="space-y-4">
              {filteredRentals.map((rental) => {
                const indicators = getRentalIndicators(rental);
                
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
                          variant={getStatusVariant(rental.status)}
                          className={getStatusClassName(rental.status)}
                        >
                          {rental.status}
                        </Badge>
                        {indicators.needsAttention && (
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
