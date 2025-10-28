import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Camera, Video, X } from "lucide-react";

interface MediaDocument {
  id: string;
  document_url: string;
  document_type: string;
  uploaded_at: string;
}

interface CarConditionGalleryProps {
  deliveryPhotos: MediaDocument[];
  deliveryVideos: MediaDocument[];
  collectionPhotos: MediaDocument[];
  collectionVideos: MediaDocument[];
  maxPhotos?: number;
}

export function CarConditionGallery({
  deliveryPhotos,
  deliveryVideos,
  collectionPhotos,
  collectionVideos,
  maxPhotos = 10,
}: CarConditionGalleryProps) {
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const MediaGrid = ({
    photos,
    videos,
    title,
    type,
  }: {
    photos: MediaDocument[];
    videos: MediaDocument[];
    title: string;
    type: 'delivery' | 'collection';
  }) => {
    const totalMedia = photos.length + videos.length;
    
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-sm">{title}</h4>
          <Badge variant="secondary" className="text-xs">
            {photos.length}/{maxPhotos} photos
            {videos.length > 0 && `, ${videos.length} video${videos.length > 1 ? 's' : ''}`}
          </Badge>
        </div>

        {totalMedia === 0 ? (
          <div className="bg-muted/50 rounded-lg p-6 text-center">
            <Camera className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              No photos uploaded yet
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {/* Photos */}
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="relative aspect-square rounded-lg overflow-hidden cursor-pointer group"
                onClick={() => setLightboxImage(photo.document_url)}
              >
                <img
                  src={photo.document_url}
                  alt="Car condition"
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <Camera className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            ))}

            {/* Videos */}
            {videos.map((video) => (
              <div
                key={video.id}
                className="relative aspect-square rounded-lg overflow-hidden"
              >
                <video
                  src={video.document_url}
                  className="w-full h-full object-cover"
                  controls
                />
                <div className="absolute top-2 right-2">
                  <Badge variant="default" className="bg-black/70 text-white">
                    <Video className="h-3 w-3 mr-1" />
                    Video
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Car Condition</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <MediaGrid
            photos={deliveryPhotos}
            videos={deliveryVideos}
            title="Before Delivery"
            type="delivery"
          />

          {(collectionPhotos.length > 0 || collectionVideos.length > 0) && (
            <>
              <div className="border-t pt-6" />
              <MediaGrid
                photos={collectionPhotos}
                videos={collectionVideos}
                title="After Collection"
                type="collection"
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Lightbox */}
      <Dialog open={!!lightboxImage} onOpenChange={() => setLightboxImage(null)}>
        <DialogContent className="max-w-4xl p-0">
          <div className="relative">
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute top-2 right-2 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
            {lightboxImage && (
              <img
                src={lightboxImage}
                alt="Car condition"
                className="w-full h-auto"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}