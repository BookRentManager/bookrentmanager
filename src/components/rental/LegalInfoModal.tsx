import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { FileText, Shield, HelpCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import DOMPurify from "dompurify";
import { parseMarkdown } from "@/lib/utils";

interface Policy {
  id: string;
  policy_type: string;
  title: string;
  content: string;
  sort_order: number;
}

interface LegalInfoModalProps {
  type: 'cancellation' | 'insurance' | 'faq';
}

export function LegalInfoModal({ type }: LegalInfoModalProps) {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) {
      fetchPolicies();
    }
  }, [open, type]);

  const fetchPolicies = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('rental_policies')
        .select('*')
        .eq('policy_type', type)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setPolicies(data || []);
    } catch (error) {
      console.error('Error fetching policies:', error);
    } finally {
      setLoading(false);
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'cancellation':
        return <FileText className="h-4 w-4 mr-2" />;
      case 'insurance':
        return <Shield className="h-4 w-4 mr-2" />;
      case 'faq':
        return <HelpCircle className="h-4 w-4 mr-2" />;
    }
  };

  const getTitle = () => {
    switch (type) {
      case 'cancellation':
        return 'Cancellation Policy';
      case 'insurance':
        return 'Insurance Terms';
      case 'faq':
        return 'Frequently Asked Questions';
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          className="flex-1 min-w-[140px] h-auto py-3 px-4 border-2 border-king-gold/30 
                     hover:border-king-gold hover:bg-king-gold/5 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-king-gold/10 flex items-center justify-center 
                            group-hover:bg-king-gold/20 transition-colors">
              {getIcon()}
            </div>
            <div className="text-left">
              <p className="font-semibold text-sm">{getTitle()}</p>
              <p className="text-xs text-muted-foreground">Click to view</p>
            </div>
          </div>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            {getIcon()}
            {getTitle()}
          </DialogTitle>
          <DialogDescription>
            {type === 'faq' ? 'Find answers to common questions' : 'Please review the following information'}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">Loading...</div>
        ) : type === 'faq' ? (
          <Accordion type="single" collapsible className="w-full">
            {policies.map((policy, index) => (
              <AccordionItem key={policy.id} value={`item-${index}`}>
                <AccordionTrigger className="text-left">{policy.title}</AccordionTrigger>
                <AccordionContent>
                  <div 
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ 
                      __html: DOMPurify.sanitize(parseMarkdown(policy.content)) 
                    }}
                  />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        ) : (
          <div className="space-y-4">
            {policies.map((policy) => (
              <div key={policy.id} className="prose prose-sm max-w-none">
                <h3 className="text-base font-semibold">{policy.title}</h3>
                <div 
                  className="text-sm text-muted-foreground"
                  dangerouslySetInnerHTML={{ 
                    __html: DOMPurify.sanitize(parseMarkdown(policy.content)) 
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}