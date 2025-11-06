import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Eye, Loader2, HelpCircle, Shield, FileText } from 'lucide-react';
import { format } from 'date-fns';
import DOMPurify from 'dompurify';
import { parseMarkdown } from '@/lib/utils';

interface RentalPolicy {
  id: string;
  policy_type: 'faq' | 'cancellation' | 'insurance';
  title: string;
  content: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

type PolicyType = 'faq' | 'cancellation' | 'insurance';

export const RentalPoliciesSettings = () => {
  const queryClient = useQueryClient();
  const [selectedType, setSelectedType] = useState<PolicyType>('faq');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<RentalPolicy | null>(null);
  const [previewPolicy, setPreviewPolicy] = useState<RentalPolicy | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    sort_order: 0,
    is_active: true,
  });

  const { data: policies, isLoading } = useQuery({
    queryKey: ['rental-policies', selectedType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rental_policies')
        .select('*')
        .eq('policy_type', selectedType)
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      return data as RentalPolicy[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase
        .from('rental_policies')
        .insert({
          policy_type: selectedType,
          title: data.title,
          content: data.content,
          sort_order: data.sort_order,
          is_active: data.is_active,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rental-policies', selectedType] });
      toast.success('Policy created successfully');
      setDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error('Failed to create policy: ' + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase
        .from('rental_policies')
        .update({
          title: data.title,
          content: data.content,
          sort_order: data.sort_order,
          is_active: data.is_active,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rental-policies', selectedType] });
      toast.success('Policy updated successfully');
      setDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error('Failed to update policy: ' + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('rental_policies')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rental-policies', selectedType] });
      toast.success('Policy deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete policy: ' + error.message);
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('rental_policies')
        .update({ is_active })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rental-policies', selectedType] });
      toast.success('Active status updated');
    },
    onError: (error) => {
      toast.error('Failed to update status: ' + error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      sort_order: 0,
      is_active: true,
    });
    setEditingPolicy(null);
  };

  const openEditDialog = (policy: RentalPolicy) => {
    setEditingPolicy(policy);
    setFormData({
      title: policy.title,
      content: policy.content,
      sort_order: policy.sort_order,
      is_active: policy.is_active,
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.title || !formData.content) {
      toast.error('Please fill in title and content');
      return;
    }

    if (formData.title.length < 5) {
      toast.error('Title must be at least 5 characters');
      return;
    }

    if (formData.content.length < 20) {
      toast.error('Content must be at least 20 characters');
      return;
    }

    if (editingPolicy) {
      updateMutation.mutate({ id: editingPolicy.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const getTypeIcon = (type: PolicyType) => {
    switch (type) {
      case 'faq':
        return <HelpCircle className="h-4 w-4" />;
      case 'cancellation':
        return <FileText className="h-4 w-4" />;
      case 'insurance':
        return <Shield className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (type: PolicyType) => {
    switch (type) {
      case 'faq':
        return 'FAQ Questions';
      case 'cancellation':
        return 'Cancellation Policies';
      case 'insurance':
        return 'Insurance Terms';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rental Policies Management</CardTitle>
        <CardDescription>
          Manage FAQ questions, cancellation policies, and insurance terms for your booking form
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={selectedType} onValueChange={(value) => setSelectedType(value as PolicyType)}>
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="faq" className="gap-2">
                {getTypeIcon('faq')}
                <span className="hidden sm:inline">FAQ</span>
              </TabsTrigger>
              <TabsTrigger value="cancellation" className="gap-2">
                {getTypeIcon('cancellation')}
                <span className="hidden sm:inline">Cancellation</span>
              </TabsTrigger>
              <TabsTrigger value="insurance" className="gap-2">
                {getTypeIcon('insurance')}
                <span className="hidden sm:inline">Insurance</span>
              </TabsTrigger>
            </TabsList>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Create New</span>
              <span className="sm:hidden">New</span>
            </Button>
          </div>

          {['faq', 'cancellation', 'insurance'].map((type) => (
            <TabsContent key={type} value={type}>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : policies && policies.length > 0 ? (
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <div className="inline-block min-w-full align-middle">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">Order</TableHead>
                          <TableHead>Title</TableHead>
                          <TableHead className="hidden md:table-cell">Created</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {policies.map((policy) => (
                          <TableRow key={policy.id}>
                            <TableCell className="font-medium">{policy.sort_order}</TableCell>
                            <TableCell className="max-w-xs truncate">{policy.title}</TableCell>
                            <TableCell className="hidden md:table-cell">
                              {format(new Date(policy.created_at), 'PP')}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={policy.is_active}
                                  onCheckedChange={(checked) =>
                                    toggleActiveMutation.mutate({ id: policy.id, is_active: checked })
                                  }
                                />
                                {policy.is_active && <Badge className="hidden sm:inline-flex">Active</Badge>}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setPreviewPolicy(policy);
                                    setPreviewOpen(true);
                                  }}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEditDialog(policy)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    if (confirm('Are you sure you want to delete this policy?')) {
                                      deleteMutation.mutate(policy.id);
                                    }
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No {getTypeLabel(type as PolicyType).toLowerCase()} found. Create one to get started.
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingPolicy ? 'Edit Policy' : 'Create New Policy'} - {getTypeLabel(selectedType)}
              </DialogTitle>
              <DialogDescription>
                Use **bold** and *italic* markdown formatting in your content
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  placeholder="e.g., What happens if I cancel?"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">Content * (Supports Markdown)</Label>
                <Textarea
                  id="content"
                  placeholder="Enter policy content. Use **text** for bold, *text* for italic..."
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  rows={10}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Markdown: **bold**, *italic*. Line breaks will be preserved.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sort_order">Sort Order</Label>
                  <Input
                    id="sort_order"
                    type="number"
                    min="0"
                    value={formData.sort_order}
                    onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="is_active">Active Status</Label>
                  <div className="flex items-center gap-2 h-10">
                    <Switch
                      id="is_active"
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                    />
                    <span className="text-sm">{formData.is_active ? 'Active' : 'Inactive'}</span>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
                {(createMutation.isPending || updateMutation.isPending) ? 'Saving...' : 'Save Policy'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Preview Dialog */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Preview: {previewPolicy?.title}</DialogTitle>
              <DialogDescription>
                How this will appear in the booking form
              </DialogDescription>
            </DialogHeader>
            {previewPolicy && (
              <div className="space-y-4">
                <div className="bg-muted p-4 rounded-lg">
                  <h3 className="font-semibold mb-2">{previewPolicy.title}</h3>
                  <div 
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ 
                      __html: DOMPurify.sanitize(parseMarkdown(previewPolicy.content)) 
                    }}
                  />
                </div>
                <div className="flex gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">Order: {previewPolicy.sort_order}</Badge>
                  <Badge variant={previewPolicy.is_active ? "default" : "secondary"}>
                    {previewPolicy.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setPreviewOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
