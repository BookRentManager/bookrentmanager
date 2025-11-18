import { useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { XCircle } from "lucide-react";

const PostFinanceCheckout = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    // This page should not be used anymore with real PostFinance integration
    // Users are redirected directly to PostFinance's checkout page
    // If they land here, it means something went wrong
    
    if (!sessionId) {
      toast({
        title: "Invalid Payment Link",
        description: "No session ID provided. Please try again.",
        variant: "destructive",
      });
      navigate("/");
      return;
    }

    // Show error message - users should not see this page with real integration
    toast({
      title: "Redirecting...",
      description: "This page is no longer used. You should be on PostFinance's payment page.",
      variant: "destructive",
    });
    
    // Redirect to home after a moment
    setTimeout(() => {
      navigate("/");
    }, 3000);
  }, [sessionId, toast, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
              <XCircle className="w-8 h-8 text-destructive" />
            </div>
          </div>
          <CardTitle className="text-center text-2xl">Page Not Available</CardTitle>
          <CardDescription className="text-center">
            This checkout page is no longer used
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            Payment processing now happens directly on PostFinance's secure payment page.
            You should have been redirected there automatically.
          </p>
          <p className="text-sm text-muted-foreground text-center">
            If you're seeing this page, please contact support or try creating a new payment link.
          </p>
        </CardContent>

        <CardFooter>
          <Button
            onClick={() => navigate("/")}
            className="w-full"
            size="lg"
          >
            Return to Home
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default PostFinanceCheckout;
