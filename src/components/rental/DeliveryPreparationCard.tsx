import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import * as LucideIcons from "lucide-react";

interface DeliveryStep {
  id: string;
  title: string;
  description: string;
  icon_name: string | null;
  sort_order: number;
}

interface DeliveryPreparationCardProps {
  whatToBring: DeliveryStep[];
  deliveryChecklist: DeliveryStep[];
}

export function DeliveryPreparationCard({
  whatToBring,
  deliveryChecklist,
}: DeliveryPreparationCardProps) {
  const getIcon = (iconName: string | null) => {
    if (!iconName) return LucideIcons.Info;
    const Icon = (LucideIcons as any)[iconName];
    return Icon || LucideIcons.Info;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Delivery Preparation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* What to Bring */}
        <div>
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <LucideIcons.Luggage className="h-4 w-4" />
            What to Bring
          </h4>
          <div className="space-y-3">
            {whatToBring
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((item) => {
                const Icon = getIcon(item.icon_name);
                return (
                  <div key={item.id} className="flex gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{item.title}</p>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        <Separator />

        {/* Delivery Checklist */}
        <div>
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <LucideIcons.ClipboardList className="h-4 w-4" />
            Delivery Process
          </h4>
          <div className="space-y-3">
            {deliveryChecklist
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((item, index) => {
                const Icon = getIcon(item.icon_name);
                return (
                  <div key={item.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-semibold">
                        {index + 1}
                      </div>
                      {index < deliveryChecklist.length - 1 && (
                        <div className="w-0.5 h-8 bg-border mt-1" />
                      )}
                    </div>
                    <div className="flex-1 pb-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <p className="font-medium text-sm">{item.title}</p>
                      </div>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}