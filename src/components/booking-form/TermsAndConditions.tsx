import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Download, FileText, HelpCircle } from "lucide-react";
import { TermsViewerModal } from "./TermsViewerModal";

interface TermsAndConditionsProps {
  version: string;
  content: string;
  pdfUrl?: string | null;
  accepted: boolean;
  onAcceptedChange: (accepted: boolean) => void;
  className?: string;
}

export const TermsAndConditions = ({ version, content, pdfUrl, accepted, onAcceptedChange, className }: TermsAndConditionsProps) => {
  const [modalOpen, setModalOpen] = useState(false);
  
  // Get preview text (first 200 characters)
  const getPreviewText = () => {
    const plainText = content.replace(/<[^>]*>/g, '').replace(/\n/g, ' ');
    return plainText.length > 200 ? plainText.substring(0, 200) + '...' : plainText;
  };

  return (
    <>
      <Card className={`p-4 md:p-6 ${className || ''}`}>
        <div className="space-y-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <h3 className="text-base md:text-lg font-semibold">Terms and Conditions</h3>
              <Badge variant="outline" className="text-xs">v{version}</Badge>
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setModalOpen(true)}
                className="gap-2"
              >
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">View Full Terms</span>
                <span className="sm:hidden">View</span>
              </Button>
              
              {pdfUrl && (
                <Button variant="outline" size="sm" asChild>
                  <a href={pdfUrl} target="_blank" rel="noopener noreferrer" download className="gap-2">
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline">PDF</span>
                  </a>
                </Button>
              )}
            </div>
          </div>
          
          {/* Compact Preview */}
          <div className="border rounded-lg p-3 md:p-4 bg-muted/30">
            <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
              {getPreviewText()}
            </p>
            <Button
              variant="link"
              size="sm"
              onClick={() => setModalOpen(true)}
              className="h-auto p-0 mt-2 text-xs"
            >
              Read full terms and conditions →
            </Button>
          </div>

          {/* Security Deposit Notice */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
            <div className="flex-1 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Security Deposit:</span> A refundable deposit will be required before vehicle pickup.
            </div>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 shrink-0"
                  aria-label="Security deposit information"
                >
                  <HelpCircle className="h-4 w-4 text-primary" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 md:w-96 z-50 bg-background" align="end">
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm">Security Deposit Policy</h4>
                  
                  <div className="space-y-2 text-xs text-muted-foreground">
                    <p>
                      A refundable security deposit is held as a <span className="font-medium text-foreground">pre-authorization</span> on your credit/debit card before vehicle pickup.
                    </p>
                    
                    <div className="pt-2 border-t">
                      <p className="font-medium text-foreground mb-1">Release Timeline:</p>
                      <p>The deposit will be released within <span className="font-medium text-foreground">7-14 business days</span> after the vehicle is returned in its original condition, subject to inspection.</p>
                    </div>
                    
                    <div className="pt-2 border-t">
                      <p className="font-medium text-foreground mb-1">The deposit may be used to cover:</p>
                      <ul className="list-disc list-inside space-y-1 ml-1">
                        <li>Vehicle damages</li>
                        <li>Traffic fines or toll fees</li>
                        <li>Missing fuel</li>
                        <li>Contract violations</li>
                        <li>Late return fees</li>
                      </ul>
                    </div>
                    
                    <div className="pt-2 border-t">
                      <p className="font-medium text-foreground mb-1">Important Notes:</p>
                      <ul className="list-disc list-inside space-y-1 ml-1">
                        <li>This is a hold, not a charge</li>
                        <li>The amount depends on the vehicle type</li>
                        <li>A valid credit/debit card is required</li>
                        <li>Release time depends on your bank</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          
          {/* Acceptance Checkbox */}
          <div className="flex items-start space-x-2 pt-2">
            <Checkbox 
              id="accept-terms" 
              checked={accepted}
              onCheckedChange={(checked) => onAcceptedChange(checked as boolean)}
            />
            <label
              htmlFor="accept-terms"
              className="text-sm font-medium leading-relaxed cursor-pointer select-none"
            >
              I have read and agreed to the terms and conditions *
            </label>
          </div>

          <p className="text-xs text-muted-foreground">
            Please review the full terms by clicking "View Full Terms" above. You must accept before signing.
          </p>
        </div>
      </Card>

      {/* Full Terms Modal */}
      <TermsViewerModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        version={version}
        content={content}
        pdfUrl={pdfUrl}
        accepted={accepted}
        onAcceptedChange={onAcceptedChange}
      />
    </>
  );
};
