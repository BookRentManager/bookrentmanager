import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { FileText, Camera, Receipt, Link2, Loader2, Eye, Copy, FileUp, Image as ImageIcon, Trash2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ContractCard } from "./ContractCard";
import { useUserViewScope } from "@/hooks/useUserViewScope";

interface RentalManagementProps {
  bookingId: string;
}

export function RentalManagement({ bookingId }: RentalManagementProps) {
  const queryClient = useQueryClient();
  const { isReadOnly } = useUserViewScope();
  const [generateLinkOpen, setGenerateLinkOpen] = useState(false);
  const [linkPurpose, setLinkPurpose] = useState("");
  const [linkExpiry, setLinkExpiry] = useState("24");
  const [generatingLink, setGeneratingLink] = useState(false);
  const [generatedLink, setGeneratedLink] = useState("");

  // Upload states for photos
  const [uploadingDeliveryPhotos, setUploadingDeliveryPhotos] = useState(false);
  const [uploadingCollectionPhotos, setUploadingCollectionPhotos] = useState(false);
  
  // Photo viewing state
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);
  
  // Refs for photo upload inputs
  const deliveryFileRef = useRef<HTMLInputElement>(null);
  const deliveryCameraRef = useRef<HTMLInputElement>(null);
  const deliveryGalleryRef = useRef<HTMLInputElement>(null);
  const collectionFileRef = useRef<HTMLInputElement>(null);
  const collectionCameraRef = useRef<HTMLInputElement>(null);
  const collectionGalleryRef = useRef<HTMLInputElement>(null);

  const { data: documents } = useQuery({
    queryKey: ["booking-documents-rental", bookingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_documents")
        .select("*")
        .eq("booking_id", bookingId)
        .in("document_type", [
          'rental_contract_delivery',
          'rental_contract_collection',
          'car_condition_delivery_photo',
          'car_condition_delivery_video',
          'car_condition_collection_photo',
          'car_condition_collection_video',
          'extra_cost_invoice',
          'damage_quote'
        ])
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: accessTokens } = useQuery({
    queryKey: ["booking-access-tokens", bookingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_access_tokens")
        .select("*")
        .eq("booking_id", bookingId)
        .eq("permission_level", "delivery_driver_edit")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: booking } = useQuery({
    queryKey: ["booking-rental-access", bookingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("reference_code")
        .eq("id", bookingId)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const handleGenerateLink = async () => {
    if (!linkPurpose) {
      toast.error("Please enter a purpose for the link");
      return;
    }

    setGeneratingLink(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "generate-delivery-driver-link",
        {
          body: {
            booking_id: bookingId,
            purpose: linkPurpose,
            expires_in_hours: parseInt(linkExpiry),
          },
        }
      );

      if (error) throw error;
      
      setGeneratedLink(data.link);
      queryClient.invalidateQueries({ queryKey: ["booking-access-tokens", bookingId] });
      toast.success("Delivery driver link generated");
    } catch (error: any) {
      toast.error(`Failed to generate link: ${error.message}`);
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast.success("Link copied to clipboard");
  };

  const handleFileUpload = async (
    file: File,
    documentType: string,
    setUploading: (loading: boolean) => void
  ) => {
    const maxSize = 50 * 1024 * 1024; // 50MB max
    
    if (file.size > maxSize) {
      toast.error("File too large. Maximum 50MB");
      return;
    }

    setUploading(true);
    try {
      // Get the access token for this booking
      const { data: tokenData } = await supabase
        .from("booking_access_tokens")
        .select("token")
        .eq("booking_id", bookingId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!tokenData?.token) {
        throw new Error("No access token found for this booking");
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("document_type", documentType);
      formData.append("booking_token", tokenData.token);

      const { error } = await supabase.functions.invoke("upload-client-document", {
        body: formData,
      });

      if (error) throw error;

      toast.success("Document uploaded successfully");
      queryClient.invalidateQueries({ queryKey: ["booking-documents-rental", bookingId] });
      queryClient.invalidateQueries({ queryKey: ["booking", bookingId] });
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Failed to upload document");
    } finally {
      setUploading(false);
    }
  };

  const handlePhotoUpload = async (files: FileList | null, type: 'delivery' | 'collection') => {
    if (!files || files.length === 0) return;
    
    const filesArray = Array.from(files);
    const existingPhotos = type === 'delivery' ? deliveryPhotos : collectionPhotos;
    const setUploading = type === 'delivery' ? setUploadingDeliveryPhotos : setUploadingCollectionPhotos;
    const documentType = type === 'delivery' ? 'car_condition_delivery_photo' : 'car_condition_collection_photo';
    
    if (existingPhotos.length + filesArray.length > 10) {
      toast.error("Maximum 10 photos allowed");
      return;
    }

    const maxSize = 10 * 1024 * 1024; // 10MB per image
    const oversizedFiles = filesArray.filter(f => f.size > maxSize);
    if (oversizedFiles.length > 0) {
      toast.error("Some files are too large. Maximum 10MB per photo");
      return;
    }

    setUploading(true);
    try {
      // Get the access token for this booking
      const { data: tokenData } = await supabase
        .from("booking_access_tokens")
        .select("token")
        .eq("booking_id", bookingId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!tokenData?.token) {
        throw new Error("No access token found for this booking");
      }

      for (const file of filesArray) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("document_type", documentType);
        formData.append("booking_token", tokenData.token);

        const { error } = await supabase.functions.invoke("upload-client-document", {
          body: formData,
        });

        if (error) throw error;
      }

      toast.success(`${filesArray.length} photo(s) uploaded successfully`);
      queryClient.invalidateQueries({ queryKey: ["booking-documents-rental", bookingId] });
      queryClient.invalidateQueries({ queryKey: ["booking", bookingId] });
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Failed to upload photos");
    } finally {
      setUploading(false);
    }
  };

  const handleViewPhoto = async (filePath: string) => {
    setViewingPhoto(filePath);
    try {
      // Generate a signed URL for the private file
      const { data, error } = await supabase.storage
        .from('client-documents')
        .createSignedUrl(filePath, 3600); // 1 hour expiry

      if (error) throw error;
      
      // Open in new tab
      window.open(data.signedUrl, '_blank');
    } catch (error: any) {
      console.error('View error:', error);
      toast.error('Failed to open photo');
    } finally {
      setViewingPhoto(null);
    }
  };

  const deliveryContract = documents?.find(d => d.document_type === 'rental_contract_delivery');
  const collectionContract = documents?.find(d => d.document_type === 'rental_contract_collection');
  
  const deliveryPhotos = documents?.filter(d => d.document_type === 'car_condition_delivery_photo') || [];
  const collectionPhotos = documents?.filter(d => d.document_type === 'car_condition_collection_photo') || [];
  
  const extraCostDocs = documents?.filter(d => 
    (d.document_type === 'extra_cost_invoice' || d.document_type === 'damage_quote') && 
    d.extra_cost_amount
  ) || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rental Management</CardTitle>
        <CardDescription>
          Manage contracts, car condition documentation, extra costs, and delivery driver access
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="contracts" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="contracts" className="gap-1 sm:gap-2 px-1 sm:px-3">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Contracts</span>
            </TabsTrigger>
            <TabsTrigger value="condition" className="gap-1 sm:gap-2 px-1 sm:px-3">
              <Camera className="h-4 w-4" />
              <span className="hidden sm:inline">Car Condition</span>
            </TabsTrigger>
            <TabsTrigger value="extra-costs" className="gap-1 sm:gap-2 px-1 sm:px-3">
              <Receipt className="h-4 w-4" />
              <span className="hidden sm:inline">Extra Costs</span>
            </TabsTrigger>
            <TabsTrigger value="driver-links" className="gap-1 sm:gap-2 px-1 sm:px-3">
              <Link2 className="h-4 w-4" />
              <span className="hidden sm:inline">Driver Links</span>
            </TabsTrigger>
          </TabsList>

          {/* Contracts Tab */}
          <TabsContent value="contracts" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ContractCard
                bookingId={bookingId}
                title="Delivery Contract"
                documentType="rental_contract_delivery"
                existingContract={deliveryContract}
                onUploadSuccess={() => {
                  queryClient.invalidateQueries({ queryKey: ["booking-documents-rental", bookingId] });
                  queryClient.invalidateQueries({ queryKey: ["booking", bookingId] });
                }}
              />
              <ContractCard
                bookingId={bookingId}
                title="Collection Contract"
                documentType="rental_contract_collection"
                existingContract={collectionContract}
                onUploadSuccess={() => {
                  queryClient.invalidateQueries({ queryKey: ["booking-documents-rental", bookingId] });
                  queryClient.invalidateQueries({ queryKey: ["booking", bookingId] });
                }}
              />
            </div>
          </TabsContent>

          {/* Car Condition Tab */}
          <TabsContent value="condition" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Before Delivery</CardTitle>
                  <CardDescription>
                    Photos: {deliveryPhotos.length}/10
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Hidden file inputs */}
                  <input
                    ref={deliveryFileRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => handlePhotoUpload(e.target.files, 'delivery')}
                    className="hidden"
                  />
                  <input
                    ref={deliveryCameraRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => handlePhotoUpload(e.target.files, 'delivery')}
                    className="hidden"
                  />
                  <input
                    ref={deliveryGalleryRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => handlePhotoUpload(e.target.files, 'delivery')}
                    className="hidden"
                  />

                  {uploadingDeliveryPhotos ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Uploading photos...</span>
                    </div>
                  ) : !isReadOnly ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <Button
                        variant="outline"
                        onClick={() => deliveryFileRef.current?.click()}
                        disabled={deliveryPhotos.length >= 10}
                        className="flex items-center gap-2"
                      >
                        <FileUp className="h-4 w-4" />
                        Choose Files
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => deliveryCameraRef.current?.click()}
                        disabled={deliveryPhotos.length >= 10}
                        className="flex items-center gap-2"
                      >
                        <Camera className="h-4 w-4" />
                        Take Photo
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => deliveryGalleryRef.current?.click()}
                        disabled={deliveryPhotos.length >= 10}
                        className="flex items-center gap-2"
                      >
                        <ImageIcon className="h-4 w-4" />
                        Gallery
                      </Button>
                    </div>
                  ) : null}
                  
                  {deliveryPhotos.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {deliveryPhotos.map((photo) => (
                        <button
                          key={photo.id}
                          onClick={() => handleViewPhoto(photo.file_path)}
                          disabled={viewingPhoto === photo.file_path}
                          className="block relative group"
                        >
                          {viewingPhoto === photo.file_path ? (
                            <div className="w-full h-24 flex items-center justify-center bg-muted rounded border">
                              <Loader2 className="h-4 w-4 animate-spin" />
                            </div>
                          ) : (
                            <>
                              <div className="w-full h-24 flex items-center justify-center bg-muted rounded border hover:opacity-75 transition-opacity">
                                <ImageIcon className="h-6 w-6 text-muted-foreground" />
                              </div>
                              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 rounded">
                                <Eye className="h-5 w-5 text-white" />
                              </div>
                            </>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">After Collection</CardTitle>
                  <CardDescription>
                    Photos: {collectionPhotos.length}/10
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Hidden file inputs */}
                  <input
                    ref={collectionFileRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => handlePhotoUpload(e.target.files, 'collection')}
                    className="hidden"
                  />
                  <input
                    ref={collectionCameraRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => handlePhotoUpload(e.target.files, 'collection')}
                    className="hidden"
                  />
                  <input
                    ref={collectionGalleryRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => handlePhotoUpload(e.target.files, 'collection')}
                    className="hidden"
                  />

                  {uploadingCollectionPhotos ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Uploading photos...</span>
                    </div>
                  ) : !isReadOnly ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <Button
                        variant="outline"
                        onClick={() => collectionFileRef.current?.click()}
                        disabled={collectionPhotos.length >= 10}
                        className="flex items-center gap-2"
                      >
                        <FileUp className="h-4 w-4" />
                        Choose Files
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => collectionCameraRef.current?.click()}
                        disabled={collectionPhotos.length >= 10}
                        className="flex items-center gap-2"
                      >
                        <Camera className="h-4 w-4" />
                        Take Photo
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => collectionGalleryRef.current?.click()}
                        disabled={collectionPhotos.length >= 10}
                        className="flex items-center gap-2"
                      >
                        <ImageIcon className="h-4 w-4" />
                        Gallery
                      </Button>
                    </div>
                  ) : null}
                  
                  {collectionPhotos.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {collectionPhotos.map((photo) => (
                        <button
                          key={photo.id}
                          onClick={() => handleViewPhoto(photo.file_path)}
                          disabled={viewingPhoto === photo.file_path}
                          className="block relative group"
                        >
                          {viewingPhoto === photo.file_path ? (
                            <div className="w-full h-24 flex items-center justify-center bg-muted rounded border">
                              <Loader2 className="h-4 w-4 animate-spin" />
                            </div>
                          ) : (
                            <>
                              <div className="w-full h-24 flex items-center justify-center bg-muted rounded border hover:opacity-75 transition-opacity">
                                <ImageIcon className="h-6 w-6 text-muted-foreground" />
                              </div>
                              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 rounded">
                                <Eye className="h-5 w-5 text-white" />
                              </div>
                            </>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Extra Costs Tab */}
          <TabsContent value="extra-costs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Extra Costs</CardTitle>
                <CardDescription>
                  Upload invoices or quotes for extra costs (managed via Extras Document Upload in client portal)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {extraCostDocs.length > 0 ? (
                  <div className="space-y-3">
                    {extraCostDocs.map((doc) => (
                      <Card key={doc.id} className="border-l-4 border-l-orange-500">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="font-semibold text-lg">€{doc.extra_cost_amount}</p>
                              <p className="text-sm text-muted-foreground">{doc.extra_cost_notes || 'No notes'}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {format(new Date(doc.created_at), "PPp")}
                              </p>
                            </div>
                            <Button variant="outline" size="sm" asChild>
                              <a href={doc.file_path} target="_blank" rel="noopener noreferrer">
                                <Eye className="h-4 w-4 mr-2" />
                                View
                              </a>
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    No extra costs added yet. Extra costs can be uploaded via the client portal.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Driver Links Tab */}
          <TabsContent value="driver-links" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Generate Delivery Driver Link</CardTitle>
                <CardDescription>
                  Create a temporary access link for delivery drivers to upload car condition documentation
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!isReadOnly && (
                  <Dialog open={generateLinkOpen} onOpenChange={setGenerateLinkOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Link2 className="h-4 w-4 mr-2" />
                        Generate New Link
                      </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Generate Delivery Driver Link</DialogTitle>
                      <DialogDescription>
                        Create a temporary access link for delivery inspection
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="purpose">Purpose</Label>
                        <Input
                          id="purpose"
                          placeholder="e.g., Pickup Inspection, Return Inspection"
                          value={linkPurpose}
                          onChange={(e) => setLinkPurpose(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="expiry">Expires in (hours)</Label>
                        <Input
                          id="expiry"
                          type="number"
                          value={linkExpiry}
                          onChange={(e) => setLinkExpiry(e.target.value)}
                          min="1"
                          max="168"
                        />
                      </div>
                      
                      {generatedLink && (
                        <div className="p-3 bg-muted rounded-lg">
                          <Label className="text-xs">Generated Link</Label>
                          <div className="flex gap-2 mt-1">
                            <Input value={generatedLink} readOnly className="text-xs" />
                            <Button size="sm" onClick={() => handleCopyLink(generatedLink)}>
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                      
                      <Button
                        onClick={handleGenerateLink}
                        disabled={generatingLink || !linkPurpose}
                        className="w-full"
                      >
                        {generatingLink ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          "Generate Link"
                        )}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                )}

                {accessTokens && accessTokens.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-semibold">Active Driver Links ({accessTokens.length})</h4>
                    {accessTokens.map((token) => (
                      <Card key={token.id}>
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="font-medium">{token.description || "Delivery Driver Access"}</p>
                              <p className="text-sm text-muted-foreground">
                                Created: {format(new Date(token.created_at), "PPp")}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Expires: {format(new Date(token.expires_at), "PPp")}
                              </p>
                              <div className="flex gap-2 mt-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleCopyLink(`${window.location.origin}/client-portal/${token.token}`)}
                                >
                                  <Copy className="h-4 w-4 mr-2" />
                                  Copy Link
                                </Button>
                              </div>
                            </div>
                            <Badge variant={new Date(token.expires_at) > new Date() ? "default" : "destructive"}>
                              {new Date(token.expires_at) > new Date() ? "Active" : "Expired"}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
