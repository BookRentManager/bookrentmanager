import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface PaymentMethod {
  id: string;
  method_type: string;
  display_name: string;
  description: string;
  fee_percentage: number;
  currency: string;
  requires_conversion: boolean;
}

interface PaymentMethodSelectorProps {
  paymentMethods: PaymentMethod[];
  selectedMethod: string | null;
  onMethodChange: (method: string) => void;
  manualInstructions: string;
  onInstructionsChange: (instructions: string) => void;
  disabled?: boolean;
}

export const PaymentMethodSelector = ({
  paymentMethods,
  selectedMethod,
  onMethodChange,
  manualInstructions,
  onInstructionsChange,
  disabled,
}: PaymentMethodSelectorProps) => {
  const hasManualMethod = selectedMethod === "manual";

  return (
    <Card className="p-4 md:p-6">
      <div className="space-y-4">
        <div>
          <h3 className="text-base md:text-lg font-semibold mb-1">Select Payment Method</h3>
          <p className="text-xs md:text-sm text-muted-foreground">
            Choose how you'd like to pay for this booking.
          </p>
        </div>

        <RadioGroup value={selectedMethod || ''} onValueChange={onMethodChange} disabled={disabled} className="space-y-3">
          {paymentMethods.map((method) => (
            <div
              key={method.id}
              className="flex items-start space-x-3 p-4 md:p-4 border-2 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer active:scale-[0.98] min-h-[60px]"
              onClick={() => !disabled && onMethodChange(method.method_type)}
            >
              <RadioGroupItem value={method.method_type} id={method.method_type} className="mt-1 shrink-0" />
              <div className="flex-1 space-y-1 min-w-0">
                <Label
                  htmlFor={method.method_type}
                  className="text-sm md:text-base font-medium cursor-pointer flex flex-wrap items-center gap-2"
                >
                  <span>{method.display_name}</span>
                  {method.fee_percentage > 0 && (
                    <Badge variant="secondary" className="text-xs shrink-0">
                      +{method.fee_percentage}% fee
                    </Badge>
                  )}
                  {method.requires_conversion && (
                    <Badge variant="outline" className="text-xs shrink-0">
                      {method.currency}
                    </Badge>
                  )}
                </Label>
                <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
                  {method.description}
                </p>
              </div>
            </div>
          ))}
        </RadioGroup>

        {hasManualMethod && (
          <div className="space-y-2 pt-4 border-t">
            <Label htmlFor="manual-instructions">
              Payment Instructions for Cash/Crypto
            </Label>
            <Textarea
              id="manual-instructions"
              placeholder="Enter payment instructions for cash or cryptocurrency payments..."
              value={manualInstructions}
              onChange={(e) => onInstructionsChange(e.target.value)}
              disabled={disabled}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Provide details on how the client should make the manual payment.
            </p>
          </div>
        )}

        {!selectedMethod && (
          <div className="text-sm text-destructive">
            Please select a payment method.
          </div>
        )}
      </div>
    </Card>
  );
};
