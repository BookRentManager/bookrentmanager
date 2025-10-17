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
        </ScrollArea>
        
        <p className="text-xs text-muted-foreground">
          Please read the terms and conditions carefully before signing below.
        </p>
      </div>
    </Card>
  );
};
