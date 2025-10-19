import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import { AppLayout } from "./components/layout/AppLayout";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Skeleton } from "@/components/ui/skeleton";

// Eager load main pages
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Bookings from "./pages/Bookings";
import BookingDetail from "./pages/BookingDetail";
import Fines from "./pages/Fines";
import Invoices from "./pages/Invoices";
import Settings from "./pages/Settings";
import Integrations from "./pages/Integrations";
import EmailImports from "./pages/EmailImports";
import Trash from "./pages/Trash";
import UserSettings from "./pages/UserSettings";

// Lazy load secondary pages
const Reports = lazy(() => import("./pages/Reports"));
const IssueReports = lazy(() => import("./pages/IssueReports"));
const NotFound = lazy(() => import("./pages/NotFound"));
const BookingForm = lazy(() => import("./pages/BookingForm"));
const PaymentConfirmation = lazy(() => import("./pages/PaymentConfirmation"));
const EmailPreview = lazy(() => import("./pages/EmailPreview"));
const PostFinanceCheckout = lazy(() => import("./pages/PostFinanceCheckout"));
const TestingUtility = lazy(() => import("./pages/TestingUtility"));

const LoadingFallback = () => (
  <div className="p-6 space-y-4">
    <Skeleton className="h-8 w-48" />
    <Skeleton className="h-4 w-64" />
    <div className="grid gap-4 md:grid-cols-3">
      <Skeleton className="h-32" />
      <Skeleton className="h-32" />
      <Skeleton className="h-32" />
    </div>
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingFallback />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route 
                path="/booking-form/:token" 
                element={
                  <Suspense fallback={<LoadingFallback />}>
                    <BookingForm />
                  </Suspense>
                } 
              />
              <Route 
                path="/payment/confirmation" 
                element={
                  <Suspense fallback={<LoadingFallback />}>
                    <PaymentConfirmation />
                  </Suspense>
                } 
              />
              <Route 
                path="/email-preview" 
                element={
                  <Suspense fallback={<LoadingFallback />}>
                    <EmailPreview />
                  </Suspense>
                } 
              />
              <Route 
                path="/payment/checkout" 
                element={
                  <Suspense fallback={<LoadingFallback />}>
                    <PostFinanceCheckout />
                  </Suspense>
                } 
              />
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Suspense fallback={<LoadingFallback />}>
                        <Routes>
                          <Route path="/" element={<Dashboard />} />
                          <Route path="/bookings" element={<Bookings />} />
                          <Route path="/bookings/:id" element={<BookingDetail />} />
                          <Route path="/fines" element={<Fines />} />
                          <Route path="/invoices" element={<Invoices />} />
                          <Route path="/reports/*" element={<Reports />} />
                          <Route path="/trash" element={<Trash />} />
                          <Route path="/settings" element={<Settings />} />
                          <Route path="/settings/profile" element={<UserSettings />} />
                          <Route path="/integrations" element={<Integrations />} />
                          <Route path="/email-imports" element={<EmailImports />} />
                          <Route path="/issues" element={<IssueReports />} />
                          <Route path="/testing" element={<TestingUtility />} />
                          <Route path="*" element={<NotFound />} />
                        </Routes>
                      </Suspense>
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
