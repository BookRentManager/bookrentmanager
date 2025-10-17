import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PaymentAmountSelectorProps {
  totalAmount: number;
  downPaymentPercent: number | null;
  selectedChoice: 'down_payment' | 'full_payment';
  onChoiceChange: (choice: 'down_payment' | 'full_payment') => void;
  currency: string;
}

export function PaymentAmountSelector({
  totalAmount,
  downPaymentPercent,
  selectedChoice,
  onChoiceChange,
  currency
}: PaymentAmountSelectorProps) {
  const downPaymentAmount = downPaymentPercent
    ? (totalAmount * downPaymentPercent) / 100
    : totalAmount;
  
  const balance = totalAmount - downPaymentAmount;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-primary" />
          <CardTitle>Payment Amount</CardTitle>
        </div>
        <CardDescription>
          Choose how much you want to pay now
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup value={selectedChoice} onValueChange={onChoiceChange}>
          <div className="space-y-3">
            {/* Down Payment Option */}
            {downPaymentPercent && downPaymentPercent < 100 && (
              <div className="flex items-start space-x-3 border rounded-lg p-4 hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="down_payment" id="down_payment" />
                <div className="flex-1 space-y-1">
                  <Label
                    htmlFor="down_payment"
                    className="text-base font-medium cursor-pointer flex items-center gap-2"
                  >
                    Down Payment ({downPaymentPercent}%)
                    <Badge variant="secondary">Recommended</Badge>
                  </Label>
                  <p className="text-2xl font-bold text-primary">
                    {downPaymentAmount.toFixed(2)} {currency}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Remaining balance: {balance.toFixed(2)} {currency}
                  </p>
                </div>
              </div>
            )}

            {/* Full Payment Option */}
            <div className="flex items-start space-x-3 border rounded-lg p-4 hover:bg-accent/50 transition-colors">
              <RadioGroupItem value="full_payment" id="full_payment" />
              <div className="flex-1 space-y-1">
                <Label
                  htmlFor="full_payment"
                  className="text-base font-medium cursor-pointer"
                >
                  Full Payment (100%)
                </Label>
                <p className="text-2xl font-bold text-primary">
                  {totalAmount.toFixed(2)} {currency}
                </p>
                <p className="text-sm text-muted-foreground">
                  Pay the entire amount now
                </p>
              </div>
            </div>
          </div>
        </RadioGroup>
      </CardContent>
    </Card>
  );
}
