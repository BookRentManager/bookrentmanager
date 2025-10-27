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
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Download, FileText, Upload, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface TermsVersion {
  id: string;
  version: string;
  content: string;
  pdf_url: string | null;
  effective_date: string;
  is_active: boolean;
  created_at: string;
}

export const TermsAndConditionsSettings = () => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editingTerms, setEditingTerms] = useState<TermsVersion | null>(null);
  const [previewTerms, setPreviewTerms] = useState<TermsVersion | null>(null);
  const [extracting, setExtracting] = useState(false);

  const [formData, setFormData] = useState({
    version: '',
    content: '',
    effective_date: new Date().toISOString().split('T')[0],
    is_active: false,
    pdf_file: null as File | null,
    pdf_url: null as string | null,
  });

  const { data: terms, isLoading } = useQuery({
    queryKey: ['terms-and-conditions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('terms_and_conditions')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as TermsVersion[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      let pdfUrl = data.pdf_url;

      // Upload PDF if file selected
      if (data.pdf_file) {
        const fileExt = data.pdf_file.name.split('.').pop();
        const fileName = `${Date.now()}-v${data.version}.${fileExt}`;
        const { error: uploadError, data: uploadData } = await supabase.storage
          .from('terms-and-conditions')
          .upload(fileName, data.pdf_file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('terms-and-conditions')
          .getPublicUrl(fileName);
        
        pdfUrl = urlData.publicUrl;
      }

      // If setting as active, deactivate others
      if (data.is_active) {
        await supabase
          .from('terms_and_conditions')
          .update({ is_active: false })
          .eq('is_active', true);
      }

      const { error } = await supabase
        .from('terms_and_conditions')
        .insert({
          version: data.version,
          content: data.content,
          pdf_url: pdfUrl,
          effective_date: data.effective_date,
          is_active: data.is_active,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['terms-and-conditions'] });
      toast.success('Terms and conditions created successfully');
      setDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error('Failed to create terms and conditions: ' + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      let pdfUrl = data.pdf_url;

      // Upload new PDF if file selected
      if (data.pdf_file) {
        const fileExt = data.pdf_file.name.split('.').pop();
        const fileName = `${Date.now()}-v${data.version}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('terms-and-conditions')
          .upload(fileName, data.pdf_file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('terms-and-conditions')
          .getPublicUrl(fileName);
        
        pdfUrl = urlData.publicUrl;
      }

      // If setting as active, deactivate others
      if (data.is_active) {
        await supabase
          .from('terms_and_conditions')
          .update({ is_active: false })
          .eq('is_active', true)
          .neq('id', id);
      }

      const { error } = await supabase
        .from('terms_and_conditions')
        .update({
          version: data.version,
          content: data.content,
          pdf_url: pdfUrl,
          effective_date: data.effective_date,
          is_active: data.is_active,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['terms-and-conditions'] });
      toast.success('Terms and conditions updated successfully');
      setDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error('Failed to update terms and conditions: ' + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('terms_and_conditions')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['terms-and-conditions'] });
      toast.success('Terms and conditions deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete terms and conditions: ' + error.message);
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      if (is_active) {
        await supabase
          .from('terms_and_conditions')
          .update({ is_active: false })
          .eq('is_active', true)
          .neq('id', id);
      }

      const { error } = await supabase
        .from('terms_and_conditions')
        .update({ is_active })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['terms-and-conditions'] });
      toast.success('Active status updated');
    },
    onError: (error) => {
      toast.error('Failed to update status: ' + error.message);
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        toast.error('Please upload a PDF file');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB');
        return;
      }
      setFormData({ ...formData, pdf_file: file });
    }
  };

  const handleExtractText = async () => {
    if (!formData.pdf_file) {
      toast.error('Please upload a PDF file first');
      return;
    }

    setExtracting(true);
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('file', formData.pdf_file);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-tc-text`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: formDataToSend,
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to extract text');
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to extract text');
      }

      setFormData({ ...formData, content: data.text });
      toast.success('Text extracted successfully! You can now review and edit it.');
    } catch (error: any) {
      console.error('PDF extraction error:', error);
      toast.error('Failed to extract text: ' + error.message);
    } finally {
      setExtracting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      version: '',
      content: '',
      effective_date: new Date().toISOString().split('T')[0],
      is_active: false,
      pdf_file: null,
      pdf_url: null,
    });
    setEditingTerms(null);
  };

  const openEditDialog = (terms: TermsVersion) => {
    setEditingTerms(terms);
    setFormData({
      version: terms.version,
      content: terms.content,
      effective_date: terms.effective_date,
      is_active: terms.is_active,
      pdf_file: null,
      pdf_url: terms.pdf_url,
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.version || !formData.content) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (editingTerms) {
      updateMutation.mutate({ id: editingTerms.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Terms and Conditions Management</CardTitle>
            <CardDescription>
              Upload PDF files and manage inline text versions for your booking form
            </CardDescription>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create New Version
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : terms && terms.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Version</TableHead>
                <TableHead>Effective Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>PDF</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {terms.map((term) => (
                <TableRow key={term.id}>
                  <TableCell className="font-medium">{term.version}</TableCell>
                  <TableCell>{format(new Date(term.effective_date), 'PPP')}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={term.is_active}
                        onCheckedChange={(checked) =>
                          toggleActiveMutation.mutate({ id: term.id, is_active: checked })
                        }
                      />
                      {term.is_active && <Badge>Active</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>
                    {term.pdf_url ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                      >
                        <a href={term.pdf_url} target="_blank" rel="noopener noreferrer">
                          <Download className="h-4 w-4 mr-1" />
                          PDF
                        </a>
                      </Button>
                    ) : (
                      <span className="text-sm text-muted-foreground">No PDF</span>
                    )}
                  </TableCell>
                  <TableCell>{format(new Date(term.created_at), 'PPP')}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setPreviewTerms(term);
                          setPreviewOpen(true);
                        }}
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(term)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this version?')) {
                            deleteMutation.mutate(term.id);
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
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No terms and conditions versions found. Create one to get started.
          </div>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingTerms ? 'Edit Terms and Conditions' : 'Create New Terms and Conditions'}
              </DialogTitle>
              <DialogDescription>
                Upload a PDF and extract text for inline display, or enter content manually
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="version">Version *</Label>
                  <Input
                    id="version"
                    placeholder="e.g., 1.0, 2.0"
                    value={formData.version}
                    onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="effective_date">Effective Date *</Label>
                  <Input
                    id="effective_date"
                    type="date"
                    value={formData.effective_date}
                    onChange={(e) => setFormData({ ...formData, effective_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>PDF Upload</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileUpload}
                    className="flex-1"
                  />
                  {formData.pdf_file && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleExtractText}
                      disabled={extracting}
                    >
                      {extracting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Extracting...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Extract Text
                        </>
                      )}
                    </Button>
                  )}
                </div>
                {formData.pdf_url && !formData.pdf_file && (
                  <p className="text-sm text-muted-foreground">
                    Current PDF: <a href={formData.pdf_url} target="_blank" rel="noopener noreferrer" className="text-primary underline">View</a>
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">Content (Inline Text) *</Label>
                <Textarea
                  id="content"
                  placeholder="Enter or paste terms and conditions content..."
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  rows={12}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  This text will be displayed inline in the booking form. Line breaks will be preserved.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="is_active">Set as active version</Label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Preview Dialog */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Preview: Version {previewTerms?.version}</DialogTitle>
              <DialogDescription>
                This is how the terms will appear in the booking form
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {previewTerms?.pdf_url && (
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" asChild>
                    <a href={previewTerms.pdf_url} target="_blank" rel="noopener noreferrer">
                      <Download className="h-4 w-4 mr-2" />
                      Download PDF
                    </a>
                  </Button>
                </div>
              )}
              <div className="border rounded-lg p-4 bg-muted/30 max-h-96 overflow-y-auto">
                <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                  {previewTerms?.content}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
