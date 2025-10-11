import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Webhook, Download, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Integrations() {
  const webhookUrl = "https://lbvaghmqwhsawvxyiemw.supabase.co/functions/v1/magnolia-webhook";

  const handleDownloadInstructions = () => {
    const link = document.createElement('a');
    link.href = '/magnolia-webhook-instructions.md';
    link.download = 'magnolia-webhook-instructions.md';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Integrations</h2>
        <p className="text-sm md:text-base text-muted-foreground">
          Connect external services and manage webhooks
        </p>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Webhook className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Magnolia CMS Webhook</CardTitle>
          </div>
          <CardDescription>
            Receive booking data automatically from Magnolia CMS
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-xs">Active</Badge>
              <span className="text-sm text-muted-foreground">Endpoint Ready</span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              This webhook automatically creates new bookings when Magnolia CMS sends booking form data.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Webhook URL</label>
            <div className="flex gap-2">
              <code className="flex-1 px-3 py-2 text-xs bg-muted rounded-md overflow-x-auto whitespace-nowrap">
                {webhookUrl}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopyUrl}
              >
                Copy
              </Button>
            </div>
          </div>

          <div className="pt-4 space-y-3">
            <h4 className="text-sm font-medium">Integration Instructions</h4>
            <p className="text-sm text-muted-foreground">
              Download the complete integration guide for your Magnolia CMS developers.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="default"
                onClick={handleDownloadInstructions}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Download Instructions
              </Button>
              
              <Button
                variant="outline"
                asChild
              >
                <a 
                  href="/magnolia-webhook-instructions.md" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  View Instructions
                </a>
              </Button>
            </div>
          </div>

          <div className="pt-4 border-t">
            <h4 className="text-sm font-medium mb-2">Key Features</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Automatic booking creation from Magnolia CMS forms</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Secure authentication with webhook secret key</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Duplicate prevention by reference code</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Full field mapping and validation</span>
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-lg">More Integrations Coming Soon</CardTitle>
          <CardDescription>
            Additional integrations will be available here in future updates
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
