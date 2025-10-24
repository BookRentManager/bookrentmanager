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
  className?: string;
  
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
  className,
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
    <Card className={className}>
      <CardHeader className="space-y-2 pb-4">
        <CardTitle className="text-lg md:text-xl">Client/Payer</CardTitle>
        <CardDescription className="text-sm leading-relaxed">
          Please enter your details here if you are the person responsible for the payment and security deposit, and also the driver (Client).
          {' '}If you are booking and paying on behalf of someone else, still enter your own details here as the Payer/Client, and then provide the Guest Information below.
          {' '}Please do not use the Guest Information section for additional drivers.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Full Name (as written in passport/ID) *</Label>
            <Input value={clientName} disabled className="bg-muted h-12 md:h-10" />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Email *</Label>
            <Input value={clientEmail} disabled className="bg-muted h-12 md:h-10" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone" className="text-sm font-medium">Phone Number *</Label>
          <PhoneInput
            value={clientPhone}
            onChange={onPhoneChange}
            placeholder="Enter phone number with country code"
            disabled={disabled}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="company" className="text-sm font-medium">Company Name (Optional)</Label>
          <Input
            id="company"
            value={companyName}
            onChange={(e) => onCompanyNameChange(e.target.value)}
            placeholder="Enter company name"
            disabled={disabled}
            className="h-12 md:h-10"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="address" className="text-sm font-medium">
            Billing Address * <span className="text-xs text-muted-foreground font-normal">(used for payment verification, not delivery)</span>
          </Label>
          <Textarea
            id="address"
            value={billingAddress}
            onChange={(e) => onBillingAddressChange(e.target.value)}
            placeholder="Street, City, Postal Code"
            rows={3}
            disabled={disabled}
            className="resize-none"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="country" className="text-sm font-medium">Country of Residence *</Label>
          <CountrySelect
            value={country}
            onChange={onCountryChange}
            placeholder="Select your country"
            disabled={disabled}
          />
        </div>

        {!showGuestInfo && (
          <div className="flex justify-center pt-3">
            <Button
              type="button"
              variant="outline"
              size="default"
              onClick={() => onShowGuestInfoChange(true)}
              disabled={disabled}
              className="flex items-center gap-2 h-12 px-6 active:scale-95"
            >
              <Plus className="h-5 w-5" />
              <span className="font-medium">Add Guest Information</span>
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
