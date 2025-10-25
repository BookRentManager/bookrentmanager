import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';

export function BankAccountSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    bank_account_holder: '',
    bank_account_iban: '',
    bank_account_bic: '',
    bank_account_bank_name: '',
    bank_transfer_instructions: '',
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('app_settings')
        .select('bank_account_holder, bank_account_iban, bank_account_bic, bank_account_bank_name, bank_transfer_instructions')
        .limit(1)
        .single();

      if (error) throw error;

      if (data) {
        setSettings({
          bank_account_holder: data.bank_account_holder || '',
          bank_account_iban: data.bank_account_iban || '',
          bank_account_bic: data.bank_account_bic || '',
          bank_account_bank_name: data.bank_account_bank_name || '',
          bank_transfer_instructions: data.bank_transfer_instructions || '',
        });
      }
    } catch (error) {
      console.error('Error fetching bank settings:', error);
      toast.error('Failed to load bank account settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      const { error } = await supabase
        .from('app_settings')
        .update({
          bank_account_holder: settings.bank_account_holder,
          bank_account_iban: settings.bank_account_iban,
          bank_account_bic: settings.bank_account_bic,
          bank_account_bank_name: settings.bank_account_bank_name,
          bank_transfer_instructions: settings.bank_transfer_instructions,
          updated_at: new Date().toISOString(),
        })
        .eq('id', (await supabase.from('app_settings').select('id').limit(1).single()).data?.id);

      if (error) throw error;

      toast.success('Bank account settings saved successfully');
    } catch (error) {
      console.error('Error saving bank settings:', error);
      toast.error('Failed to save bank account settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bank Account Details</CardTitle>
        <CardDescription>
          Configure your bank account information for clients making bank transfer payments
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="account-holder">Account Holder Name</Label>
            <Input
              id="account-holder"
              value={settings.bank_account_holder}
              onChange={(e) => setSettings({ ...settings, bank_account_holder: e.target.value })}
              placeholder="e.g., KingRent Sàrl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="iban">IBAN</Label>
            <Input
              id="iban"
              value={settings.bank_account_iban}
              onChange={(e) => setSettings({ ...settings, bank_account_iban: e.target.value })}
              placeholder="e.g., CH00 0000 0000 0000 0000 0"
              className="font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bic">BIC/SWIFT Code</Label>
            <Input
              id="bic"
              value={settings.bank_account_bic}
              onChange={(e) => setSettings({ ...settings, bank_account_bic: e.target.value })}
              placeholder="e.g., POFICHBEXXX"
              className="font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bank-name">Bank Name</Label>
            <Input
              id="bank-name"
              value={settings.bank_account_bank_name}
              onChange={(e) => setSettings({ ...settings, bank_account_bank_name: e.target.value })}
              placeholder="e.g., PostFinance"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="instructions">Transfer Instructions</Label>
            <Textarea
              id="instructions"
              value={settings.bank_transfer_instructions}
              onChange={(e) => setSettings({ ...settings, bank_transfer_instructions: e.target.value })}
              placeholder="e.g., Please include the booking reference number in your transfer description. Payment processing may take 2-5 business days."
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              This message will be shown to clients when they select bank transfer as payment method
            </p>
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Bank Account Settings
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
