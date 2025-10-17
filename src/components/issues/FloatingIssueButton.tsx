import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageCircleQuestion } from "lucide-react";
import { ReportIssueDialog } from "./ReportIssueDialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function FloatingIssueButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={() => setIsOpen(true)}
              size="icon"
              className="fixed bottom-20 right-6 h-12 w-12 rounded-full shadow-lg z-40 hover:scale-110 transition-transform"
            >
              <MessageCircleQuestion className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>Report an Issue</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <ReportIssueDialog open={isOpen} onOpenChange={setIsOpen} />
    </>
  );
}
