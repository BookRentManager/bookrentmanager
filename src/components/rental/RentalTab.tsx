import { RentalTimeline } from "./RentalTimeline";
import { RentalContractsSection } from "./RentalContractsSection";
import { DeliveryPreparationCard } from "./DeliveryPreparationCard";
import { CarConditionGallery } from "./CarConditionGallery";
import { ExtraCostsReviewSection } from "./ExtraCostsReviewSection";
import { LegalInfoModal } from "./LegalInfoModal";

interface RentalTabProps {
  booking: any;
  documents: any[];
  deliverySteps: any[];
  token: string;
  onUpdate: () => void;
}

export function RentalTab({ booking, documents, deliverySteps, token, onUpdate }: RentalTabProps) {
  // Separate documents by type
  const deliveryContract = documents.find(d => d.document_type === 'rental_contract_delivery');
  const collectionContract = documents.find(d => d.document_type === 'rental_contract_collection');
  
  const deliveryPhotos = documents.filter(d => d.document_type === 'car_condition_delivery_photo');
  const deliveryVideos = documents.filter(d => d.document_type === 'car_condition_delivery_video');
  const collectionPhotos = documents.filter(d => d.document_type === 'car_condition_collection_photo');
  const collectionVideos = documents.filter(d => d.document_type === 'car_condition_collection_video');
  
  const extraCostDocs = documents.filter(d => 
    (d.document_type === 'extra_cost_invoice' || d.document_type === 'damage_quote') && 
    d.extra_cost_amount
  );

  // Separate delivery steps
  const whatToBring = deliverySteps.filter(s => s.step_type === 'what_to_bring');
  const deliveryChecklist = deliverySteps.filter(s => s.step_type === 'delivery_checklist');

  // Map extra costs with approval status
  const extraCosts = extraCostDocs.map(doc => ({
    id: doc.id,
    extra_cost_amount: doc.extra_cost_amount,
    extra_cost_notes: doc.extra_cost_notes,
    document_url: doc.document_url,
    document_type: doc.document_type,
    uploaded_at: doc.uploaded_at,
    approval: doc.extra_cost_approval,
  }));

  return (
    <div className="space-y-6">
      {/* Visual Timeline */}
      <RentalTimeline booking={booking} />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          <RentalContractsSection
            deliveryContract={deliveryContract}
            collectionContract={collectionContract}
          />

          <DeliveryPreparationCard
            whatToBring={whatToBring}
            deliveryChecklist={deliveryChecklist}
          />
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <CarConditionGallery
            deliveryPhotos={deliveryPhotos}
            deliveryVideos={deliveryVideos}
            collectionPhotos={collectionPhotos}
            collectionVideos={collectionVideos}
            maxPhotos={10}
          />

          <ExtraCostsReviewSection
            extraCosts={extraCosts}
            token={token}
            bookingId={booking.id}
            onUpdate={onUpdate}
          />
        </div>
      </div>

      {/* Legal Information */}
      <div className="flex flex-wrap gap-3 pt-4 border-t">
        <LegalInfoModal type="cancellation" />
        <LegalInfoModal type="insurance" />
        <LegalInfoModal type="faq" />
      </div>
    </div>
  );
}