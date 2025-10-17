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
              variant="outline"
              className="fixed bottom-[5.5rem] right-6 h-10 w-10 rounded-full shadow-lg z-40 hover:scale-110 transition-transform md:bottom-24 md:right-8"
            >
              <MessageCircleQuestion className="h-4 w-4" />
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
