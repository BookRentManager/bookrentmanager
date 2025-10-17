import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PhoneInput } from "@/components/shared/PhoneInput";
import { CountrySelect } from "@/components/shared/CountrySelect";

interface ClientInformationFormProps {
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  onPhoneChange: (value: string) => void;
  billingAddress: string;
  onBillingAddressChange: (value: string) => void;
  country: string;
  onCountryChange: (value: string) => void;
  companyName: string;
  onCompanyNameChange: (value: string) => void;
  disabled?: boolean;
}

export function ClientInformationForm({
  clientName,
  clientEmail,
  clientPhone,
  onPhoneChange,
  billingAddress,
  onBillingAddressChange,
  country,
  onCountryChange,
  companyName,
  onCompanyNameChange,
  disabled = false,
}: ClientInformationFormProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Information</CardTitle>
        <CardDescription>Please review and update your contact details</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={clientName} disabled className="bg-muted" />
          </div>

          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={clientEmail} disabled className="bg-muted" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone Number *</Label>
          <PhoneInput
            value={clientPhone}
            onChange={onPhoneChange}
            placeholder="Enter phone number with country code"
            disabled={disabled}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="company">Company Name (Optional)</Label>
          <Input
            id="company"
            value={companyName}
            onChange={(e) => onCompanyNameChange(e.target.value)}
            placeholder="Enter company name"
            disabled={disabled}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="address">Billing Address *</Label>
          <Textarea
            id="address"
            value={billingAddress}
            onChange={(e) => onBillingAddressChange(e.target.value)}
            placeholder="Street, City, Postal Code"
            rows={3}
            disabled={disabled}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="country">Country *</Label>
          <CountrySelect
            value={country}
            onChange={onCountryChange}
            placeholder="Select your country"
            disabled={disabled}
          />
        </div>
      </CardContent>
    </Card>
  );
}
