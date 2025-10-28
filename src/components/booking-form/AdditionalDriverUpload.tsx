import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, ChevronUp } from "lucide-react";
import { SimpleDocumentUpload } from "./SimpleDocumentUpload";
import { ClientDocumentView } from "./ClientDocumentView";

interface AdditionalDriverUploadProps {
  driverNumber: 2 | 3;
  token: string;
  bookingId: string;
  uploadedDocuments: any[];
  onUploadComplete: () => void;
}

export function AdditionalDriverUpload({
  driverNumber,
  token,
  bookingId,
  uploadedDocuments,
  onUploadComplete
}: AdditionalDriverUploadProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const driverPrefix = `driver${driverNumber}`;
  const frontType = `${driverPrefix}_license_front`;
  const backType = `${driverPrefix}_license_back`;
  
  const hasFront = uploadedDocuments.some(d => d.document_type === frontType);
  const hasBack = uploadedDocuments.some(d => d.document_type === backType);
  const isComplete = hasFront && hasBack;
  
  // Auto-expand if documents exist
  useEffect(() => {
    if (hasFront || hasBack) {
      setIsExpanded(true);
    }
  }, [hasFront, hasBack]);
  
  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">
              {driverNumber === 2 ? 'Second' : 'Third'} Driver Documents
            </h3>
            {isComplete && (
              <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
                ✓ Complete
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-8 w-8 p-0"
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Upload the driver's license (front and back) for the {driverNumber === 2 ? 'second' : 'third'} driver.
          </p>
          
          <SimpleDocumentUpload
            label="Driver's License (Front)"
            documentType={frontType}
            token={token}
            bookingId={bookingId}
            onUploadComplete={onUploadComplete}
            isUploaded={hasFront}
          />
          
          <SimpleDocumentUpload
            label="Driver's License (Back)"
            documentType={backType}
            token={token}
            bookingId={bookingId}
            onUploadComplete={onUploadComplete}
            isUploaded={hasBack}
          />
          
          {uploadedDocuments.length > 0 && (
            <div className="pt-2 border-t">
              <ClientDocumentView
                documents={uploadedDocuments}
                token={token}
                onDocumentDeleted={onUploadComplete}
              />
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
