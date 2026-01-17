import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, AlertTriangle, Merge, Search } from "lucide-react";
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
import { useUserViewScope } from "@/hooks/useUserViewScope";

interface MergeNamesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'supplier' | 'client';
  preselectedNames?: string[];
}

interface NameCount {
  name: string;
  bookingCount: number;
  invoiceCount: number;
}

export function MergeNamesDialog({ open, onOpenChange, type, preselectedNames }: MergeNamesDialogProps) {
  const { isReadOnly } = useUserViewScope();
  
  // Hide entire dialog for read-only users
  if (isReadOnly) return null;
  
  const queryClient = useQueryClient();
  const [selectedNames, setSelectedNames] = useState<string[]>([]);
  const [canonicalName, setCanonicalName] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  
  // Pre-populate selected names when dialog opens with preselectedNames
  useEffect(() => {
    if (open && preselectedNames && preselectedNames.length >= 2) {
      setSelectedNames(preselectedNames);
      setCanonicalName(preselectedNames[0]);
    }
  }, [open, preselectedNames]);

  const isSupplier = type === 'supplier';

  // Fetch names with counts
  const { data: nameData, isLoading } = useQuery({
    queryKey: [isSupplier ? 'supplier-names-with-counts' : 'client-names-with-counts'],
    queryFn: async () => {
      const nameCounts = new Map<string, NameCount>();

      if (isSupplier) {
        // Fetch supplier names from bookings
        const { data: bookings } = await supabase
          .from('bookings')
          .select('supplier_name')
          .not('supplier_name', 'is', null)
          .is('deleted_at', null);

        bookings?.forEach(b => {
          if (b.supplier_name) {
            const existing = nameCounts.get(b.supplier_name);
            if (existing) {
              existing.bookingCount += 1;
            } else {
              nameCounts.set(b.supplier_name, { name: b.supplier_name, bookingCount: 1, invoiceCount: 0 });
            }
          }
        });

        // Fetch supplier names from supplier_invoices
        const { data: invoices } = await supabase
          .from('supplier_invoices')
          .select('supplier_name')
          .not('supplier_name', 'is', null)
          .is('deleted_at', null);

        invoices?.forEach(i => {
          if (i.supplier_name) {
            const existing = nameCounts.get(i.supplier_name);
            if (existing) {
              existing.invoiceCount += 1;
            } else {
              nameCounts.set(i.supplier_name, { name: i.supplier_name, bookingCount: 0, invoiceCount: 1 });
            }
          }
        });
      } else {
        // Fetch client names from bookings
        const { data: bookings } = await supabase
          .from('bookings')
          .select('client_name')
          .not('client_name', 'is', null)
          .is('deleted_at', null);

        bookings?.forEach(b => {
          if (b.client_name) {
            const existing = nameCounts.get(b.client_name);
            if (existing) {
              existing.bookingCount += 1;
            } else {
              nameCounts.set(b.client_name, { name: b.client_name, bookingCount: 1, invoiceCount: 0 });
            }
          }
        });

        // Fetch client names from tax_invoices
        const { data: invoices } = await supabase
          .from('tax_invoices')
          .select('client_name')
          .not('client_name', 'is', null)
          .is('deleted_at', null);

        invoices?.forEach(i => {
          if (i.client_name) {
            const existing = nameCounts.get(i.client_name);
            if (existing) {
              existing.invoiceCount += 1;
            } else {
              nameCounts.set(i.client_name, { name: i.client_name, bookingCount: 0, invoiceCount: 1 });
            }
          }
        });
      }

      return Array.from(nameCounts.values()).sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: open,
  });

  // Filter names based on search
  const filteredNames = useMemo(() => {
    if (!nameData) return [];
    if (!searchTerm) return nameData;
    const term = searchTerm.toLowerCase();
    return nameData.filter(n => n.name.toLowerCase().includes(term));
  }, [nameData, searchTerm]);

  // Calculate total affected records
  const affectedRecords = useMemo(() => {
    if (!nameData) return { bookings: 0, invoices: 0 };
    
    return selectedNames.reduce((acc, name) => {
      const data = nameData.find(n => n.name === name);
      if (data) {
        acc.bookings += data.bookingCount;
        acc.invoices += data.invoiceCount;
      }
      return acc;
    }, { bookings: 0, invoices: 0 });
  }, [selectedNames, nameData]);

  const mergeMutation = useMutation({
    mutationFn: async () => {
      if (!canonicalName || selectedNames.length < 2) {
        throw new Error("Please select at least 2 names and provide a canonical name");
      }

      const namesToMerge = selectedNames.filter(n => n !== canonicalName);

      if (isSupplier) {
        // Update bookings
        const { error: bookingsError } = await supabase
          .from('bookings')
          .update({ supplier_name: canonicalName })
          .in('supplier_name', namesToMerge);

        if (bookingsError) throw bookingsError;

        // Update supplier_invoices
        const { error: invoicesError } = await supabase
          .from('supplier_invoices')
          .update({ supplier_name: canonicalName })
          .in('supplier_name', namesToMerge);

        if (invoicesError) throw invoicesError;
      } else {
        // Update bookings
        const { error: bookingsError } = await supabase
          .from('bookings')
          .update({ client_name: canonicalName })
          .in('client_name', namesToMerge);

        if (bookingsError) throw bookingsError;

        // Update tax_invoices
        const { error: invoicesError } = await supabase
          .from('tax_invoices')
          .update({ client_name: canonicalName })
          .in('client_name', namesToMerge);

        if (invoicesError) throw invoicesError;
      }

      return { merged: namesToMerge.length, canonical: canonicalName };
    },
    onSuccess: (data) => {
      toast.success(`Successfully merged ${data.merged} names into "${data.canonical}"`);
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['all-bookings-for-suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['all-supplier-invoices-for-suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['all-tax-invoices-for-customers'] });
      queryClient.invalidateQueries({ queryKey: ['distinct-supplier-names'] });
      queryClient.invalidateQueries({ queryKey: ['distinct-client-names'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-names-with-counts'] });
      queryClient.invalidateQueries({ queryKey: ['client-names-with-counts'] });
      // Also invalidate customer-related queries used by Customers page
      queryClient.invalidateQueries({ queryKey: ['all-bookings-for-customer-filter'] });
      queryClient.invalidateQueries({ queryKey: ['customer-bookings'] });
      
      // Reset state
      setSelectedNames([]);
      setCanonicalName("");
      setShowConfirmDialog(false);
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Merge error:', error);
      toast.error("Failed to merge names. Please try again.");
      setShowConfirmDialog(false);
    },
  });

  const handleNameToggle = (name: string) => {
    setSelectedNames(prev => {
      const newSelection = prev.includes(name) 
        ? prev.filter(n => n !== name)
        : [...prev, name];
      
      // If canonical name is no longer in selection, clear it
      if (!newSelection.includes(canonicalName)) {
        setCanonicalName("");
      }
      
      // Auto-select first name as canonical if none selected
      if (newSelection.length > 0 && !newSelection.includes(canonicalName)) {
        setCanonicalName(newSelection[0]);
      }
      
      return newSelection;
    });
  };

  const handleClose = () => {
    setSelectedNames([]);
    setCanonicalName("");
    setSearchTerm("");
    onOpenChange(false);
  };

  return (
    <>
      <ResponsiveDialog open={open} onOpenChange={handleClose}>
        <ResponsiveDialogContent className="sm:max-w-2xl">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle className="flex items-center gap-2">
              <Merge className="h-5 w-5" />
              Merge {isSupplier ? 'Supplier' : 'Client'} Names
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              Select duplicate names to merge into a single canonical name. This will update all related records.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search names..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Name List */}
            <div className="border rounded-lg">
              <ScrollArea className="h-[40vh] sm:h-[300px]">
                {isLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredNames.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    No names found
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {filteredNames.map((item) => (
                      <div
                        key={item.name}
                        className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-md hover:bg-muted/50 cursor-pointer ${
                          selectedNames.includes(item.name) ? 'bg-muted' : ''
                        }`}
                        onClick={() => handleNameToggle(item.name)}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Checkbox
                            checked={selectedNames.includes(item.name)}
                            onCheckedChange={() => handleNameToggle(item.name)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <span className="font-medium truncate">{item.name}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pl-7 sm:pl-0">
                          <Badge variant="secondary" className="text-xs">
                            {item.bookingCount} booking{item.bookingCount !== 1 ? 's' : ''}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {item.invoiceCount} invoice{item.invoiceCount !== 1 ? 's' : ''}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Canonical Name Selection */}
            {selectedNames.length >= 2 && (
              <div className="space-y-3 p-3 sm:p-4 border rounded-lg bg-muted/30">
                <Label className="text-sm font-medium">Select canonical name (all others will be merged into this)</Label>
                <div className="flex flex-wrap gap-2">
                  {selectedNames.map((name) => (
                    <Button
                      key={name}
                      type="button"
                      variant={canonicalName === name ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCanonicalName(name)}
                      className="text-xs sm:text-sm"
                    >
                      {name}
                    </Button>
                  ))}
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <Label className="text-sm text-muted-foreground">Or enter a new name:</Label>
                  <Input
                    value={canonicalName}
                    onChange={(e) => setCanonicalName(e.target.value)}
                    placeholder="Enter canonical name..."
                    className="sm:max-w-xs"
                  />
                </div>
              </div>
            )}

            {/* Preview */}
            {selectedNames.length >= 2 && canonicalName && (
              <div className="p-3 border rounded-lg bg-amber-500/10 border-amber-200">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm min-w-0">
                    <p className="font-medium text-amber-800">
                      This will update {affectedRecords.bookings} booking{affectedRecords.bookings !== 1 ? 's' : ''} and {affectedRecords.invoices} invoice{affectedRecords.invoices !== 1 ? 's' : ''}
                    </p>
                    <p className="text-amber-700 mt-1 break-words">
                      Merging: <span className="font-medium">{selectedNames.filter(n => n !== canonicalName).join(', ')}</span>
                      {' → '}
                      <span className="font-medium">{canonicalName}</span>
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <ResponsiveDialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={handleClose} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button
              onClick={() => setShowConfirmDialog(true)}
              disabled={selectedNames.length < 2 || !canonicalName || mergeMutation.isPending}
              className="w-full sm:w-auto"
            >
              {mergeMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Merging...
                </>
              ) : (
                <>
                  <Merge className="mr-2 h-4 w-4" />
                  Merge {selectedNames.length} Names
                </>
              )}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="max-w-[95vw] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Merge</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to merge {selectedNames.length} names into "{canonicalName}"?
              This will update {affectedRecords.bookings} bookings and {affectedRecords.invoices} invoices.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => mergeMutation.mutate()}
              className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirm Merge
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
