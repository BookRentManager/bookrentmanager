import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Printer, Download, X } from "lucide-react";
import DOMPurify from 'dompurify';

interface TermsViewerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  version: string;
  content: string;
  pdfUrl?: string | null;
  accepted: boolean;
  onAcceptedChange: (accepted: boolean) => void;
}

export const TermsViewerModal = ({
  open,
  onOpenChange,
  version,
  content,
  pdfUrl,
  accepted,
  onAcceptedChange,
}: TermsViewerModalProps) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] md:max-h-[85vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b space-y-2">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-semibold">Terms and Conditions</DialogTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                Version {version}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable Content */}
        <ScrollArea className="flex-1 px-6 py-4">
          <div className="print:block">
            <div 
              className="prose prose-sm md:prose max-w-none dark:prose-invert prose-headings:font-semibold prose-p:text-muted-foreground prose-p:leading-relaxed"
              dangerouslySetInnerHTML={{ 
                __html: DOMPurify.sanitize(content.replace(/\n/g, '<br/>')) 
              }}
            />
            
            {/* Security Deposit Policy */}
            <div className="mt-8 pt-6 border-t">
              <h4 className="font-semibold text-base mb-3">Security Deposit Policy</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                A refundable security deposit will be required before vehicle pickup. This deposit is held as a pre-authorization 
                on your credit/debit card and will be released within 7-14 business days after the vehicle is returned in its 
                original condition, subject to inspection. The deposit may be used to cover any damages, fines, toll fees, 
                missing fuel, or contract violations incurred during the rental period.
              </p>
            </div>

            {/* Print-only header */}
            <div className="hidden print:block mb-6 pb-4 border-b">
              <h1 className="text-2xl font-bold mb-2">Terms and Conditions</h1>
              <p className="text-sm text-muted-foreground">Version {version}</p>
              <p className="text-sm text-muted-foreground">Printed on: {new Date().toLocaleDateString()}</p>
            </div>
          </div>
        </ScrollArea>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t flex-col sm:flex-row gap-4 print:hidden">
          <div className="flex items-start space-x-2 flex-1">
            <Checkbox 
              id="modal-accept-terms" 
              checked={accepted}
              onCheckedChange={(checked) => onAcceptedChange(checked as boolean)}
            />
            <Label
              htmlFor="modal-accept-terms"
              className="text-sm font-medium leading-relaxed cursor-pointer"
            >
              I have read and agreed to the terms and conditions
            </Label>
          </div>
          
          <div className="flex gap-2 sm:ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="gap-2"
            >
              <Printer className="h-4 w-4" />
              Print
            </Button>
            
            {pdfUrl && (
              <Button
                variant="outline"
                size="sm"
                asChild
              >
                <a href={pdfUrl} target="_blank" rel="noopener noreferrer" download className="gap-2">
                  <Download className="h-4 w-4" />
                  PDF
                </a>
              </Button>
            )}
            
            <Button
              variant="default"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      {/* Print styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          
          .print\\:block,
          .print\\:block * {
            visibility: visible;
          }
          
          .print\\:hidden {
            display: none !important;
          }
          
          .prose {
            max-width: 100% !important;
          }
          
          @page {
            margin: 2cm;
          }
        }
      `}</style>
    </Dialog>
  );
};
