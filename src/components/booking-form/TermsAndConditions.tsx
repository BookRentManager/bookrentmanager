import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface TermsAndConditionsProps {
  version: string;
  content: string;
}

export const TermsAndConditions = ({ version, content }: TermsAndConditionsProps) => {
  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Terms and Conditions</h3>
          <Badge variant="outline">Version {version}</Badge>
        </div>
        
        <ScrollArea className="h-[400px] w-full border rounded-lg p-4 bg-muted/30">
          <div 
            className="prose prose-sm max-w-none dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: content.replace(/\n/g, '<br/>') }}
          />
          
          {/* Security Deposit Policy */}
          <div className="mt-6 pt-4 border-t">
            <h4 className="font-semibold text-sm mb-2">Security Deposit Policy</h4>
            <p className="text-sm">
              A refundable security deposit will be required before vehicle pickup. This deposit is held as a pre-authorization 
              on your credit/debit card and will be released within 7-14 business days after the vehicle is returned in its 
              original condition, subject to inspection. The deposit may be used to cover any damages, fines, toll fees, 
              missing fuel, or contract violations incurred during the rental period.
            </p>
          </div>
        </ScrollArea>
        
        <p className="text-xs text-muted-foreground">
          Please read the terms and conditions carefully, including the security deposit policy, before signing below.
        </p>
      </div>
    </Card>
  );
};
