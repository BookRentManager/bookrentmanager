import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Download, FileText } from "lucide-react";
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
            <div className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Security Deposit:</span> A refundable deposit will be required before vehicle pickup.
            </div>
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
