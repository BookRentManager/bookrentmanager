import { useState, useMemo, useEffect } from "react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, Mail, User, Eye, EyeOff, RotateCcw, Merge } from "lucide-react";

interface CustomerData {
  client_name: string;
  client_email: string | null;
  invoice_count: number;
  booking_count: number;
  total_amount: number;
  last_invoice_date: string;
  currencies: string[];
}

interface DuplicateGroup {
  id: string;
  type: 'same_email' | 'similar_name';
  reason: string;
  customers: CustomerData[];
}

interface CustomerDuplicatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customers: CustomerData[];
  onMergeNames: (names: string[]) => void;
}

const STORAGE_KEY = 'ignored_customer_duplicates';

// Simple Levenshtein distance-based similarity
function stringSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;
  
  // Check if one contains the other
  if (s1.includes(s2) || s2.includes(s1)) return 0.85;
  
  // Simple word overlap check
  const words1 = s1.split(/\s+/).filter(w => w.length > 1);
  const words2 = s2.split(/\s+/).filter(w => w.length > 1);
  
  if (words1.length === 0 || words2.length === 0) return 0;
  
  const commonWords = words1.filter(w1 => 
    words2.some(w2 => w1 === w2 || w1.includes(w2) || w2.includes(w1))
  );
  
  const similarity = (commonWords.length * 2) / (words1.length + words2.length);
  return similarity;
}

export function CustomerDuplicatesDialog({ 
  open, 
  onOpenChange, 
  customers,
  onMergeNames 
}: CustomerDuplicatesDialogProps) {
  const [ignoredGroups, setIgnoredGroups] = useState<string[]>([]);
  const [showIgnored, setShowIgnored] = useState(false);

  // Load ignored groups from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setIgnoredGroups(JSON.parse(stored));
      } catch {
        setIgnoredGroups([]);
      }
    }
  }, [open]);

  // Detect same email with different names
  const sameEmailGroups = useMemo(() => {
    const emailMap = new Map<string, CustomerData[]>();
    
    customers.forEach(customer => {
      if (customer.client_email) {
        const email = customer.client_email.toLowerCase().trim();
        const existing = emailMap.get(email) || [];
        existing.push(customer);
        emailMap.set(email, existing);
      }
    });
    
    return Array.from(emailMap.entries())
      .filter(([_, custs]) => custs.length > 1)
      .map(([email, custs]) => ({
        id: `email_${email}`,
        type: 'same_email' as const,
        reason: `Same email "${email}" used with different names`,
        customers: custs
      }));
  }, [customers]);

  // Detect similar names with different emails
  const similarNameGroups = useMemo(() => {
    const groups: DuplicateGroup[] = [];
    const checked = new Set<string>();
    
    customers.forEach((customer, i) => {
      if (checked.has(customer.client_name)) return;
      
      const similar = customers.filter((other, j) => {
        if (i === j) return false;
        if (checked.has(other.client_name)) return false;
        
        // Check similarity
        const similarity = stringSimilarity(customer.client_name, other.client_name);
        
        // Only flag if emails are different (or one is missing)
        const emailsDiffer = customer.client_email !== other.client_email;
        
        return similarity >= 0.7 && emailsDiffer;
      });
      
      if (similar.length > 0) {
        const allInGroup = [customer, ...similar];
        allInGroup.forEach(c => checked.add(c.client_name));
        
        const names = allInGroup.map(c => c.client_name).sort().join('_');
        groups.push({
          id: `similar_${names}`,
          type: 'similar_name',
          reason: 'Similar names with different emails',
          customers: allInGroup
        });
      }
    });
    
    return groups;
  }, [customers]);

  // All duplicate groups
  const allGroups = useMemo(() => {
    return [...sameEmailGroups, ...similarNameGroups];
  }, [sameEmailGroups, similarNameGroups]);

  // Filter out ignored groups
  const visibleGroups = useMemo(() => {
    if (showIgnored) return allGroups;
    return allGroups.filter(g => !ignoredGroups.includes(g.id));
  }, [allGroups, ignoredGroups, showIgnored]);

  const pendingCount = allGroups.filter(g => !ignoredGroups.includes(g.id)).length;
  const ignoredCount = ignoredGroups.filter(id => allGroups.some(g => g.id === id)).length;

  const handleIgnore = (groupId: string) => {
    const newIgnored = [...ignoredGroups, groupId];
    setIgnoredGroups(newIgnored);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newIgnored));
  };

  const handleUnignore = (groupId: string) => {
    const newIgnored = ignoredGroups.filter(id => id !== groupId);
    setIgnoredGroups(newIgnored);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newIgnored));
  };

  const handleResetIgnored = () => {
    setIgnoredGroups([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  const handleMerge = (group: DuplicateGroup) => {
    const names = group.customers.map(c => c.client_name);
    onMergeNames(names);
    onOpenChange(false);
  };

  const formatCurrency = (amount: number, currencies: string[]) => {
    const currency = currencies[0] || 'EUR';
    return new Intl.NumberFormat('de-CH', { 
      style: 'currency', 
      currency 
    }).format(amount);
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-2xl">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Review Potential Duplicates
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Review customers that may be duplicates based on email or similar names. 
            Merge them or ignore if they are different customers.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="space-y-4">
          {/* Stats bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm">
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              <span className="text-muted-foreground">
                {pendingCount} pending review{pendingCount !== 1 ? 's' : ''}
              </span>
              {ignoredCount > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 text-xs"
                  onClick={() => setShowIgnored(!showIgnored)}
                >
                  {showIgnored ? (
                    <>
                      <EyeOff className="h-3 w-3 mr-1" />
                      Hide ignored ({ignoredCount})
                    </>
                  ) : (
                    <>
                      <Eye className="h-3 w-3 mr-1" />
                      Show ignored ({ignoredCount})
                    </>
                  )}
                </Button>
              )}
            </div>
            {ignoredCount > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 text-xs self-start sm:self-auto"
                onClick={handleResetIgnored}
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Reset all
              </Button>
            )}
          </div>

          <ScrollArea className="h-[50vh] sm:h-[400px]">
            {visibleGroups.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                <AlertTriangle className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground">
                  {allGroups.length === 0 
                    ? 'No potential duplicates detected' 
                    : 'All potential duplicates have been reviewed'}
                </p>
              </div>
            ) : (
              <div className="space-y-4 pr-2 sm:pr-4">
                {visibleGroups.map((group) => {
                  const isIgnored = ignoredGroups.includes(group.id);
                  
                  return (
                    <div 
                      key={group.id} 
                      className={`border rounded-lg p-3 sm:p-4 space-y-3 ${isIgnored ? 'opacity-50 bg-muted/30' : ''}`}
                    >
                      {/* Group header */}
                      <div className="flex flex-wrap items-center gap-2">
                        {group.type === 'same_email' ? (
                          <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-200">
                            <Mail className="h-3 w-3 mr-1" />
                            Same Email
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-200">
                            <User className="h-3 w-3 mr-1" />
                            Similar Names
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {group.customers.length} entries
                        </span>
                      </div>

                      {/* Customers in group */}
                      <div className="space-y-2">
                        {group.customers.map((customer, idx) => (
                          <div 
                            key={`${customer.client_name}-${customer.client_email}-${idx}`}
                            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2 text-sm py-2 border-b last:border-0"
                          >
                            <div className="min-w-0">
                              <div className="font-medium truncate">{customer.client_name}</div>
                              <div className="text-xs text-muted-foreground truncate">
                                {customer.client_email || 'No email'}
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-1 sm:mt-0">
                              <Badge variant="secondary" className="text-xs">
                                {customer.booking_count} booking{customer.booking_count !== 1 ? 's' : ''}
                              </Badge>
                              <Badge variant="secondary" className="text-xs">
                                {customer.invoice_count} invoice{customer.invoice_count !== 1 ? 's' : ''}
                              </Badge>
                              <span className="text-xs font-medium whitespace-nowrap">
                                {formatCurrency(customer.total_amount, customer.currencies)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <Separator />

                      {/* Actions */}
                      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2">
                        {isIgnored ? (
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="w-full sm:w-auto"
                            onClick={() => handleUnignore(group.id)}
                          >
                            Restore
                          </Button>
                        ) : (
                          <>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="w-full sm:w-auto"
                              onClick={() => handleIgnore(group.id)}
                            >
                              Ignore
                            </Button>
                            <Button 
                              size="sm"
                              className="w-full sm:w-auto"
                              onClick={() => handleMerge(group)}
                            >
                              <Merge className="h-4 w-4 mr-1" />
                              Merge These
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        <ResponsiveDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Close
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

// Export helper to get pending duplicate count
export function useDuplicateCount(customers: { client_name: string; client_email: string | null }[]): number {
  return useMemo(() => {
    const storedIgnored = localStorage.getItem(STORAGE_KEY);
    const ignoredGroups: string[] = storedIgnored ? JSON.parse(storedIgnored) : [];
    
    // Count same email groups
    const emailMap = new Map<string, number>();
    customers.forEach(c => {
      if (c.client_email) {
        const email = c.client_email.toLowerCase().trim();
        emailMap.set(email, (emailMap.get(email) || 0) + 1);
      }
    });
    
    let count = 0;
    emailMap.forEach((cnt, email) => {
      if (cnt > 1 && !ignoredGroups.includes(`email_${email}`)) {
        count++;
      }
    });
    
    // Count similar name groups (simplified check)
    const checked = new Set<string>();
    customers.forEach((customer, i) => {
      if (checked.has(customer.client_name)) return;
      
      const similar = customers.filter((other, j) => {
        if (i === j) return false;
        if (checked.has(other.client_name)) return false;
        
        const similarity = stringSimilarity(customer.client_name, other.client_name);
        const emailsDiffer = customer.client_email !== other.client_email;
        
        return similarity >= 0.7 && emailsDiffer;
      });
      
      if (similar.length > 0) {
        const allInGroup = [customer, ...similar];
        const names = allInGroup.map(c => c.client_name).sort().join('_');
        allInGroup.forEach(c => checked.add(c.client_name));
        
        if (!ignoredGroups.includes(`similar_${names}`)) {
          count++;
        }
      }
    });
    
    return count;
  }, [customers]);
}
