import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PhoneInput } from "@/components/shared/PhoneInput";
import { CountrySelect } from "@/components/shared/CountrySelect";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";

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
  
  // Guest information props
  showGuestInfo: boolean;
  onShowGuestInfoChange: (show: boolean) => void;
  guestName: string;
  onGuestNameChange: (value: string) => void;
  guestPhone: string;
  onGuestPhoneChange: (value: string) => void;
  guestBillingAddress: string;
  onGuestBillingAddressChange: (value: string) => void;
  guestCountry: string;
  onGuestCountryChange: (value: string) => void;
  guestCompanyName: string;
  onGuestCompanyNameChange: (value: string) => void;
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
  showGuestInfo,
  onShowGuestInfoChange,
  guestName,
  onGuestNameChange,
  guestPhone,
  onGuestPhoneChange,
  guestBillingAddress,
  onGuestBillingAddressChange,
  guestCountry,
  onGuestCountryChange,
  guestCompanyName,
  onGuestCompanyNameChange,
}: ClientInformationFormProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Information</CardTitle>
        <CardDescription>
          Enter here the details of the person whose payment method is used — the name must match the credit card holder or bank account owner.
          {' '}If you are booking on behalf of someone else, enter your own details here (as the client) and select the guest information option below.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Full Name (as written in passport/ID) *</Label>
            <Input value={clientName} disabled className="bg-muted" />
          </div>

          <div className="space-y-2">
            <Label>Email *</Label>
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
          <Label htmlFor="address">Billing Address * (used for payment verification, not delivery)</Label>
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
          <Label htmlFor="country">Country of Residence *</Label>
          <CountrySelect
            value={country}
            onChange={onCountryChange}
            placeholder="Select your country"
            disabled={disabled}
          />
        </div>

        {!showGuestInfo && (
          <div className="flex justify-center pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onShowGuestInfoChange(true)}
              disabled={disabled}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Guest Information
            </Button>
          </div>
        )}

        {showGuestInfo && (
          <div className="border-t pt-4 mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">Guest Information</h4>
              <Button 
                type="button"
                variant="ghost" 
                size="sm"
                onClick={() => onShowGuestInfoChange(false)}
                disabled={disabled}
                className="flex items-center gap-1"
              >
                <X className="h-4 w-4" />
                Remove
              </Button>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="guest-name">Full Guest Name *</Label>
              <Input
                id="guest-name"
                value={guestName}
                onChange={(e) => onGuestNameChange(e.target.value)}
                placeholder="Enter guest's full name"
                disabled={disabled}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="guest-phone">Phone Number (Optional)</Label>
              <PhoneInput
                value={guestPhone}
                onChange={onGuestPhoneChange}
                placeholder="Enter guest's phone number"
                disabled={disabled}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="guest-address">Billing Address (needed in case of police fine redirection)</Label>
              <Textarea
                id="guest-address"
                value={guestBillingAddress}
                onChange={(e) => onGuestBillingAddressChange(e.target.value)}
                placeholder="Street, City, Postal Code"
                rows={3}
                disabled={disabled}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="guest-country">Country of Residence *</Label>
              <CountrySelect
                value={guestCountry}
                onChange={onGuestCountryChange}
                placeholder="Select guest's country"
                disabled={disabled}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="guest-company">Company Name (Optional)</Label>
              <Input
                id="guest-company"
                value={guestCompanyName}
                onChange={(e) => onGuestCompanyNameChange(e.target.value)}
                placeholder="Enter guest's company name"
                disabled={disabled}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
