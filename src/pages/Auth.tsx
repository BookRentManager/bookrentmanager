import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Car } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import bookRentManagerLogo from "@/assets/bookrentmanager-logo-new.webp";
import { InstallPrompt } from "@/components/InstallPrompt";

const authSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
});

const signUpSchema = authSchema.extend({
  humanVerification: z.boolean().refine(val => val === true, {
    message: "Please confirm you are human",
  }),
});

export default function Auth() {
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [isHumanVerified, setIsHumanVerified] = useState(false);
  const [stayLoggedIn, setStayLoggedIn] = useState(true);
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();


  // Check if this is a password reset flow - detect from URL hash
  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const type = hashParams.get('type');
    const accessToken = hashParams.get('access_token');
    
    if (type === 'recovery' && accessToken) {
      console.log("Recovery flow detected from URL hash");
      setShowResetPassword(true);
    }
  }, []);

  // Listen for PASSWORD_RECOVERY event from Supabase
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      console.log("Auth event:", event);
      if (event === 'PASSWORD_RECOVERY') {
        console.log("Password recovery event detected");
        setShowResetPassword(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Redirect if already authenticated (but not during password reset)
  if (user && !showResetPassword) {
    navigate("/");
    return null;
  }

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const validation = authSchema.safeParse({ email, password });
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      setIsLoading(false);
      return;
    }

    const { error } = await signIn(email, password);

    if (error) {
      toast.error(error.message || "Failed to sign in");
    } else {
      // Store persistence preference
      localStorage.setItem('stayLoggedIn', stayLoggedIn ? 'true' : 'false');
      toast.success("Welcome back!");
      navigate("/");
    }

    setIsLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const validation = signUpSchema.safeParse({ 
      email, 
      password,
      humanVerification: isHumanVerified 
    });
    
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      setIsLoading(false);
      return;
    }

    // Additional spam prevention: check email format for common spam patterns
    const suspiciousPatterns = [
      /^[a-z]{20,}@/i, // Very long random strings
      /\d{10,}@/, // Too many consecutive numbers
      /(.)\1{5,}/, // Repeated characters (6+ times)
    ];
    
    if (suspiciousPatterns.some(pattern => pattern.test(email))) {
      toast.error("Invalid email format detected");
      setIsLoading(false);
      return;
    }

    // Check if email is authorized to sign up
    const isKingRentEmail = email.toLowerCase().endsWith('@kingrent.com');

    if (!isKingRentEmail) {
      // Check if email is in whitelist
      const { data: whitelistCheck, error: whitelistError } = await supabase
        .from('whitelisted_emails')
        .select('email')
        .eq('email', email.toLowerCase().trim())
        .single();
      
      if (whitelistError || !whitelistCheck) {
        toast.error("Registration is restricted to authorized users only. Please contact your administrator.");
        setIsLoading(false);
        return;
      }
    }

    const { error } = await signUp(email, password);

    if (error) {
      if (error.message?.includes("already registered")) {
        toast.error("This email is already registered. Please sign in instead.");
      } else {
        toast.error(error.message || "Failed to create account");
      }
    } else {
      toast.success("Account created successfully!");
      setIsHumanVerified(false); // Reset for next signup
      navigate("/");
    }

    setIsLoading(false);
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const emailValidation = z.string().email().safeParse(resetEmail);
    if (!emailValidation.success) {
      toast.error("Please enter a valid email address");
      setIsLoading(false);
      return;
    }

    const { data, error } = await supabase.functions.invoke('trigger-password-reset', {
      body: { email: resetEmail }
    });

    if (error) {
      toast.error(error.message || "Failed to send reset email");
    } else {
      toast.success("Password reset email sent! Check your inbox.");
      setShowForgotPassword(false);
      setResetEmail("");
    }

    setIsLoading(false);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      setIsLoading(false);
      return;
    }

    if (newPassword !== confirmNewPassword) {
      toast.error("Passwords do not match");
      setIsLoading(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      toast.error(error.message || "Failed to update password");
    } else {
      toast.success("Password updated successfully!");
      navigate("/");
    }

    setIsLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-luxury p-4 sm:p-6 py-6 sm:py-4">
      <Card className="w-full max-w-md shadow-luxury">
        <CardHeader className="space-y-1 text-center pb-4 sm:pb-6 pt-6 sm:pt-8">
          <div className="flex justify-center mb-0">
            <img 
              src={bookRentManagerLogo} 
              alt="BookRentManager Platform" 
              width="475"
              height="180"
              className="h-auto w-full max-w-[200px] sm:max-w-md object-contain"
            />
          </div>
          <CardDescription className="text-base">Professional Luxury Car Rental Management</CardDescription>
        </CardHeader>
        <CardContent>
          {showResetPassword ? (
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="new-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Updating..." : "Update Password"}
              </Button>
            </form>
          ) : showForgotPassword ? (
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email">Email</Label>
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="Enter your email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="email"
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Sending..." : "Send Reset Link"}
              </Button>
              <Button 
                type="button" 
                variant="ghost" 
                className="w-full" 
                onClick={() => setShowForgotPassword(false)}
                disabled={isLoading}
              >
                Back to Sign In
              </Button>
            </form>
          ) : (
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>
              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      name="email"
                      type="email"
                      placeholder="your.email@example.com"
                      required
                      disabled={isLoading}
                      autoComplete="email"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="signin-password">Password</Label>
                      <Button
                        type="button"
                        variant="link"
                        className="h-auto p-0 text-xs"
                        onClick={() => setShowForgotPassword(true)}
                      >
                        Forgot password?
                      </Button>
                    </div>
                    <Input
                      id="signin-password"
                      name="password"
                      type="password"
                      required
                      disabled={isLoading}
                      autoComplete="current-password"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="stay-logged-in" 
                      checked={stayLoggedIn}
                      onCheckedChange={(checked) => setStayLoggedIn(checked === true)}
                      disabled={isLoading}
                    />
                    <Label 
                      htmlFor="stay-logged-in" 
                      className="text-sm font-normal cursor-pointer"
                    >
                      Stay logged in
                    </Label>
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Signing in..." : "Sign In"}
                  </Button>
                </form>
              </TabsContent>
              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      name="email"
                      type="email"
                      placeholder="you@example.com"
                      required
                      disabled={isLoading}
                      autoComplete="email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      name="password"
                      type="password"
                      placeholder="Minimum 6 characters"
                      required
                      disabled={isLoading}
                      autoComplete="new-password"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="human-verification" 
                      checked={isHumanVerified}
                      onCheckedChange={(checked) => setIsHumanVerified(checked === true)}
                      disabled={isLoading}
                    />
                    <Label 
                      htmlFor="human-verification" 
                      className="text-sm font-normal cursor-pointer"
                    >
                      I am a human, not a bot
                    </Label>
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={isLoading || !isHumanVerified}
                  >
                    {isLoading ? "Creating account..." : "Create Account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
        <CardFooter>
          <div className="text-xs text-muted-foreground text-center w-full">
            Auto-confirm is enabled - accounts are instantly active
          </div>
        </CardFooter>
      </Card>
      <InstallPrompt />
    </div>
  );
}
