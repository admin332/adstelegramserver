import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AnimatedBackground from "@/components/ui/animated-background";
import { AuthProvider } from "@/contexts/AuthContext";
import { isTelegramMiniApp, isMobilePlatform } from "@/lib/telegram";
import Index from "./pages/Index";
import Channels from "./pages/Channels";
import Channel from "./pages/Channel";
import ChannelSettings from "./pages/ChannelSettings";
import Create from "./pages/Create";
import Deals from "./pages/Deals";
import Profile from "./pages/Profile";
import Operator from "./pages/Operator";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  const [showTelegramHeader, setShowTelegramHeader] = useState(false);

  useEffect(() => {
    // Показываем шапку и отступ только для мобильных Telegram устройств
    setShowTelegramHeader(isTelegramMiniApp() && isMobilePlatform());
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <AnimatedBackground />
          <div className="app-container relative z-10" style={{ paddingTop: showTelegramHeader ? '2.5rem' : '0' }}>
            {/* Синий заголовок только для мобильного Telegram */}
            {showTelegramHeader && (
              <div className="fixed top-0 left-0 right-0 h-10 z-50" style={{ backgroundColor: '#1484fb' }} />
            )}
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <div className="scrollable-content">
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/channels" element={<Channels />} />
                <Route path="/channel/:id" element={<Channel />} />
                <Route path="/channel/:id/settings" element={<ChannelSettings />} />
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
