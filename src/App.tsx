import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AnimatedBackground from "@/components/ui/animated-background";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Channels from "./pages/Channels";
import Create from "./pages/Create";
import Deals from "./pages/Deals";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <div className="app-container">
          {/* Синий заголовок для отступа */}
          <div className="fixed top-0 left-0 right-0 h-8 z-50" style={{ backgroundColor: '#1484fb' }} />
          <AnimatedBackground />
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <div className="scrollable-content">
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/channels" element={<Channels />} />
                <Route path="/create" element={<Create />} />
                <Route path="/deals" element={<Deals />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </div>
          </BrowserRouter>
        </div>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
