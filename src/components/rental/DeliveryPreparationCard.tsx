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
      <CardHeader className="p-4 md:p-6">
        <CardTitle className="text-lg">Delivery Preparation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 md:space-y-6 p-4 md:p-6 pt-0">
        {/* What to Bring */}
        <div>
          <h4 className="font-semibold mb-3 flex items-center gap-2 text-sm md:text-base">
            <LucideIcons.Luggage className="h-4 w-4" />
            What to Bring
          </h4>
          <div className="space-y-2 md:space-y-3">
            {whatToBring
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((item) => {
                const Icon = getIcon(item.icon_name);
                return (
                  <div key={item.id} className="flex gap-2 md:gap-3">
                    <div className="flex-shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Icon className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm md:text-base">{item.title}</p>
                      <p className="text-xs md:text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        <Separator />

        {/* Delivery Process */}
        <div>
          <h4 className="font-semibold mb-3 flex items-center gap-2 text-sm md:text-base">
            <LucideIcons.ClipboardList className="h-4 w-4" />
            Delivery Process
          </h4>
          <div className="space-y-2 md:space-y-3">
            {deliveryChecklist
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((item, index) => {
                const Icon = getIcon(item.icon_name);
                return (
                  <div key={item.id} className="flex gap-2 md:gap-3">
                    <div className="flex flex-col items-center">
                      <div className="flex-shrink-0 w-7 h-7 md:w-8 md:h-8 rounded-full bg-king-gold/10 text-king-gold flex items-center justify-center text-xs md:text-sm font-bold">
                        {index + 1}
                      </div>
                      {index < deliveryChecklist.length - 1 && (
                        <div className="w-0.5 h-6 md:h-8 bg-border mt-1" />
                      )}
                    </div>
                    <div className="flex-1 pb-2 md:pb-3">
                      <div className="flex items-start gap-2 mb-1">
                        <Icon className="h-4 w-4 text-king-gold mt-0.5 flex-shrink-0" />
                        <p className="font-medium text-sm md:text-base leading-tight">{item.title}</p>
                      </div>
                      <p className="text-xs md:text-sm text-muted-foreground leading-relaxed ml-6">
                        {item.description}
                      </p>
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