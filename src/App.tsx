
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AuthPage } from "@/pages/AuthPage";
import { Dashboard } from "@/pages/Dashboard";
import { NewMeetingPage } from "@/pages/NewMeetingPage";
import { MeetingPage } from "@/pages/MeetingPage";
import { EnhancedMeetingPage } from "@/pages/EnhancedMeetingPage";
import { MeetingAnalyticsPage } from "@/pages/MeetingAnalyticsPage";
import Index from "./pages/Index";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <BrowserRouter>
          <Routes>
            <Route path="/welcome" element={<Index />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route 
              path="/" 
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/meeting/new" 
              element={
                <ProtectedRoute>
                  <NewMeetingPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/meeting/:id" 
              element={
                <ProtectedRoute>
                  <EnhancedMeetingPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/meeting/:id/analytics" 
              element={
                <ProtectedRoute>
                  <MeetingAnalyticsPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/meeting/:id/classic" 
              element={
                <ProtectedRoute>
                  <MeetingPage />
                </ProtectedRoute>
              } 
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
