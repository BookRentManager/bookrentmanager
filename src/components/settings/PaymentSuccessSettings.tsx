import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const messageTypes = [
  { value: 'down_payment', label: 'Down Payment' },
  { value: 'balance_payment', label: 'Balance Payment' },
  { value: 'security_deposit', label: 'Security Deposit' },
];

const placeholders = [
  '{{bookingRef}}',
  '{{accessToken}}',
];

export function PaymentSuccessSettings() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('down_payment');
  const [editedContent, setEditedContent] = useState('');

  const { data: messages, isLoading } = useQuery({
    queryKey: ['payment-success-messages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_success_messages')
        .select('*')
        .order('message_type');
      
      if (error) throw error;
      return data;
    },
  });

  const updateMessage = useMutation({
    mutationFn: async ({ type, content }: { type: string; content: string }) => {
      const { error } = await supabase
        .from('payment_success_messages')
        .update({ 
          html_content: content,
          updated_at: new Date().toISOString()
        })
        .eq('message_type', type);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-success-messages'] });
      toast.success('Success message updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update message: ' + error.message);
    },
  });

  const activeMessage = messages?.find(m => m.message_type === activeTab);

  const handleSave = () => {
    if (!activeMessage) return;
    
    updateMessage.mutate({
      type: activeTab,
      content: editedContent || activeMessage.html_content,
    });
  };

  const handleReset = () => {
    if (!activeMessage) return;
    setEditedContent(activeMessage.html_content);
    toast.info('Reset to current saved version');
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Success Messages</CardTitle>
        <CardDescription>
          Customize the success messages displayed after payment completion
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(value) => {
          setActiveTab(value);
          const message = messages?.find(m => m.message_type === value);
          if (message) {
            setEditedContent(message.html_content);
          }
        }}>
          <TabsList className="grid w-full grid-cols-3">
            {messageTypes.map((type) => (
              <TabsTrigger key={type.value} value={type.value}>
                {type.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {messageTypes.map((type) => (
            <TabsContent key={type.value} value={type.value} className="space-y-4">
              {activeMessage && (
                <>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="content">HTML Content</Label>
                      <Textarea
                        id="content"
                        value={editedContent || activeMessage.html_content}
                        onChange={(e) => setEditedContent(e.target.value)}
                        className="min-h-[300px] font-mono text-sm"
                        placeholder="HTML content"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Live Preview</Label>
                      <div 
                        className="border rounded-md p-4 min-h-[300px] overflow-auto bg-white"
                        dangerouslySetInnerHTML={{ 
                          __html: editedContent || activeMessage.html_content 
                        }}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Available Placeholders</Label>
                    <div className="flex flex-wrap gap-2">
                      {placeholders.map((placeholder) => (
                        <code
                          key={placeholder}
                          className="px-2 py-1 bg-muted rounded text-xs cursor-pointer hover:bg-muted/80"
                          onClick={() => {
                            navigator.clipboard.writeText(placeholder);
                            toast.success(`Copied ${placeholder}`);
                          }}
                        >
                          {placeholder}
                        </code>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Click any placeholder to copy it to clipboard
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      onClick={handleSave}
                      disabled={updateMessage.isPending}
                    >
                      {updateMessage.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Save Changes
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={handleReset}
                      disabled={updateMessage.isPending}
                    >
                      Reset
                    </Button>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    Last updated: {new Date(activeMessage.updated_at).toLocaleString()}
                  </div>
                </>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
