import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AnimatedBackground from "@/components/ui/animated-background";
import { AuthProvider } from "@/contexts/AuthContext";
import { isTelegramMiniApp } from "@/lib/telegram";
import Index from "./pages/Index";
import Channels from "./pages/Channels";
import Create from "./pages/Create";
import Deals from "./pages/Deals";
import Profile from "./pages/Profile";
import Operator from "./pages/Operator";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  const [isTelegram, setIsTelegram] = useState(false);

  useEffect(() => {
    setIsTelegram(isTelegramMiniApp());
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <AnimatedBackground />
          <div className="app-container relative z-10">
            {/* Синий заголовок только для Telegram Mini App */}
            {isTelegram && (
              <div className="fixed top-0 left-0 right-0 h-10 z-50" style={{ backgroundColor: '#1484fb' }} />
            )}
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
                <Route path="/operator" element={<Operator />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </div>
          </BrowserRouter>
        </div>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
