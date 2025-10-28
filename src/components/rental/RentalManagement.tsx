import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { FileText, Camera, Receipt, Link2, Upload, Loader2, Download, Eye, Copy } from "lucide-react";
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

interface RentalManagementProps {
  bookingId: string;
}

export function RentalManagement({ bookingId }: RentalManagementProps) {
  const queryClient = useQueryClient();
  const [generateLinkOpen, setGenerateLinkOpen] = useState(false);
  const [linkPurpose, setLinkPurpose] = useState("");
  const [linkExpiry, setLinkExpiry] = useState("24");
  const [generatingLink, setGeneratingLink] = useState(false);
  const [generatedLink, setGeneratedLink] = useState("");

  // Upload states for each document type
  const [uploadingDeliveryContract, setUploadingDeliveryContract] = useState(false);
  const [uploadingCollectionContract, setUploadingCollectionContract] = useState(false);
  const [uploadingDeliveryPhotos, setUploadingDeliveryPhotos] = useState(false);
  const [uploadingCollectionPhotos, setUploadingCollectionPhotos] = useState(false);

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
            <TabsTrigger value="contracts">
              <FileText className="h-4 w-4 mr-2" />
              Contracts
            </TabsTrigger>
            <TabsTrigger value="condition">
              <Camera className="h-4 w-4 mr-2" />
              Car Condition
            </TabsTrigger>
            <TabsTrigger value="extra-costs">
              <Receipt className="h-4 w-4 mr-2" />
              Extra Costs
            </TabsTrigger>
            <TabsTrigger value="driver-links">
              <Link2 className="h-4 w-4 mr-2" />
              Driver Links
            </TabsTrigger>
          </TabsList>

          {/* Contracts Tab */}
          <TabsContent value="contracts" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Delivery Contract</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {deliveryContract ? (
                    <div className="space-y-2">
                      <Badge variant="default" className="bg-success">Uploaded</Badge>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(deliveryContract.created_at), "PPp")}
                      </p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <a href={deliveryContract.file_path} target="_blank" rel="noopener noreferrer">
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </a>
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="delivery-contract">Upload Contract (PDF or Photo)</Label>
                      <Input
                        id="delivery-contract"
                        type="file"
                        accept=".pdf,image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file, 'rental_contract_delivery', setUploadingDeliveryContract);
                        }}
                        disabled={uploadingDeliveryContract}
                      />
                      {uploadingDeliveryContract && (
                        <p className="text-sm text-muted-foreground flex items-center">
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Uploading...
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Collection Contract</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {collectionContract ? (
                    <div className="space-y-2">
                      <Badge variant="default" className="bg-success">Uploaded</Badge>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(collectionContract.created_at), "PPp")}
                      </p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <a href={collectionContract.file_path} target="_blank" rel="noopener noreferrer">
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </a>
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="collection-contract">Upload Contract (PDF or Photo)</Label>
                      <Input
                        id="collection-contract"
                        type="file"
                        accept=".pdf,image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file, 'rental_contract_collection', setUploadingCollectionContract);
                        }}
                        disabled={uploadingCollectionContract}
                      />
                      {uploadingCollectionContract && (
                        <p className="text-sm text-muted-foreground flex items-center">
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Uploading...
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
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
                  <div>
                    <Label htmlFor="delivery-photos">Upload Photos (max 10)</Label>
                    <Input
                      id="delivery-photos"
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        if (deliveryPhotos.length + files.length > 10) {
                          toast.error("Maximum 10 photos allowed for delivery");
                          return;
                        }
                        files.forEach(file => handleFileUpload(file, 'car_condition_delivery_photo', setUploadingDeliveryPhotos));
                      }}
                      disabled={uploadingDeliveryPhotos || deliveryPhotos.length >= 10}
                    />
                    {uploadingDeliveryPhotos && (
                      <p className="text-sm text-muted-foreground flex items-center mt-2">
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </p>
                    )}
                  </div>
                  
                  {deliveryPhotos.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {deliveryPhotos.map((photo) => (
                        <a
                          key={photo.id}
                          href={photo.file_path}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block"
                        >
                          <img
                            src={photo.file_path}
                            alt="Delivery condition"
                            className="w-full h-24 object-cover rounded border hover:opacity-75 transition-opacity"
                          />
                        </a>
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
                  <div>
                    <Label htmlFor="collection-photos">Upload Photos (max 10)</Label>
                    <Input
                      id="collection-photos"
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        if (collectionPhotos.length + files.length > 10) {
                          toast.error("Maximum 10 photos allowed for collection");
                          return;
                        }
                        files.forEach(file => handleFileUpload(file, 'car_condition_collection_photo', setUploadingCollectionPhotos));
                      }}
                      disabled={uploadingCollectionPhotos || collectionPhotos.length >= 10}
                    />
                    {uploadingCollectionPhotos && (
                      <p className="text-sm text-muted-foreground flex items-center mt-2">
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </p>
                    )}
                  </div>
                  
                  {collectionPhotos.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {collectionPhotos.map((photo) => (
                        <a
                          key={photo.id}
                          href={photo.file_path}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block"
                        >
                          <img
                            src={photo.file_path}
                            alt="Collection condition"
                            className="w-full h-24 object-cover rounded border hover:opacity-75 transition-opacity"
                          />
                        </a>
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
