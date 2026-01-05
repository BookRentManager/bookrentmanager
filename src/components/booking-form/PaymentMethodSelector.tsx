import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";

interface PaymentMethod {
  id: string;
  method_type: string;
  display_name: string;
  description: string;
  fee_percentage: number;
  currency: string;
  requires_conversion: boolean;
}

interface ManualPaymentConfig {
  downpayment: {
    enabled: boolean;
    instructions: string | null;
  };
  balance: {
    enabled: boolean;
    instructions: string | null;
  };
  security_deposit: {
    enabled: boolean;
    instructions: string | null;
  };
}

interface PaymentMethodSelectorProps {
  paymentMethods: PaymentMethod[];
  selectedMethod: string | null;
  onMethodChange: (method: string) => void;
  manualInstructions: string;
  onInstructionsChange: (instructions: string) => void;
  disabled?: boolean;
  className?: string;
  manualPaymentConfig?: ManualPaymentConfig;
}

export const PaymentMethodSelector = ({
  paymentMethods,
  selectedMethod,
  onMethodChange,
  manualInstructions,
  onInstructionsChange,
  disabled,
  className,
  manualPaymentConfig,
}: PaymentMethodSelectorProps) => {
  const isManualSelected = selectedMethod === "manual";
  
  // Get instructions for manual down payment from config
  const manualDownpaymentInstructions = manualPaymentConfig?.downpayment?.instructions || manualInstructions;

  return (
    <Card className={`p-4 md:p-6 ${className || ''}`}>
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

        {/* Show read-only instructions when manual payment is selected */}
        {isManualSelected && manualDownpaymentInstructions && (
          <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800">
            <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertDescription className="text-amber-800 dark:text-amber-200">
              <p className="font-semibold mb-2">Payment Instructions:</p>
              <p className="whitespace-pre-wrap">{manualDownpaymentInstructions}</p>
            </AlertDescription>
          </Alert>
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
