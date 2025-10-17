import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface PaymentAmountSelectorProps {
  totalAmount: number;
  downPaymentPercent: number;
  selectedChoice: 'down_payment' | 'full_payment';
  onChoiceChange: (choice: 'down_payment' | 'full_payment') => void;
  currency: string;
  disabled?: boolean;
}

export function PaymentAmountSelector({
  totalAmount,
  downPaymentPercent,
  selectedChoice,
  onChoiceChange,
  currency,
  disabled = false,
}: PaymentAmountSelectorProps) {
  const downPaymentAmount = (totalAmount * downPaymentPercent) / 100;
  const remainingAmount = totalAmount - downPaymentAmount;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Amount</CardTitle>
        <CardDescription>Choose how much you'd like to pay now</CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={selectedChoice}
          onValueChange={(value) => onChoiceChange(value as 'down_payment' | 'full_payment')}
          disabled={disabled}
          className="space-y-4"
        >
          <div className="flex items-start space-x-3 space-y-0 rounded-md border p-4 hover:bg-accent cursor-pointer">
            <RadioGroupItem value="down_payment" id="down_payment" />
            <div className="flex-1">
              <Label htmlFor="down_payment" className="cursor-pointer font-medium">
                Down Payment ({downPaymentPercent}%)
              </Label>
              <p className="text-2xl font-bold text-primary mt-1">
                {currency} {downPaymentAmount.toFixed(2)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Remaining balance: {currency} {remainingAmount.toFixed(2)} (due later)
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3 space-y-0 rounded-md border p-4 hover:bg-accent cursor-pointer">
            <RadioGroupItem value="full_payment" id="full_payment" />
            <div className="flex-1">
              <Label htmlFor="full_payment" className="cursor-pointer font-medium">
                Full Payment (100%)
              </Label>
              <p className="text-2xl font-bold text-primary mt-1">
                {currency} {totalAmount.toFixed(2)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Pay in full now - no remaining balance
              </p>
            </div>
          </div>
        </RadioGroup>
      </CardContent>
    </Card>
  );
}
