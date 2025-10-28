import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { CheckCircle, FileText, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ExtraCost {
  id: string;
  extra_cost_amount: number;
  extra_cost_notes: string | null;
  document_url: string;
  document_type: string;
  uploaded_at: string;
  approval?: {
    id: string;
    approved_at: string;
  } | null;
}

interface ExtraCostsReviewSectionProps {
  extraCosts: ExtraCost[];
  token: string;
  bookingId: string;
  onUpdate: () => void;
}

export function ExtraCostsReviewSection({
  extraCosts,
  token,
  bookingId,
  onUpdate,
}: ExtraCostsReviewSectionProps) {
  const [approving, setApproving] = useState<string | null>(null);

  const handleApprove = async (documentId: string) => {
    setApproving(documentId);
    try {
      const { error } = await supabase.functions.invoke('approve-extra-cost', {
        body: { token, document_id: documentId },
      });

      if (error) throw error;

      toast.success('Extra cost approved successfully');
      onUpdate();
    } catch (error: any) {
      console.error('Error approving extra cost:', error);
      toast.error(error.message || 'Failed to approve extra cost');
    } finally {
      setApproving(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (extraCosts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <AlertCircle className="h-5 w-5 text-orange-500" />
        <h3 className="text-lg font-semibold">Extra Costs & Damages</h3>
      </div>

      <div className="space-y-3">
        {extraCosts.map((cost) => (
          <Card key={cost.id} className="border-l-4 border-l-orange-500">
            <CardHeader>
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                  <CardTitle className="text-base">
                    {cost.extra_cost_notes || 'Extra Cost'}
                  </CardTitle>
                  <Badge
                    variant={cost.approval ? 'default' : 'secondary'}
                    className={cost.approval ? 'bg-green-500 mt-2' : 'mt-2'}
                  >
                    {cost.approval ? 'Approved' : 'Pending Review'}
                  </Badge>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">€{cost.extra_cost_amount.toFixed(2)}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Document Preview */}
              <div className="mb-4">
                {cost.document_url && (
                  <a
                    href={cost.document_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <FileText className="h-4 w-4" />
                    View Invoice/Quote
                  </a>
                )}
              </div>

              {/* Approval Action */}
              {!cost.approval ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button className="w-full" disabled={approving === cost.id}>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      {approving === cost.id ? 'Approving...' : 'Accept Extra Cost'}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirm Acceptance</AlertDialogTitle>
                      <AlertDialogDescription>
                        By accepting this extra cost of €{cost.extra_cost_amount.toFixed(2)},
                        you acknowledge the charge. Your approval will be handled manually
                        by our accounts department.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleApprove(cost.id)}>
                        Confirm Acceptance
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-green-800">
                    <CheckCircle className="h-5 w-5" />
                    <p className="font-medium">Approved on {formatDate(cost.approval.approved_at)}</p>
                  </div>
                  <p className="text-sm text-green-700 mt-1">
                    This cost is now locked and will be processed by our team.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}