import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Download, Eye, Clock } from "lucide-react";

interface ContractDocument {
  id: string;
  document_type: string;
  document_url: string;
  uploaded_at: string;
}

interface RentalContractsSectionProps {
  deliveryContract?: ContractDocument;
  collectionContract?: ContractDocument;
}

export function RentalContractsSection({
  deliveryContract,
  collectionContract,
}: RentalContractsSectionProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const ContractCard = ({
    title,
    contract,
    type,
  }: {
    title: string;
    contract?: ContractDocument;
    type: 'delivery' | 'collection';
  }) => (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">{title}</CardTitle>
          </div>
          {contract ? (
            <Badge variant="default" className="bg-green-500">Signed</Badge>
          ) : (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Pending
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {contract ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Signed on {formatDate(contract.uploaded_at)}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => window.open(contract.document_url, '_blank')}
              >
                <Eye className="h-4 w-4 mr-2" />
                View
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = contract.document_url;
                  link.download = `${type}_contract.pdf`;
                  link.click();
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
          </div>
        ) : (
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <p className="text-sm text-muted-foreground">
              Contract will be available after {type === 'delivery' ? 'pickup' : 'return'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Rental Contracts</h3>
      <div className="grid gap-4">
        <ContractCard
          title="Delivery Contract"
          contract={deliveryContract}
          type="delivery"
        />
        <ContractCard
          title="Collection Contract"
          contract={collectionContract}
          type="collection"
        />
      </div>
    </div>
  );
}