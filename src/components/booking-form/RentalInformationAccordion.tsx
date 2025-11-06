import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Truck, Navigation, Phone, XCircle, Shield, Info } from "lucide-react";

export function RentalInformationAccordion() {
  return (
    <Card className="bg-gradient-to-br from-king-gold/5 to-king-black/5 border-king-gold/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-king-gold">
          <Info className="h-5 w-5" />
          Rental Information
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="delivery">
            <AccordionTrigger className="hover:text-king-gold transition-colors">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-king-gold" />
                <span className="font-semibold">Delivery and Collection</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground leading-relaxed">
              The vehicle will be delivered and collected at no additional cost within the predefined delivery and collection locations. You can specify the exact location - hotel, address or the airport in the "pick up/drop off information" text fields above.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="gps">
            <AccordionTrigger className="hover:text-king-gold transition-colors">
              <div className="flex items-center gap-2">
                <Navigation className="h-4 w-4 text-king-gold" />
                <span className="font-semibold">GPS Navigation</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground leading-relaxed">
              It's hard to imagine traveling without GPS these days, but with King Rent, you're in good hands. Practically all of our cars are equipped with built-in GPS. In the rare case that they're not, we've got you covered with a complimentary portable device for Navigation.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="roadside">
            <AccordionTrigger className="hover:text-king-gold transition-colors">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-king-gold" />
                <span className="font-semibold">Roadside Assistance</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground leading-relaxed">
              Roadside assistance means you can feel safe and secure. In case of a problem or emergency you are just a phone call away from help; you can contact us anytime during your rental for assistance.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="cancellation">
            <AccordionTrigger className="hover:text-king-gold transition-colors">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-king-gold" />
                <span className="font-semibold">Cancellation Policy</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground leading-relaxed">
              If the booking is cancelled not later than 3 days (72 hours) before the rental date, we will only keep the down payment of 30% the rental amount, which cannot be refunded, but can be used for a future rental at anytime. If the booking is cancelled less than 3 days (72 hours) before the delivery date, the cancellation fee equals 100% of the down payment + 100% of the balance payment.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="insurance">
            <AccordionTrigger className="hover:text-king-gold transition-colors">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-king-gold" />
                <span className="font-semibold">Insurance Information</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground leading-relaxed space-y-4">
              <p>
                Your luxury car rental with King Rent is all about enjoying the journey worry-free. To ensure your peace of mind, we offer two essential insurance options: Collision Damage Waiver (CDW) and Third Party Liability.
              </p>
              
              <div>
                <h4 className="font-semibold text-foreground mb-2">Collision Damage Waiver (CDW):</h4>
                <p>
                  Functioning as Full Kasko Insurance with Deductible, CDW safeguards against financial liabilities for damage to the rented car. In the case of direct or indirect damages caused to the vehicle, the Customer is required to reimburse up to the maximum amount of the Excess Deductible indicated for each vehicle (insurance deductible for comprensive cover). Deductible amounts range from 2'000€ to 25'000€, depending on the rented vehicle. In the event of self-inflicted damage, you cover the deductible, while CDW handles exceeding costs or the car's total value. CDW, however, does not extend to damages resulting from intentional acts, negligence, or violations of rental terms.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-foreground mb-2">Third Party Liability:</h4>
                <p>
                  This coverage is pivotal, protecting against damages caused to others' property or injuries while operating the rented sports car. With no deductible, you remain unaccountable for damages to third parties. It encompasses property damage and medical expenses for affected parties in accidents where you are at fault. If the other party is at fault, their insurance should cover the costs with proper documentation.
                </p>
              </div>

              <p className="text-sm">
                Reviewing the rental agreement thoroughly is recommended, and deductible amounts on most cars can be reduced up to 50% with an extra fee. For inquiries or clarification on insurance options, our dedicated team is ready to assist throughout your exceptional sports car rental experience with King Rent.
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
