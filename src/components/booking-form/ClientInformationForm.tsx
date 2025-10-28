import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PhoneInput } from "@/components/shared/PhoneInput";
import { CountrySelect } from "@/components/shared/CountrySelect";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, X, Info } from "lucide-react";

interface ClientInformationFormProps {
  clientName: string;
  originalClientName: string;
  onClientNameChange: (value: string) => void;
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
  originalClientName,
  onClientNameChange,
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
        <CardDescription className="text-sm leading-relaxed space-y-2">
          <div>
            <strong className="text-foreground">If you are the driver and paying:</strong>
            <br />
            Enter your details here as the Client/Payer.
          </div>
          <div>
            <strong className="text-foreground">If you are booking and paying on behalf of someone else:</strong>
            <br />
            Still enter your own details here as the Client/Payer, then provide the Guest/Driver Information below.
          </div>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Full Name (as written in passport/ID) *
              {clientName !== originalClientName && (
                <span className="text-xs text-muted-foreground font-normal ml-2">
                  (Original: {originalClientName})
                </span>
              )}
            </Label>
            <Input 
              value={clientName} 
              onChange={(e) => onClientNameChange(e.target.value)}
              placeholder="Enter your full name as in passport/ID"
              disabled={disabled}
              className="h-12 md:h-10" 
            />
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
          <Alert className="border-l-4 border-amber-500 bg-amber-50/50 dark:bg-amber-950/20">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex items-start gap-3 flex-1">
                <Info className="h-5 w-5 text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
                <AlertDescription className="text-sm font-medium text-amber-900 dark:text-amber-100 leading-relaxed">
                  Note: Please, do not use the Guest/Driver Information section for additional drivers.
                </AlertDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="default"
                onClick={() => onShowGuestInfoChange(true)}
                disabled={disabled}
                className="flex items-center gap-2 h-10 px-4 shrink-0 w-full sm:w-auto"
              >
                <Plus className="h-4 w-4" />
                <span className="font-medium">Add Guest/Driver Information</span>
              </Button>
            </div>
          </Alert>
        )}

        {showGuestInfo && (
          <div className="border-t pt-4 mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">Guest/Driver Information</h4>
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
              <Label htmlFor="guest-name">Full Guest/Driver Name *</Label>
              <Input
                id="guest-name"
                value={guestName}
                onChange={(e) => onGuestNameChange(e.target.value)}
                placeholder="Enter guest/driver's full name"
                disabled={disabled}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="guest-phone">Phone Number (Optional)</Label>
              <PhoneInput
                value={guestPhone}
                onChange={onGuestPhoneChange}
                placeholder="Enter guest/driver's phone number"
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
                placeholder="Select guest/driver's country"
                disabled={disabled}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="guest-company">Company Name (Optional)</Label>
              <Input
                id="guest-company"
                value={guestCompanyName}
                onChange={(e) => onGuestCompanyNameChange(e.target.value)}
                placeholder="Enter guest/driver's company name"
                disabled={disabled}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
