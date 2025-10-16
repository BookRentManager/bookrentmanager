import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus, Download, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function TelegramConfig() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    entityType: 'general' as 'general' | 'booking' | 'fine' | 'supplier_invoice' | 'client_invoice',
    entityId: '',
    telegramChatId: '',
    isEnabled: true,
  });

  // Fetch telegram configs
  const { data: configs, isLoading } = useQuery({
    queryKey: ['telegram-configs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('telegram_config')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Create config mutation
  const createConfig = useMutation({
    mutationFn: async (config: typeof formData) => {
      const { data, error } = await supabase
        .from('telegram_config')
        .insert([{
          entity_type: config.entityType,
          entity_id: config.entityType === 'general' ? null : config.entityId,
          telegram_chat_id: config.telegramChatId,
          is_enabled: config.isEnabled,
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Configuration saved",
        description: "Telegram sync has been configured successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['telegram-configs'] });
      setShowForm(false);
      setFormData({
        entityType: 'general',
        entityId: '',
        telegramChatId: '',
        isEnabled: true,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save configuration",
        variant: "destructive",
      });
    },
  });

  // Toggle enabled status
  const toggleEnabled = useMutation({
    mutationFn: async ({ id, isEnabled }: { id: string; isEnabled: boolean }) => {
      const { error } = await supabase
        .from('telegram_config')
        .update({ is_enabled: isEnabled })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['telegram-configs'] });
      toast({
        title: "Updated",
        description: "Sync status updated",
      });
    },
  });

  // Delete config
  const deleteConfig = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('telegram_config')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['telegram-configs'] });
      toast({
        title: "Deleted",
        description: "Configuration deleted",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.telegramChatId) {
      toast({
        title: "Chat ID required",
        description: "Please enter a Telegram chat ID",
        variant: "destructive",
      });
      return;
    }
    createConfig.mutate(formData);
  };

  const handleDownloadInstructions = () => {
    const link = document.createElement('a');
    link.href = '/telegram-setup-instructions.md';
    link.download = 'telegram-setup-instructions.md';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.941z"/>
                </svg>
                Telegram Integration
              </CardTitle>
              <CardDescription>
                Sync chat messages bidirectionally between webapp and Telegram groups
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={handleDownloadInstructions} className="gap-2">
              <Download className="h-4 w-4" />
              Setup Instructions
            </Button>
            <Button variant="outline" asChild>
              <a href="/telegram-setup-instructions.md" target="_blank" rel="noopener noreferrer" className="gap-2">
                <ExternalLink className="h-4 w-4" />
                View Instructions
              </a>
            </Button>
          </div>

          {!showForm && (
            <Button onClick={() => setShowForm(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Configure New Sync
            </Button>
          )}

          {showForm && (
            <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg">
              <div className="space-y-2">
                <Label htmlFor="entityType">Chat Context</Label>
                <Select
                  value={formData.entityType}
                  onValueChange={(value) => setFormData({ ...formData, entityType: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General Chat</SelectItem>
                    <SelectItem value="booking">Specific Booking</SelectItem>
                    <SelectItem value="fine">Specific Fine</SelectItem>
                    <SelectItem value="supplier_invoice">Specific Supplier Invoice</SelectItem>
                    <SelectItem value="client_invoice">Specific Client Invoice</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.entityType !== 'general' && (
                <div className="space-y-2">
                  <Label htmlFor="entityId">Entity ID (UUID)</Label>
                  <Input
                    id="entityId"
                    value={formData.entityId}
                    onChange={(e) => setFormData({ ...formData, entityId: e.target.value })}
                    placeholder="Enter entity UUID"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="telegramChatId">Telegram Chat ID</Label>
                <Input
                  id="telegramChatId"
                  value={formData.telegramChatId}
                  onChange={(e) => setFormData({ ...formData, telegramChatId: e.target.value })}
                  placeholder="-1001234567890"
                />
                <p className="text-xs text-muted-foreground">
                  Negative number from your Telegram group (see setup instructions)
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="isEnabled"
                  checked={formData.isEnabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, isEnabled: checked })}
                />
                <Label htmlFor="isEnabled">Enable sync immediately</Label>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={createConfig.isPending}>
                  {createConfig.isPending ? "Saving..." : "Save Configuration"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Active Configs */}
      <Card>
        <CardHeader>
          <CardTitle>Active Syncs</CardTitle>
          <CardDescription>Manage your Telegram integrations</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : configs && configs.length > 0 ? (
            <div className="space-y-3">
              {configs.map((config) => (
                <div key={config.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium capitalize">{config.entity_type}</span>
                      {config.is_enabled ? (
                        <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/20">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">Disabled</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">Chat ID: {config.telegram_chat_id}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={config.is_enabled}
                      onCheckedChange={(checked) => toggleEnabled.mutate({ id: config.id, isEnabled: checked })}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteConfig.mutate(config.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No configurations yet. Create one to get started!</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
